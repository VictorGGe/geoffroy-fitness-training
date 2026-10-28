import { activeCount, adminClient, stripeKey, syncStripePayment } from "@/lib/server/ct";
import type { CtRegistration, CtSlot } from "@/lib/crossTraining";
import { fail, NOT_READY, ok, UUID } from "../_shared";

export const dynamic = "force-dynamic";

/** Suivi d'une inscription grâce au lien personnel (jeton secret). */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const token = sp.get("t") ?? "";
  const sessionId = sp.get("session_id");
  if (!UUID.test(token)) return fail("Lien invalide.", 404);
  const admin = await adminClient();
  if (!admin) return fail(NOT_READY, 503);

  const { data: reg } = await admin.from("ct_registrations").select("*").eq("token", token).maybeSingle();
  if (!reg) return fail("Inscription introuvable.", 404);
  const { data: slot } = await admin.from("ct_slots").select("*").eq("id", reg.slot_id).single();
  if (!slot) return fail("Créneau introuvable.", 404);

  let r = reg as CtRegistration;
  const s = slot as CtSlot;
  // Retour de paiement (ou paiement commencé) : on vérifie directement auprès de Stripe
  if (r.status === "inscrit" && (sessionId || r.stripe_session_id)) {
    if (await syncStripePayment(admin, r, s, sessionId && /^cs_[\w]+$/.test(sessionId) ? sessionId : null)) {
      const { data: fresh } = await admin.from("ct_registrations").select("*").eq("id", r.id).single();
      if (fresh) r = fresh as CtRegistration;
    }
  }
  const count = await activeCount(admin, s.id);
  return ok({
    registration: {
      first_name: r.first_name,
      last_name: r.last_name,
      email: r.email,
      status: r.status,
      paid_at: r.paid_at,
      amount_paid: r.amount_paid,
    },
    slot: {
      title: s.title,
      starts_at: s.starts_at,
      duration_min: s.duration_min,
      location: s.location,
      price: Number(s.price),
      min_people: s.min_people,
      max_people: s.max_people,
      status: s.status,
    },
    count,
    cardPayment: !!stripeKey(),
  });
}
