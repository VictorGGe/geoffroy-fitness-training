"use client";

/**
 * Estimation des calories dépensées (réservée au coach).
 * Méthode : équivalents métaboliques (MET, Compendium of Physical Activities)
 *   kcal = MET × 3,5 × poids (kg) / 200 × minutes
 * Musculation : MET de l'effort pendant les séries + MET de récupération (~3) pendant les repos,
 *   soit environ 4 à 6 kcal/min sur une séance pour 80 kg, ce qui correspond aux mesures publiées.
 * Course : ~1,036 kcal par kg et par km quand la distance est connue.
 * Ce sont des ordres de grandeur (±20 %), pas des mesures.
 */
import { useEffect, useState } from "react";
import { getSupabase } from "./supabase/client";
import { isCardioExercise, normalize, num } from "./format";

export interface ExLike {
  name?: string | null;
  movement_type?: string | null;
  muscle_group?: string | null;
}

export interface SetLike {
  reps?: number | null;
  rpe?: number | null;
  rest_seconds?: number | null;
  duration_seconds?: number | null;
  distance_km?: number | null;
  set_type?: string | null;
}

export const DEFAULT_WEIGHT = 75;
const DEFAULT_REST = 90;
const SECONDS_PER_REP = 3.5;
const SECONDS_PER_SET_NO_REPS = 40;

export function kcalFor(met: number, kg: number, seconds: number): number {
  return (met * 3.5 * kg) / 200 * (seconds / 60);
}

/** Mot entier (« marche » ne doit pas correspondre à « fentes marchées »). */
const has = (n: string, ...words: string[]) => words.some((w) => new RegExp(`\\b${w}s?\\b`).test(n));

/** MET d'un exercice cardio (intensité modérée à soutenue). */
function cardioMet(name: string): number {
  if (has(name, "corde a sauter")) return 11.8;
  if (has(name, "marche incline")) return 6.0;
  if (has(name, "marche")) return 3.8;
  if (has(name, "course", "tapis", "running", "footing", "sprint")) return 9.8;
  if (has(name, "stepper", "escalier")) return 8.8;
  if (has(name, "assault", "air bike", "airbike")) return 8.5;
  if (has(name, "skierg", "ski erg")) return 7.5;
  if (has(name, "rameur", "aviron")) return 7.0;
  if (has(name, "elliptique")) return 5.0;
  if (has(name, "velo")) return 6.8;
  if (has(name, "natation", "nage")) return 7.0;
  return 7.0;
}

const REST_MET = 3.0;

/** MET pendant l'effort d'un exercice de musculation, selon le type de mouvement. */
function strengthMet(ex: ExLike, name: string): number {
  if (has(name, "kettlebell swing", "swing")) return 10.0;
  const t = normalize(ex.movement_type ?? "");
  if (has(t, "halterophilie")) return 9.0;
  if (has(t, "flexion de genou", "charniere")) return 8.0;
  if (has(t, "poussee", "tirage")) return 6.5;
  if (has(t, "gainage")) return 4.0;
  if (has(t, "isolation")) return 5.0;
  if (has(name, "squat", "souleve", "fente", "presse", "thrust")) return 8.0;
  if (has(name, "curl", "extension", "elevation", "ecarte", "oiseau", "mollet", "crunch")) return 5.0;
  return 6.5;
}

/** Plus l'effort ressenti est élevé, plus la dépense l'est aussi (±15 %). */
function rpeFactor(rpe: number | null | undefined): number {
  if (!rpe) return 1;
  return Math.min(1.15, Math.max(0.85, 0.75 + 0.04 * rpe));
}

export function isCardio(ex: ExLike): boolean {
  return (
    isCardioExercise({ movement_type: ex.movement_type ?? null, muscle_group: ex.muscle_group ?? null }) ||
    /\b(course|tapis|rameur|velo|elliptique|natation|corde a sauter|skierg|stepper|marche|footing|running|sprint)\b/.test(normalize(ex.name ?? ""))
  );
}

/** Calories d'une liste de séries réalisées (ou prévues) pour un exercice. */
export function kcalForSets(ex: ExLike, sets: SetLike[], kg: number): number {
  const name = normalize(ex.name ?? "");
  let total = 0;
  if (isCardio(ex)) {
    const met = cardioMet(name);
    const running = has(name, "course", "tapis", "running", "footing", "sprint") && !has(name, "marche");
    for (const s of sets) {
      const dur = num(s.duration_seconds) ?? 0;
      const km = num(s.distance_km) ?? 0;
      if (running && km > 0) total += 1.036 * kg * km * (dur > 0 && km / (dur / 3600) < 7 ? 0.55 / 1.036 : 1);
      else if (dur > 0) total += kcalFor(met, kg, dur) * rpeFactor(num(s.rpe));
    }
    return Math.round(total);
  }
  const met = strengthMet(ex, name);
  const swing = has(name, "swing");
  for (const s of sets) {
    const reps = num(s.reps);
    const dur = num(s.duration_seconds);
    const work = dur && dur > 0 ? dur : reps ? reps * (swing ? 1.3 : SECONDS_PER_REP) : SECONDS_PER_SET_NO_REPS;
    const rest = num(s.rest_seconds) ?? DEFAULT_REST;
    const warmup = s.set_type === "echauffement" ? 0.7 : 1;
    total += (kcalFor(met, kg, work) * rpeFactor(num(s.rpe)) + kcalFor(REST_MET, kg, rest)) * warmup;
  }
  return Math.round(total);
}

/** Calories prévues pour un exercice de programme. */
export function kcalForPlanned(
  pe: {
    sets?: number | null;
    reps?: string | null;
    rpe?: number | null;
    rest_seconds?: number | null;
    duration_seconds?: number | null;
    distance_km?: number | null;
    set_type?: string | null;
  },
  ex: ExLike,
  kg: number,
): number {
  const n = Math.max(1, Math.min(50, num(pe.sets) ?? (isCardio(ex) ? 1 : 3)));
  // « 8-10 » → 9 répétitions en moyenne
  const r = String(pe.reps ?? "").match(/(\d+)(?:\s*[-à/]\s*(\d+))?/);
  const reps = r ? (r[2] ? (Number(r[1]) + Number(r[2])) / 2 : Number(r[1])) : null;
  const one: SetLike = {
    reps,
    rpe: num(pe.rpe),
    rest_seconds: num(pe.rest_seconds),
    duration_seconds: num(pe.duration_seconds),
    distance_km: num(pe.distance_km),
    set_type: pe.set_type,
  };
  return kcalForSets(ex, Array.from({ length: n }, () => one), kg);
}

/* ------------------------------------------------------------------ */
/* Poids du client (coach uniquement)                                    */
/* ------------------------------------------------------------------ */

export interface ClientWeight {
  kg: number;
  source: "pesée" | "bilan" | "défaut";
}

export function useClientWeight(clientId: string | null | undefined, enabled = true): ClientWeight {
  const [w, setW] = useState<ClientWeight>({ kg: DEFAULT_WEIGHT, source: "défaut" });
  useEffect(() => {
    if (!enabled || !clientId) {
      setW({ kg: DEFAULT_WEIGHT, source: "défaut" });
      return;
    }
    let cancelled = false;
    (async () => {
      const sb = getSupabase();
      const { data: wi } = await sb
        .from("weigh_ins")
        .select("weight_kg")
        .eq("client_id", clientId)
        .order("measured_on", { ascending: false })
        .limit(1)
        .maybeSingle();
      const kg = num(wi?.weight_kg);
      if (kg && kg >= 20) return !cancelled && setW({ kg, source: "pesée" });
      const { data: it } = await sb
        .from("client_intakes")
        .select("answers")
        .eq("client_id", clientId)
        .order("assessed_on", { ascending: false })
        .limit(1)
        .maybeSingle();
      const ikg = num((it?.answers as { weight_kg?: string } | null)?.weight_kg);
      if (!cancelled) setW(ikg && ikg >= 20 && ikg <= 400 ? { kg: ikg, source: "bilan" } : { kg: DEFAULT_WEIGHT, source: "défaut" });
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [clientId, enabled]);
  return w;
}

export function weightNote(w: ClientWeight): string {
  return w.source === "défaut"
    ? `estimation pour ${DEFAULT_WEIGHT} kg (aucun poids connu)`
    : `estimation pour ${String(w.kg).replace(".", ",")} kg (${w.source === "pesée" ? "dernière pesée" : "bilan de départ"})`;
}
