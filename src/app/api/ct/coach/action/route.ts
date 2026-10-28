import {
  activeCount,
  adminClient,
  currentCoach,
  mailCancelled,
  mailPaymentOpen,
  markPaid,
  originOf,
  personalLink,
  sendMail,
} from "@/lib/server/ct";
import type { CtRegistration, CtSlot } from "@/lib/crossTraining";
import { fail, ok, readJson, str, UUID } from "../../public/_shared";

export const dynamic = "force-dynamic";

/**
 * Actions du coach :
 *  - mark-paid      : paiement reçu en main propre / virement (+ facture dans Finances)
 *  - cancel-slot    : annule le créneau et prévient les inscrits par email
 *  - remind         : renvoie le lien de paiement aux inscrits qui n'ont pas encore payé
 */
export async function POST(req: Request) {
  const c = await currentCoach();
  if (!c) return fail("Réservé au coach.", 401);
  const b = await readJson(req);
  const action = str(b.action, 30);
  const admin = await adminClient();
  if (!admin) return fail("La clé SUPABASE_SERVICE_ROLE_KEY n'est pas configurée dans Vercel (voir /diagnostic).", 500);
  const origin = originOf(req);

  if (action === "mark-paid") {
    const id = str(b.registrationId, 40);
    if (!UUID.test(id)) return fail("Inscription invalide.");
    // RLS : ne renvoie la ligne que si elle appartient au coach connecté
    const { data: reg } = await c.sb.from("ct_registrations").select("*").eq("id", id).maybeSingle();
    if (!reg) return fail("Inscription introuvable.", 404);
    const { data: slot } = await c.sb.from("ct_slots").select("*").eq("id", reg.slot_id).single();
    if (!slot) return fail("Créneau introuvable.", 404);
    const amount = typeof b.amount === "number" && b.amount > 0 ? Math.round(b.amount * 100) / 100 : Number(slot.price);
    await markPaid(admin, reg as CtRegistration, slot as CtSlot, amount, "manuel");
    return ok({ ok: true });
  }

  const slotId = str(b.slotId, 40);
  if (!UUID.test(slotId)) return fail("Créneau invalide.");
  const { data: slotRow } = await c.sb.from("ct_slots").select("*").eq("id", slotId).maybeSingle();
  if (!slotRow) return fail("Créneau introuvable.", 404);
  const slot = slotRow as CtSlot;
  const { data: regRows } = await c.sb.from("ct_registrations").select("*").eq("slot_id", slotId).neq("status", "annule");
  const regs = (regRows ?? []) as CtRegistration[];

  if (action === "cancel-slot") {
    const { error } = await c.sb.from("ct_slots").update({ status: "annule" }).eq("id", slotId);
    if (error) return fail(error.message, 500);
    let notified = 0;
    for (const r of regs) {
      const m = mailCancelled(r, slot);
      if (await sendMail(r.email, m.subject, m.html, m.text)) notified++;
    }
    return ok({ notified, total: regs.length, paid: regs.filter((r) => r.status === "paye").length });
  }

  if (action === "remind") {
    const count = await activeCount(admin, slotId);
    if (count < slot.min_people) return fail(`Le minimum de ${slot.min_people} inscrits n'est pas encore atteint.`, 409);
    let notified = 0;
    for (const r of regs.filter((x) => x.status === "inscrit")) {
      const m = mailPaymentOpen(r, slot, count, personalLink(origin, r.token));
      if (await sendMail(r.email, m.subject, m.html, m.text)) {
        notified++;
        await admin.from("ct_registrations").update({ pay_notified_at: new Date().toISOString() }).eq("id", r.id);
      }
    }
    return ok({ notified });
  }

  return fail("Action inconnue.");
}
