"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowLeft, ArrowUp, History, Plus, Target, Trash2, X } from "lucide-react";
import { Badge, Button, Card, ConfirmDialog, Field, Input, LoadingBlock, PageHeader, Select, Textarea, cn } from "./ui";
import { ExercisePicker } from "./ExercisePicker";
import { useToast } from "./toast";
import { getSupabase } from "@/lib/supabase/client";
import { fetchProgramFull } from "@/lib/data";
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
  todayISO,
} from "@/lib/format";
import { estimate1RM } from "@/lib/calc";
import type { Client, Program, ProgramSession, SetType, WorkoutLog, WorkoutSet } from "@/lib/types";

interface SetRow {
  load: string;
  reps: string;
  rpe: string;
  rir: string;
  rest: string;
  comment: string;
  set_type: SetType | "";
}
interface Planned {
  sets: number | null;
  reps: string | null;
  load_kg: number | null;
  rpe: number | null;
  rir: number | null;
  rest_seconds: number | null;
  technical_cues: string | null;
}
interface Block {
  key: string;
  exercise_id: string | null;
  exercise_name: string;
  planned: Planned | null;
  sets: SetRow[];
}

const emptySet = (set_type: SetType | "" = "travail"): SetRow => ({ load: "", reps: "", rpe: "", rir: "", rest: "", comment: "", set_type });
const uid = () => Math.random().toString(36).slice(2, 10);
const str = (v: unknown) => (num(v) === null ? "" : String(num(v)).replace(".", ","));

type LastPerf = { date: string; sets: { load: number | null; reps: number | null; rpe: number | null }[] };

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
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Chargement initial
  useEffect(() => {
    (async () => {
      const { data: cl } = await sb.from("clients").select("id, first_name, last_name").eq("archived", false).order("last_name");
      setClients(cl ?? []);
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
              planned:
                s.planned_reps || s.planned_load_kg != null || s.planned_rpe != null || s.planned_rir != null
                  ? {
                      sets: null,
                      reps: s.planned_reps,
                      load_kg: num(s.planned_load_kg),
                      rpe: num(s.planned_rpe),
                      rir: s.planned_rir,
                      rest_seconds: null,
                      technical_cues: null,
                    }
                  : null,
              sets: [],
            };
            grouped.push(b);
          }
          b.sets.push({
            load: str(s.load_kg),
            reps: s.reps?.toString() ?? "",
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
        planned: {
          sets: pe.sets,
          reps: pe.reps,
          load_kg: num(pe.load_kg),
          rpe: num(pe.rpe),
          rir: pe.rir,
          rest_seconds: pe.rest_seconds,
          technical_cues: pe.technical_cues,
        },
        sets: Array.from({ length: Math.max(1, Math.min(pe.sets ?? 1, 12)) }, () => ({
          ...emptySet(pe.set_type ?? "travail"),
          rest: pe.rest_seconds != null ? String(pe.rest_seconds) : "",
        })),
      })),
    );
  }, [sessionId, programSessions, editing]);

  // Dernières performances du client pour chaque exercice
  const exerciseIds = useMemo(() => [...new Set(blocks.map((b) => b.exercise_id).filter(Boolean) as string[])], [blocks]);
  useEffect(() => {
    if (!clientId || !exerciseIds.length) return;
    (async () => {
      const { data } = await sb
        .from("workout_sets")
        .select("exercise_id, load_kg, reps, rpe, set_number, set_type, workout_log_id, workout_logs!inner(client_id, performed_on)")
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
            .map((r) => ({ load: num(r.load_kg), reps: num(r.reps), rpe: num(r.rpe) })),
        };
      }
      setLastPerf(res);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, exerciseIds.join(","), logId]);

  function updateSet(bi: number, si: number, patch: Partial<SetRow>) {
    setBlocks((bs) => bs.map((b, i) => (i !== bi ? b : { ...b, sets: b.sets.map((s, j) => (j === si ? { ...s, ...patch } : s)) })));
  }
  function addSet(bi: number) {
    setBlocks((bs) =>
      bs.map((b, i) => {
        if (i !== bi) return b;
        const last = b.sets[b.sets.length - 1];
        return { ...b, sets: [...b.sets, last ? { ...last, comment: "" } : emptySet()] };
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
        const filled = [s.load, s.reps, s.rpe, s.rir, s.comment].some((v) => v.trim() !== "");
        if (!filled) continue;
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
      router.push(`/clients/${clientId}?tab=seances`);
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
    router.push(`/clients/${clientId}?tab=seances`);
  }

  if (loading) return <LoadingBlock />;

  const client = clients.find((c) => c.id === clientId);

  return (
    <>
      <PageHeader
        back={
          <Link
            href={clientId ? `/clients/${clientId}?tab=seances` : "/clients"}
            className="inline-flex items-center gap-1.5 text-sm text-ink-400 hover:text-ink-100"
          >
            <ArrowLeft className="h-4 w-4" /> {client ? fullName(client) : "Retour"}
          </Link>
        }
        title={editing ? "Modifier la séance réalisée" : "Saisir une séance réalisée"}
        subtitle="Les valeurs prévues par le programme sont rappelées en bleu ; saisissez les performances réellement obtenues."
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
              disabled={editing}
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
              <header className="flex items-start gap-2 border-b border-ink-700/60 bg-ink-800/60 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-display text-lg font-semibold uppercase tracking-wide text-white">
                    <span className="mr-2 text-royal-400">{bi + 1}.</span>
                    {b.exercise_name}
                  </p>
                  {b.planned && (
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-royal-300">
                      <Target className="h-3.5 w-3.5" />
                      <span>Prévu :</span>
                      {(b.planned.sets || b.planned.reps) && (
                        <span>
                          {b.planned.sets ?? "?"} × {b.planned.reps ?? "?"}
                        </span>
                      )}
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
                        {last.sets.map((s) => `${s.load != null ? fmtNum(s.load, 2) : "–"}×${s.reps ?? "–"}`).join(" · ")}
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
              <div className="overflow-x-auto px-2 py-2 sm:px-4">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wider text-ink-500">
                      <th className="w-8 py-1.5 text-left font-medium">#</th>
                      <th className="py-1.5 text-left font-medium">Type</th>
                      <th className="py-1.5 text-left font-medium">Charge (kg)</th>
                      <th className="py-1.5 text-left font-medium">Reps</th>
                      <th className="py-1.5 text-left font-medium">RPE</th>
                      <th className="py-1.5 text-left font-medium">RIR</th>
                      <th className="py-1.5 text-left font-medium">Repos (s)</th>
                      <th className="w-16 py-1.5 text-right font-medium">1RM est.</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {b.sets.map((s, si) => {
                      const e1 = estimate1RM(parseNum(s.load), parseNum(s.reps));
                      return (
                        <tr key={si} className={cn(s.set_type === "echauffement" && "opacity-70")}>
                          <td className="py-1 pr-2 font-semibold tabular-nums text-ink-400">{si + 1}</td>
                          <td className="py-1 pr-2">
                            <select
                              value={s.set_type}
                              onChange={(e) => updateSet(bi, si, { set_type: e.target.value as SetType })}
                              className="input-sm w-[112px]"
                            >
                              <option value="">—</option>
                              {Object.entries(SET_TYPE_LABELS).map(([k, v]) => (
                                <option key={k} value={k}>
                                  {v}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-1 pr-2">
                            <input
                              inputMode="decimal"
                              className="input-sm w-20"
                              value={s.load}
                              placeholder={b.planned?.load_kg != null ? str(b.planned.load_kg) : ""}
                              onChange={(e) => updateSet(bi, si, { load: e.target.value })}
                            />
                          </td>
                          <td className="py-1 pr-2">
                            <input
                              inputMode="numeric"
                              className="input-sm w-16"
                              value={s.reps}
                              placeholder={b.planned?.reps ?? ""}
                              onChange={(e) => updateSet(bi, si, { reps: e.target.value })}
                            />
                          </td>
                          <td className="py-1 pr-2">
                            <input
                              inputMode="decimal"
                              className="input-sm w-14"
                              value={s.rpe}
                              placeholder={b.planned?.rpe != null ? str(b.planned.rpe) : ""}
                              onChange={(e) => updateSet(bi, si, { rpe: e.target.value })}
                            />
                          </td>
                          <td className="py-1 pr-2">
                            <input
                              inputMode="numeric"
                              className="input-sm w-14"
                              value={s.rir}
                              placeholder={b.planned?.rir != null ? String(b.planned.rir) : ""}
                              onChange={(e) => updateSet(bi, si, { rir: e.target.value })}
                            />
                          </td>
                          <td className="py-1 pr-2">
                            <input inputMode="numeric" className="input-sm w-16" value={s.rest} onChange={(e) => updateSet(bi, si, { rest: e.target.value })} />
                          </td>
                          <td className="py-1 pr-2 text-right tabular-nums text-ink-400">{e1 ? fmtNum(e1) : "—"}</td>
                          <td className="py-1 text-right">
                            <button
                              onClick={() => removeSet(bi, si)}
                              className="rounded-md p-1 text-ink-500 hover:bg-ink-750 hover:text-red-300"
                              aria-label="Supprimer la série"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t border-ink-750 px-4 py-2">
                <Button size="sm" variant="ghost" onClick={() => addSet(bi)} className="text-royal-300">
                  <Plus className="h-4 w-4" /> Ajouter une série
                </Button>
                <span className="text-xs text-ink-500">{b.sets.length} série(s)</span>
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

        <div className="sticky bottom-20 z-20 flex justify-end gap-2 rounded-2xl border border-ink-700 bg-ink-900/95 p-3 backdrop-blur lg:bottom-4">
          <span className="mr-auto hidden self-center text-sm text-ink-400 sm:block">
            {blocks.length} exercice(s) ·{" "}
            {blocks.reduce((n, b) => n + b.sets.filter((s) => s.load || s.reps).length, 0)} série(s) renseignée(s)
          </span>
          <Button variant="secondary" onClick={() => router.back()}>
            Annuler
          </Button>
          <Button onClick={save} loading={saving}>
            Enregistrer la séance
          </Button>
        </div>
      </div>

      <ExercisePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(exs) =>
          setBlocks((bs) => [
            ...bs,
            ...exs.map((e) => ({ key: uid(), exercise_id: e.id, exercise_name: e.name, planned: null, sets: [emptySet(), emptySet(), emptySet()] })),
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
