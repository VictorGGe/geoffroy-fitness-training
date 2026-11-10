"use client";

import { useState } from "react";
import { AlertTriangle, ClipboardCheck, FileDown, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge, Button, Card, ConfirmDialog, EmptyState, Field, Input, LoadingBlock, Modal, Textarea, cn } from "./ui";
import { useToast } from "./toast";
import { getSupabase } from "@/lib/supabase/client";
import { useAsync } from "@/lib/hooks";
import { errorMessage, fmtDateLong, todayISO } from "@/lib/format";
import {
  ALCOHOL_OPTIONS,
  DAY_OPTIONS,
  DIET_OPTIONS,
  GOAL_OPTIONS,
  JOB_OPTIONS,
  MOTIVATION_LEVELS,
  PAIN_ZONES,
  PLACE_OPTIONS,
  PRACTICE_LEVELS,
  SLEEP_QUALITY,
  SLOT_OPTIONS,
  STEPS_OPTIONS,
  STRESS_OPTIONS,
  bmi,
  intakeSections,
  needsMedicalAdvice,
  type Intake,
  type IntakeAnswers,
  type YesNo,
} from "@/lib/intake";
import type { Client } from "@/lib/types";

/* ------------------------------------------------------------------ */
/* Petits contrôles                                                    */
/* ------------------------------------------------------------------ */

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border px-3 py-1.5 text-sm transition",
        active ? "border-royal-500 bg-royal-600/20 text-white" : "border-ink-700 bg-ink-900 text-ink-300 hover:border-ink-500",
      )}
    >
      {children}
    </button>
  );
}

function YesNoField({
  label,
  value,
  onChange,
  details,
  onDetails,
}: {
  label: string;
  value: YesNo | undefined;
  onChange: (v: YesNo) => void;
  details?: string;
  onDetails?: (v: string) => void;
}) {
  return (
    <div>
      <p className="label">{label}</p>
      <div className="flex flex-wrap items-center gap-2">
        {(["oui", "non"] as const).map((v) => (
          <Chip key={v} active={value === v} onClick={() => onChange(value === v ? "" : v)}>
            {v === "oui" ? "Oui" : "Non"}
          </Chip>
        ))}
      </div>
      {onDetails && value === "oui" && (
        <Input className="mt-2" value={details ?? ""} onChange={(e) => onDetails(e.target.value)} placeholder="Préciser…" maxLength={500} />
      )}
    </div>
  );
}

/** Choix unique sous forme de pastilles (re-cliquer désélectionne). */
function ChoiceField({
  label,
  options,
  value,
  onChange,
  className,
}: {
  label: string;
  options: string[];
  value: string | undefined;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="label">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <Chip key={o} active={value === o} onClick={() => onChange(value === o ? "" : o)}>
            {o}
          </Chip>
        ))}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-2xl border border-ink-700/70 bg-ink-900/50 p-4 sm:p-5">
      <legend className="h-display px-2 text-base text-royal-300">{title}</legend>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

/* ------------------------------------------------------------------ */
/* Champs du questionnaire (réutilisés par la fiche client et l'onglet Bilan) */
/* ------------------------------------------------------------------ */

export function IntakeFields({
  answers: a,
  onChange: setA,
  date,
  onDate: setDate,
  header,
}: {
  answers: IntakeAnswers;
  onChange: React.Dispatch<React.SetStateAction<IntakeAnswers>>;
  date: string;
  onDate: (v: string) => void;
  header?: React.ReactNode;
}) {
  const set = <K extends keyof IntakeAnswers>(k: K, v: IntakeAnswers[K]) => setA((x) => ({ ...x, [k]: v }));
  const toggle = (k: "goals" | "days" | "slots" | "pain_zones" | "diet" | "training_places", v: string, exclusive?: string) =>
    setA((x) => {
      let cur = x[k] ?? [];
      if (cur.includes(v)) cur = cur.filter((y) => y !== v);
      // « Aucune » / « Aucun régime » s'excluent avec les autres choix
      else if (v === exclusive) cur = [v];
      else cur = [...cur.filter((y) => y !== exclusive), v];
      return { ...x, [k]: cur };
    });
  const text = (k: keyof IntakeAnswers, max = 300) => ({
    value: (a[k] as string | undefined) ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(k, e.target.value as never),
    maxLength: max,
  });
  const imc = bmi(a);
  return (
      <div className="space-y-5">
        <Section title="Informations client">
          {header}
          <Field label="Date du bilan">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Âge">
              <Input inputMode="numeric" value={a.age ?? ""} onChange={(e) => set("age", e.target.value)} placeholder="ans" maxLength={3} />
            </Field>
            <div>
              <p className="label">Sexe</p>
              <div className="flex gap-2">
                <Chip active={a.sex === "homme"} onClick={() => set("sex", a.sex === "homme" ? "" : "homme")}>
                  Homme
                </Chip>
                <Chip active={a.sex === "femme"} onClick={() => set("sex", a.sex === "femme" ? "" : "femme")}>
                  Femme
                </Chip>
              </div>
            </div>
          </div>
        </Section>

        <Section title="1. Objectifs">
          <Field label="Objectif principal" className="sm:col-span-2">
            <Input value={a.main_goal ?? ""} onChange={(e) => set("main_goal", e.target.value)} maxLength={300} />
          </Field>
          <div className="sm:col-span-2">
            <p className="label">Objectifs (plusieurs choix possibles)</p>
            <div className="flex flex-wrap gap-2">
              {GOAL_OPTIONS.map((g) => (
                <Chip key={g} active={(a.goals ?? []).includes(g)} onClick={() => toggle("goals", g)}>
                  {g}
                </Chip>
              ))}
            </div>
          </div>
          <Field label="Autre" className="sm:col-span-2">
            <Input value={a.goal_other ?? ""} onChange={(e) => set("goal_other", e.target.value)} maxLength={300} />
          </Field>
          <Field label="Objectif chiffré">
            <Input {...text("goal_target", 200)} placeholder="Ex. −8 kg, courir 10 km, 10 tractions" />
          </Field>
          <Field label="Échéance">
            <Input {...text("goal_deadline", 120)} placeholder="Ex. dans 3 mois, mariage en juin" />
          </Field>
          <Field label="Pourquoi maintenant ? (la vraie motivation)" className="sm:col-span-2">
            <Textarea {...text("motivation_why", 1000)} rows={2} placeholder="Ex. me sentir bien dans mon corps, santé, confiance en soi…" />
          </Field>
          <ChoiceField
            label="Motivation (1 = faible, 10 = à fond)"
            options={MOTIVATION_LEVELS}
            value={a.motivation_level}
            onChange={(v) => set("motivation_level", v)}
            className="sm:col-span-2"
          />
          <Field label="Ce qui t'a freiné jusqu'ici" className="sm:col-span-2">
            <Textarea {...text("past_obstacles", 1000)} rows={2} placeholder="Ex. manque de temps, motivation, blessure, ne savait pas quoi faire…" />
          </Field>
        </Section>

        <Section title="2. État physique général">
          <div className="grid grid-cols-2 gap-3 sm:col-span-2 sm:grid-cols-4">
            <Field label="Taille (cm)">
              <Input inputMode="numeric" value={a.height_cm ?? ""} onChange={(e) => set("height_cm", e.target.value)} placeholder="170" />
            </Field>
            <Field label="Poids (kg)">
              <Input inputMode="decimal" value={a.weight_kg ?? ""} onChange={(e) => set("weight_kg", e.target.value)} placeholder="70" />
            </Field>
            <div>
              <p className="label">IMC (calculé)</p>
              <p className="flex h-[42px] items-center rounded-xl border border-ink-700 bg-ink-850 px-3.5 text-ink-200">
                {imc !== null ? String(imc).replace(".", ",") : "—"}
              </p>
            </div>
            <Field label="Tour de taille (cm)">
              <Input inputMode="decimal" {...text("waist_cm", 5)} placeholder="80" />
            </Field>
          </div>
        </Section>

        <Section title="3. Antécédents et santé">
          {needsMedicalAdvice(a) && (
            <div className="flex items-start gap-2 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200 sm:col-span-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Avis médical recommandé avant de commencer un entraînement intense. Demande un certificat médical de non contre-indication.</span>
            </div>
          )}
          <YesNoField
            label="Douleur dans la poitrine, essoufflement anormal, malaise ou vertiges pendant un effort"
            value={a.cardio_symptoms}
            onChange={(v) => set("cardio_symptoms", v)}
            details={a.cardio_symptoms_details}
            onDetails={(v) => set("cardio_symptoms_details", v)}
          />
          <YesNoField
            label="Problème cardiaque, tension ou diabète (toi ou famille proche)"
            value={a.cardio_history}
            onChange={(v) => set("cardio_history", v)}
            details={a.cardio_history_details}
            onDetails={(v) => set("cardio_history_details", v)}
          />
          <YesNoField
            label="Pathologies ou problèmes de santé"
            value={a.pathologies}
            onChange={(v) => set("pathologies", v)}
            details={a.pathologies_details}
            onDetails={(v) => set("pathologies_details", v)}
          />
          <YesNoField
            label="Blessures récentes ou anciennes"
            value={a.injuries}
            onChange={(v) => set("injuries", v)}
            details={a.injuries_details}
            onDetails={(v) => set("injuries_details", v)}
          />
          <YesNoField
            label="Traitement médical en cours"
            value={a.treatment}
            onChange={(v) => set("treatment", v)}
            details={a.treatment_details}
            onDetails={(v) => set("treatment_details", v)}
          />
          <YesNoField
            label="Opérations chirurgicales"
            value={a.surgeries}
            onChange={(v) => set("surgeries", v)}
            details={a.surgeries_details}
            onDetails={(v) => set("surgeries_details", v)}
          />
          {a.sex === "femme" && (
            <YesNoField label="Enceinte ou accouchement il y a moins d'un an" value={a.pregnancy} onChange={(v) => set("pregnancy", v)} />
          )}
          <div className="sm:col-span-2">
            <p className="label">Douleurs actuelles</p>
            <div className="flex flex-wrap gap-2">
              {PAIN_ZONES.map((z) => (
                <Chip key={z} active={(a.pain_zones ?? []).includes(z)} onClick={() => toggle("pain_zones", z, "Aucune")}>
                  {z}
                </Chip>
              ))}
            </div>
            {(a.pain_zones ?? []).some((z) => z !== "Aucune") && (
              <Input className="mt-2" {...text("pain_details", 500)} placeholder="Quand ça fait mal, depuis quand, quels mouvements…" />
            )}
          </div>
          <YesNoField label="Certificat médical fourni" value={a.medical_certificate} onChange={(v) => set("medical_certificate", v)} />
          <Field label="Restrictions ou précautions médicales" className="sm:col-span-2">
            <Textarea value={a.restrictions ?? ""} onChange={(e) => set("restrictions", e.target.value)} rows={2} maxLength={1000} />
          </Field>
        </Section>

        <Section title="4. Habitudes sportives">
          <div className="sm:col-span-2">
            <p className="label">Niveau de pratique actuel</p>
            <div className="flex flex-wrap gap-2">
              {PRACTICE_LEVELS.map((l) => (
                <Chip key={l.key} active={a.practice_level === l.key} onClick={() => set("practice_level", a.practice_level === l.key ? "" : l.key)}>
                  {l.label}
                </Chip>
              ))}
            </div>
          </div>
          <Field label="Types d'activités pratiquées">
            <Input value={a.activities ?? ""} onChange={(e) => set("activities", e.target.value)} maxLength={300} />
          </Field>
          <Field label="Fréquence hebdomadaire">
            <Input value={a.weekly_frequency ?? ""} onChange={(e) => set("weekly_frequency", e.target.value)} placeholder="Ex. 3 séances" maxLength={100} />
          </Field>
          <YesNoField label="Expérience en salle ou avec un coach" value={a.coach_experience} onChange={(v) => set("coach_experience", v)} />
          <Field label="Activités passées (si arrêt)">
            <Input value={a.past_activities ?? ""} onChange={(e) => set("past_activities", e.target.value)} maxLength={300} />
          </Field>
          <Field label="Ce qu'il/elle aime faire">
            <Input {...text("liked_activities")} placeholder="Ex. cardio, renfo, travail en musique…" />
          </Field>
          <Field label="Ce qu'il/elle n'aime pas">
            <Input {...text("disliked_activities")} placeholder="Ex. courir, burpees…" />
          </Field>
          <div className="sm:col-span-2">
            <p className="label">Où s&apos;entraîner</p>
            <div className="flex flex-wrap gap-2">
              {PLACE_OPTIONS.map((o) => (
                <Chip key={o} active={(a.training_places ?? []).includes(o)} onClick={() => toggle("training_places", o)}>
                  {o}
                </Chip>
              ))}
            </div>
          </div>
          {(a.training_places ?? []).includes("Domicile") && (
            <Field label="Matériel à la maison" className="sm:col-span-2">
              <Input {...text("home_equipment")} placeholder="Ex. haltères 2×10 kg, élastiques, tapis…" />
            </Field>
          )}
        </Section>

        <Section title="5. Mode de vie">
          <ChoiceField label="Activité professionnelle" options={JOB_OPTIONS} value={a.job_activity} onChange={(v) => set("job_activity", v)} className="sm:col-span-2" />
          <ChoiceField label="Pas par jour (environ)" options={STEPS_OPTIONS} value={a.daily_steps} onChange={(v) => set("daily_steps", v)} className="sm:col-span-2" />
          <Field label="Sommeil (heures par nuit)">
            <Input inputMode="decimal" {...text("sleep_hours", 5)} placeholder="7" />
          </Field>
          <ChoiceField label="Qualité du sommeil" options={SLEEP_QUALITY} value={a.sleep_quality} onChange={(v) => set("sleep_quality", v)} />
          <ChoiceField label="Niveau de stress" options={STRESS_OPTIONS} value={a.stress_level} onChange={(v) => set("stress_level", v)} />
          <ChoiceField label="Alcool" options={ALCOHOL_OPTIONS} value={a.alcohol} onChange={(v) => set("alcohol", v)} />
          <YesNoField label="Fumeur" value={a.smoker} onChange={(v) => set("smoker", v)} />
        </Section>

        <Section title="6. Alimentation">
          <Field label="Repas par jour">
            <Input inputMode="numeric" {...text("meals_per_day", 2)} placeholder="3" />
          </Field>
          <Field label="Eau par jour (litres)">
            <Input inputMode="decimal" {...text("water_liters", 4)} placeholder="1,5" />
          </Field>
          <div className="sm:col-span-2">
            <p className="label">Régime alimentaire</p>
            <div className="flex flex-wrap gap-2">
              {DIET_OPTIONS.map((o) => (
                <Chip key={o} active={(a.diet ?? []).includes(o)} onClick={() => toggle("diet", o, "Aucun régime particulier")}>
                  {o}
                </Chip>
              ))}
            </div>
          </div>
          <Field label="Allergies ou intolérances">
            <Input {...text("allergies")} placeholder="Ex. arachides, lactose…" />
          </Field>
          <YesNoField label="Grignotage entre les repas" value={a.snacking} onChange={(v) => set("snacking", v)} />
          <Field label="Journée alimentaire type" className="sm:col-span-2">
            <Textarea {...text("typical_day", 2000)} rows={3} placeholder="Petit-déjeuner, midi, soir, collations…" />
          </Field>
        </Section>

        <Section title="7. Disponibilités et organisation">
          <div className="sm:col-span-2">
            <p className="label">Jours disponibles</p>
            <div className="flex flex-wrap gap-2">
              {DAY_OPTIONS.map((d) => (
                <Chip key={d} active={(a.days ?? []).includes(d)} onClick={() => toggle("days", d)}>
                  {d}
                </Chip>
              ))}
            </div>
          </div>
          <div className="sm:col-span-2">
            <p className="label">Créneaux préférés</p>
            <div className="flex flex-wrap gap-2">
              {SLOT_OPTIONS.map((d) => (
                <Chip key={d} active={(a.slots ?? []).includes(d)} onClick={() => toggle("slots", d)}>
                  {d}
                </Chip>
              ))}
            </div>
          </div>
          <Field label="Durée souhaitée par séance">
            <Input value={a.session_duration ?? ""} onChange={(e) => set("session_duration", e.target.value)} placeholder="Ex. 45 min / 1 h" maxLength={60} />
          </Field>
          <Field label="Fréquence souhaitée (séances / semaine)">
            <Input inputMode="numeric" value={a.wished_frequency ?? ""} onChange={(e) => set("wished_frequency", e.target.value)} placeholder="3" maxLength={2} />
          </Field>
        </Section>

        <Section title="8. Conclusion du bilan">
          <Field label="Conclusion" className="sm:col-span-2">
            <Textarea value={a.conclusion ?? ""} onChange={(e) => set("conclusion", e.target.value)} rows={4} maxLength={4000} />
          </Field>
        </Section>
      </div>
  );
}

/* ------------------------------------------------------------------ */
/* Formulaire                                                          */
/* ------------------------------------------------------------------ */

function IntakeForm({
  open,
  onClose,
  client,
  intake,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  client: Client;
  intake: Intake | null;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [date, setDate] = useState(todayISO());
  const [a, setA] = useState<IntakeAnswers>({});
  const [saving, setSaving] = useState(false);
  const [wasOpen, setWasOpen] = useState(false);

  if (open && !wasOpen) {
    setWasOpen(true);
    setDate(intake?.assessed_on ?? todayISO());
    setA(
      intake?.answers ?? {
        main_goal: client.goal ?? "",
        wished_frequency: client.sessions_per_week != null ? String(client.sessions_per_week) : "",
      },
    );
  }
  if (!open && wasOpen) setWasOpen(false);

  async function save() {
    if (!date) return toast.error("Indiquez la date du bilan.");
    setSaving(true);
    const sb = getSupabase();
    const payload = { assessed_on: date, answers: a };
    const res = intake
      ? await sb.from("client_intakes").update(payload).eq("id", intake.id)
      : await sb.from("client_intakes").insert({ ...payload, client_id: client.id });
    setSaving(false);
    if (res.error) {
      return toast.error(
        /client_intakes/.test(res.error.message)
          ? "Fonction non activée : exécutez le fichier SQL 20261015000005_intake.sql dans Supabase."
          : errorMessage(res.error),
      );
    }
    toast.success("Bilan de départ enregistré.");
    onSaved();
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={`Bilan de départ — ${client.first_name} ${client.last_name}`}
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
      <IntakeFields answers={a} onChange={setA} date={date} onDate={setDate} />
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Carte affichée dans l'onglet Bilans                                  */
/* ------------------------------------------------------------------ */

export function IntakePanel({ client }: { client: Client }) {
  const toast = useToast();
  const { data, loading, reload } = useAsync(async () => {
    const { data, error } = await getSupabase()
      .from("client_intakes")
      .select("*")
      .eq("client_id", client.id)
      .order("assessed_on", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return { intake: null, missing: /client_intakes/.test(error.message) };
    return { intake: (data as Intake | null) ?? null, missing: false };
  }, [client.id]);
  const [formOpen, setFormOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  if (loading) return <LoadingBlock />;
  const intake = data?.intake ?? null;

  if (data?.missing) {
    return (
      <Card title="Bilan de départ">
        <p className="text-sm text-amber-300">
          Fonction non activée : exécutez le fichier <code>supabase/migrations/20261015000005_intake.sql</code> dans Supabase &gt; SQL Editor.
        </p>
      </Card>
    );
  }

  async function exportPdf() {
    if (!intake) return;
    setPdfBusy(true);
    try {
      const { exportIntakePdf } = await import("@/lib/pdf");
      await exportIntakePdf(client, intake);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setPdfBusy(false);
    }
  }

  return (
    <>
      <Card
        title={
          <span className="flex items-center gap-2">
            Bilan de départ {intake && <Badge tone="blue">{fmtDateLong(intake.assessed_on)}</Badge>}
          </span>
        }
        actions={
          intake ? (
            <>
              <Button size="sm" variant="secondary" onClick={exportPdf} loading={pdfBusy}>
                <FileDown className="h-3.5 w-3.5" /> PDF
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setFormOpen(true)}>
                <Pencil className="h-3.5 w-3.5" /> Modifier
              </Button>
              <Button size="icon" variant="ghost" className="hover:text-red-300" onClick={() => setConfirmDel(true)} aria-label="Supprimer le bilan de départ">
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          ) : undefined
        }
      >
        {!intake ? (
          <EmptyState
            icon={<ClipboardCheck className="h-6 w-6" />}
            title="Aucun bilan de départ"
            text="Objectifs, santé, habitudes sportives, disponibilités : le questionnaire à remplir lors du premier rendez-vous."
            action={
              <Button onClick={() => setFormOpen(true)}>
                <Plus className="h-4 w-4" /> Remplir le bilan de départ
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {needsMedicalAdvice(intake.answers) && (
              <div className="flex items-start gap-2 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200 md:col-span-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Avis médical recommandé avant tout entraînement intense (voir « Antécédents et santé »).</span>
              </div>
            )}
            {intakeSections(intake.answers).map((s) => (
              <div key={s.title} className={cn("rounded-xl border border-ink-700/60 bg-ink-900/40 p-4", s.title.startsWith("8.") && "md:col-span-2")}>
                <h3 className="h-display mb-2 text-sm text-royal-300">{s.title}</h3>
                <dl className="space-y-1.5 text-sm">
                  {s.rows.map(([k, v]) => (
                    <div key={k} className="grid grid-cols-[minmax(0,44%)_1fr] gap-3">
                      <dt className="text-ink-400">{k}</dt>
                      <dd className="whitespace-pre-line text-ink-100">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        )}
      </Card>

      <IntakeForm open={formOpen} onClose={() => setFormOpen(false)} client={client} intake={intake} onSaved={reload} />
      <ConfirmDialog
        open={confirmDel}
        title="Supprimer le bilan de départ ?"
        message="Toutes les réponses du questionnaire seront supprimées définitivement."
        onConfirm={async () => {
          const { error } = await getSupabase().from("client_intakes").delete().eq("id", intake!.id);
          setConfirmDel(false);
          if (error) return toast.error(errorMessage(error));
          toast.success("Bilan de départ supprimé.");
          reload();
        }}
        onCancel={() => setConfirmDel(false)}
      />
    </>
  );
}
