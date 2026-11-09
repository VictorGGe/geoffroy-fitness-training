import { adminClient } from "@/lib/server/ct";
import { EMAIL_RE, samePhone } from "@/lib/crossTraining";
import { fail, NOT_READY, ok, readJson, str } from "../_shared";

export const dynamic = "force-dynamic";

/** Retrouver ses inscriptions à venir (email + téléphone utilisés à l'inscription). */
export async function POST(req: Request) {
  const b = await readJson(req);
  const email = str(b.email, 160).toLowerCase();
  const phone = str(b.phone, 30);
  if (!EMAIL_RE.test(email) || phone.replace(/\D/g, "").length < 9) return fail("Indique l'email et le téléphone utilisés à l'inscription.");
  const admin = await adminClient();
  if (!admin) return fail(NOT_READY, 503);
  const { data } = await admin
    .from("ct_registrations")
    .select("token, phone, status, ct_slots!inner(title, starts_at, status)")
    .ilike("email", email)
    .neq("status", "annule")
    .gte("ct_slots.starts_at", new Date(Date.now() - 3 * 3600000).toISOString())
    .limit(20);
  type Row = { token: string; phone: string; status: string; ct_slots: { title: string; starts_at: string; status: string } | { title: string; starts_at: string; status: string }[] };
  const list = ((data ?? []) as Row[])
    .filter((r) => samePhone(r.phone, phone))
    .map((r) => {
      const s = Array.isArray(r.ct_slots) ? r.ct_slots[0] : r.ct_slots;
      return { token: r.token, label: s.title, starts_at: s.starts_at, paid: r.status === "paye", cancelled: s.status === "annule" };
    })
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  return ok({ registrations: list });
}
