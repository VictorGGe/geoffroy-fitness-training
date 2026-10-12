import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";

export const dynamic = "force-dynamic";

/** Toutes les pages de ce groupe sont privées : vérification côté serveur. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return <AppShell email={user.email ?? ""}>{children}</AppShell>;
}
