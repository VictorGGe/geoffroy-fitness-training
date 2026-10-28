import {
  activeCount,
  adminClient,
  coachEmail,
  mailCoachNew,
  mailRegistered,
  notifyPaymentOpen,
  originOf,
  personalLink,
  sendMail,
} from "@/lib/server/ct";
import { CONSENT_VERSION, CONSENTS, EMAIL_RE, validPhone, type CtRegistration, type CtSlot } from "@/lib/crossTraining";
import { fail, NOT_READY, ok, readJson, str, UUID } from "../_shared";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, [string, number]> = {
  CT_CLOSED: ["Ce créneau n'est plus disponible.", 409],
  CT_PAST: ["Ce créneau est déjà passé.", 409],
  CT_DUPLICATE: ["Tu es déjà inscrit(e) à ce créneau avec cette adresse email.", 409],
  CT_FULL: ["Désolé, ce créneau est complet.", 409],
};

export async function POST(req: Request) {
  const b = await readJson(req);
  // Piège à robots : champ invisible qui doit rester vide
  if (str(b.website, 200)) return ok({ ok: true });

  const slotId = str(b.slotId, 40);
  const first = str(b.firstName, 60);
  const last = str(b.lastName, 60);
  const email = str(b.email, 160).toLowerCase();
  const phone = str(b.phone, 30);
  const raw = (b.consents && typeof b.consents === "object" ? b.consents : {}) as Record<string, unknown>;

  if (!UUID.test(slotId)) return fail("Créneau invalide.");
  if (!first || !last) return fail("Indique ton prénom et ton nom.");
  if (!EMAIL_RE.test(email)) return fail("Adresse email invalide.");
  if (!validPhone(phone)) return fail("Numéro de téléphone invalide.");
  const missing = CONSENTS.filter((c) => c.required && raw[c.key] !== true);
  if (missing.length) return fail("Coche toutes les cases obligatoires pour valider ton inscription.");

  const admin = await adminClient();
  if (!admin) return fail(NOT_READY, 503);

  const consents: Record<string, unknown> = Object.fromEntries(CONSENTS.map((c) => [c.key, raw[c.key] === true]));
  consents.accepted_at = new Date().toISOString();
  consents.user_agent = (req.headers.get("user-agent") || "").slice(0, 200);

  const { data, error } = await admin.rpc("ct_register", {
    p_slot: slotId,
    p_first: first,
    p_last: last,
    p_email: email,
    p_phone: phone,
    p_consents: consents,
    p_version: CONSENT_VERSION,
  });
  if (error) {
    const code = Object.keys(ERRORS).find((k) => error.message.includes(k));
    if (code) return fail(ERRORS[code][0], ERRORS[code][1]);
    console.error("[ct] inscription", error.message);
    return fail(NOT_READY, 503);
  }
  const row = (Array.isArray(data) ? data[0] : data) as { registration_id: string; token: string; active_count: number };

  // Emails (n'empêchent jamais l'inscription s'ils échouent)
  const origin = originOf(req);
  const [{ data: slot }, { data: reg }] = await Promise.all([
    admin.from("ct_slots").select("*").eq("id", slotId).single(),
    admin.from("ct_registrations").select("*").eq("id", row.registration_id).single(),
  ]);
  if (slot && reg) {
    const s = slot as CtSlot;
    const r = reg as CtRegistration;
    const count = await activeCount(admin, s.id);
    const link = personalLink(origin, r.token);
    const m = mailRegistered(r, s, count, link);
    const sent = await sendMail(r.email, m.subject, m.html, m.text);
    if (sent && count >= s.min_people) {
      await admin.from("ct_registrations").update({ pay_notified_at: new Date().toISOString() }).eq("id", r.id);
    }
    await notifyPaymentOpen(admin, s, origin, r.id);
    const coach = coachEmail();
    if (coach) {
      const c = mailCoachNew(r, s, count, `${origin}/creneaux`);
      await sendMail(coach, c.subject, c.html, c.text);
    }
  }
  return ok({ token: row.token, count: row.active_count });
}
