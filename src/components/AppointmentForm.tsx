"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ClipboardCheck, ClipboardPlus, Repeat, Trash2 } from "lucide-react";
import { Button, ConfirmDialog, Field, Input, Modal, Select, Textarea } from "./ui";
import { Chip } from "./FoodPicker";
import { useToast } from "./toast";
import { cn } from "@/lib/cn";
import { getSupabase } from "@/lib/supabase/client";
import { errorMessage, fullName } from "@/lib/format";
import {
  addDays,
  apptName,
  dateInput,
  DURATIONS,
  endOf,
  fmtTime,
  fromInputs,
  KINDS,
  LOCATIONS,
  overlaps,
  STATUSES,
  timeInput,
  type Appointment,
  type AppointmentKind,
  type AppointmentStatus,
} from "@/lib/agenda";
import type { Client } from "@/lib/types";

const GUEST = "__guest";
const NONE = "__none";

export function AppointmentForm({
  open,
  onClose,
  appt,
  initialStart,
  initialClientId,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  appt: Appointment | null;
  initialStart?: Date | null;
  initialClientId?: string | null;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [clients, setClients] = useState<Pick<Client, "id" | "first_name" | "last_name">[]>([]);
  const [kind, setKind] = useState<AppointmentKind>("seance");
  const [who, setWho] = useState("");
  const [guest, setGuest] = useState("");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState("60");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<AppointmentStatus>("prevu");
  const [repeat, setRepeat] = useState("0");
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [askDelete, setAskDelete] = useState(false);
  const [sameDay, setSameDay] = useState<Appointment[]>([]);

  useEffect(() => {
    if (!open) return;
    setErr(null);
    setAskDelete(false);
    getSupabase()
      .from("clients")
      .select("id, first_name, last_name")
      .eq("archived", false)
      .order("first_name")
      .then(({ data }) => setClients(data ?? []));
    if (appt) {
      const s = new Date(appt.starts_at);
      setKind(appt.kind);
      setWho(appt.client_id ?? (appt.guest_name ? GUEST : NONE));
      setGuest(appt.guest_name ?? "");
      setTitle(appt.title ?? "");
      setDate(dateInput(s));
      setTime(timeInput(s));
      setDuration(String(appt.duration_min));
      setLocation(appt.location ?? "");
      setNotes(appt.notes ?? "");
      setStatus(appt.status);
      setRepeat("0");
    } else {
      const s = initialStart ?? nextSlot();
      setKind("seance");
      setWho(initialClientId ?? "");
      setGuest("");
      setTitle("");
      setDate(dateInput(s));
      setTime(timeInput(s));
      setDuration("60");
      setLocation(lastLocation());
      setNotes("");
      setStatus("prevu");
      setRepeat("0");
    }
  }, [open, appt, initialStart, initialClientId]);

  const start = fromInputs(date, time);
  const dur = Number(duration);

  // Rendez-vous du même jour, pour prévenir d'un chevauchement
  useEffect(() => {
    if (!open || !start) return;
    const d0 = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    let cancelled = false;
    getSupabase()
      .from("appointments")
      .select("*, clients(id, first_name, last_name)")
      .gte("starts_at", d0.toISOString())
      .lt("starts_at", addDays(d0, 1).toISOString())
      .neq("status", "annule")
      .then(({ data }) => !cancelled && setSameDay((data as Appointment[]) ?? []));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, date]);

  const conflicts = useMemo(() => {
    if (!start || !dur) return [];
    const me = { start, end: new Date(start.getTime() + dur * 60000) };
    return sameDay.filter((a) => a.id !== appt?.id && overlaps(me, { start: new Date(a.starts_at), end: endOf(a) }));
  }, [sameDay, start, dur, appt]);

  const clientId = who && who !== GUEST && who !== NONE ? who : null;

  async function save() {
    setErr(null);
    if (!start) return setErr("Indique la date et l'heure.");
    if (!Number.isInteger(dur) || dur < 5 || dur > 720) return setErr("Durée : entre 5 et 720 minutes.");
    if (!who) return setErr("Choisis le client (ou « Nouvelle personne »).");
    if (who === GUEST && !guest.trim()) return setErr("Indique le nom de la personne.");
    if (who === NONE && !title.trim() && kind !== "autre") return setErr("Donne un intitulé au rendez-vous.");

    const row = {
      kind,
      client_id: clientId,
      guest_name: who === GUEST ? guest.trim().slice(0, 120) : null,
      title: title.trim().slice(0, 120) || (who === NONE ? KINDS.find((k) => k.key === kind)?.label ?? null : null),
      starts_at: start.toISOString(),
      duration_min: dur,
      location: location.trim().slice(0, 160) || null,
      notes: notes.trim() || null,
      status,
    };
    setSaving(true);
    const sb = getSupabase();
    try {
      if (appt) {
        const { error } = await sb.from("appointments").update(row).eq("id", appt.id);
        if (error) throw error;
      } else {
        const n = Math.max(1, Number(repeat) || 1);
        const series = n > 1 ? crypto.randomUUID() : null;
        const rows = Array.from({ length: n }, (_, i) => ({ ...row, series_id: series, starts_at: addDays(start, 7 * i).toISOString() }));
        const { error } = await sb.from("appointments").insert(rows);
        if (error) throw error;
      }
      try {
        if (row.location) localStorage.setItem("vt:last-location", row.location);
      } catch {
        /* sans importance */
      }
      toast.success(appt ? "Rendez-vous modifié." : Number(repeat) > 1 ? `${repeat} rendez-vous ajoutés.` : "Rendez-vous ajouté.");
      onSaved();
      onClose();
    } catch (e) {
      const m = errorMessage(e);
      setErr(/appointments/.test(m) ? "L'agenda n'est pas encore activé : exécute le fichier SQL 20261017000007_agenda.sql dans Supabase." : m);
    } finally {
      setSaving(false);
    }
  }

  async function remove(scope: "one" | "next") {
    if (!appt) return;
    setSaving(true);
    const sb = getSupabase();
    const q =
      scope === "next" && appt.series_id
        ? sb.from("appointments").delete().eq("series_id", appt.series_id).gte("starts_at", appt.starts_at)
        : sb.from("appointments").delete().eq("id", appt.id);
    const { error } = await q;
    setSaving(false);
    if (error) return toast.error(errorMessage(error));
    toast.success(scope === "next" ? "Rendez-vous supprimés." : "Rendez-vous supprimé.");
    setAskDelete(false);
    onSaved();
    onClose();
  }

  const name = appt ? apptName(appt) : "";
  const bilanHref = appt
    ? `/bilans?${new URLSearchParams({
        ...(appt.client_id ? { client: appt.client_id } : appt.guest_name ? { nom: appt.guest_name } : {}),
        date: dateInput(new Date(appt.starts_at)),
        rdv: appt.id,
      })}`
    : "";

  return (
    <>
      <Modal
        open={open && !askDelete}
        onClose={onClose}
        title={appt ? "Rendez-vous" : "Nouveau rendez-vous"}
        size="lg"
        footer={
          <>
            {appt && (
              <Button variant="ghost" className="text-red-300 hover:bg-red-500/10 sm:mr-auto" onClick={() => setAskDelete(true)}>
                <Trash2 className="h-4 w-4" /> Supprimer
              </Button>
            )}
            <Button variant="secondary" onClick={onClose}>
              Annuler
            </Button>
            <Button onClick={save} loading={saving}>
              {appt ? "Enregistrer" : "Ajouter à l'agenda"}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          {appt && (appt.kind === "bilan" || (appt.kind === "seance" && appt.client_id)) && (
            <div className="flex flex-wrap gap-2 rounded-xl border border-ink-700 bg-ink-900/70 p-3">
              {appt.kind === "bilan" && (
                <Link href={bilanHref} className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-600/90 px-3 text-sm font-medium text-white hover:bg-emerald-500">
                  <ClipboardCheck className="h-4 w-4" /> Faire le bilan {appt.client_id || appt.guest_name ? `de ${name}` : ""}
                </Link>
              )}
              {appt.kind === "seance" && appt.client_id && (
                <Link
                  href={`/sessions/new?client=${appt.client_id}`}
                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-royal-600 px-3 text-sm font-medium text-white hover:bg-royal-500"
                >
                  <ClipboardPlus className="h-4 w-4" /> Saisir la séance de {name}
                </Link>
              )}
              {appt.client_id && (
                <Link href={`/clients/${appt.client_id}`} className="inline-flex h-9 items-center rounded-lg px-3 text-sm text-royal-300 hover:bg-ink-800">
                  Voir la fiche
                </Link>
              )}
            </div>
          )}

          <div>
            <p className="label">Type</p>
            <div className="flex flex-wrap gap-2">
              {KINDS.map((k) => (
                <button
                  key={k.key}
                  type="button"
                  onClick={() => setKind(k.key)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition",
                    kind === k.key ? k.chip : "border-ink-700 bg-ink-900 text-ink-300 hover:border-ink-500",
                  )}
                >
                  <span className={cn("h-2.5 w-2.5 rounded-full", k.dot)} /> {k.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Avec qui ?" required>
              <Select value={who} onChange={(e) => setWho(e.target.value)} aria-label="Client">
                <option value="">— Choisir un client —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {fullName(c)}
                  </option>
                ))}
                {appt?.client_id && !clients.some((c) => c.id === appt.client_id) && appt.clients && (
                  <option value={appt.client_id}>{fullName(appt.clients)}</option>
                )}
                <option value={GUEST}>＋ Nouvelle personne (prospect)</option>
                <option value={NONE}>Sans client (perso, réunion…)</option>
              </Select>
            </Field>
            {who === GUEST ? (
              <Field label="Nom de la personne" required hint="La fiche client sera créée au moment du bilan.">
                <Input value={guest} onChange={(e) => setGuest(e.target.value)} placeholder="Prénom Nom" maxLength={120} aria-label="Nom de la personne" autoFocus />
              </Field>
            ) : (
              <Field label="Intitulé" hint={who === NONE ? undefined : "Facultatif (ex. Jambes, Bilan 1 mois…)"}>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} aria-label="Intitulé" />
              </Field>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Date" required>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date" />
            </Field>
            <Field label="Heure" required>
              <Input type="time" step={300} value={time} onChange={(e) => setTime(e.target.value)} aria-label="Heure" />
            </Field>
          </div>

          <div>
            <p className="label">Durée</p>
            <div className="flex flex-wrap items-center gap-2">
              {DURATIONS.map((d) => (
                <Chip key={d} active={duration === String(d)} onClick={() => setDuration(String(d))}>
                  {d < 60 ? `${d} min` : d === 60 ? "1 h" : "1 h 30"}
                </Chip>
              ))}
              <div className="flex items-center gap-1.5">
                <input
                  className="input-sm w-20 text-center"
                  inputMode="numeric"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value.replace(/\D/g, "").slice(0, 3))}
                  aria-label="Durée en minutes"
                />
                <span className="text-sm text-ink-400">min</span>
              </div>
            </div>
          </div>

          <div>
            <p className="label">Lieu</p>
            <div className="flex flex-wrap items-center gap-2">
              {LOCATIONS.map((l) => (
                <Chip key={l} active={location === l} onClick={() => setLocation(location === l ? "" : l)}>
                  {l}
                </Chip>
              ))}
            </div>
            <Input className="mt-2" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Ou une adresse, le nom de la salle…" maxLength={160} aria-label="Lieu" />
          </div>

          {appt ? (
            <div>
              <p className="label">Statut</p>
              <div className="flex flex-wrap gap-2">
                {STATUSES.map((s) => (
                  <Chip key={s.key} active={status === s.key} onClick={() => setStatus(s.key)}>
                    {s.label}
                  </Chip>
                ))}
              </div>
            </div>
          ) : (
            <Field label="Répéter">
              <div className="flex items-center gap-2">
                <Repeat className="h-4 w-4 shrink-0 text-ink-400" />
                <Select value={repeat} onChange={(e) => setRepeat(e.target.value)} aria-label="Répéter">
                  <option value="0">Une seule fois</option>
                  <option value="4">Chaque semaine, pendant 4 semaines</option>
                  <option value="8">Chaque semaine, pendant 8 semaines</option>
                  <option value="12">Chaque semaine, pendant 12 semaines</option>
                  <option value="24">Chaque semaine, pendant 24 semaines</option>
                </Select>
              </div>
            </Field>
          )}

          <Field label="Notes (privées)" hint="Visibles uniquement par toi.">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={4000} />
          </Field>

          {conflicts.length > 0 && (
            <p className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Attention, ce créneau chevauche :{" "}
                {conflicts.map((c) => `${apptName(c)} (${fmtTime(new Date(c.starts_at))})`).join(", ")}.
              </span>
            </p>
          )}
          {err && <p className="text-sm text-red-300">{err}</p>}
        </div>
      </Modal>

      <ConfirmDialog
        open={askDelete && !appt?.series_id}
        title="Supprimer ce rendez-vous ?"
        message={appt ? `${name} — ${new Date(appt.starts_at).toLocaleString("fr-FR", { dateStyle: "full", timeStyle: "short" })}` : ""}
        loading={saving}
        onConfirm={() => remove("one")}
        onCancel={() => setAskDelete(false)}
      />
      <Modal
        open={askDelete && !!appt?.series_id}
        onClose={() => setAskDelete(false)}
        title="Rendez-vous répété"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAskDelete(false)}>
              Annuler
            </Button>
            <Button variant="danger" onClick={() => remove("next")} loading={saving}>
              Celui-ci et les suivants
            </Button>
            <Button variant="danger" onClick={() => remove("one")} loading={saving}>
              Seulement celui-ci
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-300">Ce rendez-vous fait partie d&apos;une série hebdomadaire. Que veux-tu supprimer ?</p>
      </Modal>
    </>
  );
}

function nextSlot(): Date {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
}

function lastLocation(): string {
  try {
    return localStorage.getItem("vt:last-location") ?? "";
  } catch {
    return "";
  }
}
