"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronDown, ClipboardPlus, Dumbbell, Pencil, Trophy } from "lucide-react";
import { Badge, Card, EmptyState, ErrorBlock, Input, LinkButton, LoadingBlock, Select, StatCard, cn } from "./ui";
import { TimeChart } from "./charts";
import { getSupabase } from "@/lib/supabase/client";
import { unwrap, useAsync } from "@/lib/hooks";
import { aggregateExercise, estimate1RM, type ExerciseSessionPoint } from "@/lib/calc";
import { fmtDate, fmtDateLong, fmtNum, num, SET_TYPE_LABELS } from "@/lib/format";
import type { WorkoutLog, WorkoutSet } from "@/lib/types";

/* ------------------------------------------------------------------ */
/* Historique des séances réalisées                                    */
/* ------------------------------------------------------------------ */

export function SessionHistory({ clientId }: { clientId: string }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const { data, loading, error, reload } = useAsync(async () => {
    return unwrap(
      await getSupabase()
        .from("workout_logs")
        .select("*, workout_sets(*)")
        .eq("client_id", clientId)
        .order("performed_on", { ascending: false })
        .order("created_at", { ascending: false }),
    ) as WorkoutLog[];
  }, [clientId]);

  const list = useMemo(
    () => (data ?? []).filter((l) => (!from || l.performed_on >= from) && (!to || l.performed_on <= to)),
    [data, from, to],
  );

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} onRetry={reload} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="grid flex-1 grid-cols-2 gap-2 sm:max-w-sm">
          <label className="text-xs text-ink-400">
            Du
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1" />
          </label>
          <label className="text-xs text-ink-400">
            Au
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1" />
          </label>
        </div>
        <LinkButton href={`/sessions/new?client=${clientId}`} className="sm:ml-auto">
          <ClipboardPlus className="h-4 w-4" /> Saisir une séance
        </LinkButton>
      </div>

      {list.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Dumbbell className="h-6 w-6" />}
            title={data?.length ? "Aucune séance sur cette période" : "Aucune séance réalisée"}
            text="Enregistrez les performances réellement obtenues : charges, répétitions, RPE et RIR."
          />
        </Card>
      ) : (
        <div className="space-y-2">
          {list.map((l) => {
            const sets = [...(l.workout_sets ?? [])].sort((a, b) => a.exercise_order - b.exercise_order || a.set_number - b.set_number);
            const exercises = groupByExercise(sets);
            const volume = sets.reduce((v, s) => v + (num(s.load_kg) ?? 0) * (num(s.reps) ?? 0), 0);
            const isOpen = open === l.id;
            return (
              <div key={l.id} className="card overflow-hidden">
                <button className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-ink-800/60" onClick={() => setOpen(isOpen ? null : l.id)}>
                  <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-ink-750 leading-none">
                    <span className="font-display text-lg font-semibold text-white">{l.performed_on.slice(8, 10)}</span>
                    <span className="text-[10px] uppercase text-ink-400">
                      {new Date(l.performed_on + "T12:00:00").toLocaleDateString("fr-FR", { month: "short" })}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-white">
                      {l.session_name ?? "Séance libre"}
                      {l.program_name && <span className="font-normal text-ink-400"> · {l.program_name}</span>}
                    </p>
                    <p className="text-xs text-ink-400">
                      {fmtDateLong(l.performed_on)} · {exercises.length} exercice(s) · {sets.length} série(s)
                      {volume > 0 && ` · ${fmtNum(volume, 1)} kg de volume`}
                    </p>
                  </div>
                  <ChevronDown className={cn("h-5 w-5 text-ink-500 transition", isOpen && "rotate-180")} />
                </button>
                {isOpen && (
                  <div className="border-t border-ink-700/60 px-4 py-4 animate-fade-in">
                    <div className="space-y-4">
                      {exercises.map((ex) => (
                        <div key={ex.key}>
                          <p className="mb-1.5 text-sm font-semibold text-white">{ex.name}</p>
                          <SetsTable sets={ex.sets} />
                        </div>
                      ))}
                    </div>
                    {l.coach_comments && (
                      <p className="mt-4 whitespace-pre-line rounded-xl bg-ink-800 px-3 py-2.5 text-sm text-ink-200">{l.coach_comments}</p>
                    )}
                    <div className="mt-4 flex justify-end">
                      <LinkButton href={`/sessions/${l.id}`} variant="secondary" size="sm">
                        <Pencil className="h-3.5 w-3.5" /> Modifier
                      </LinkButton>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function groupByExercise(sets: WorkoutSet[]) {
  const out: { key: string; name: string; sets: WorkoutSet[] }[] = [];
  for (const s of sets) {
    const key = `${s.exercise_order}`;
    let g = out.find((x) => x.key === key);
    if (!g) {
      g = { key, name: s.exercise_name, sets: [] };
      out.push(g);
    }
    g.sets.push(s);
  }
  return out;
}

/** Tableau des séries : prévu (bleu) vs réalisé (blanc). */
export function SetsTable({ sets }: { sets: WorkoutSet[] }) {
  const planned = sets[0];
  const hasPlan = planned && (planned.planned_reps || planned.planned_load_kg != null || planned.planned_rpe != null || planned.planned_rir != null);
  return (
    <div className="overflow-x-auto">
      {hasPlan && (
        <p className="mb-1 text-xs text-royal-300">
          Prévu : {planned.planned_reps ?? "?"} reps
          {planned.planned_load_kg != null && ` · ${fmtNum(planned.planned_load_kg, 2)} kg`}
          {planned.planned_rpe != null && ` · RPE ${fmtNum(planned.planned_rpe)}`}
          {planned.planned_rir != null && ` · RIR ${planned.planned_rir}`}
        </p>
      )}
      <table className="w-full min-w-[420px] text-sm">
        <thead>
          <tr className="text-[11px] uppercase tracking-wider text-ink-500">
            <th className="py-1 text-left font-medium">Série</th>
            <th className="py-1 text-left font-medium">Charge</th>
            <th className="py-1 text-left font-medium">Reps</th>
            <th className="py-1 text-left font-medium">RPE</th>
            <th className="py-1 text-left font-medium">RIR</th>
            <th className="py-1 text-left font-medium">1RM est.</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {sets.map((s) => {
            const e1 = s.set_type === "echauffement" ? null : estimate1RM(num(s.load_kg), num(s.reps));
            return (
              <tr key={s.id} className={cn("border-t border-ink-750", s.set_type === "echauffement" && "text-ink-500")}>
                <td className="py-1.5">
                  {s.set_number}
                  {s.set_type && s.set_type !== "travail" && <span className="ml-1.5 text-[11px] text-amber-300">{SET_TYPE_LABELS[s.set_type]}</span>}
                </td>
                <td className="py-1.5 font-medium text-white">{s.load_kg != null ? `${fmtNum(s.load_kg, 2)} kg` : "—"}</td>
                <td className="py-1.5">{s.reps ?? "—"}</td>
                <td className="py-1.5">{s.rpe != null ? fmtNum(s.rpe) : "—"}</td>
                <td className="py-1.5">{s.rir ?? "—"}</td>
                <td className="py-1.5 text-ink-400">{e1 ? `${fmtNum(e1)} kg` : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {sets.some((s) => s.comment) && (
        <ul className="mt-1 space-y-0.5 text-xs italic text-ink-400">
          {sets.filter((s) => s.comment).map((s) => (
            <li key={s.id}>
              Série {s.set_number} : {s.comment}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Progression sportive                                                */
/* ------------------------------------------------------------------ */

type SetWithLog = WorkoutSet & { workout_logs: { performed_on: string } | null };
type Metric = "topLoad" | "best1RM" | "volume" | "totalReps";
const METRICS: { key: Metric; label: string; unit: string }[] = [
  { key: "topLoad", label: "Charge maximale", unit: "kg" },
  { key: "best1RM", label: "1RM estimé", unit: "kg" },
  { key: "volume", label: "Volume (charge × reps)", unit: "kg" },
  { key: "totalReps", label: "Répétitions totales", unit: "reps" },
];

export function ProgressionPanel({ clientId }: { clientId: string }) {
  const { data, loading, error, reload } = useAsync(async () => {
    return unwrap(
      await getSupabase()
        .from("workout_sets")
        .select("*, workout_logs!inner(performed_on, client_id)")
        .eq("workout_logs.client_id", clientId)
        .order("set_number"),
    ) as SetWithLog[];
  }, [clientId]);

  const groups = useMemo(() => {
    const m = new Map<string, { key: string; name: string; rows: SetWithLog[] }>();
    for (const s of data ?? []) {
      const key = s.exercise_id ?? `name:${s.exercise_name}`;
      if (!m.has(key)) m.set(key, { key, name: s.exercise_name, rows: [] });
      m.get(key)!.rows.push(s);
    }
    return [...m.values()]
      .map((g) => ({ ...g, points: aggregateExercise(g.rows) }))
      .filter((g) => g.points.length > 0)
      .sort((a, b) => b.points.length - a.points.length || a.name.localeCompare(b.name));
  }, [data]);

  const [selected, setSelected] = useState("");
  const [metric, setMetric] = useState<Metric>("topLoad");
  const [cmpA, setCmpA] = useState("");
  const [cmpB, setCmpB] = useState("");

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} onRetry={reload} />;
  if (!groups.length)
    return (
      <Card>
        <EmptyState
          icon={<Trophy className="h-6 w-6" />}
          title="Pas encore de données de progression"
          text="La progression apparaît dès que des séances réalisées sont enregistrées."
          action={
            <LinkButton href={`/sessions/new?client=${clientId}`}>
              <ClipboardPlus className="h-4 w-4" /> Saisir une séance
            </LinkButton>
          }
        />
      </Card>
    );

  const group = groups.find((g) => g.key === selected) ?? groups[0];
  const points = group.points;
  const last = points[points.length - 1];
  const bestLoad = maxBy(points, (p) => p.topLoad);
  const best1RM = maxBy(points, (p) => p.best1RM);
  const bestVolume = maxBy(points, (p) => p.volume || null);
  const m = METRICS.find((x) => x.key === metric)!;
  const chartData = points.map((p) => ({ date: p.date, value: p[metric] === 0 && metric !== "totalReps" ? null : p[metric] }));
  const pa = points.find((p) => p.logId === cmpA);
  const pb = points.find((p) => p.logId === cmpB);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-[1fr_240px]">
        <Select
          value={group.key}
          onChange={(e) => {
            setSelected(e.target.value);
            setCmpA("");
            setCmpB("");
          }}
          aria-label="Exercice"
        >
          {groups.map((g) => (
            <option key={g.key} value={g.key}>
              {g.name} ({g.points.length} séance{g.points.length > 1 ? "s" : ""})
            </option>
          ))}
        </Select>
        <Select value={metric} onChange={(e) => setMetric(e.target.value as Metric)} aria-label="Indicateur">
          {METRICS.map((x) => (
            <option key={x.key} value={x.key}>
              {x.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Dernière performance"
          value={last.topLoad !== null ? `${fmtNum(last.topLoad, 2)} kg` : "—"}
          hint={`${fmtDate(last.date)} · ${last.sets.map((s) => `${s.load_kg != null ? fmtNum(s.load_kg, 2) : "–"}×${s.reps ?? "–"}`).join(" ")}`}
          accent
        />
        <StatCard
          label="Meilleure charge"
          value={bestLoad?.topLoad != null ? `${fmtNum(bestLoad.topLoad, 2)} kg` : "—"}
          hint={bestLoad ? `${bestLoad.topLoadReps ?? "?"} reps · ${fmtDate(bestLoad.date)}` : undefined}
          icon={<Trophy className="h-4 w-4" />}
        />
        <StatCard
          label="Meilleur 1RM estimé"
          value={best1RM?.best1RM != null ? `${fmtNum(best1RM.best1RM)} kg` : "—"}
          hint={best1RM ? `${fmtDate(best1RM.date)} · formule d'Epley, indicatif` : "Séries ≤ 12 reps requises"}
        />
        <StatCard
          label="Volume record"
          value={bestVolume?.volume ? `${fmtNum(bestVolume.volume)} kg` : "—"}
          hint={bestVolume ? fmtDate(bestVolume.date) : undefined}
        />
      </div>

      <Card title={`${group.name} — ${m.label}`}>
        <TimeChart data={chartData} series={[{ key: "value", label: m.label, color: "#4A6CF7" }]} unit={m.unit} />
        <p className="mt-2 text-xs text-ink-500">Séries d&apos;échauffement exclues. Chaque point correspond à une séance réellement enregistrée.</p>
      </Card>

      {points.length > 1 && (
        <Card title="Comparer deux séances">
          <div className="grid gap-2 sm:grid-cols-2">
            <Select value={cmpA} onChange={(e) => setCmpA(e.target.value)} aria-label="Séance 1">
              <option value="">Première date</option>
              {points.map((p) => (
                <option key={p.logId} value={p.logId}>
                  {fmtDate(p.date)}
                </option>
              ))}
            </Select>
            <Select value={cmpB} onChange={(e) => setCmpB(e.target.value)} aria-label="Séance 2">
              <option value="">Seconde date</option>
              {points.map((p) => (
                <option key={p.logId} value={p.logId}>
                  {fmtDate(p.date)}
                </option>
              ))}
            </Select>
          </div>
          {pa && pb && (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {[pa, pb].map((p) => (
                <div key={p.logId} className="rounded-xl border border-ink-700 bg-ink-900 p-3">
                  <p className="mb-2 text-sm font-semibold text-white">{fmtDateLong(p.date)}</p>
                  <SetsTable sets={p.sets} />
                </div>
              ))}
              <div className="md:col-span-2">
                <CompareRow label="Charge max" a={pa.topLoad} b={pb.topLoad} unit="kg" />
                <CompareRow label="1RM estimé" a={pa.best1RM} b={pb.best1RM} unit="kg" />
                <CompareRow label="Volume" a={pa.volume} b={pb.volume} unit="kg" />
                <CompareRow label="Répétitions totales" a={pa.totalReps} b={pb.totalReps} unit="" />
              </div>
            </div>
          )}
        </Card>
      )}

      <Card title="Toutes les séances" padded={false}>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Date</th>
                <th>Séries (charge × reps)</th>
                <th>Charge max</th>
                <th>1RM est.</th>
                <th>Volume</th>
              </tr>
            </thead>
            <tbody>
              {[...points].reverse().map((p) => (
                <tr key={p.logId}>
                  <td className="whitespace-nowrap">
                    <Link href={`/sessions/${p.logId}`} className="text-royal-300 hover:text-royal-200">
                      {fmtDate(p.date)}
                    </Link>
                  </td>
                  <td className="tabular-nums text-ink-300">
                    {p.sets.map((s) => `${s.load_kg != null ? fmtNum(s.load_kg, 2) : "–"}×${s.reps ?? "–"}`).join("  ")}
                  </td>
                  <td className="whitespace-nowrap tabular-nums font-medium text-white">
                    {p.topLoad != null ? `${fmtNum(p.topLoad, 2)} kg` : "—"}
                    {p === bestLoad && <Badge tone="green" className="ml-2">Record</Badge>}
                  </td>
                  <td className="whitespace-nowrap tabular-nums">{p.best1RM != null ? `${fmtNum(p.best1RM)} kg` : "—"}</td>
                  <td className="whitespace-nowrap tabular-nums">{p.volume ? `${fmtNum(p.volume)} kg` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function CompareRow({ label, a, b, unit }: { label: string; a: number | null; b: number | null; unit: string }) {
  const d = a !== null && b !== null ? Math.round((b - a) * 10) / 10 : null;
  return (
    <div className="flex items-center justify-between border-b border-ink-750 py-2 text-sm last:border-0">
      <span className="text-ink-400">{label}</span>
      <span className="tabular-nums text-ink-200">
        {a !== null ? fmtNum(a) : "—"} → {b !== null ? fmtNum(b) : "—"} {unit}
        {d !== null && d !== 0 && (
          <span className={cn("ml-2 font-semibold", d > 0 ? "text-emerald-400" : "text-amber-400")}>
            ({d > 0 ? "+" : "−"}
            {fmtNum(Math.abs(d))})
          </span>
        )}
      </span>
    </div>
  );
}

function maxBy(points: ExerciseSessionPoint[], f: (p: ExerciseSessionPoint) => number | null): ExerciseSessionPoint | null {
  let best: ExerciseSessionPoint | null = null;
  let bv = -Infinity;
  for (const p of points) {
    const v = f(p);
    if (v !== null && v > bv) {
      bv = v;
      best = p;
    }
  }
  return best;
}

