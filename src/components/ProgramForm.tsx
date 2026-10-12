"use client";

import { useEffect, useState } from "react";
import { Button, Field, Input, Modal, Select, Textarea, cn } from "./ui";
import { useToast } from "./toast";
import { getSupabase } from "@/lib/supabase/client";
import { createProgramFromStarter, duplicateProgram } from "@/lib/data";
import { emptyToNull, errorMessage, fullName, GOAL_LABELS, LEVEL_LABELS } from "@/lib/format";
import { STARTER_TEMPLATES } from "@/lib/starter";
import type { Client, Program } from "@/lib/types";

type Source = { kind: "starter"; key: string } | { kind: "program"; id: string };

export function ProgramForm({
  open,
  onClose,
  program,
  defaultClientId,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  /** Si fourni : modification des informations générales */
  program?: Program | null;
  defaultClientId?: string | null;
  onSaved: (id: string) => void;
}) {
  const toast = useToast();
  const editing = !!program;
  const [clients, setClients] = useState<Pick<Client, "id" | "first_name" | "last_name">[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [source, setSource] = useState<Source>({ kind: "starter", key: "custom" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    client_id: "",
    goal: "",
    level: "",
    duration_weeks: "",
    sessions_per_week: "",
    description: "",
    instructions: "",
    is_template: false,
  });

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSource({ kind: "starter", key: "custom" });
    setForm({
      name: program?.name ?? "",
      client_id: program ? (program.client_id ?? "") : (defaultClientId ?? ""),
      goal: program?.goal ?? "",
      level: program?.level ?? "",
      duration_weeks: program?.duration_weeks?.toString() ?? "",
      sessions_per_week: program?.sessions_per_week?.toString() ?? "",
      description: program?.description ?? "",
      instructions: program?.instructions ?? "",
      is_template: program?.is_template ?? false,
    });
    const sb = getSupabase();
    sb.from("clients")
      .select("id, first_name, last_name")
      .eq("archived", false)
      .order("last_name")
      .then(({ data }) => setClients(data ?? []));
    if (!program) {
      sb.from("programs")
        .select("*, clients(id, first_name, last_name)")
        .order("is_template", { ascending: false })
        .order("updated_at", { ascending: false })
        .then(({ data }) => setPrograms((data as Program[]) ?? []));
    }
  }, [open, program, defaultClientId]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function chooseStarter(key: string) {
    setSource({ kind: "starter", key });
    const tpl = STARTER_TEMPLATES.find((t) => t.key === key);
    if (tpl && key !== "custom") {
      setForm((f) => ({
        ...f,
        name: f.name || tpl.label,
        sessions_per_week: f.sessions_per_week || String(tpl.sessions.length),
        goal: f.goal || (key === "strength" ? "force" : key === "hypertrophy" ? "hypertrophie" : f.goal),
      }));
    }
  }

  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    if (!form.name.trim()) return setError("Le nom du programme est requis.");
    const dw = form.duration_weeks ? Number(form.duration_weeks) : null;
    const spw = form.sessions_per_week ? Number(form.sessions_per_week) : null;
    if (dw !== null && (!Number.isInteger(dw) || dw < 1 || dw > 104)) return setError("Durée : entre 1 et 104 semaines.");
    if (spw !== null && (!Number.isInteger(spw) || spw < 0 || spw > 14)) return setError("Séances par semaine : entre 0 et 14.");

    const fields = {
      name: form.name.trim(),
      client_id: form.client_id || null,
      goal: emptyToNull(form.goal),
      level: emptyToNull(form.level),
      duration_weeks: dw,
      sessions_per_week: spw,
      description: emptyToNull(form.description),
      instructions: emptyToNull(form.instructions),
      is_template: form.is_template,
    };

    setSaving(true);
    try {
      const sb = getSupabase();
      let id: string;
      if (editing && program) {
        const { error } = await sb.from("programs").update(fields).eq("id", program.id);
        if (error) throw error;
        id = program.id;
      } else if (source.kind === "starter") {
        id = await createProgramFromStarter(source.key, fields);
      } else {
        id = await duplicateProgram(source.id, { name: fields.name, client_id: fields.client_id, is_template: fields.is_template });
        const { error } = await sb.from("programs").update(fields).eq("id", id);
        if (error) throw error;
      }
      toast.success(editing ? "Programme mis à jour." : "Programme créé.");
      onSaved(id);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const sourcePrograms = programs.filter((p) => !p.archived || p.is_template);

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={editing ? "Informations du programme" : "Nouveau programme"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={() => save()} loading={saving}>
            {editing ? "Enregistrer" : "Créer le programme"}
          </Button>
        </>
      }
    >
      <form onSubmit={save} className="space-y-6">
        {!editing && (
          <div>
            <p className="label">Point de départ</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {STARTER_TEMPLATES.map((t) => (
                <button
                  type="button"
                  key={t.key}
                  onClick={() => chooseStarter(t.key)}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-left transition",
                    source.kind === "starter" && source.key === t.key
                      ? "border-royal-500 bg-royal-600/15 shadow-glow"
                      : "border-ink-700 bg-ink-900 hover:border-ink-500",
                  )}
                >
                  <p className="text-sm font-semibold text-white">{t.label}</p>
                  <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-snug text-ink-400">{t.description}</p>
                </button>
              ))}
            </div>
            {sourcePrograms.length > 0 && (
              <div className="mt-3">
                <Field label="…ou copier un programme / modèle existant">
                  <Select
                    value={source.kind === "program" ? source.id : ""}
                    onChange={(e) => {
                      const p = programs.find((x) => x.id === e.target.value);
                      if (!p) return setSource({ kind: "starter", key: "custom" });
                      setSource({ kind: "program", id: p.id });
                      setForm((f) => ({
                        ...f,
                        name: f.name || p.name,
                        goal: p.goal ?? f.goal,
                        level: p.level ?? f.level,
                        duration_weeks: p.duration_weeks?.toString() ?? f.duration_weeks,
                        sessions_per_week: p.sessions_per_week?.toString() ?? f.sessions_per_week,
                        description: p.description ?? f.description,
                        instructions: p.instructions ?? f.instructions,
                      }));
                    }}
                  >
                    <option value="">— Aucun —</option>
                    {sourcePrograms.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.is_template ? "★ Modèle · " : ""}
                        {p.name}
                        {p.clients ? ` — ${fullName(p.clients)}` : ""}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            )}
            <p className="mt-2 text-xs text-ink-500">Le modèle n&apos;est qu&apos;un point de départ : tout reste modifiable ensuite.</p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nom du programme" required className="sm:col-span-2">
            <Input value={form.name} onChange={set("name")} maxLength={120} placeholder="Ex. : Cycle force — bloc 1" />
          </Field>
          <Field label="Client associé" hint="Laisser vide pour un programme modèle sans client.">
            <Select value={form.client_id} onChange={set("client_id")}>
              <option value="">— Aucun (modèle) —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {fullName(c)}
                </option>
              ))}
              {program?.clients && !clients.some((c) => c.id === program.client_id) && (
                <option value={program.clients.id}>{fullName(program.clients)} (archivé)</option>
              )}
            </Select>
          </Field>
          <Field label="Objectif">
            <Select value={form.goal} onChange={set("goal")}>
              <option value="">—</option>
              {Object.entries(GOAL_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Niveau">
            <Select value={form.level} onChange={set("level")}>
              <option value="">—</option>
              {Object.entries(LEVEL_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Durée (semaines)">
              <Input type="number" inputMode="numeric" min={1} max={104} value={form.duration_weeks} onChange={set("duration_weeks")} />
            </Field>
            <Field label="Séances / sem.">
              <Input type="number" inputMode="numeric" min={0} max={14} value={form.sessions_per_week} onChange={set("sessions_per_week")} />
            </Field>
          </div>
          <Field label="Description générale" className="sm:col-span-2">
            <Textarea value={form.description} onChange={set("description")} maxLength={4000} />
          </Field>
          <Field label="Consignes particulières" className="sm:col-span-2" hint="Apparaissent dans le PDF remis au client.">
            <Textarea value={form.instructions} onChange={set("instructions")} maxLength={4000} />
          </Field>
          <label className="flex cursor-pointer items-center gap-3 sm:col-span-2">
            <input
              type="checkbox"
              checked={form.is_template}
              onChange={(e) => setForm((f) => ({ ...f, is_template: e.target.checked }))}
              className="h-4 w-4 rounded border-ink-600 bg-ink-900 accent-royal-500"
            />
            <span className="text-sm text-ink-200">Enregistrer aussi comme modèle réutilisable</span>
          </label>
        </div>
        {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}
