import { adminClient, currentCoach, stripeKey, syncStripePayment } from "@/lib/server/ct";
import type { CtRegistration, CtSlot } from "@/lib/crossTraining";
import { fail, ok } from "../../public/_shared";

export const dynamic = "force-dynamic";

/** Vérifie auprès de Stripe les paiements commencés mais pas encore confirmés. */
export async function POST() {
  const c = await currentCoach();
  if (!c) return fail("Réservé au coach.", 401);
  if (!stripeKey()) return ok({ updated: 0 });
  const admin = await adminClient();
  if (!admin) return ok({ updated: 0 });
  const { data: regs } = await c.sb
    .from("ct_registrations")
    .select("*")
    .eq("status", "inscrit")
    .not("stripe_session_id", "is", null)
    .limit(50);
  let updated = 0;
  for (const r of (regs ?? []) as CtRegistration[]) {
    const { data: slot } = await c.sb.from("ct_slots").select("*").eq("id", r.slot_id).single();
    if (slot && (await syncStripePayment(admin, r, slot as CtSlot))) updated++;
  }
  return ok({ updated });
}
