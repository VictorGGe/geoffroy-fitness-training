import { activeCount, adminClient, createCheckout, originOf, personalLink, stripeKey } from "@/lib/server/ct";
import { fmtSlotFull, type CtRegistration, type CtSlot } from "@/lib/crossTraining";
import { fail, NOT_READY, ok, readJson, str, UUID } from "../_shared";

export const dynamic = "force-dynamic";

/** Ouvre la page de paiement par carte (seulement si le minimum d'inscrits est atteint). */
export async function POST(req: Request) {
  const token = str((await readJson(req)).token, 40);
  if (!UUID.test(token)) return fail("Lien invalide.", 404);
  if (!stripeKey()) return fail("Le paiement par carte n'est pas encore activé. Le coach te contactera pour le règlement.", 503);
  const admin = await adminClient();
  if (!admin) return fail(NOT_READY, 503);

  const { data: reg } = await admin.from("ct_registrations").select("*").eq("token", token).maybeSingle();
  if (!reg) return fail("Inscription introuvable.", 404);
  const r = reg as CtRegistration;
  if (r.status === "paye") return fail("Ta séance est déjà réglée.", 409);
  if (r.status === "annule") return fail("Cette inscription a été annulée.", 409);
  const { data: slot } = await admin.from("ct_slots").select("*").eq("id", r.slot_id).single();
  const s = slot as CtSlot | null;
  if (!s || s.status !== "ouvert") return fail("Ce créneau a été annulé.", 409);
  if (new Date(s.starts_at).getTime() < Date.now() - 3600000) return fail("Ce créneau est passé.", 409);
  const count = await activeCount(admin, s.id);
  if (count < s.min_people) {
    return fail(`Le paiement s'ouvrira dès que ${s.min_people} personnes seront inscrites (actuellement ${count}).`, 409);
  }

  const link = personalLink(originOf(req), r.token);
  try {
    const session = await createCheckout({
      amountCents: Math.round(Number(s.price) * 100),
      name: s.title,
      description: `${fmtSlotFull(s.starts_at, s.duration_min)}${s.location ? ` — ${s.location}` : ""} — ${r.first_name} ${r.last_name}`.slice(0, 300),
      email: r.email,
      registrationId: r.id,
      successUrl: `${link}&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: link,
    });
    await admin.from("ct_registrations").update({ stripe_session_id: session.id }).eq("id", r.id);
    if (!session.url) throw new Error("Lien de paiement manquant");
    return ok({ url: session.url });
  } catch (e) {
    console.error("[stripe] checkout", (e as Error).message);
    return fail("Le paiement n'a pas pu être ouvert. Réessaie dans un instant.", 502);
  }
}
