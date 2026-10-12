"use client";

import { useState } from "react";
import { ClipboardList, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge, Button, Card, ConfirmDialog, EmptyState, ErrorBlock, Field, Input, LoadingBlock, Modal, Textarea, cn } from "./ui";
import { useToast } from "./toast";
import { loadWeightData, type WeightData } from "./WeightTracker";
import { getSupabase } from "@/lib/supabase/client";
import { useAsync } from "@/lib/hooks";
import { MEASUREMENT_FIELDS, round1, sortWeighIns, weighInAt } from "@/lib/calc";
import { emptyToNull, errorMessage, fmtDateLong, fmtNum, fmtKg, fmtSigned, fmtSignedKg, num, parseNum, todayISO } from "@/lib/format";
import type { Measurement, Review } from "@/lib/types";

/** Évolution des mensurations entre deux dates (dernière valeur connue à chaque date). */
function measurementDelta(list: Measurement[], from: string | null, to: string) {
  const sorted = [...list].sort((a, b) => a.measured_on.localeCompare(b.measured_on));
  return MEASUREMENT_FIELDS.map((f) => {
    const upTo = (d: string) => [...sorted].reverse().find((m) => m.measured_on <= d && num(m[f.key]) !== null);
    const end = upTo(to);
    const start = from ? upTo(from) : sorted.find((m) => num(m[f.key]) !== null);
    const e = end ? num(end[f.key]) : null;
    const s = start ? num(start[f.key]) : null;
    return { label: f.label, value: e, delta: e !== null && s !== null && start !== end ? round1(e - s) : null };
  }).filter((x) => x.value !== null);
}

export function ReviewsPanel({ clientId }: { clientId: string }) {
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(() => loadWeightData(clientId), [clientId]);
  const [editing, setEditing] = useState<Review | "new" | null>(null);
  const [toDelete, setToDelete] = useState<Review | null>(null);

  if (loading) return <LoadingBlock />;
  if (error || !data) return <ErrorBlock message={error ?? "Erreur"} onRetry={reload} />;

  const reviews = data.reviews; // tri décroissant

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setEditing("new")}>
          <Plus className="h-4 w-4" /> Nouveau bilan
        </Button>
      </div>

      {reviews.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ClipboardList className="h-6 w-6" />}
            title="Aucun bilan"
            text="Les bilans périodiques permettent de faire le point sur le poids, les mensurations, les difficultés et les prochains objectifs."
            action={
              <Button onClick={() => setEditing("new")}>
                <Plus className="h-4 w-4" /> Créer un bilan
              </Button>
            }
          />
        </Card>
      ) : (
        <ol className="relative space-y-4 border-l border-ink-700 pl-5 sm:pl-7">
          {reviews.map((r, i) => {
            const prev = reviews[i + 1];
            const w = num(r.weight_kg);
            const pw = prev ? num(prev.weight_kg) : null;
            const deltaPrev = w !== null && pw !== null ? round1(w - pw) : null;
            const meas = measurementDelta(data.measurements, prev?.review_date ?? null, r.review_date);
            return (
              <li key={r.id} className="relative">
                <span className="absolute -left-[27px] top-5 h-3 w-3 rounded-full border-2 border-royal-500 bg-ink-950 sm:-left-[35px]" />
                <Card
                  title={`Bilan du ${fmtDateLong(r.review_date)}`}
                  actions={
                    <>
                      <Button size="icon" variant="ghost" onClick={() => setEditing(r)} aria-label="Modifier le bilan">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="hover:text-red-300" onClick={() => setToDelete(r)} aria-label="Supprimer le bilan">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  }
                >
                  <div className="mb-4 flex flex-wrap gap-2">
                    <Badge tone="blue">Poids : {fmtKg(w)}</Badge>
                    {deltaPrev !== null && <Badge>{fmtSignedKg(deltaPrev)} depuis le bilan précédent</Badge>}
                    {meas.map((m) => (
                      <Badge key={m.label}>
                        {m.label.replace("Tour de ", "")} {fmtNum(m.value)} cm{m.delta !== null ? ` (${fmtSigned(m.delta, "cm")})` : ""}
                      </Badge>
                    ))}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Block label="Points positifs" text={r.positives} tone="green" />
                    <Block label="Difficultés rencontrées" text={r.difficulties} tone="amber" />
                    <Block label="Commentaires du coach" text={r.coach_comments} />
                    <Block label="Objectifs pour la période suivante" text={r.next_goals} tone="blue" />
                  </div>
                </Card>
              </li>
            );
          })}
        </ol>
      )}

      <ReviewModal data={data} value={editing} onClose={() => setEditing(null)} onSaved={reload} />
      <ConfirmDialog
        open={!!toDelete}
        title="Supprimer ce bilan ?"
        message={<>Le bilan du {fmtDateLong(toDelete?.review_date)} sera supprimé définitivement.</>}
        onConfirm={async () => {
          const { error } = await getSupabase().from("reviews").delete().eq("id", toDelete!.id);
          setToDelete(null);
          if (error) return toast.error(errorMessage(error));
          toast.success("Bilan supprimé.");
          reload();
        }}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}

function Block({ label, text, tone }: { label: string; text: string | null; tone?: "green" | "amber" | "blue" }) {
  return (
    <div>
      <h4
        className={cn(
          "mb-1 text-[11.5px] font-semibold uppercase tracking-wider",
          tone === "green" ? "text-emerald-400" : tone === "amber" ? "text-amber-400" : tone === "blue" ? "text-royal-300" : "text-ink-400",
        )}
      >
        {label}
      </h4>
      <p className="whitespace-pre-line text-sm leading-relaxed text-ink-200">{text || <span className="text-ink-600">—</span>}</p>
    </div>
  );
}

function ReviewModal({
  data,
  value,
  onClose,
  onSaved,
}: {
  data: WeightData;
  value: Review | "new" | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [f, setF] = useState({ date: "", weight: "", difficulties: "", positives: "", coach_comments: "", next_goals: "" });
  const [key, setKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const currentKey = value === null ? null : value === "new" ? "new" : value.id;
  if (currentKey !== key) {
    setKey(currentKey);
    if (value && value !== "new") {
      setF({
        date: value.review_date,
        weight: value.weight_kg != null ? String(num(value.weight_kg)).replace(".", ",") : "",
        difficulties: value.difficulties ?? "",
        positives: value.positives ?? "",
        coach_comments: value.coach_comments ?? "",
        next_goals: value.next_goals ?? "",
      });
    } else if (value === "new") {
      const today = todayISO();
      const w = weighInAt(sortWeighIns(data.weighIns), today);
      setF({ date: today, weight: w ? String(num(w.weight_kg)).replace(".", ",") : "", difficulties: "", positives: "", coach_comments: "", next_goals: "" });
    }
  }

  const prev = data.reviews.find((r) => r.review_date < f.date && (value === "new" || r.id !== (value as Review | null)?.id));
  const w = parseNum(f.weight);
  const pw = prev ? num(prev.weight_kg) : null;
  const meas = f.date ? measurementDelta(data.measurements, prev?.review_date ?? null, f.date) : [];

  async function save() {
    if (!f.date) return toast.error("Indiquez la date du bilan.");
    if (f.weight && (w === null || w < 20 || w > 400)) return toast.error("Poids invalide.");
    const payload = {
      review_date: f.date,
      weight_kg: w,
      difficulties: emptyToNull(f.difficulties),
      positives: emptyToNull(f.positives),
      coach_comments: emptyToNull(f.coach_comments),
      next_goals: emptyToNull(f.next_goals),
    };
    setSaving(true);
    const sb = getSupabase();
    const res =
      value && value !== "new"
        ? await sb.from("reviews").update(payload).eq("id", value.id)
        : await sb.from("reviews").insert({ ...payload, client_id: data.client.id });
    setSaving(false);
    if (res.error) return toast.error(errorMessage(res.error));
    toast.success("Bilan enregistré.");
    onClose();
    onSaved();
  }

  return (
    <Modal
      open={value !== null}
      onClose={onClose}
      size="lg"
      title={value === "new" ? "Nouveau bilan" : "Modifier le bilan"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={save} loading={saving}>
            Enregistrer le bilan
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date du bilan" required>
          <Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
        </Field>
        <Field label="Poids actuel (kg)" hint="Pré-rempli avec la dernière pesée connue.">
          <Input inputMode="decimal" value={f.weight} onChange={(e) => setF({ ...f, weight: e.target.value })} />
        </Field>
        <div className="rounded-xl border border-ink-700 bg-ink-900 p-3 text-sm sm:col-span-2">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-400">Calculé automatiquement</p>
          <p className="text-ink-200">
            Évolution depuis le bilan précédent :{" "}
            <strong className="text-white">{prev ? (w !== null && pw !== null ? fmtSignedKg(round1(w - pw)) : "données insuffisantes") : "premier bilan"}</strong>
          </p>
          {meas.length > 0 && (
            <p className="mt-1 text-ink-300">
              Mensurations :{" "}
              {meas.map((m) => `${m.label.replace("Tour de ", "")} ${fmtNum(m.value)} cm${m.delta !== null ? ` (${fmtSigned(m.delta, "cm")})` : ""}`).join(" · ")}
            </p>
          )}
        </div>
        <Field label="Points positifs">
          <Textarea value={f.positives} onChange={(e) => setF({ ...f, positives: e.target.value })} maxLength={4000} />
        </Field>
        <Field label="Difficultés rencontrées">
          <Textarea value={f.difficulties} onChange={(e) => setF({ ...f, difficulties: e.target.value })} maxLength={4000} />
        </Field>
        <Field label="Commentaires du coach" className="sm:col-span-2">
          <Textarea value={f.coach_comments} onChange={(e) => setF({ ...f, coach_comments: e.target.value })} rows={4} maxLength={4000} />
        </Field>
        <Field label="Objectifs pour la période suivante" className="sm:col-span-2">
          <Textarea value={f.next_goals} onChange={(e) => setF({ ...f, next_goals: e.target.value })} maxLength={4000} />
        </Field>
      </div>
    </Modal>
  );
}
