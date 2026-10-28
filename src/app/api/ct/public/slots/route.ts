import { adminClient } from "@/lib/server/ct";
import type { PublicSlot } from "@/lib/crossTraining";
import { fail, NOT_READY, ok, UUID } from "../_shared";

export const dynamic = "force-dynamic";

/** Créneaux à venir (sans aucune donnée personnelle : seulement le nombre d'inscrits). */
export async function GET(req: Request) {
  const coach = new URL(req.url).searchParams.get("c");
  const admin = await adminClient();
  if (!admin) return fail(NOT_READY, 503);
  let q = admin
    .from("ct_slots")
    .select("id, title, starts_at, duration_min, location, price, min_people, max_people")
    .eq("status", "ouvert")
    .gt("starts_at", new Date().toISOString())
    .lt("starts_at", new Date(Date.now() + 60 * 86400000).toISOString())
    .order("starts_at")
    .limit(60);
  if (coach && UUID.test(coach)) q = q.eq("coach_id", coach);
  const { data, error } = await q;
  if (error) return fail(NOT_READY, 503);
  const ids = (data ?? []).map((s) => s.id);
  const counts = new Map<string, number>();
  if (ids.length) {
    const { data: regs } = await admin.from("ct_registrations").select("slot_id").in("slot_id", ids).neq("status", "annule");
    for (const r of regs ?? []) counts.set(r.slot_id, (counts.get(r.slot_id) ?? 0) + 1);
  }
  const slots: PublicSlot[] = (data ?? []).map((s) => ({ ...s, price: Number(s.price), count: counts.get(s.id) ?? 0 }));
  return ok({ slots });
}
