import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { ClientShell } from "@/components/ClientShell";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mon espace" };

/** Espace personnel d'un client : vérification serveur du rôle. */
export default async function ClientSpaceLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (user.app_metadata?.role !== "client") redirect("/dashboard");

  const firstName = (user.user_metadata?.first_name as string | undefined) ?? "";
  return (
    <ClientShell firstName={firstName} email={user.email ?? ""}>
      {children}
    </ClientShell>
  );
}
