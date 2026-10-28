import { adminClient } from "@/lib/server/ct";
import type { CtRegistration } from "@/lib/crossTraining";
import { fail, NOT_READY, ok, readJson, str, UUID } from "../_shared";

export const dynamic = "force-dynamic";

/** Le participant annule lui-même son inscription (uniquement si elle n'est pas payée). */
export async function POST(req: Request) {
  const token = str((await readJson(req)).token, 40);
  if (!UUID.test(token)) return fail("Lien invalide.", 404);
  const admin = await adminClient();
  if (!admin) return fail(NOT_READY, 503);
  const { data: reg } = await admin.from("ct_registrations").select("*").eq("token", token).maybeSingle();
  if (!reg) return fail("Inscription introuvable.", 404);
  const r = reg as CtRegistration;
  if (r.status === "paye") return fail("Ta séance est déjà réglée : contacte le coach pour annuler.", 409);
  if (r.status === "annule") return ok({ ok: true });
  const { error } = await admin.from("ct_registrations").update({ status: "annule" }).eq("id", r.id).eq("status", "inscrit");
  if (error) return fail(NOT_READY, 503);
  return ok({ ok: true });
}
