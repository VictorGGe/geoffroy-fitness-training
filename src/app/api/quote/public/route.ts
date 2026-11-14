import { adminClient } from "@/lib/server/ct";
import { fail, NOT_READY, ok, UUID } from "@/app/api/ct/public/_shared";

export const dynamic = "force-dynamic";

/** Devis consultable avec son lien de signature (jeton secret) : uniquement ce devis. */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("t") ?? "";
  if (!UUID.test(token)) return fail("Lien invalide.", 404);
  const admin = await adminClient();
  if (!admin) return fail(NOT_READY, 503);
  const { data: q } = await admin
    .from("quotes")
    .select(
      "id, client_id, number, issued_on, valid_until, intro, client_email, client_phone, client_address, items, conditions, details, total, status, client_signature, client_signed_name, client_signed_at, coach_signature, coach_signed_at, created_at",
    )
    .eq("sign_token", token)
    .maybeSingle();
  if (!q) return fail("Devis introuvable.", 404);
  const { data: c } = await admin.from("clients").select("first_name, last_name").eq("id", q.client_id).single();
  return ok({ quote: { ...q, total: Number(q.total), invoice_id: null }, client: c ?? { first_name: "", last_name: "" } });
}
