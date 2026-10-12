"use client";

import { useEffect, useState } from "react";
import { Button, Field, Input, Modal, Select, Textarea } from "./ui";
import { useToast } from "./toast";
import { getSupabase } from "@/lib/supabase/client";
import { emptyToNull, EQUIPMENT, errorMessage, MOVEMENT_TYPES, MUSCLE_GROUPS } from "@/lib/format";
import type { Exercise } from "@/lib/types";

const EMPTY = {
  name: "",
  muscle_group: "",
  equipment: "",
  movement_type: "",
  description: "",
  execution_cues: "",
  common_mistakes: "",
  variations: "",
  video_url: "",
  notes: "",
};

export function ExerciseForm({
  open,
  onClose,
  exercise,
  initialName,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  exercise?: Exercise | null;
  initialName?: string;
  onSaved: (ex: Exercise) => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(
      exercise
        ? {
            name: exercise.name,
            muscle_group: exercise.muscle_group ?? "",
            equipment: exercise.equipment ?? "",
            movement_type: exercise.movement_type ?? "",
            description: exercise.description ?? "",
            execution_cues: exercise.execution_cues ?? "",
            common_mistakes: exercise.common_mistakes ?? "",
            variations: exercise.variations ?? "",
            video_url: exercise.video_url ?? "",
            notes: exercise.notes ?? "",
          }
        : { ...EMPTY, name: initialName ?? "" },
    );
  }, [open, exercise, initialName]);

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    if (!form.name.trim()) return setError("Le nom de l'exercice est requis.");
    const url = form.video_url.trim();
    if (url && !/^https?:\/\/\S+$/i.test(url)) return setError("Le lien vidéo doit commencer par http:// ou https://");

    const payload: Record<string, string | null> = {};
    (Object.keys(EMPTY) as (keyof typeof EMPTY)[]).forEach((k) => (payload[k] = emptyToNull(form[k])));
    payload.name = form.name.trim();

    setSaving(true);
    const sb = getSupabase();
    const res = exercise
      ? await sb.from("exercises").update(payload).eq("id", exercise.id).select("*").single()
      : await sb.from("exercises").insert(payload).select("*").single();
    setSaving(false);
    if (res.error) return setError(errorMessage(res.error));
    toast.success(exercise ? "Exercice mis à jour." : "Exercice ajouté à la bibliothèque.");
    onSaved(res.data as Exercise);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={exercise ? "Modifier l'exercice" : "Nouvel exercice"}
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
      <form onSubmit={save} className="grid gap-4 sm:grid-cols-3">
        <Field label="Nom de l'exercice" required className="sm:col-span-3">
          <Input value={form.name} onChange={set("name")} maxLength={120} autoFocus />
        </Field>
        <Field label="Groupe musculaire">
          <Input value={form.muscle_group} onChange={set("muscle_group")} list="muscles" maxLength={60} />
        </Field>
        <Field label="Matériel">
          <Input value={form.equipment} onChange={set("equipment")} list="equipment" maxLength={60} />
        </Field>
        <Field label="Type de mouvement">
          <Select value={form.movement_type} onChange={set("movement_type")}>
            <option value="">—</option>
            {MOVEMENT_TYPES.map((m) => (
              <option key={m}>{m}</option>
            ))}
            {form.movement_type && !MOVEMENT_TYPES.includes(form.movement_type) && <option>{form.movement_type}</option>}
          </Select>
        </Field>
        <Field label="Description technique" className="sm:col-span-3">
          <Textarea value={form.description} onChange={set("description")} maxLength={4000} />
        </Field>
        <Field label="Consignes d'exécution" className="sm:col-span-3">
          <Textarea value={form.execution_cues} onChange={set("execution_cues")} maxLength={4000} />
        </Field>
        <Field label="Erreurs fréquentes" className="sm:col-span-3">
          <Textarea value={form.common_mistakes} onChange={set("common_mistakes")} maxLength={4000} />
        </Field>
        <Field label="Variantes possibles" className="sm:col-span-3">
          <Textarea value={form.variations} onChange={set("variations")} rows={2} maxLength={2000} />
        </Field>
        <Field label="Lien vidéo de démonstration" className="sm:col-span-3">
          <Input type="url" value={form.video_url} onChange={set("video_url")} placeholder="https://…" />
        </Field>
        <Field label="Notes personnelles" className="sm:col-span-3">
          <Textarea value={form.notes} onChange={set("notes")} rows={2} maxLength={4000} />
        </Field>
        <datalist id="muscles">
          {MUSCLE_GROUPS.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
        <datalist id="equipment">
          {EQUIPMENT.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
        {error && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300 sm:col-span-3">{error}</p>
        )}
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}
