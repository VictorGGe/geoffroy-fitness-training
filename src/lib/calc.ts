import { num } from "./format";
import type { Measurement, WeighIn, WeightGoal, WeightMilestone, WorkoutSet } from "./types";

/**
 * Estimation du 1RM (formule d'Epley). Indicative uniquement.
 * Non calculée au-delà de 12 répétitions (estimation trop imprécise).
 */
export function estimate1RM(load: number | null, reps: number | null): number | null {
  if (load === null || reps === null || load <= 0 || reps <= 0 || reps > 12) return null;
  if (reps === 1) return load;
  return Math.round(load * (1 + reps / 30) * 10) / 10;
}

export type WeightDirection = "loss" | "gain" | "maintain";

export interface WeightSummary {
  hasData: boolean;
  startWeight: number | null;
  startDate: string | null;
  startFromGoal: boolean;
  currentWeight: number | null;
  lastDate: string | null;
  previousWeight: number | null;
  targetWeight: number | null;
  targetDate: string | null;
  direction: WeightDirection | null;
  /** Variation depuis le départ (négatif = perte) */
  totalChange: number | null;
  /** Variation depuis la pesée précédente */
  lastChange: number | null;
  /** Reste à parcourir jusqu'à l'objectif (valeur absolue) */
  remaining: number | null;
  /** Progression brute en % (peut être < 0 ou > 100) */
  progressRaw: number | null;
  /** Progression bornée 0–100 pour la barre */
  progressBar: number | null;
  status: "no_goal" | "in_progress" | "reached" | "opposite" | "no_data";
  count: number;
}

/** Trie les pesées par date croissante (puis par création). */
export function sortWeighIns(list: WeighIn[]): WeighIn[] {
  return [...list].sort((a, b) => a.measured_on.localeCompare(b.measured_on));
}

/**
 * Calcule un résumé cohérent du suivi de poids.
 * - Le poids de départ provient de l'objectif s'il est renseigné, sinon de la première pesée.
 * - Aucune valeur n'est inventée : si une donnée manque, elle reste null.
 * - Fonctionne pour une perte, une prise de poids ou un maintien.
 */
export function weightSummary(weighIns: WeighIn[], goal: WeightGoal | null): WeightSummary {
  const sorted = sortWeighIns(weighIns);
  const first = sorted[0] ?? null;
  const last = sorted[sorted.length - 1] ?? null;
  const prev = sorted.length > 1 ? sorted[sorted.length - 2] : null;

  const goalStart = num(goal?.start_weight);
  const startWeight = goalStart ?? num(first?.weight_kg);
  const startDate = goal?.start_date ?? first?.measured_on ?? null;
  const currentWeight = num(last?.weight_kg);
  const targetWeight = num(goal?.target_weight);

  const totalChange = startWeight !== null && currentWeight !== null ? round1(currentWeight - startWeight) : null;
  const lastChange = prev && currentWeight !== null ? round1(currentWeight - num(prev.weight_kg)!) : null;

  let direction: WeightDirection | null = null;
  if (startWeight !== null && targetWeight !== null) {
    direction = targetWeight < startWeight ? "loss" : targetWeight > startWeight ? "gain" : "maintain";
  }

  let progressRaw: number | null = null;
  let remaining: number | null = null;
  let status: WeightSummary["status"] = "no_data";

  if (currentWeight === null) {
    status = "no_data";
  } else if (targetWeight === null || startWeight === null) {
    status = "no_goal";
  } else {
    remaining = round1(Math.abs(targetWeight - currentWeight));
    if (direction === "maintain") {
      progressRaw = Math.abs(currentWeight - targetWeight) <= 0.5 ? 100 : 0;
      status = progressRaw === 100 ? "reached" : "in_progress";
    } else {
      progressRaw = ((startWeight - currentWeight) / (startWeight - targetWeight)) * 100;
      if (progressRaw >= 100) status = "reached";
      else if (progressRaw < 0) status = "opposite";
      else status = "in_progress";
    }
  }

  return {
    hasData: sorted.length > 0,
    startWeight,
    startDate,
    startFromGoal: goalStart !== null,
    currentWeight,
    lastDate: last?.measured_on ?? null,
    previousWeight: num(prev?.weight_kg),
    targetWeight,
    targetDate: goal?.target_date ?? null,
    direction,
    totalChange,
    lastChange,
    remaining,
    progressRaw: progressRaw === null ? null : Math.round(progressRaw),
    progressBar: progressRaw === null ? null : Math.max(0, Math.min(100, Math.round(progressRaw))),
    status,
    count: sorted.length,
  };
}

/** Un objectif intermédiaire est atteint si le poids actuel l'a franchi dans le sens de l'objectif. */
export function milestoneReached(m: WeightMilestone, summary: WeightSummary): boolean {
  if (summary.currentWeight === null) return false;
  const w = num(m.weight)!;
  if (summary.direction === "gain") return summary.currentWeight >= w;
  return summary.currentWeight <= w;
}

/** Pesée la plus proche (au plus tard) d'une date donnée. */
export function weighInAt(sorted: WeighIn[], date: string): WeighIn | null {
  let found: WeighIn | null = null;
  for (const w of sorted) {
    if (w.measured_on <= date) found = w;
    else break;
  }
  return found;
}

export const MEASUREMENT_FIELDS = [
  { key: "waist_cm", label: "Tour de taille" },
  { key: "hips_cm", label: "Tour de hanches" },
  { key: "chest_cm", label: "Tour de poitrine" },
  { key: "thigh_cm", label: "Tour de cuisse" },
  { key: "arm_cm", label: "Tour de bras" },
] as const;

export type MeasurementKey = (typeof MEASUREMENT_FIELDS)[number]["key"];

/** Pour chaque mensuration : première et dernière valeur réellement saisies. */
export function measurementEvolution(list: Measurement[]) {
  const sorted = [...list].sort((a, b) => a.measured_on.localeCompare(b.measured_on));
  return MEASUREMENT_FIELDS.map((f) => {
    const withValue = sorted.filter((m) => num(m[f.key]) !== null);
    const first = withValue[0];
    const last = withValue[withValue.length - 1];
    const firstV = first ? num(first[f.key]) : null;
    const lastV = last ? num(last[f.key]) : null;
    return {
      key: f.key,
      label: f.label,
      first: firstV,
      firstDate: first?.measured_on ?? null,
      last: lastV,
      lastDate: last?.measured_on ?? null,
      change: firstV !== null && lastV !== null && withValue.length > 1 ? round1(lastV - firstV) : null,
      count: withValue.length,
    };
  });
}

export interface ExerciseSessionPoint {
  date: string;
  logId: string;
  topLoad: number | null;
  topLoadReps: number | null;
  totalReps: number;
  volume: number;
  best1RM: number | null;
  sets: WorkoutSet[];
}

/** Agrège les séries d'un exercice par séance (charge max, volume, 1RM estimé). */
export function aggregateExercise(
  rows: (WorkoutSet & { workout_logs: { performed_on: string } | null })[],
): ExerciseSessionPoint[] {
  const byLog = new Map<string, ExerciseSessionPoint>();
  for (const s of rows) {
    if (!s.workout_logs) continue;
    if (s.set_type === "echauffement") continue;
    let p = byLog.get(s.workout_log_id);
    if (!p) {
      p = {
        date: s.workout_logs.performed_on,
        logId: s.workout_log_id,
        topLoad: null,
        topLoadReps: null,
        totalReps: 0,
        volume: 0,
        best1RM: null,
        sets: [],
      };
      byLog.set(s.workout_log_id, p);
    }
    const load = num(s.load_kg);
    const reps = num(s.reps);
    p.sets.push(s);
    if (reps !== null) p.totalReps += reps;
    if (load !== null && reps !== null) p.volume += load * reps;
    if (load !== null && (p.topLoad === null || load > p.topLoad || (load === p.topLoad && (reps ?? 0) > (p.topLoadReps ?? 0)))) {
      p.topLoad = load;
      p.topLoadReps = reps;
    }
    const e = estimate1RM(load, reps);
    if (e !== null && (p.best1RM === null || e > p.best1RM)) p.best1RM = e;
  }
  return [...byLog.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function round1(v: number): number {
  return Math.round(v * 10) / 10;
}
