"use client";

import { useEffect, useMemo, useState } from "react";
import { Calculator, Info } from "lucide-react";
import { Button, Field, Input, Modal, Select, Textarea } from "./ui";
import { Chip } from "./FoodPicker";
import { useToast } from "./toast";
import { getSupabase } from "@/lib/supabase/client";
import { errorMessage, parseNum } from "@/lib/format";
import {
  ACTIVITIES,
  activityFromSessions,
  calcTargets,
  goalFromText,
  kcalFromMacros,
  NUTRITION_GOALS,
  type Activity,
  type NutritionGoal,
  type NutritionTarget,
  type TargetInputs,
} from "@/lib/nutrition";

interface Draft {
  sex: "homme" | "femme" | "";
  age: string;
  height_cm: string;
  weight_kg: string;
  activity: Activity;
  goal: NutritionGoal;
}

const s = (v: unknown) => (v === null || v === undefined ? "" : String(v).replace(".", ","));

/** Préremplit le calcul avec le bilan de départ, la dernière pesée et la fiche client. */
async function loadDefaults(clientId: string): Promise<Draft> {
  const sb = getSupabase();
  const [client, intake, weigh] = await Promise.all([
    sb.from("clients").select("goal, sessions_per_week").eq("id", clientId).maybeSingle(),
    sb.from("client_intakes").select("answers").eq("client_id", clientId).order("assessed_on", { ascending: false }).limit(1).maybeSingle(),
    sb.from("weigh_ins").select("weight_kg").eq("client_id", clientId).order("measured_on", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const a = (intake.data?.answers ?? {}) as Record<string, string | string[] | undefined>;
  const goalText = [client.data?.goal, a.main_goal, ...(Array.isArray(a.goals) ? a.goals : [])].filter(Boolean).join(" ");
  return {
    sex: a.sex === "homme" || a.sex === "femme" ? a.sex : "",
    age: s(a.age),
    height_cm: s(a.height_cm),
    weight_kg: weigh.data?.weight_kg ? s(weigh.data.weight_kg) : s(a.weight_kg),
    activity: activityFromSessions(client.data?.sessions_per_week ?? (a.wished_frequency ? Number(a.wished_frequency) : null)),
    goal: goalFromText(goalText),
  };
}

export function NutritionTargetsForm({
  open,
  onClose,
  clientId,
  current,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  clientId: string;
  current: NutritionTarget | null;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [d, setD] = useState<Draft>({ sex: "", age: "", height_cm: "", weight_kg: "", activity: "modere", goal: "maintien" });
  const [final, setFinal] = useState({ kcal: "", protein_g: "", carbs_g: "", fat_g: "" });
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErr(null);
    setNote(current?.note ?? "");
    const inp = current?.inputs as Partial<TargetInputs> | undefined;
    if (current) {
      setFinal({ kcal: s(current.kcal), protein_g: s(current.protein_g), carbs_g: s(current.carbs_g), fat_g: s(current.fat_g) });
    } else setFinal({ kcal: "", protein_g: "", carbs_g: "", fat_g: "" });
    if (inp && inp.sex && inp.age) {
      setD({
        sex: inp.sex,
        age: s(inp.age),
        height_cm: s(inp.height_cm),
        weight_kg: s(inp.weight_kg),
        activity: inp.activity ?? "modere",
        goal: inp.goal ?? "maintien",
      });
    } else {
      loadDefaults(clientId)
        .then(setD)
        .catch(() => {});
    }
  }, [open, current, clientId]);

  const inputs: TargetInputs | null = useMemo(() => {
    const age = parseNum(d.age);
    const h = parseNum(d.height_cm);
    const w = parseNum(d.weight_kg);
    if (!d.sex || !age || !h || !w || age < 14 || age > 100 || h < 120 || h > 230 || w < 30 || w > 300) return null;
    return { sex: d.sex, age, height_cm: h, weight_kg: w, activity: d.activity, goal: d.goal };
  }, [d]);
  const result = inputs ? calcTargets(inputs) : null;

  // Sans objectifs enregistrés, la proposition remplit automatiquement les valeurs finales
  useEffect(() => {
    if (!open || current || !result) return;
    setFinal({ kcal: String(result.kcal), protein_g: String(result.protein_g), carbs_g: String(result.carbs_g), fat_g: String(result.fat_g) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, current, result?.kcal, result?.protein_g, result?.carbs_g, result?.fat_g]);

  const fk = parseNum(final.kcal);
  const fp = parseNum(final.protein_g);
  const fc = parseNum(final.carbs_g);
  const ff = parseNum(final.fat_g);
  const macroKcal = fp !== null && fc !== null && ff !== null ? kcalFromMacros(fp, fc, ff) : null;
  const gap = fk !== null && macroKcal !== null ? macroKcal - fk : null;

  async function save() {
    if (fk === null || fp === null || fc === null || ff === null) return setErr("Renseigne les calories et les trois macros.");
    if (fk < 500 || fk > 10000) return setErr("Les calories doivent être comprises entre 500 et 10 000 kcal.");
    if ([fp, fc, ff].some((v) => v < 0 || v > 1000)) return setErr("Les macros doivent être comprises entre 0 et 1000 g.");
    setErr(null);
    setSaving(true);
    const { error } = await getSupabase()
      .from("nutrition_targets")
      .upsert(
        {
          client_id: clientId,
          kcal: Math.round(fk),
          protein_g: fp,
          carbs_g: fc,
          fat_g: ff,
          inputs: inputs ?? {},
          note: note.trim() || null,
        },
        { onConflict: "client_id" },
      );
    setSaving(false);
    if (error) return toast.error(errorMessage(error));
    toast.success("Objectifs nutritionnels enregistrés.");
    onSaved();
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Objectifs nutritionnels"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={save} loading={saving}>
            Enregistrer les objectifs
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <section className="space-y-4">
          <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink-400">
            <Calculator className="h-4 w-4 text-royal-400" /> Calcul automatique
          </h3>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <p className="label">Sexe</p>
              <div className="flex gap-2">
                <Chip active={d.sex === "homme"} onClick={() => setD({ ...d, sex: "homme" })}>
                  Homme
                </Chip>
                <Chip active={d.sex === "femme"} onClick={() => setD({ ...d, sex: "femme" })}>
                  Femme
                </Chip>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Âge (ans)">
              <Input value={d.age} onChange={(e) => setD({ ...d, age: e.target.value })} inputMode="numeric" placeholder="30" aria-label="Âge" />
            </Field>
            <Field label="Taille (cm)">
              <Input value={d.height_cm} onChange={(e) => setD({ ...d, height_cm: e.target.value })} inputMode="decimal" placeholder="175" aria-label="Taille" />
            </Field>
            <Field label="Poids (kg)">
              <Input value={d.weight_kg} onChange={(e) => setD({ ...d, weight_kg: e.target.value })} inputMode="decimal" placeholder="75" aria-label="Poids" />
            </Field>
          </div>
          <Field label="Niveau d'activité">
            <Select aria-label="Niveau d'activité" value={d.activity} onChange={(e) => setD({ ...d, activity: e.target.value as Activity })}>
              {ACTIVITIES.map((a) => (
                <option key={a.key} value={a.key}>
                  {a.label} — {a.hint}
                </option>
              ))}
            </Select>
          </Field>
          <div>
            <p className="label">Objectif</p>
            <div className="flex flex-wrap gap-2">
              {NUTRITION_GOALS.map((g) => (
                <Chip key={g.key} active={d.goal === g.key} onClick={() => setD({ ...d, goal: g.key })}>
                  {g.label} <span className="text-xs text-ink-400">· {g.hint}</span>
                </Chip>
              ))}
            </div>
          </div>

          {result ? (
            <div className="rounded-xl border border-royal-600/40 bg-royal-600/10 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-ink-200">
                  <p>
                    Métabolisme de base : <strong className="text-white">{result.bmr} kcal</strong> · Dépense quotidienne :{" "}
                    <strong className="text-white">{result.tdee} kcal</strong>
                  </p>
                  <p className="mt-1">
                    Proposition : <strong className="text-white">{result.kcal} kcal</strong> · P {result.protein_g} g · G {result.carbs_g} g · L {result.fat_g} g
                  </p>
                  {result.floored && <p className="mt-1 text-xs text-amber-300">Calories relevées au niveau du métabolisme de base (plancher de sécurité).</p>}
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    setFinal({ kcal: String(result.kcal), protein_g: String(result.protein_g), carbs_g: String(result.carbs_g), fat_g: String(result.fat_g) })
                  }
                >
                  Utiliser ces valeurs
                </Button>
              </div>
            </div>
          ) : (
            <p className="flex items-start gap-2 text-sm text-ink-400">
              <Info className="mt-0.5 h-4 w-4 shrink-0" /> Renseigne le sexe, l&apos;âge, la taille et le poids pour obtenir une proposition.
            </p>
          )}
        </section>

        <section className="space-y-4 border-t border-ink-700/60 pt-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-400">Objectifs retenus (modifiables)</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(
              [
                ["kcal", "Calories (kcal)"],
                ["protein_g", "Protéines (g)"],
                ["carbs_g", "Glucides (g)"],
                ["fat_g", "Lipides (g)"],
              ] as const
            ).map(([k, label]) => (
              <Field key={k} label={label} required>
                <Input value={final[k]} onChange={(e) => setFinal({ ...final, [k]: e.target.value })} inputMode="decimal" aria-label={label} />
              </Field>
            ))}
          </div>
          {gap !== null && Math.abs(gap) > 50 && (
            <p className="text-xs text-amber-300">
              Les macros représentent {macroKcal} kcal, soit {gap > 0 ? "+" : ""}
              {gap} kcal par rapport à l&apos;objectif calorique.
            </p>
          )}
          <Field label="Message pour le client" hint="Visible par le client dans son espace (ex. conseils, hydratation).">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={2000} />
          </Field>
          {err && <p className="text-sm text-red-300">{err}</p>}
        </section>
      </div>
    </Modal>
  );
}
