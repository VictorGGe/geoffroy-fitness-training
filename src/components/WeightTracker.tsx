"use client";

import { useMemo, useState } from "react";
import { CalendarDays, FileDown, Flag, Pencil, Plus, Scale, Smartphone, Target, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorBlock,
  Field,
  Input,
  LoadingBlock,
  Modal,
  ProgressBar,
  Select,
  StatCard,
  cn,
} from "./ui";
import { TimeChart } from "./charts";
import { useToast } from "./toast";
import { getSupabase } from "@/lib/supabase/client";
import { unwrap, useAsync } from "@/lib/hooks";
import { milestoneReached, round1, sortWeighIns, weightSummary, type WeightSummary } from "@/lib/calc";
import { emptyToNull, errorMessage, fmtDate, fmtDateLong, fmtKg, fmtSignedKg, num, parseNum, todayISO } from "@/lib/format";
import type { Client, Measurement, Review, WeighIn, WeightGoal, WeightMilestone } from "@/lib/types";

export interface WeightData {
  client: Client;
  goal: WeightGoal | null;
  milestones: WeightMilestone[];
  weighIns: WeighIn[];
  measurements: Measurement[];
  reviews: Review[];
}

export async function loadWeightData(clientId: string): Promise<WeightData> {
  const sb = getSupabase();
  const [client, goal, milestones, weighIns, measurements, reviews] = await Promise.all([
    sb.from("clients").select("*").eq("id", clientId).single(),
    sb.from("weight_goals").select("*").eq("client_id", clientId).maybeSingle(),
    sb.from("weight_milestones").select("*").eq("client_id", clientId).order("weight", { ascending: false }),
    sb.from("weigh_ins").select("*").eq("client_id", clientId).order("measured_on").order("created_at"),
    sb.from("measurements").select("*").eq("client_id", clientId).order("measured_on"),
    sb.from("reviews").select("*").eq("client_id", clientId).order("review_date", { ascending: false }),
  ]);
  return {
    client: unwrap(client) as Client,
    goal: unwrap(goal) as WeightGoal | null,
    milestones: unwrap(milestones) as WeightMilestone[],
    weighIns: unwrap(weighIns) as WeighIn[],
    measurements: unwrap(measurements) as Measurement[],
    reviews: unwrap(reviews) as Review[],
  };
}

function statusText(s: WeightSummary): { text: string; tone: "green" | "blue" | "amber" | "neutral" } {
  switch (s.status) {
    case "no_data":
      return { text: "Aucune pesée enregistrée.", tone: "neutral" };
    case "no_goal":
      return { text: "Aucun objectif défini.", tone: "neutral" };
    case "reached":
      return { text: s.progressRaw! > 100 ? "Objectif atteint et dépassé." : "Objectif atteint.", tone: "green" };
    case "opposite":
      return { text: "Évolution actuellement dans le sens inverse de l'objectif.", tone: "amber" };
    default:
      return { text: `Il reste ${fmtKg(s.remaining)} pour atteindre l'objectif.`, tone: "blue" };
  }
}

export function WeightTracker({ clientId }: { clientId: string }) {
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(() => loadWeightData(clientId), [clientId]);
  const [goalOpen, setGoalOpen] = useState(false);
  const [editing, setEditing] = useState<WeighIn | null>(null);
  const [toDelete, setToDelete] = useState<WeighIn | null>(null);
  const [form, setForm] = useState({ date: todayISO(), weight: "", comment: "" });
  const [saving, setSaving] = useState(false);
  const [pdfBusy, setPdfBusy] = useState<string | null>(null);
  const [cmpA, setCmpA] = useState("");
  const [cmpB, setCmpB] = useState("");

  const sorted = useMemo(() => sortWeighIns(data?.weighIns ?? []), [data]);
  const summary = useMemo(() => weightSummary(data?.weighIns ?? [], data?.goal ?? null), [data]);

  if (loading) return <LoadingBlock />;
  if (error || !data) return <ErrorBlock message={error ?? "Erreur de chargement."} onRetry={reload} />;

  const sb = getSupabase();
  const st = statusText(summary);

  async function addWeighIn(e: React.FormEvent) {
    e.preventDefault();
    const w = parseNum(form.weight);
    if (w === null || w < 20 || w > 400) return toast.error("Saisissez un poids valide (20 à 400 kg).");
    if (!form.date) return toast.error("Indiquez la date.");
    setSaving(true);
    const { error } = await sb.from("weigh_ins").insert({ client_id: clientId, measured_on: form.date, weight_kg: w, comment: emptyToNull(form.comment) });
    setSaving(false);
    if (error) return toast.error(errorMessage(error));
    toast.success("Pesée enregistrée.");
    setForm({ date: todayISO(), weight: "", comment: "" });
    reload();
  }

  async function exportPdf(format: "a4" | "mobile") {
    if (!data) return;
    setPdfBusy(format);
    try {
      const { exportWeightPdf } = await import("@/lib/pdf");
      await exportWeightPdf(data, format);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setPdfBusy(null);
    }
  }

  const chartData = sorted.map((w) => ({ date: w.measured_on, poids: num(w.weight_kg) }));
  const references = [
    ...(summary.targetWeight !== null ? [{ y: summary.targetWeight, label: `Objectif ${fmtKg(summary.targetWeight)}`, color: "#22c55e" }] : []),
    ...data.milestones.map((m) => ({ y: num(m.weight)!, label: m.label || fmtKg(m.weight), color: "#f59e0b" })),
  ];

  // Historique décroissant avec écarts réels
  const history = [...sorted].reverse().map((w, i, arr) => {
    const prev = arr[i + 1];
    const v = num(w.weight_kg)!;
    return {
      ...w,
      diffPrev: prev ? round1(v - num(prev.weight_kg)!) : null,
      diffStart: summary.startWeight !== null ? round1(v - summary.startWeight) : null,
    };
  });

  const a = sorted.find((w) => w.id === cmpA);
  const b = sorted.find((w) => w.id === cmpB);
  const cmpDiff = a && b ? round1(num(b.weight_kg)! - num(a.weight_kg)!) : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={() => setGoalOpen(true)}>
          <Target className="h-4 w-4" /> Objectifs
        </Button>
        <Button variant="secondary" size="sm" onClick={() => exportPdf("a4")} loading={pdfBusy === "a4"} disabled={!summary.hasData}>
          <FileDown className="h-4 w-4" /> Bilan PDF
        </Button>
        <Button variant="secondary" size="sm" onClick={() => exportPdf("mobile")} loading={pdfBusy === "mobile"} disabled={!summary.hasData}>
          <Smartphone className="h-4 w-4" /> PDF mobile
        </Button>
      </div>

      {/* Cartes synthétiques */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Poids de départ"
          value={fmtKg(summary.startWeight)}
          hint={summary.startDate ? `le ${fmtDate(summary.startDate)}${summary.startFromGoal ? "" : " (1re pesée)"}` : "—"}
          icon={<Flag className="h-4 w-4" />}
        />
        <StatCard
          label="Poids actuel"
          value={fmtKg(summary.currentWeight)}
          hint={summary.lastDate ? `Dernière pesée le ${fmtDate(summary.lastDate)}` : "Aucune pesée"}
          icon={<Scale className="h-4 w-4" />}
          accent
        />
        <StatCard
          label="Objectif"
          value={fmtKg(summary.targetWeight)}
          hint={summary.targetDate ? `Date cible : ${fmtDate(summary.targetDate)}` : "Pas de date cible"}
          icon={<Target className="h-4 w-4" />}
        />
        <StatCard
          label="Évolution totale"
          value={fmtSignedKg(summary.totalChange)}
          hint={summary.lastChange !== null ? `${fmtSignedKg(summary.lastChange)} depuis la pesée précédente` : "—"}
          icon={summary.totalChange !== null && summary.totalChange > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
        />
      </div>

      {/* Progression */}
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[12px] font-medium uppercase tracking-wider text-ink-400">Progression vers l&apos;objectif</p>
            <p className="mt-1 font-display text-3xl font-semibold text-white">
              {summary.progressRaw !== null ? `${summary.progressRaw} %` : "—"}
            </p>
          </div>
          <Badge tone={st.tone}>{st.text}</Badge>
        </div>
        <div className="mt-4">
          <ProgressBar value={summary.progressBar ?? 0} tone={summary.status === "reached" ? "green" : summary.status === "opposite" ? "amber" : "blue"} />
        </div>
        <div className="mt-2 flex justify-between text-xs text-ink-500">
          <span>{fmtKg(summary.startWeight)}</span>
          <span>{fmtKg(summary.targetWeight)}</span>
        </div>
        {data.milestones.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {data.milestones.map((m) => {
              const ok = milestoneReached(m, summary);
              return (
                <span
                  key={m.id}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs",
                    ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-ink-600 bg-ink-800 text-ink-300",
                  )}
                >
                  <Flag className="h-3 w-3" />
                  {m.label ? `${m.label} · ` : ""}
                  {fmtKg(m.weight)}
                  {m.target_date ? ` · ${fmtDate(m.target_date)}` : ""}
                  {ok && " ✓"}
                </span>
              );
            })}
          </div>
        )}
        <p className="mt-4 text-xs text-ink-500">
          Les valeurs affichées reflètent uniquement les pesées réellement saisies. Aucune projection n&apos;est calculée : l&apos;évolution
          future n&apos;est jamais garantie.
        </p>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <Card title="Évolution du poids">
          {chartData.length ? (
            <>
              <TimeChart data={chartData} series={[{ key: "poids", label: "Poids", color: "#4A6CF7" }]} unit="kg" references={references} />
              <p className="mt-2 text-xs text-ink-500">Points bleus : pesées saisies. Lignes pointillées : objectifs (non des mesures).</p>
            </>
          ) : (
            <EmptyState icon={<Scale className="h-6 w-6" />} title="Aucune pesée" text="Enregistrez une première pesée pour afficher le graphique." />
          )}
        </Card>

        <Card title="Nouvelle pesée">
          <form onSubmit={addWeighIn} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date">
                <Input type="date" value={form.date} max={todayISO()} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </Field>
              <Field label="Poids (kg)">
                <Input inputMode="decimal" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} placeholder="78,4" />
              </Field>
            </div>
            <Field label="Commentaire (facultatif)">
              <Input value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} maxLength={1000} />
            </Field>
            <Button type="submit" className="w-full" loading={saving}>
              <Plus className="h-4 w-4" /> Ajouter la pesée
            </Button>
          </form>

          {sorted.length > 1 && (
            <div className="mt-6 border-t border-ink-700/60 pt-5">
              <p className="mb-3 flex items-center gap-2 text-sm font-medium text-ink-200">
                <CalendarDays className="h-4 w-4 text-royal-400" /> Comparer deux dates
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Select value={cmpA} onChange={(e) => setCmpA(e.target.value)} aria-label="Date 1">
                  <option value="">Date 1</option>
                  {sorted.map((w) => (
                    <option key={w.id} value={w.id}>
                      {fmtDate(w.measured_on)} — {fmtKg(w.weight_kg)}
                    </option>
                  ))}
                </Select>
                <Select value={cmpB} onChange={(e) => setCmpB(e.target.value)} aria-label="Date 2">
                  <option value="">Date 2</option>
                  {sorted.map((w) => (
                    <option key={w.id} value={w.id}>
                      {fmtDate(w.measured_on)} — {fmtKg(w.weight_kg)}
                    </option>
                  ))}
                </Select>
              </div>
              {a && b && (
                <p className="mt-3 rounded-xl bg-ink-800 px-3 py-2.5 text-sm text-ink-200">
                  Du {fmtDate(a.measured_on)} au {fmtDate(b.measured_on)} :{" "}
                  <strong className="text-white">{fmtSignedKg(cmpDiff)}</strong>
                </p>
              )}
            </div>
          )}
        </Card>
      </div>

      <Card title="Historique des pesées" padded={false}>
        {history.length === 0 ? (
          <p className="p-5 text-sm text-ink-400">Aucune pesée.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Poids</th>
                  <th>Écart précédent</th>
                  <th>Depuis le départ</th>
                  <th>Commentaire</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {history.map((w) => (
                  <tr key={w.id} className="hover:bg-ink-800/50">
                    <td className="whitespace-nowrap">{fmtDate(w.measured_on)}</td>
                    <td className="whitespace-nowrap font-semibold tabular-nums text-white">{fmtKg(w.weight_kg)}</td>
                    <td className={cn("whitespace-nowrap tabular-nums", diffColor(w.diffPrev, summary))}>{fmtSignedKg(w.diffPrev)}</td>
                    <td className={cn("whitespace-nowrap tabular-nums", diffColor(w.diffStart, summary))}>{fmtSignedKg(w.diffStart)}</td>
                    <td className="max-w-xs text-ink-400">{w.comment}</td>
                    <td className="whitespace-nowrap text-right">
                      <Button size="icon" variant="ghost" onClick={() => setEditing(w)} aria-label="Modifier la pesée">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="hover:text-red-300" onClick={() => setToDelete(w)} aria-label="Supprimer la pesée">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <GoalModal open={goalOpen} onClose={() => setGoalOpen(false)} data={data} onSaved={reload} />
      <WeighInModal weighIn={editing} onClose={() => setEditing(null)} onSaved={reload} />
      <ConfirmDialog
        open={!!toDelete}
        title="Supprimer cette pesée ?"
        message={
          <>
            Pesée du <strong className="text-white">{fmtDateLong(toDelete?.measured_on)}</strong> ({fmtKg(toDelete?.weight_kg)}).
          </>
        }
        onConfirm={async () => {
          const { error } = await sb.from("weigh_ins").delete().eq("id", toDelete!.id);
          setToDelete(null);
          if (error) return toast.error(errorMessage(error));
          toast.success("Pesée supprimée.");
          reload();
        }}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}

/** Vert si l'écart va dans le sens de l'objectif, ambre sinon. */
function diffColor(diff: number | null, s: WeightSummary) {
  if (diff === null || diff === 0) return "text-ink-400";
  const goodIfNegative = s.direction !== "gain";
  const good = goodIfNegative ? diff < 0 : diff > 0;
  return good ? "text-emerald-400" : "text-amber-400";
}

function WeighInModal({ weighIn, onClose, onSaved }: { weighIn: WeighIn | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ date: "", weight: "", comment: "" });
  const [saving, setSaving] = useState(false);
  const [lastId, setLastId] = useState<string | null>(null);
  if (weighIn && weighIn.id !== lastId) {
    setLastId(weighIn.id);
    setF({ date: weighIn.measured_on, weight: String(num(weighIn.weight_kg)).replace(".", ","), comment: weighIn.comment ?? "" });
  }

  async function save() {
    if (!weighIn) return;
    const w = parseNum(f.weight);
    if (w === null || w < 20 || w > 400) return toast.error("Poids invalide.");
    setSaving(true);
    const { error } = await getSupabase()
      .from("weigh_ins")
      .update({ measured_on: f.date, weight_kg: w, comment: emptyToNull(f.comment) })
      .eq("id", weighIn.id);
    setSaving(false);
    if (error) return toast.error(errorMessage(error));
    toast.success("Pesée modifiée.");
    setLastId(null);
    onClose();
    onSaved();
  }

  return (
    <Modal
      open={!!weighIn}
      onClose={() => {
        setLastId(null);
        onClose();
      }}
      title="Modifier la pesée"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={save} loading={saving}>
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Date">
          <Input type="date" value={f.date} max={todayISO()} onChange={(e) => setF({ ...f, date: e.target.value })} />
        </Field>
        <Field label="Poids (kg)">
          <Input inputMode="decimal" value={f.weight} onChange={(e) => setF({ ...f, weight: e.target.value })} />
        </Field>
        <Field label="Commentaire">
          <Input value={f.comment} onChange={(e) => setF({ ...f, comment: e.target.value })} maxLength={1000} />
        </Field>
      </div>
    </Modal>
  );
}

function GoalModal({ open, onClose, data, onSaved }: { open: boolean; onClose: () => void; data: WeightData; onSaved: () => void }) {
  const toast = useToast();
  const sb = getSupabase();
  const [f, setF] = useState({ start_weight: "", start_date: "", target_weight: "", target_date: "" });
  const [ms, setMs] = useState({ label: "", weight: "", date: "" });
  const [saving, setSaving] = useState(false);
  const [wasOpen, setWasOpen] = useState(false);

  if (open && !wasOpen) {
    setWasOpen(true);
    const g = data.goal;
    const first = sortWeighIns(data.weighIns)[0];
    setF({
      start_weight: g?.start_weight != null ? String(num(g.start_weight)).replace(".", ",") : first ? String(num(first.weight_kg)).replace(".", ",") : "",
      start_date: g?.start_date ?? first?.measured_on ?? "",
      target_weight: g?.target_weight != null ? String(num(g.target_weight)).replace(".", ",") : "",
      target_date: g?.target_date ?? "",
    });
  }
  if (!open && wasOpen) setWasOpen(false);

  async function save() {
    const sw = parseNum(f.start_weight);
    const tw = parseNum(f.target_weight);
    if (f.start_weight && (sw === null || sw < 20 || sw > 400)) return toast.error("Poids de départ invalide.");
    if (f.target_weight && (tw === null || tw < 20 || tw > 400)) return toast.error("Objectif invalide.");
    setSaving(true);
    const { error } = await sb.from("weight_goals").upsert(
      {
        client_id: data.client.id,
        start_weight: sw,
        start_date: f.start_date || null,
        target_weight: tw,
        target_date: f.target_date || null,
      },
      { onConflict: "client_id" },
    );
    setSaving(false);
    if (error) return toast.error(errorMessage(error));
    toast.success("Objectifs enregistrés.");
    onSaved();
    onClose();
  }

  async function addMilestone() {
    const w = parseNum(ms.weight);
    if (w === null || w < 20 || w > 400) return toast.error("Poids intermédiaire invalide.");
    const { error } = await sb
      .from("weight_milestones")
      .insert({ client_id: data.client.id, label: emptyToNull(ms.label), weight: w, target_date: ms.date || null });
    if (error) return toast.error(errorMessage(error));
    setMs({ label: "", weight: "", date: "" });
    toast.success("Objectif intermédiaire ajouté.");
    onSaved();
  }

  async function removeMilestone(id: string) {
    const { error } = await sb.from("weight_milestones").delete().eq("id", id);
    if (error) return toast.error(errorMessage(error));
    onSaved();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Objectifs de poids"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Fermer
          </Button>
          <Button onClick={save} loading={saving}>
            Enregistrer l&apos;objectif
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Poids de départ (kg)" hint="Par défaut : la première pesée.">
          <Input inputMode="decimal" value={f.start_weight} onChange={(e) => setF({ ...f, start_weight: e.target.value })} />
        </Field>
        <Field label="Date de début du suivi">
          <Input type="date" value={f.start_date} onChange={(e) => setF({ ...f, start_date: e.target.value })} />
        </Field>
        <Field label="Objectif final (kg)">
          <Input inputMode="decimal" value={f.target_weight} onChange={(e) => setF({ ...f, target_weight: e.target.value })} />
        </Field>
        <Field label="Date cible (facultative)">
          <Input type="date" value={f.target_date} onChange={(e) => setF({ ...f, target_date: e.target.value })} />
        </Field>
      </div>

      <div className="mt-6 border-t border-ink-700/60 pt-5">
        <h3 className="h-display mb-3 text-base text-ink-100">Objectifs intermédiaires</h3>
        {data.milestones.length > 0 ? (
          <ul className="mb-4 space-y-2">
            {data.milestones.map((m) => (
              <li key={m.id} className="flex items-center justify-between rounded-xl bg-ink-800 px-3 py-2 text-sm">
                <span>
                  <strong className="text-white">{fmtKg(m.weight)}</strong>
                  {m.label && <span className="text-ink-300"> · {m.label}</span>}
                  {m.target_date && <span className="text-ink-500"> · {fmtDate(m.target_date)}</span>}
                </span>
                <Button size="icon" variant="ghost" className="hover:text-red-300" onClick={() => removeMilestone(m.id)} aria-label="Supprimer">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-4 text-sm text-ink-500">Aucun objectif intermédiaire.</p>
        )}
        <div className="grid gap-2 sm:grid-cols-[1fr_110px_150px_auto]">
          <Input placeholder="Libellé (ex. Palier 1)" value={ms.label} onChange={(e) => setMs({ ...ms, label: e.target.value })} maxLength={80} />
          <Input placeholder="Poids" inputMode="decimal" value={ms.weight} onChange={(e) => setMs({ ...ms, weight: e.target.value })} />
          <Input type="date" value={ms.date} onChange={(e) => setMs({ ...ms, date: e.target.value })} aria-label="Date cible" />
          <Button variant="secondary" onClick={addMilestone}>
            <Plus className="h-4 w-4" /> Ajouter
          </Button>
        </div>
      </div>
    </Modal>
  );
}
