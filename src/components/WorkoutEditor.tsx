"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowLeft, ArrowUp, Check, History, Plus, Target, Timer, Trash2, X } from "lucide-react";
import { RestTimer, unlockAudio, type RestRequest } from "./RestTimer";
import { Badge, Button, Card, ConfirmDialog, Field, Input, LoadingBlock, PageHeader, Select, Textarea, cn } from "./ui";
import { ExercisePicker } from "./ExercisePicker";
import { VideoThumb } from "./ExerciseVideo";
import { ExerciseSheetButton } from "./ExerciseSheet";
import { KcalChip } from "./KcalChip";
import { kcalForSets, useClientWeight, weightNote } from "@/lib/calories";
import { useToast } from "./toast";
import { getSupabase } from "@/lib/supabase/client";
import { fetchProgramFull, getMyClientProfile } from "@/lib/data";
import { usePaths } from "@/lib/mode";
import {
  emptyToNull,
  errorMessage,
  fmtDate,
  fmtNum,
  fmtRest,
  fullName,
  num,
  parseNum,
  parseRest,
  SET_TYPE_LABELS,
  cardioSummary,
  durationInput,
  fmtDuration,
  isCardioExercise,
  parseDuration,
  todayISO,
} from "@/lib/format";
import { estimate1RM } from "@/lib/calc";
import type { Client, Program, ProgramSession, SetType, WorkoutLog, WorkoutSet } from "@/lib/types";

interface SetRow {
  load: string;
  reps: string;
  duration: string;
  distance: string;
  intensity: string;
  hr_avg: string;
  hr_max: string;
  incline: string;
  rpe: string;
  rir: string;
  rest: string;
  comment: string;
  set_type: SetType | "";
  /** Valeurs pré-remplies automatiquement (dernière séance ou programme), pas encore modifiées */
  auto?: boolean;
  /** Série cochée comme faite (affichage) */
  done?: boolean;
}
interface Planned {
  sets: number | null;
  reps: string | null;
  load_kg: number | null;
  rpe: number | null;
  rir: number | null;
  rest_seconds: number | null;
  technical_cues: string | null;
  duration_seconds?: number | null;
  distance_km?: number | null;
  intensity?: string | null;
  hr_min?: number | null;
  hr_max?: number | null;
  incline_pct?: number | null;
}
interface Block {
  key: string;
  exercise_id: string | null;
  exercise_name: string;
  cardio: boolean;
  video_url?: string | null;
  planned: Planned | null;
  sets: SetRow[];
}

const emptySet = (set_type: SetType | "" = "travail"): SetRow => ({
  load: "",
  reps: "",
  duration: "",
  distance: "",
  intensity: "",
  hr_avg: "",
  hr_max: "",
  incline: "",
  rpe: "",
  rir: "",
  rest: "",
  comment: "",
  set_type,
});
const uid = () => Math.random().toString(36).slice(2, 10);
const str = (v: unknown) => (num(v) === null ? "" : String(num(v)).replace(".", ","));

/** « 8-10 » → « 8 » (on part du bas de la fourchette), « 5 » → « 5 », texte libre → vide. */
function lowReps(r: string | null | undefined): string {
  const m = String(r ?? "").match(/\d+/);
  return m ? m[0] : "";
}

/**
 * Pré-remplit les séries encore automatiques : valeurs de la dernière séance
 * (pour garder la progression), sinon celles prévues par le programme.
 */
function prefillBlock(b: Block, last: LastPerf | undefined): Block {
  if (!b.sets.some((s) => s.auto)) return b;
  return {
    ...b,
    sets: b.sets.map((s, i) => {
      if (!s.auto) return s;
      // Les échauffements gardent les valeurs du programme ; les séries de travail reprennent la dernière séance
      const warm = s.set_type === "echauffement";
      const wi = b.sets.slice(0, i).filter((x) => x.set_type !== "echauffement").length;
      const ls = !warm && last?.sets.length ? (last.sets[wi] ?? last.sets[last.sets.length - 1]) : undefined;
      if (b.cardio) {
        const dur = ls?.duration ?? b.planned?.duration_seconds ?? null;
        const dist = ls?.distance ?? b.planned?.distance_km ?? null;
        const inc = ls?.incline ?? b.planned?.incline_pct ?? null;
        return { ...s, duration: dur != null ? durationInput(dur) : "", distance: dist != null ? str(dist) : "", incline: inc != null ? str(inc) : "" };
      }
      const load = ls?.load ?? b.planned?.load_kg ?? null;
      const reps = ls?.reps != null ? String(ls.reps) : lowReps(b.planned?.reps);
      return { ...s, load: load != null ? str(load) : "", reps };
    }),
  };
}

type LastPerf = {
  date: string;
  sets: { load: number | null; reps: number | null; rpe: number | null; duration: number | null; distance: number | null; hr: number | null; incline: number | null }[];
};

export function WorkoutEditor({
  logId,
  initialClientId,
  initialProgramId,
  initialSessionId,
}: {
  logId?: string;
  initialClientId?: string | null;
  initialProgramId?: string | null;
  initialSessionId?: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const sb = getSupabase();
  const paths = usePaths();
  const editing = !!logId;

  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Pick<Client, "id" | "first_name" | "last_name">[]>([]);
  const [clientId, setClientId] = useState(initialClientId ?? "");
  const [programs, setPrograms] = useState<Program[]>([]);
  const [programId, setProgramId] = useState(initialProgramId ?? "");
  const [programSessions, setProgramSessions] = useState<ProgramSession[]>([]);
  const [sessionId, setSessionId] = useState(initialSessionId ?? "");
  const [date, setDate] = useState(todayISO());
  const [comments, setComments] = useState("");
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [original, setOriginal] = useState<WorkoutLog | null>(null);
  const [lastPerf, setLastPerf] = useState<Record<string, LastPerf>>({});
  const lastPerfRef = useRef<Record<string, LastPerf>>({});
  const [details, setDetails] = useState<Set<string>>(new Set());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rest, setRest] = useState<(RestRequest & { blockKey: string; si: number }) | null>(null);
  const weight = useClientWeight(clientId || null, !paths.isClient);

  /** Calories estimées d'un exercice à partir des séries remplies (coach uniquement). */
  function blockKcal(b: Block): number {
    const sets = b.sets
      .filter((s) => s.load || s.reps || s.duration || s.distance)
      .map((s) => ({
        reps: parseNum(s.reps),
        rpe: parseNum(s.rpe),
        rest_seconds: s.rest.trim() ? parseRest(s.rest) : (b.planned?.rest_seconds ?? null),
        duration_seconds: s.duration.trim() ? parseDuration(s.duration) : null,
        distance_km: parseNum(s.distance),
        set_type: s.set_type || null,
        intensity: s.intensity || b.planned?.intensity || null,
        incline_pct: parseNum(s.incline),
      }));
    return kcalForSets({ name: b.exercise_name, movement_type: b.cardio ? "Cardio" : null }, sets, weight.kg);
  }

  /** Lance le chrono de repos après la série si (temps prévu, sinon 90 s). */
  function startRest(bi: number, si: number) {
    const b = blocks[bi];
    if (!b) return;
    unlockAudio();
    const row = b.sets[si];
    const seconds = (row && parseRest(row.rest)) || b.planned?.rest_seconds || 90;
    setRest({ id: uid(), label: `Repos · ${b.exercise_name} · série ${si + 1}`, seconds, blockKey: b.key, si });
  }

  function finishRest(elapsed: number) {
    if (rest) {
      const bi = blocks.findIndex((b) => b.key === rest.blockKey);
      if (bi >= 0 && blocks[bi].sets[rest.si]) updateSet(bi, rest.si, { rest: String(elapsed) });
    }
    setRest(null);
  }

  // Chargement initial
  useEffect(() => {
    (async () => {
      if (paths.isClient) {
        // Espace client : uniquement lui-même
        const me = await getMyClientProfile();
        setClients(me ? [me] : []);
        if (me && !logId) setClientId(me.id);
      } else {
        const { data: cl } = await sb.from("clients").select("id, first_name, last_name").eq("archived", false).order("last_name");
        setClients(cl ?? []);
      }
      if (logId) {
        const { data, error } = await sb.from("workout_logs").select("*, workout_sets(*)").eq("id", logId).single();
        if (error || !data) {
          setError("Séance introuvable.");
          setLoading(false);
          return;
        }
        const log = data as WorkoutLog;
        setOriginal(log);
        setClientId(log.client_id);
        setProgramId(log.program_id ?? "");
        setSessionId(log.program_session_id ?? "");
        setDate(log.performed_on);
        setComments(log.coach_comments ?? "");
        const sets = [...(log.workout_sets ?? [])].sort((a, b) => a.exercise_order - b.exercise_order || a.set_number - b.set_number);
        const grouped: Block[] = [];
        for (const s of sets) {
          let b = grouped.find((g) => g.key === `o${s.exercise_order}`);
          if (!b) {
            b = {
              key: `o${s.exercise_order}`,
              exercise_id: s.exercise_id,
              exercise_name: s.exercise_name,
              cardio: false,
              planned:
                s.planned_reps ||
                s.planned_load_kg != null ||
                s.planned_rpe != null ||
                s.planned_rir != null ||
                s.planned_duration_seconds != null ||
                s.planned_distance_km != null ||
                s.planned_intensity ||
                s.planned_hr_min != null
                  ? {
                      sets: null,
                      reps: s.planned_reps,
                      load_kg: num(s.planned_load_kg),
                      rpe: num(s.planned_rpe),
                      rir: s.planned_rir,
                      rest_seconds: null,
                      technical_cues: null,
                      duration_seconds: s.planned_duration_seconds ?? null,
                      distance_km: num(s.planned_distance_km),
                      intensity: s.planned_intensity ?? null,
                      hr_min: s.planned_hr_min ?? null,
                      hr_max: s.planned_hr_max ?? null,
                      incline_pct: num(s.planned_incline_pct),
                    }
                  : null,
              sets: [],
            };
            grouped.push(b);
          }
          if (
            s.duration_seconds != null ||
            s.distance_km != null ||
            s.hr_avg != null ||
            s.hr_max != null ||
            s.intensity ||
            s.planned_duration_seconds != null
          )
            b.cardio = true;
          b.sets.push({
            load: str(s.load_kg),
            reps: s.reps?.toString() ?? "",
            duration: durationInput(s.duration_seconds),
            distance: str(s.distance_km),
            intensity: s.intensity ?? "",
            hr_avg: s.hr_avg?.toString() ?? "",
            hr_max: s.hr_max?.toString() ?? "",
            incline: str(s.incline_pct),
            rpe: str(s.rpe),
            rir: s.rir?.toString() ?? "",
            rest: s.rest_seconds != null ? String(s.rest_seconds) : "",
            comment: s.comment ?? "",
            set_type: s.set_type ?? "",
          });
        }
        setBlocks(grouped.map((g) => ({ ...g, key: uid() })));
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logId]);

  // Programmes du client
  useEffect(() => {
    if (!clientId) return setPrograms([]);
    sb.from("programs")
      .select("*")
      .eq("client_id", clientId)
      .order("archived")
      .order("updated_at", { ascending: false })
      .then(({ data }) => setPrograms((data as Program[]) ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  // Séances du programme
  useEffect(() => {
    if (!programId) return setProgramSessions([]);
    fetchProgramFull(programId)
      .then(({ sessions }) => setProgramSessions(sessions))
      .catch(() => setProgramSessions([]));
  }, [programId]);

  // Pré-remplissage depuis la séance prévue (création uniquement)
  useEffect(() => {
    if (editing || !sessionId) return;
    const s = programSessions.find((x) => x.id === sessionId);
    if (!s) return;
    setBlocks(
      (s.program_exercises ?? []).map((pe) => ({
        key: uid(),
        exercise_id: pe.exercise_id,
        exercise_name: pe.exercises?.name ?? "Exercice",
        video_url: pe.exercises?.video_url ?? null,
        cardio: isCardioExercise(pe.exercises) || pe.duration_seconds != null || num(pe.distance_km) !== null || pe.hr_min != null,
        planned: {
          sets: pe.sets,
          reps: pe.reps,
          load_kg: num(pe.load_kg),
          rpe: num(pe.rpe),
          rir: pe.rir,
          rest_seconds: pe.rest_seconds,
          technical_cues: pe.technical_cues,
          duration_seconds: pe.duration_seconds ?? null,
          distance_km: num(pe.distance_km),
          intensity: pe.intensity ?? null,
          hr_min: pe.hr_min ?? null,
          hr_max: pe.hr_max ?? null,
          incline_pct: num(pe.incline_pct),
        },
        sets: Array.from({ length: Math.max(1, Math.min(pe.sets ?? 1, 12)) }, () => ({
          ...emptySet(pe.set_type ?? "travail"),
          rest: pe.rest_seconds != null ? String(pe.rest_seconds) : "",
          auto: true,
        })),
      })).map((b) => prefillBlock(b, b.exercise_id ? lastPerfRef.current[b.exercise_id] : undefined)),
    );
  }, [sessionId, programSessions, editing]);

  // Séance suivante du programme proposée automatiquement (rotation A → B → C → A…)
  useEffect(() => {
    if (editing || sessionId || !programId || !clientId || !programSessions.length) return;
    if (programSessions.length === 1) return setSessionId(programSessions[0].id);
    sb.from("workout_logs")
      .select("program_session_id")
      .eq("client_id", clientId)
      .eq("program_id", programId)
      .not("program_session_id", "is", null)
      .order("performed_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        const i = programSessions.findIndex((x) => x.id === data?.program_session_id);
        setSessionId(programSessions[(i + 1) % programSessions.length].id);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programSessions, programId, clientId, editing]);

  // Vidéos des exercices (pour les séances déjà enregistrées)
  const [videos, setVideos] = useState<Record<string, string | null>>({});
  const idsKey = blocks.map((b) => b.exercise_id).filter(Boolean).join(",");
  useEffect(() => {
    const ids = [...new Set(blocks.filter((b) => b.exercise_id && b.video_url === undefined).map((b) => b.exercise_id as string))];
    if (!ids.length) return;
    sb.from("exercises")
      .select("id, video_url")
      .in("id", ids)
      .then(({ data }) => {
        if (data) setVideos((v) => ({ ...v, ...Object.fromEntries((data as { id: string; video_url: string | null }[]).map((x) => [x.id, x.video_url])) }));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  // Dernières performances du client pour chaque exercice
  const exerciseIds = useMemo(() => [...new Set(blocks.map((b) => b.exercise_id).filter(Boolean) as string[])], [blocks]);
  useEffect(() => {
    if (!clientId || !exerciseIds.length) return;
    (async () => {
      const { data } = await sb
        .from("workout_sets")
        .select("*, workout_logs!inner(client_id, performed_on)")
        .eq("workout_logs.client_id", clientId)
        .in("exercise_id", exerciseIds)
        .order("set_number");
      const rows = (data ?? []) as unknown as (WorkoutSet & { workout_logs: { performed_on: string } })[];
      const res: Record<string, LastPerf> = {};
      for (const id of exerciseIds) {
        const mine = rows.filter((r) => r.exercise_id === id && r.workout_log_id !== logId && r.set_type !== "echauffement");
        if (!mine.length) continue;
        const lastDate = mine.reduce((d, r) => (r.workout_logs.performed_on > d ? r.workout_logs.performed_on : d), "");
        const lastLog = mine.find((r) => r.workout_logs.performed_on === lastDate)!.workout_log_id;
        res[id] = {
          date: lastDate,
          sets: mine
            .filter((r) => r.workout_log_id === lastLog)
            .map((r) => ({
              load: num(r.load_kg),
              reps: num(r.reps),
              rpe: num(r.rpe),
              duration: r.duration_seconds ?? null,
              distance: num(r.distance_km),
              hr: r.hr_avg ?? null,
              incline: num(r.incline_pct),
            })),
        };
      }
      lastPerfRef.current = res;
      setLastPerf(res);
      if (!logId) setBlocks((bs) => bs.map((b) => (b.exercise_id && res[b.exercise_id] ? prefillBlock(b, res[b.exercise_id]) : b)));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, exerciseIds.join(","), logId]);

  function updateSet(bi: number, si: number, patch: Partial<SetRow>) {
    const edits = ["load", "reps", "duration", "distance", "incline"].some((k) => k in patch);
    setBlocks((bs) =>
      bs.map((b, i) => (i !== bi ? b : { ...b, sets: b.sets.map((s, j) => (j === si ? { ...s, ...patch, ...(edits ? { auto: false } : {}) } : s)) })),
    );
  }
  /** Ajuste la charge de toutes les séries de travail d'un exercice (progression). */
  function bumpLoad(bi: number, delta: number) {
    setBlocks((bs) =>
      bs.map((b, i) =>
        i !== bi
          ? b
          : {
              ...b,
              sets: b.sets.map((s) => {
                const v = parseNum(s.load);
                if (v === null || s.set_type === "echauffement") return s;
                return { ...s, load: str(Math.max(0, Math.round((v + delta) * 100) / 100)), auto: false };
              }),
            },
      ),
    );
  }
  function toggleDone(bi: number, si: number) {
    const s = blocks[bi]?.sets[si];
    if (!s) return;
    updateSet(bi, si, { done: !s.done });
    if (!s.done) startRest(bi, si);
  }
  function addSet(bi: number) {
    setBlocks((bs) =>
      bs.map((b, i) => {
        if (i !== bi) return b;
        const last = b.sets[b.sets.length - 1];
        return { ...b, sets: [...b.sets, last ? { ...last, comment: "", done: false, auto: false } : emptySet()] };
      }),
    );
  }
  function removeSet(bi: number, si: number) {
    setBlocks((bs) => bs.map((b, i) => (i !== bi ? b : { ...b, sets: b.sets.filter((_, j) => j !== si) })));
  }
  function moveBlock(bi: number, dir: -1 | 1) {
    setBlocks((bs) => {
      const t = bi + dir;
      if (t < 0 || t >= bs.length) return bs;
      const copy = [...bs];
      [copy[bi], copy[t]] = [copy[t], copy[bi]];
      return copy;
    });
  }

  async function save() {
    setError(null);
    if (!clientId) return setError("Choisissez un client.");
    if (!date) return setError("Indiquez la date de la séance.");

    // Validation et construction des séries
    const rows: Record<string, unknown>[] = [];
    for (const [order, b] of blocks.entries()) {
      let n = 0;
      for (const s of b.sets) {
        const load = parseNum(s.load);
        const reps = parseNum(s.reps);
        const rpe = parseNum(s.rpe);
        const rir = parseNum(s.rir);
        const rest = s.rest.trim() ? parseRest(s.rest) : null;
        const duration = s.duration.trim() ? parseDuration(s.duration) : null;
        const distance = parseNum(s.distance);
        const hrAvg = parseNum(s.hr_avg);
        const hrMax = parseNum(s.hr_max);
        const filled = [s.load, s.reps, s.rpe, s.rir, s.comment, s.duration, s.distance, s.intensity, s.hr_avg, s.hr_max, s.incline].some(
          (v) => v.trim() !== "",
        );
        if (!filled) continue;
        if (s.duration.trim() && (duration === null || duration > 86400)) return setError(`${b.exercise_name} : durée invalide (ex. 30, 32:30, 1h15).`);
        if (s.distance.trim() && (distance === null || distance < 0 || distance > 1000)) return setError(`${b.exercise_name} : distance invalide (km).`);
        const inc = parseNum(s.incline);
        if (s.incline.trim() && (inc === null || inc < 0 || inc > 40)) return setError(`${b.exercise_name} : inclinaison entre 0 et 40 %.`);
        if (s.hr_avg.trim() && (hrAvg === null || !Number.isInteger(hrAvg) || hrAvg < 30 || hrAvg > 250)) return setError(`${b.exercise_name} : FC moyenne invalide (30 à 250 bpm).`);
        if (s.hr_max.trim() && (hrMax === null || !Number.isInteger(hrMax) || hrMax < 30 || hrMax > 250)) return setError(`${b.exercise_name} : FC max invalide (30 à 250 bpm).`);
        if (s.load && (load === null || load < 0 || load > 1000)) return setError(`${b.exercise_name} : charge invalide.`);
        if (s.reps && (reps === null || !Number.isInteger(reps) || reps < 0 || reps > 200)) return setError(`${b.exercise_name} : répétitions invalides.`);
        if (s.rpe && (rpe === null || rpe < 1 || rpe > 10)) return setError(`${b.exercise_name} : RPE entre 1 et 10.`);
        if (s.rir && (rir === null || !Number.isInteger(rir) || rir < 0 || rir > 10)) return setError(`${b.exercise_name} : RIR entier entre 0 et 10.`);
        n += 1;
        rows.push({
          exercise_id: b.exercise_id,
          exercise_name: b.exercise_name,
          exercise_order: order,
          set_number: n,
          set_type: s.set_type || null,
          planned_reps: b.planned?.reps ?? null,
          planned_load_kg: b.planned?.load_kg ?? null,
          planned_rpe: b.planned?.rpe ?? null,
          planned_rir: b.planned?.rir ?? null,
          planned_duration_seconds: b.planned?.duration_seconds ?? null,
          planned_distance_km: b.planned?.distance_km ?? null,
          planned_intensity: b.planned?.intensity ?? null,
          planned_hr_min: b.planned?.hr_min ?? null,
          planned_hr_max: b.planned?.hr_max ?? null,
          // colonnes d'inclinaison envoyées seulement si utilisées (fichier SQL de l'inclinaison)
          ...(b.planned?.incline_pct != null ? { planned_incline_pct: b.planned.incline_pct } : {}),
          ...(parseNum(s.incline) !== null ? { incline_pct: parseNum(s.incline) } : {}),
          duration_seconds: duration,
          distance_km: distance,
          intensity: emptyToNull(s.intensity),
          hr_avg: hrAvg,
          hr_max: hrMax,
          load_kg: load,
          reps,
          rpe,
          rir,
          rest_seconds: rest,
          comment: emptyToNull(s.comment),
        });
      }
    }
    if (!rows.length && !comments.trim()) return setError("Saisissez au moins une série réalisée.");

    const program = programs.find((p) => p.id === programId);
    const session = programSessions.find((s) => s.id === sessionId);
    const logPayload = {
      client_id: clientId,
      program_id: programId || null,
      program_session_id: sessionId || null,
      program_name: program?.name ?? original?.program_name ?? null,
      session_name: session?.name ?? original?.session_name ?? null,
      performed_on: date,
      coach_comments: emptyToNull(comments),
    };

    setSaving(true);
    try {
      let id = logId;
      if (editing && logId) {
        const { error } = await sb.from("workout_logs").update(logPayload).eq("id", logId);
        if (error) throw error;
        // On insère d'abord les nouvelles séries, puis on supprime les anciennes : aucune perte en cas d'erreur.
        const oldIds = (original?.workout_sets ?? []).map((s) => s.id);
        if (rows.length) {
          const ins = await sb.from("workout_sets").insert(rows.map((r) => ({ ...r, workout_log_id: logId })));
          if (ins.error) throw ins.error;
        }
        if (oldIds.length) {
          const del = await sb.from("workout_sets").delete().in("id", oldIds);
          if (del.error) throw del.error;
        }
      } else {
        const { data, error } = await sb.from("workout_logs").insert(logPayload).select("id").single();
        if (error) throw error;
        id = data.id;
        if (rows.length) {
          const ins = await sb.from("workout_sets").insert(rows.map((r) => ({ ...r, workout_log_id: id })));
          if (ins.error) {
            await sb.from("workout_logs").delete().eq("id", id);
            throw ins.error;
          }
        }
      }
      toast.success(editing ? "Séance mise à jour." : "Séance enregistrée.");
      router.push(paths.clientSessions(clientId));
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function deleteLog() {
    if (!logId) return;
    const { error } = await sb.from("workout_logs").delete().eq("id", logId);
    if (error) return toast.error(errorMessage(error));
    toast.success("Séance supprimée.");
    router.push(paths.clientSessions(clientId));
  }

  if (loading) return <LoadingBlock />;

  const client = clients.find((c) => c.id === clientId);

  return (
    <>
      <PageHeader
        back={
          <Link
            href={paths.isClient ? "/espace/seances" : clientId ? `/clients/${clientId}?tab=seances` : "/clients"}
            className="inline-flex items-center gap-1.5 text-sm text-ink-400 hover:text-ink-100"
          >
            <ArrowLeft className="h-4 w-4" /> {client ? fullName(client) : "Retour"}
          </Link>
        }
        title={editing ? "Modifier la séance réalisée" : "Saisir une séance réalisée"}
        subtitle="Les charges et répétitions de la dernière séance (ou du programme) sont déjà remplies : ajuste si besoin, coche chaque série, puis enregistre."
        actions={
          editing ? (
            <Button variant="ghost" className="text-red-300 hover:bg-red-500/10" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="h-4 w-4" /> Supprimer
            </Button>
          ) : undefined
        }
      />

      <Card className="mb-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Client" required>
            <Select
              value={clientId}
              onChange={(e) => {
                setClientId(e.target.value);
                setProgramId("");
                setSessionId("");
              }}
              disabled={editing || paths.isClient}
            >
              <option value="">— Choisir —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {fullName(c)}
                </option>
              ))}
              {editing && client === undefined && original && <option value={original.client_id}>Client archivé</option>}
            </Select>
          </Field>
          <Field label="Date de la séance" required>
            <Input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Programme">
            <Select
              value={programId}
              onChange={(e) => {
                setProgramId(e.target.value);
                setSessionId("");
              }}
              disabled={!clientId}
            >
              <option value="">— Séance libre —</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.archived ? " (archivé)" : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Séance prévue" hint={!editing ? "Pré-remplit les exercices du programme." : undefined}>
            <Select value={sessionId} onChange={(e) => setSessionId(e.target.value)} disabled={!programId}>
              <option value="">—</option>
              {programSessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>

      <div className="space-y-4">
        {blocks.map((b, bi) => {
          const last = b.exercise_id ? lastPerf[b.exercise_id] : undefined;
          return (
            <section key={b.key} className="card overflow-hidden animate-fade-in">
              <header className="flex items-start gap-3 border-b border-ink-700/60 bg-ink-800/60 px-4 py-3">
                <VideoThumb url={b.video_url ?? (b.exercise_id ? videos[b.exercise_id] : null)} title={b.exercise_name} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-start gap-1 font-display text-lg font-semibold uppercase tracking-wide text-white">
                    <span className="min-w-0">
                      <span className="mr-2 text-royal-400">{bi + 1}.</span>
                      {b.exercise_name}
                    </span>
                    <ExerciseSheetButton exerciseId={b.exercise_id} name={b.exercise_name} className="-mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-royal-300 transition hover:bg-royal-600/15" />
                  </p>
                  <KcalChip kcal={blockKcal(b)} className="mt-1" title={`Dépense estimée — ${weightNote(weight)} (visible uniquement par toi)`} />
                  {b.planned && (
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-royal-300">
                      <Target className="h-3.5 w-3.5" />
                      <span>Prévu :</span>
                      {b.planned.reps && (
                        <span>
                          {b.planned.sets ?? "?"} × {b.planned.reps}
                        </span>
                      )}
                      {b.cardio && b.planned.sets != null && b.planned.sets > 1 && <span>{b.planned.sets} blocs</span>}
                      {cardioSummary(b.planned).map((c) => (
                        <span key={c}>{c}</span>
                      ))}
                      {b.planned.load_kg != null && <span>{fmtNum(b.planned.load_kg, 2)} kg</span>}
                      {b.planned.rpe != null && <span>RPE {fmtNum(b.planned.rpe)}</span>}
                      {b.planned.rir != null && <span>RIR {b.planned.rir}</span>}
                      {b.planned.rest_seconds != null && <span>Repos {fmtRest(b.planned.rest_seconds)}</span>}
                    </p>
                  )}
                  {b.planned?.technical_cues && <p className="mt-1 text-xs italic text-ink-400">{b.planned.technical_cues}</p>}
                  {last && (
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[12.5px] text-ink-400">
                      <History className="h-3.5 w-3.5" /> Dernière fois ({fmtDate(last.date)}) :
                      <span className="text-ink-200">
                        {last.sets
                          .map((s) =>
                            b.cardio
                              ? [s.duration != null ? fmtDuration(s.duration) : null, s.distance != null ? `${fmtNum(s.distance, 2)} km` : null, s.hr != null ? `${s.hr} bpm` : null]
                                  .filter(Boolean)
                                  .join(" ") || "—"
                              : `${s.load != null ? fmtNum(s.load, 2) : "–"}×${s.reps ?? "–"}`,
                          )
                          .join(" · ")}
                      </span>
                    </p>
                  )}
                </div>
                <div className="flex">
                  <Button size="icon" variant="ghost" onClick={() => moveBlock(bi, -1)} disabled={bi === 0} aria-label="Monter">
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => moveBlock(bi, 1)} disabled={bi === blocks.length - 1} aria-label="Descendre">
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="hover:text-red-300"
                    onClick={() => setBlocks((bs) => bs.filter((_, i) => i !== bi))}
                    aria-label="Retirer l'exercice"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </header>
              <div className={cn("px-2 py-2 sm:px-4", details.has(b.key) && "overflow-x-auto")}>
                {(() => {
                  const more = details.has(b.key);
                  // Colonne inclinaison pour le tapis (ou si une pente est prévue / déjà saisie)
                  const tm = /tapis|inclin/i.test(b.exercise_name) || b.planned?.incline_pct != null || b.sets.some((x) => x.incline.trim() !== "");
                  const doneBtn = (si: number, done?: boolean) => (
                    <td className="whitespace-nowrap py-1 text-right">
                      <button
                        onClick={() => toggleDone(bi, si)}
                        className={cn(
                          "inline-flex h-9 w-9 items-center justify-center rounded-lg border transition",
                          done ? "border-emerald-400 bg-emerald-500/20 text-emerald-300" : "border-ink-600 text-ink-500 hover:border-emerald-400 hover:text-emerald-300",
                        )}
                        aria-label={`${b.cardio ? "Bloc" : "Série"} ${si + 1} faite`}
                        aria-pressed={!!done}
                        title="Série faite (lance le chrono de repos)"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => removeSet(bi, si)}
                        className="ml-1 rounded-md p-1 text-ink-500 hover:bg-ink-750 hover:text-red-300"
                        aria-label={b.cardio ? "Supprimer le bloc" : "Supprimer la série"}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </td>
                  );
                  return b.cardio ? (
                    <table className={cn("w-full text-sm", more && "min-w-[560px]")}>
                      <thead>
                        <tr className="text-[11px] uppercase tracking-wider text-ink-500">
                          <th className="w-7 py-1.5 text-left font-medium">#</th>
                          <th className="py-1.5 text-left font-medium">Durée</th>
                          <th className="py-1.5 text-left font-medium">Distance (km)</th>
                          {tm && <th className="py-1.5 text-left font-medium">Incl. %</th>}
                          {more && (
                            <>
                              <th className="py-1.5 text-left font-medium">Intensité</th>
                              <th className="py-1.5 text-left font-medium">FC moy.</th>
                              <th className="py-1.5 text-left font-medium">FC max</th>
                              <th className="py-1.5 text-left font-medium">RPE</th>
                            </>
                          )}
                          <th className="py-1.5 text-right font-medium">Fait</th>
                        </tr>
                      </thead>
                      <tbody>
                        {b.sets.map((s, si) => (
                          <tr key={si} className={cn(s.done && "bg-emerald-500/5")}>
                            <td className="py-1 pr-2 font-semibold tabular-nums text-ink-400">{si + 1}</td>
                            <td className="py-1 pr-2">
                              <input
                                className="input-sm w-20"
                                value={s.duration}
                                placeholder={b.planned?.duration_seconds != null ? durationInput(b.planned.duration_seconds) : "min"}
                                onChange={(e) => updateSet(bi, si, { duration: e.target.value })}
                                aria-label="Durée"
                              />
                            </td>
                            <td className="py-1 pr-2">
                              <input
                                inputMode="decimal"
                                className="input-sm w-20"
                                value={s.distance}
                                placeholder={b.planned?.distance_km != null ? str(b.planned.distance_km) : "km"}
                                onChange={(e) => updateSet(bi, si, { distance: e.target.value })}
                                aria-label="Distance"
                              />
                            </td>
                            {tm && (
                              <td className="py-1 pr-2">
                                <input
                                  inputMode="decimal"
                                  className="input-sm w-16"
                                  value={s.incline}
                                  placeholder={b.planned?.incline_pct != null ? str(b.planned.incline_pct) : "0"}
                                  onChange={(e) => updateSet(bi, si, { incline: e.target.value })}
                                  aria-label="Inclinaison"
                                />
                              </td>
                            )}
                            {more && (
                              <>
                                <td className="py-1 pr-2">
                                  <input
                                    className="input-sm w-32"
                                    value={s.intensity}
                                    placeholder={b.planned?.intensity ?? "Zone 2, allure…"}
                                    onChange={(e) => updateSet(bi, si, { intensity: e.target.value })}
                                    maxLength={60}
                                    aria-label="Intensité"
                                  />
                                </td>
                                <td className="py-1 pr-2">
                                  <input
                                    inputMode="numeric"
                                    className="input-sm w-16"
                                    value={s.hr_avg}
                                    placeholder={b.planned?.hr_min != null ? String(b.planned.hr_min) : "bpm"}
                                    onChange={(e) => updateSet(bi, si, { hr_avg: e.target.value })}
                                    aria-label="FC moyenne"
                                  />
                                </td>
                                <td className="py-1 pr-2">
                                  <input
                                    inputMode="numeric"
                                    className="input-sm w-16"
                                    value={s.hr_max}
                                    placeholder={b.planned?.hr_max != null ? String(b.planned.hr_max) : "bpm"}
                                    onChange={(e) => updateSet(bi, si, { hr_max: e.target.value })}
                                    aria-label="FC max"
                                  />
                                </td>
                                <td className="py-1 pr-2">
                                  <input
                                    inputMode="decimal"
                                    className="input-sm w-14"
                                    value={s.rpe}
                                    placeholder={b.planned?.rpe != null ? str(b.planned.rpe) : ""}
                                    onChange={(e) => updateSet(bi, si, { rpe: e.target.value })}
                                    aria-label="RPE"
                                  />
                                </td>
                              </>
                            )}
                            {doneBtn(si, s.done)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <table className={cn("w-full text-sm", more && "min-w-[600px]")}>
                      <thead>
                        <tr className="text-[11px] uppercase tracking-wider text-ink-500">
                          <th className="w-7 py-1.5 text-left font-medium">#</th>
                          {more && <th className="py-1.5 text-left font-medium">Type</th>}
                          <th className="py-1.5 text-left font-medium">Charge (kg)</th>
                          <th className="py-1.5 text-left font-medium">Reps</th>
                          {more && (
                            <>
                              <th className="py-1.5 text-left font-medium">RPE</th>
                              <th className="py-1.5 text-left font-medium">RIR</th>
                              <th className="py-1.5 text-left font-medium">Repos (s)</th>
                              <th className="w-16 py-1.5 text-right font-medium">1RM est.</th>
                            </>
                          )}
                          <th className="py-1.5 text-right font-medium">Fait</th>
                        </tr>
                      </thead>
                      <tbody>
                        {b.sets.map((s, si) => {
                          const e1 = estimate1RM(parseNum(s.load), parseNum(s.reps));
                          return (
                            <tr key={si} className={cn(s.set_type === "echauffement" && "opacity-70", s.done && "bg-emerald-500/5")}>
                              <td className="py-1 pr-2 font-semibold tabular-nums text-ink-400">
                                {si + 1}
                                {s.set_type === "echauffement" && !more && <span className="ml-0.5 text-[10px] font-normal text-amber-300">éch.</span>}
                              </td>
                              {more && (
                                <td className="py-1 pr-2">
                                  <select
                                    value={s.set_type}
                                    onChange={(e) => updateSet(bi, si, { set_type: e.target.value as SetType })}
                                    className="input-sm w-[112px]"
                                    aria-label="Type de série"
                                  >
                                    <option value="">—</option>
                                    {Object.entries(SET_TYPE_LABELS).map(([k, v]) => (
                                      <option key={k} value={k}>
                                        {v}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                              )}
                              <td className="py-1 pr-2">
                                <input
                                  inputMode="decimal"
                                  className="input-sm w-20 text-center text-base font-semibold tabular-nums sm:w-24"
                                  value={s.load}
                                  placeholder={b.planned?.load_kg != null ? str(b.planned.load_kg) : "kg"}
                                  onChange={(e) => updateSet(bi, si, { load: e.target.value })}
                                  aria-label={`Charge série ${si + 1}`}
                                />
                              </td>
                              <td className="py-1 pr-2">
                                <input
                                  inputMode="numeric"
                                  className="input-sm w-16 text-center text-base font-semibold tabular-nums sm:w-20"
                                  value={s.reps}
                                  placeholder={b.planned?.reps ?? "reps"}
                                  onChange={(e) => updateSet(bi, si, { reps: e.target.value })}
                                  aria-label={`Répétitions série ${si + 1}`}
                                />
                              </td>
                              {more && (
                                <>
                                  <td className="py-1 pr-2">
                                    <input
                                      inputMode="decimal"
                                      className="input-sm w-14"
                                      value={s.rpe}
                                      placeholder={b.planned?.rpe != null ? str(b.planned.rpe) : ""}
                                      onChange={(e) => updateSet(bi, si, { rpe: e.target.value })}
                                      aria-label="RPE"
                                    />
                                  </td>
                                  <td className="py-1 pr-2">
                                    <input
                                      inputMode="numeric"
                                      className="input-sm w-14"
                                      value={s.rir}
                                      placeholder={b.planned?.rir != null ? String(b.planned.rir) : ""}
                                      onChange={(e) => updateSet(bi, si, { rir: e.target.value })}
                                      aria-label="RIR"
                                    />
                                  </td>
                                  <td className="py-1 pr-2">
                                    <input inputMode="numeric" className="input-sm w-16" value={s.rest} onChange={(e) => updateSet(bi, si, { rest: e.target.value })} aria-label="Repos" />
                                  </td>
                                  <td className="py-1 pr-2 text-right tabular-nums text-ink-400">{e1 ? fmtNum(e1) : "—"}</td>
                                </>
                              )}
                              {doneBtn(si, s.done)}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  );
                })()}
              </div>
              <div className="flex flex-wrap items-center gap-2 border-t border-ink-750 px-3 py-2 sm:px-4">
                <Button size="sm" variant="ghost" onClick={() => addSet(bi)} className="text-royal-300">
                  <Plus className="h-4 w-4" /> {b.cardio ? "Bloc" : "Série"}
                </Button>
                {!b.cardio && b.sets.some((x) => parseNum(x.load) !== null) && (
                  <span className="inline-flex items-center gap-1">
                    <Button size="sm" variant="secondary" onClick={() => bumpLoad(bi, -2.5)} aria-label="Toutes les séries −2,5 kg">
                      −2,5 kg
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => bumpLoad(bi, 2.5)} aria-label="Toutes les séries +2,5 kg">
                      +2,5 kg
                    </Button>
                  </span>
                )}
                <button
                  type="button"
                  onClick={() =>
                    setDetails((d) => {
                      const n = new Set(d);
                      if (n.has(b.key)) n.delete(b.key);
                      else n.add(b.key);
                      return n;
                    })
                  }
                  className="ml-auto text-xs font-medium text-ink-400 hover:text-royal-300"
                  aria-expanded={details.has(b.key)}
                >
                  {details.has(b.key) ? "− Moins de détails" : b.cardio ? "+ Intensité, FC, RPE" : "+ RPE, RIR, repos"}
                </button>
              </div>
            </section>
          );
        })}

        <button
          onClick={() => setPickerOpen(true)}
          disabled={!clientId}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-ink-600 py-4 text-sm font-medium text-ink-300 transition hover:border-royal-500 hover:text-royal-300 disabled:opacity-40"
        >
          <Plus className="h-4 w-4" /> Ajouter un exercice
        </button>

        <Card title="Commentaires du coach">
          <Textarea value={comments} onChange={(e) => setComments(e.target.value)} rows={3} maxLength={4000} placeholder="Ressenti, forme du jour, points techniques…" />
        </Card>

        {error && <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}

        <div className="sticky bottom-20 z-20 space-y-2 lg:bottom-4">
          <RestTimer request={rest} onDone={finishRest} onClose={() => setRest(null)} />
        <div className="flex flex-wrap items-center justify-end gap-2 rounded-2xl border border-ink-700 bg-ink-900/95 p-3 backdrop-blur">
          <KcalChip
            strong
            className="mr-auto self-center sm:mr-0"
            kcal={blocks.reduce((n, b) => n + blockKcal(b), 0)}
            title={`Dépense estimée de la séance — ${weightNote(weight)} (visible uniquement par toi)`}
          />
          <span className="mr-auto hidden self-center text-sm text-ink-400 sm:block">
            {blocks.length} exercice(s) ·{" "}
            {blocks.reduce((n, b) => n + b.sets.filter((s) => s.load || s.reps || s.duration || s.distance).length, 0)} série(s) renseignée(s)
          </span>
          <Button variant="secondary" onClick={() => router.back()}>
            Annuler
          </Button>
          <Button onClick={save} loading={saving}>
            Enregistrer la séance
          </Button>
        </div>
        </div>
      </div>

      <ExercisePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(exs) =>
          setBlocks((bs) => [
            ...bs,
            ...exs.map((e) => {
              const cardio = isCardioExercise(e);
              return {
                key: uid(),
                exercise_id: e.id,
                exercise_name: e.name,
                video_url: e.video_url,
                cardio,
                planned: null,
                sets: (cardio ? [emptySet()] : [emptySet(), emptySet(), emptySet()]).map((x) => ({ ...x, auto: true })),
              };
            }),
          ])
        }
      />
      <ConfirmDialog
        open={confirmDelete}
        title="Supprimer cette séance ?"
        message={
          <>
            La séance du <strong className="text-white">{fmtDate(date)}</strong> et toutes ses séries seront supprimées définitivement.
            {original?.session_name && (
              <>
                {" "}
                <Badge tone="blue">{original.session_name}</Badge>
              </>
            )}
          </>
        }
        onConfirm={deleteLog}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
