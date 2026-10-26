"use client";

import { getSupabase } from "./supabase/client";
import { fmtPace, type Pt, type RunMode, type Split } from "./run";

export interface RunRow {
  id: string;
  client_id: string;
  workout_log_id: string | null;
  mode: RunMode;
  activity: "course" | "marche";
  started_at: string;
  duration_s: number;
  distance_m: number;
  calories: number | null;
  weight_kg: number | null;
  splits: Split[];
  route: Pt[][];
  feeling: number | null;
  note: string | null;
  incline_pct?: number | null;
}

export interface SaveRunInput {
  clientId: string;
  mode: RunMode;
  activity: "course" | "marche";
  startedAt: number;
  durationS: number;
  distanceM: number;
  calories: number | null;
  weightKg: number | null;
  splits: Split[];
  route: Pt[][];
  feeling: number | null;
  note: string | null;
  inclinePct?: number | null;
}

function localDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Enregistre la course :
 *  1. comme séance (historique + progression, visibles par le coach) ;
 *  2. avec ses détails (tracé, temps au km, calories) dans la table des courses.
 * Retourne un avertissement si seule la séance a pu être enregistrée.
 */
export async function saveRun(r: SaveRunInput): Promise<{ warning: string | null }> {
  const sb = getSupabase();
  const exName = r.mode === "tapis" ? "Tapis de course" : r.activity === "marche" ? "Marche" : "Course à pied";
  const { data: ex } = await sb.from("exercises").select("id, name").in("name", [exName, "Course à pied"]).limit(5);
  const exercise = (ex ?? []).find((e) => e.name === exName) ?? (ex ?? [])[0] ?? null;

  const km = Math.round(r.distanceM / 10) / 100;
  const pace = r.distanceM >= 50 ? r.durationS / (r.distanceM / 1000) : null;

  const log = await sb
    .from("workout_logs")
    .insert({ client_id: r.clientId, performed_on: localDate(r.startedAt), session_name: exName })
    .select("id")
    .single();
  if (log.error) throw log.error;

  const set = await sb.from("workout_sets").insert({
    workout_log_id: log.data.id,
    exercise_id: exercise?.id ?? null,
    exercise_name: exName,
    exercise_order: 0,
    set_number: 1,
    set_type: "travail",
    duration_seconds: Math.min(86400, Math.round(r.durationS)),
    distance_km: km > 0 ? Math.min(1000, km) : null,
    intensity: pace ? `Allure ${fmtPace(pace)} /km` : null,
    rpe: r.feeling,
    comment: [r.calories ? `${r.calories} kcal` : null, r.note].filter(Boolean).join(" · ").slice(0, 1000) || null,
    ...(r.inclinePct != null ? { incline_pct: r.inclinePct } : {}),
  });
  if (set.error) {
    await sb.from("workout_logs").delete().eq("id", log.data.id);
    throw set.error;
  }

  const run = await sb.from("runs").insert({
    client_id: r.clientId,
    workout_log_id: log.data.id,
    mode: r.mode,
    activity: r.activity,
    started_at: new Date(r.startedAt).toISOString(),
    duration_s: Math.max(1, Math.min(86400, Math.round(r.durationS))),
    distance_m: Math.round(r.distanceM),
    calories: r.calories,
    weight_kg: r.weightKg,
    splits: r.splits,
    route: r.route,
    feeling: r.feeling,
    note: r.note,
    ...(r.inclinePct != null ? { incline_pct: r.inclinePct } : {}),
  });
  if (run.error) {
    return {
      warning: /runs/.test(run.error.message)
        ? "Course enregistrée dans l'historique, mais sans le tracé : exécute le fichier SQL 20261022000009_runs.sql dans Supabase."
        : "Course enregistrée dans l'historique, mais le tracé n'a pas pu être sauvegardé.",
    };
  }
  return { warning: null };
}

export async function listRuns(clientId: string): Promise<RunRow[] | null> {
  const { data, error } = await getSupabase()
    .from("runs")
    .select("*")
    .eq("client_id", clientId)
    .order("started_at", { ascending: false })
    .limit(50);
  if (error) return null;
  return data as RunRow[];
}

export async function deleteRun(run: RunRow): Promise<void> {
  const sb = getSupabase();
  // Supprimer la séance supprime aussi la course (cascade)
  const res = run.workout_log_id
    ? await sb.from("workout_logs").delete().eq("id", run.workout_log_id)
    : await sb.from("runs").delete().eq("id", run.id);
  if (res.error) throw res.error;
}
