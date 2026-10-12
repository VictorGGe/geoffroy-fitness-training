"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, Ruler, Trash2 } from "lucide-react";
import { Button, Card, ConfirmDialog, EmptyState, ErrorBlock, Field, Input, LoadingBlock, Modal, Select, cn } from "./ui";
import { TimeChart } from "./charts";
import { useToast } from "./toast";
import { getSupabase } from "@/lib/supabase/client";
import { unwrap, useAsync } from "@/lib/hooks";
import { MEASUREMENT_FIELDS, measurementEvolution, round1, type MeasurementKey } from "@/lib/calc";
import { emptyToNull, errorMessage, fmtDate, fmtNum, fmtSigned, num, parseNum, todayISO } from "@/lib/format";
import type { Measurement } from "@/lib/types";

const COLORS: Record<MeasurementKey, string> = {
  waist_cm: "#4A6CF7",
  hips_cm: "#E7E9EE",
  chest_cm: "#9DB4FF",
  thigh_cm: "#f59e0b",
  arm_cm: "#22c55e",
};

export function MeasurementsPanel({ clientId }: { clientId: string }) {
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(async () => {
    return unwrap(
      await getSupabase().from("measurements").select("*").eq("client_id", clientId).order("measured_on"),
    ) as Measurement[];
  }, [clientId]);
  const [editing, setEditing] = useState<Measurement | "new" | null>(null);
  const [toDelete, setToDelete] = useState<Measurement | null>(null);
  const [visible, setVisible] = useState<MeasurementKey[]>(["waist_cm", "hips_cm"]);
  const [cmpA, setCmpA] = useState("");
  const [cmpB, setCmpB] = useState("");

  const evo = useMemo(() => measurementEvolution(data ?? []), [data]);

  if (loading) return <LoadingBlock />;
  if (error || !data) return <ErrorBlock message={error ?? "Erreur"} onRetry={reload} />;

  const chartData = data.map((m) => {
    const row: Record<string, unknown> = { date: m.measured_on };
    MEASUREMENT_FIELDS.forEach((f) => (row[f.key] = num(m[f.key])));
    return row;
  });
  const a = data.find((m) => m.id === cmpA);
  const b = data.find((m) => m.id === cmpB);

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button onClick={() => setEditing("new")}>
          <Plus className="h-4 w-4" /> Nouvelles mensurations
        </Button>
      </div>

      {data.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Ruler className="h-6 w-6" />}
            title="Aucune mensuration"
            text="Toutes les mesures sont facultatives : renseignez uniquement celles que vous prenez."
            action={
              <Button onClick={() => setEditing("new")}>
                <Plus className="h-4 w-4" /> Ajouter des mensurations
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {evo.map((e) => (
              <div key={e.key} className="card p-4">
                <p className="text-[11.5px] font-medium uppercase tracking-wider text-ink-400">{e.label}</p>
                <p className="mt-1.5 font-display text-2xl font-semibold text-white">{e.last !== null ? `${fmtNum(e.last)} cm` : "—"}</p>
                <p
                  className={cn(
                    "mt-1 text-xs",
                    e.change === null ? "text-ink-500" : e.change < 0 ? "text-emerald-400" : e.change > 0 ? "text-amber-400" : "text-ink-400",
                  )}
                >
                  {e.change !== null ? `${fmtSigned(e.change, "cm")} depuis le ${fmtDate(e.firstDate)}` : e.count ? "1 seule mesure" : "Non mesuré"}
                </p>
              </div>
            ))}
          </div>

          <Card
            title="Évolution"
            actions={
              <div className="hidden flex-wrap gap-1 sm:flex">
                {MEASUREMENT_FIELDS.map((f) => (
                  <ToggleChip key={f.key} f={f} visible={visible} setVisible={setVisible} />
                ))}
              </div>
            }
          >
            <div className="mb-3 flex flex-wrap gap-1 sm:hidden">
              {MEASUREMENT_FIELDS.map((f) => (
                <ToggleChip key={f.key} f={f} visible={visible} setVisible={setVisible} />
              ))}
            </div>
            <TimeChart
              data={chartData}
              unit="cm"
              series={MEASUREMENT_FIELDS.filter((f) => visible.includes(f.key)).map((f) => ({ key: f.key, label: f.label, color: COLORS[f.key] }))}
            />
          </Card>

          {data.length > 1 && (
            <Card title="Comparer deux périodes">
              <div className="grid gap-2 sm:grid-cols-2">
                <Select value={cmpA} onChange={(e) => setCmpA(e.target.value)} aria-label="Date 1">
                  <option value="">Première date</option>
                  {data.map((m) => (
                    <option key={m.id} value={m.id}>
                      {fmtDate(m.measured_on)}
                    </option>
                  ))}
                </Select>
                <Select value={cmpB} onChange={(e) => setCmpB(e.target.value)} aria-label="Date 2">
                  <option value="">Seconde date</option>
                  {data.map((m) => (
                    <option key={m.id} value={m.id}>
                      {fmtDate(m.measured_on)}
                    </option>
                  ))}
                </Select>
              </div>
              {a && b && (
                <div className="mt-4 overflow-x-auto">
                  <table className="table-base">
                    <thead>
                      <tr>
                        <th>Mesure</th>
                        <th>{fmtDate(a.measured_on)}</th>
                        <th>{fmtDate(b.measured_on)}</th>
                        <th>Écart</th>
                      </tr>
                    </thead>
                    <tbody>
                      {MEASUREMENT_FIELDS.map((f) => {
                        const va = num(a[f.key]);
                        const vb = num(b[f.key]);
                        const d = va !== null && vb !== null ? round1(vb - va) : null;
                        return (
                          <tr key={f.key}>
                            <td className="text-ink-300">{f.label}</td>
                            <td className="tabular-nums">{va !== null ? `${fmtNum(va)} cm` : "—"}</td>
                            <td className="tabular-nums">{vb !== null ? `${fmtNum(vb)} cm` : "—"}</td>
                            <td className={cn("tabular-nums font-semibold", d === null ? "text-ink-500" : d < 0 ? "text-emerald-400" : d > 0 ? "text-amber-400" : "")}>
                              {d === null ? "—" : fmtSigned(d, "cm")}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          <Card title="Historique des mensurations" padded={false}>
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Date</th>
                    {MEASUREMENT_FIELDS.map((f) => (
                      <th key={f.key}>{f.label.replace("Tour de ", "")}</th>
                    ))}
                    <th>Commentaire</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {[...data].reverse().map((m) => (
                    <tr key={m.id} className="hover:bg-ink-800/50">
                      <td className="whitespace-nowrap">{fmtDate(m.measured_on)}</td>
                      {MEASUREMENT_FIELDS.map((f) => (
                        <td key={f.key} className="whitespace-nowrap tabular-nums">
                          {num(m[f.key]) !== null ? `${fmtNum(m[f.key])} cm` : <span className="text-ink-600">—</span>}
                        </td>
                      ))}
                      <td className="max-w-[200px] text-ink-400">{m.comment}</td>
                      <td className="whitespace-nowrap text-right">
                        <Button size="icon" variant="ghost" onClick={() => setEditing(m)} aria-label="Modifier">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="hover:text-red-300" onClick={() => setToDelete(m)} aria-label="Supprimer">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      <MeasurementModal clientId={clientId} value={editing} onClose={() => setEditing(null)} onSaved={reload} />
      <ConfirmDialog
        open={!!toDelete}
        title="Supprimer ces mensurations ?"
        message={<>Mesures du {fmtDate(toDelete?.measured_on)}.</>}
        onConfirm={async () => {
          const { error } = await getSupabase().from("measurements").delete().eq("id", toDelete!.id);
          setToDelete(null);
          if (error) return toast.error(errorMessage(error));
          toast.success("Mensurations supprimées.");
          reload();
        }}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}

function ToggleChip({
  f,
  visible,
  setVisible,
}: {
  f: (typeof MEASUREMENT_FIELDS)[number];
  visible: MeasurementKey[];
  setVisible: React.Dispatch<React.SetStateAction<MeasurementKey[]>>;
}) {
  const on = visible.includes(f.key);
  return (
    <button
      onClick={() => setVisible((v) => (on ? v.filter((x) => x !== f.key) : [...v, f.key]))}
      className={cn(
        "flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11.5px] transition",
        on ? "border-ink-500 bg-ink-750 text-ink-100" : "border-ink-700 text-ink-500 hover:text-ink-300",
      )}
    >
      <span className="h-2 w-2 rounded-full" style={{ background: on ? COLORS[f.key] : "#454E61" }} />
      {f.label.replace("Tour de ", "")}
    </button>
  );
}

function MeasurementModal({
  clientId,
  value,
  onClose,
  onSaved,
}: {
  clientId: string;
  value: Measurement | "new" | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [f, setF] = useState<Record<string, string>>({});
  const [key, setKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const currentKey = value === null ? null : value === "new" ? "new" : value.id;
  if (currentKey !== key) {
    setKey(currentKey);
    if (value && value !== "new") {
      const init: Record<string, string> = { date: value.measured_on, comment: value.comment ?? "" };
      MEASUREMENT_FIELDS.forEach((x) => (init[x.key] = num(value[x.key]) !== null ? String(num(value[x.key])).replace(".", ",") : ""));
      setF(init);
    } else {
      setF({ date: todayISO(), comment: "" });
    }
  }

  async function save() {
    const payload: Record<string, unknown> = { measured_on: f.date, comment: emptyToNull(f.comment) };
    let any = false;
    for (const x of MEASUREMENT_FIELDS) {
      const raw = f[x.key] ?? "";
      const v = parseNum(raw);
      if (raw.trim() && (v === null || v < 10 || v > 300)) return toast.error(`${x.label} : valeur invalide.`);
      payload[x.key] = v;
      if (v !== null) any = true;
    }
    if (!any) return toast.error("Renseignez au moins une mensuration.");
    if (!f.date) return toast.error("Indiquez la date.");
    setSaving(true);
    const sb = getSupabase();
    const res =
      value && value !== "new"
        ? await sb.from("measurements").update(payload).eq("id", value.id)
        : await sb.from("measurements").insert({ ...payload, client_id: clientId });
    setSaving(false);
    if (res.error) return toast.error(errorMessage(res.error));
    toast.success("Mensurations enregistrées.");
    onClose();
    onSaved();
  }

  return (
    <Modal
      open={value !== null}
      onClose={onClose}
      title={value === "new" ? "Nouvelles mensurations" : "Modifier les mensurations"}
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
      <div className="grid grid-cols-2 gap-4">
        <Field label="Date" className="col-span-2 sm:col-span-1">
          <Input type="date" value={f.date ?? ""} max={todayISO()} onChange={(e) => setF({ ...f, date: e.target.value })} />
        </Field>
        <div className="hidden sm:block" />
        {MEASUREMENT_FIELDS.map((x) => (
          <Field key={x.key} label={`${x.label} (cm)`}>
            <Input inputMode="decimal" value={f[x.key] ?? ""} onChange={(e) => setF({ ...f, [x.key]: e.target.value })} placeholder="—" />
          </Field>
        ))}
        <Field label="Commentaire" className="col-span-2">
          <Input value={f.comment ?? ""} onChange={(e) => setF({ ...f, comment: e.target.value })} maxLength={1000} />
        </Field>
      </div>
      <p className="mt-4 text-xs text-ink-500">Toutes les mesures sont facultatives. Les champs vides ne sont jamais estimés.</p>
    </Modal>
  );
}
