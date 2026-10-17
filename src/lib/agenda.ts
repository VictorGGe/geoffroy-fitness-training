/** Agenda du coach : types, couleurs et calculs de dates (heure locale). */

export type AppointmentKind = "seance" | "bilan" | "suivi" | "autre";
export type AppointmentStatus = "prevu" | "fait" | "annule" | "absent";

export interface Appointment {
  id: string;
  client_id: string | null;
  guest_name: string | null;
  kind: AppointmentKind;
  title: string | null;
  starts_at: string;
  duration_min: number;
  location: string | null;
  notes: string | null;
  status: AppointmentStatus;
  series_id: string | null;
  clients?: { id: string; first_name: string; last_name: string } | null;
}

export const KINDS: { key: AppointmentKind; label: string; dot: string; block: string; chip: string }[] = [
  {
    key: "seance",
    label: "Séance",
    dot: "bg-royal-500",
    block: "border-royal-500/60 bg-royal-600/25 text-white",
    chip: "border-royal-500 bg-royal-600/20 text-white",
  },
  {
    key: "bilan",
    label: "Bilan",
    dot: "bg-emerald-400",
    block: "border-emerald-400/60 bg-emerald-500/20 text-white",
    chip: "border-emerald-400 bg-emerald-500/15 text-white",
  },
  {
    key: "suivi",
    label: "Suivi",
    dot: "bg-amber-400",
    block: "border-amber-400/60 bg-amber-500/20 text-white",
    chip: "border-amber-400 bg-amber-500/15 text-white",
  },
  {
    key: "autre",
    label: "Autre",
    dot: "bg-ink-400",
    block: "border-ink-500 bg-ink-700/70 text-white",
    chip: "border-ink-400 bg-ink-700 text-white",
  },
];
export const kindInfo = (k: AppointmentKind) => KINDS.find((x) => x.key === k) ?? KINDS[3];

export const STATUSES: { key: AppointmentStatus; label: string }[] = [
  { key: "prevu", label: "Prévu" },
  { key: "fait", label: "Fait" },
  { key: "absent", label: "Absent" },
  { key: "annule", label: "Annulé" },
];

export const DURATIONS = [30, 45, 60, 90];
export const LOCATIONS = ["Salle", "À domicile", "En extérieur", "Visio"];

/** Nom affiché d'un rendez-vous. */
export function apptName(a: Pick<Appointment, "clients" | "guest_name" | "title" | "kind">): string {
  if (a.clients) return `${a.clients.first_name} ${a.clients.last_name}`;
  if (a.guest_name) return a.guest_name;
  return a.title || kindInfo(a.kind).label;
}

/* ---------------- Dates (toujours en heure locale) ---------------- */

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes());
}

/** Lundi de la semaine. */
export function startOfWeek(d: Date): Date {
  const s = startOfDay(d);
  const day = (s.getDay() + 6) % 7;
  return addDays(s, -day);
}

export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function dateInput(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function timeInput(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function fromInputs(date: string, time: string): Date | null {
  const dm = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const tm = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!dm || !tm) return null;
  const d = new Date(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]), Number(tm[1]), Number(tm[2]));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function fmtTime(d: Date): string {
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export function fmtDayLong(d: Date): string {
  const s = d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function endOf(a: Pick<Appointment, "starts_at" | "duration_min">): Date {
  return new Date(new Date(a.starts_at).getTime() + a.duration_min * 60000);
}

export function overlaps(a: { start: Date; end: Date }, b: { start: Date; end: Date }): boolean {
  return a.start < b.end && b.start < a.end;
}

export function fmtDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}
