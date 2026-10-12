"use client";

import { getSupabase } from "./supabase/client";
import { normalize } from "./format";
import { STARTER_EXERCISES, STARTER_TEMPLATES } from "./starter";
import type { Program, ProgramExercise, ProgramSession } from "./types";

function check<T>(res: { data: T; error: unknown }): T {
  if (res.error) throw res.error;
  return res.data;
}

/** Importe la bibliothèque de base (n'ajoute que les exercices absents). */
export async function importStarterLibrary(): Promise<number> {
  const sb = getSupabase();
  const existing = check(await sb.from("exercises").select("name")) as { name: string }[];
  const have = new Set(existing.map((e) => normalize(e.name)));
  const toInsert = STARTER_EXERCISES.filter((e) => !have.has(normalize(e.name)));
  if (toInsert.length) check(await sb.from("exercises").insert(toInsert));
  return toInsert.length;
}

/** Retourne l'id de chaque exercice par nom, en créant ceux qui manquent. */
async function ensureExercises(names: string[]): Promise<Map<string, string>> {
  const sb = getSupabase();
  const rows = check(await sb.from("exercises").select("id, name")) as { id: string; name: string }[];
  const map = new Map(rows.map((r) => [normalize(r.name), r.id]));
  const missing = [...new Set(names)].filter((n) => !map.has(normalize(n)));
  if (missing.length) {
    const payload = missing.map((name) => {
      const s = STARTER_EXERCISES.find((e) => e.name === name);
      return s ?? { name };
    });
    const created = check(await sb.from("exercises").insert(payload).select("id, name")) as { id: string; name: string }[];
    created.forEach((c) => map.set(normalize(c.name), c.id));
  }
  return map;
}

export interface NewProgramInput {
  name: string;
  client_id: string | null;
  goal: string | null;
  level: string | null;
  duration_weeks: number | null;
  sessions_per_week: number | null;
  description: string | null;
  instructions: string | null;
  is_template: boolean;
}

/** Crée un programme à partir d'un modèle de départ. */
export async function createProgramFromStarter(templateKey: string, input: NewProgramInput): Promise<string> {
  const sb = getSupabase();
  const tpl = STARTER_TEMPLATES.find((t) => t.key === templateKey) ?? STARTER_TEMPLATES[0];
  const program = check(
    await sb
      .from("programs")
      .insert({ ...input, split_type: tpl.key === "custom" ? null : tpl.label })
      .select("id")
      .single(),
  ) as { id: string };

  const names = tpl.sessions.flatMap((s) => s.exercises.map((e) => e.name));
  const ids = names.length ? await ensureExercises(names) : new Map<string, string>();

  for (const [i, s] of tpl.sessions.entries()) {
    const session = check(
      await sb.from("program_sessions").insert({ program_id: program.id, name: s.name, position: i }).select("id").single(),
    ) as { id: string };
    if (s.exercises.length) {
      check(
        await sb.from("program_exercises").insert(
          s.exercises.map((e, j) => ({
            session_id: session.id,
            exercise_id: ids.get(normalize(e.name)),
            position: j,
            sets: e.sets,
            reps: e.reps,
            rpe: e.rpe ?? null,
            rir: e.rir ?? null,
            rest_seconds: e.rest ?? null,
            set_type: e.set_type ?? "travail",
          })),
        ),
      );
    }
  }
  return program.id;
}

const EXERCISE_FIELDS = [
  "exercise_id",
  "position",
  "sets",
  "reps",
  "load_kg",
  "rpe",
  "rir",
  "rest_seconds",
  "tempo",
  "set_type",
  "technical_cues",
  "comments",
] as const;

function pickExercise(e: ProgramExercise) {
  const out: Record<string, unknown> = {};
  for (const k of EXERCISE_FIELDS) out[k] = e[k];
  return out;
}

export async function fetchProgramFull(id: string): Promise<{ program: Program; sessions: ProgramSession[] }> {
  const sb = getSupabase();
  const program = check(
    await sb.from("programs").select("*, clients(id, first_name, last_name)").eq("id", id).single(),
  ) as Program;
  const sessions = check(
    await sb
      .from("program_sessions")
      .select("*, program_exercises(*, exercises(id, name, muscle_group, equipment))")
      .eq("program_id", id)
      .order("position"),
  ) as ProgramSession[];
  sessions.forEach((s) => s.program_exercises?.sort((a, b) => a.position - b.position));
  return { program, sessions };
}

/**
 * Duplique un programme complet (séances + exercices + paramètres).
 * La copie est indépendante : la modifier n'affecte jamais l'original.
 */
export async function duplicateProgram(
  sourceId: string,
  overrides: { name: string; client_id: string | null; is_template: boolean },
): Promise<string> {
  const sb = getSupabase();
  const { program, sessions } = await fetchProgramFull(sourceId);
  const copy = check(
    await sb
      .from("programs")
      .insert({
        name: overrides.name,
        client_id: overrides.client_id,
        is_template: overrides.is_template,
        goal: program.goal,
        level: program.level,
        split_type: program.split_type,
        duration_weeks: program.duration_weeks,
        sessions_per_week: program.sessions_per_week,
        description: program.description,
        instructions: program.instructions,
      })
      .select("id")
      .single(),
  ) as { id: string };

  for (const s of sessions) {
    await copySessionInto(s, copy.id, s.position, s.name);
  }
  return copy.id;
}

async function copySessionInto(s: ProgramSession, programId: string, position: number, name: string) {
  const sb = getSupabase();
  const ns = check(
    await sb.from("program_sessions").insert({ program_id: programId, name, notes: s.notes, position }).select("id").single(),
  ) as { id: string };
  const exs = s.program_exercises ?? [];
  if (exs.length) {
    check(await sb.from("program_exercises").insert(exs.map((e) => ({ ...pickExercise(e), session_id: ns.id }))));
  }
}

/** Copie une séance dans le même programme (ou un autre). */
export async function copySession(session: ProgramSession, targetProgramId: string, position: number) {
  await copySessionInto(session, targetProgramId, position, `${session.name} (copie)`);
}
