"use client";

import { useEffect, useState } from "react";
import { Button, Field, Input, Modal, Select, Textarea } from "./ui";
import { useToast } from "./toast";
import { getSupabase } from "@/lib/supabase/client";
import { emptyToNull, errorMessage, LEVEL_LABELS } from "@/lib/format";
import type { Client } from "@/lib/types";

const GOAL_SUGGESTIONS = [
  "Perte de poids",
  "Prise de masse musculaire",
  "Gain de force",
  "Remise en forme",
  "Préparation physique",
  "Recomposition corporelle",
  "Santé / bien-être",
];

export function ClientForm({
  open,
  onClose,
  client,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  client?: Client | null;
  onSaved: (id: string) => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    goal: "",
    level: "",
    sessions_per_week: "",
    constraints: "",
    notes: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setForm({
      first_name: client?.first_name ?? "",
      last_name: client?.last_name ?? "",
      goal: client?.goal ?? "",
      level: client?.level ?? "",
      sessions_per_week: client?.sessions_per_week?.toString() ?? "",
      constraints: client?.constraints ?? "",
      notes: client?.notes ?? "",
    });
  }, [open, client]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.first_name.trim()) errs.first_name = "Prénom requis";
    if (!form.last_name.trim()) errs.last_name = "Nom requis";
    const spw = form.sessions_per_week ? Number(form.sessions_per_week) : null;
    if (spw !== null && (!Number.isInteger(spw) || spw < 0 || spw > 14)) errs.sessions_per_week = "Entre 0 et 14";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setSaving(true);
    const payload = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      goal: emptyToNull(form.goal),
      level: emptyToNull(form.level),
      sessions_per_week: spw,
      constraints: emptyToNull(form.constraints),
      notes: emptyToNull(form.notes),
    };
    const sb = getSupabase();
    const res = client
      ? await sb.from("clients").update(payload).eq("id", client.id).select("id").single()
      : await sb.from("clients").insert(payload).select("id").single();
    setSaving(false);
    if (res.error) return toast.error(errorMessage(res.error));
    toast.success(client ? "Fiche client mise à jour." : "Client ajouté.");
    onSaved(res.data.id);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={client ? "Modifier la fiche client" : "Nouveau client"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={() => save()} loading={saving}>
            Enregistrer
          </Button>
        </>
      }
    >
      <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        <Field label="Prénom" required error={errors.first_name}>
          <Input value={form.first_name} onChange={set("first_name")} autoFocus maxLength={80} />
        </Field>
        <Field label="Nom" required error={errors.last_name}>
          <Input value={form.last_name} onChange={set("last_name")} maxLength={80} />
        </Field>
        <Field label="Objectif principal" className="sm:col-span-2">
          <Input value={form.goal} onChange={set("goal")} list="client-goals" maxLength={200} placeholder="Ex. : perte de poids" />
          <datalist id="client-goals">
            {GOAL_SUGGESTIONS.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
        </Field>
        <Field label="Niveau sportif">
          <Select value={form.level} onChange={set("level")}>
            <option value="">—</option>
            {Object.entries(LEVEL_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Séances par semaine" error={errors.sessions_per_week}>
          <Input type="number" inputMode="numeric" min={0} max={14} value={form.sessions_per_week} onChange={set("sessions_per_week")} />
        </Field>
        <Field label="Contraintes d'entraînement" className="sm:col-span-2" hint="Blessures, matériel disponible, horaires…">
          <Textarea value={form.constraints} onChange={set("constraints")} maxLength={4000} />
        </Field>
        <Field label="Notes privées du coach" className="sm:col-span-2">
          <Textarea value={form.notes} onChange={set("notes")} rows={4} maxLength={8000} />
        </Field>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}
