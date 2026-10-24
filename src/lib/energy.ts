"use client";

/**
 * Dépense énergétique de la semaine : séances (musculation, cardio, course),
 * pas du podomètre, métabolisme de base (coach) et apports notés dans les repas.
 * Toutes les valeurs sont des estimations (±20 %).
 */
import { getSupabase } from "./supabase/client";
import { DEFAULT_WEIGHT, kcalForSets, type ExLike } from "./calories";
import { num } from "./format";
import type { WorkoutLog, WorkoutSet } from "./types";

export interface DayEnergy {
  day: string; // AAAA-MM-JJ
  sessions: { name: string; kcal: number }[];
  sessionsKcal: number;
  steps: number | null;
  stepsKcal: number;
  baseKcal: number | null; // métabolisme de base + digestion (coach uniquement)
  intakeKcal: number | null; // repas notés ce jour-là
}

export interface WeekEnergy {
  days: DayEnergy[];
  kg: number;
  weightSource: "pesée" | "bilan" | "défaut";
  bmr: number | null;
  stepsAvailable: boolean;
  foodAvailable: boolean;
}

export function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function mondayOf(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

const stepKcal = (steps: number, kg: number) => steps * 0.0005 * kg;

/** Métabolisme de base (Mifflin-St Jeor). */
function bmrOf(sex: string | undefined, age: number | null, height: number | null, kg: number): number | null {
  if ((sex !== "homme" && sex !== "femme") || !age || !height || age < 14 || age > 100 || height < 120 || height > 230) return null;
  return 10 * kg + 6.25 * height - 5 * age + (sex === "homme" ? 5 : -161);
}

export async function loadWeekEnergy(clientId: string, monday: Date, isClient: boolean): Promise<WeekEnergy> {
  const sb = getSupabase();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return isoDay(d);
  });
  const from = days[0];
  const to = days[6];

  const [logs, steps, food, exercises] = await Promise.all([
    sb.from("workout_logs").select("id, performed_on, session_name, workout_sets(*)").eq("client_id", clientId).gte("performed_on", from).lte("performed_on", to),
    sb.from("daily_steps").select("day, steps").eq("client_id", clientId).gte("day", from).lte("day", to),
    sb.from("food_entries").select("eaten_on, kcal").eq("client_id", clientId).gte("eaten_on", from).lte("eaten_on", to),
    sb.from("exercises").select("id, name, movement_type, muscle_group"),
  ]);
  if (logs.error) throw logs.error;

  // Poids (et profil pour le métabolisme de base côté coach)
  let kg = DEFAULT_WEIGHT;
  let weightSource: WeekEnergy["weightSource"] = "défaut";
  let bmr: number | null = null;
  if (isClient) {
    const { data: w } = await sb.rpc("my_latest_weight");
    if (num(w)) {
      kg = num(w)!;
      weightSource = "pesée";
    }
  } else {
    const [wi, it, nt] = await Promise.all([
      sb.from("weigh_ins").select("weight_kg").eq("client_id", clientId).lte("measured_on", to).order("measured_on", { ascending: false }).limit(1).maybeSingle(),
      sb.from("client_intakes").select("answers").eq("client_id", clientId).order("assessed_on", { ascending: false }).limit(1).maybeSingle(),
      sb.from("nutrition_targets").select("inputs").eq("client_id", clientId).maybeSingle(),
    ]);
    const a = (it.data?.answers ?? {}) as { sex?: string; age?: string; height_cm?: string; weight_kg?: string };
    const t = (nt.data?.inputs ?? {}) as { sex?: string; age?: number; height_cm?: number; weight_kg?: number };
    if (num(wi.data?.weight_kg)) {
      kg = num(wi.data?.weight_kg)!;
      weightSource = "pesée";
    } else if (num(a.weight_kg)) {
      kg = num(a.weight_kg)!;
      weightSource = "bilan";
    }
    bmr = bmrOf(a.sex || t.sex, num(a.age) ?? num(t.age), num(a.height_cm) ?? num(t.height_cm), kg);
  }

  const exMap = new Map<string, ExLike>(((exercises.data ?? []) as (ExLike & { id: string })[]).map((e) => [e.id, e]));
  const stepsByDay = new Map(((steps.data ?? []) as { day: string; steps: number }[]).map((s) => [s.day, s.steps]));
  const foodByDay = new Map<string, number>();
  for (const f of (food.data ?? []) as { eaten_on: string; kcal: number }[]) foodByDay.set(f.eaten_on, (foodByDay.get(f.eaten_on) ?? 0) + Number(f.kcal));

  const out: DayEnergy[] = days.map((day) => {
    const dayLogs = ((logs.data ?? []) as unknown as (WorkoutLog & { workout_sets: WorkoutSet[] })[]).filter((l) => l.performed_on === day);
    const sessions = dayLogs.map((l) => {
      const groups = new Map<number, WorkoutSet[]>();
      for (const s of l.workout_sets ?? []) groups.set(s.exercise_order, [...(groups.get(s.exercise_order) ?? []), s]);
      let kcal = 0;
      for (const sets of groups.values()) kcal += kcalForSets(exMap.get(sets[0].exercise_id ?? "") ?? { name: sets[0].exercise_name }, sets, kg);
      return { name: l.session_name ?? "Séance", kcal: Math.round(kcal) };
    });
    const st = stepsByDay.get(day) ?? null;
    return {
      day,
      sessions,
      sessionsKcal: sessions.reduce((n, s) => n + s.kcal, 0),
      steps: st,
      stepsKcal: st ? Math.round(stepKcal(st, kg)) : 0,
      // Métabolisme de base + ~10 % pour la digestion (les pas et séances sont comptés à part)
      baseKcal: bmr ? Math.round(bmr * 1.1) : null,
      intakeKcal: foodByDay.has(day) ? Math.round(foodByDay.get(day)!) : null,
    };
  });

  return { days: out, kg, weightSource, bmr: bmr ? Math.round(bmr) : null, stepsAvailable: !steps.error, foodAvailable: !food.error };
}
