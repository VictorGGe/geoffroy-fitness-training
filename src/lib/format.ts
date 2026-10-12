import type { Level, ProgramGoal, SetType } from "./types";

export const LEVEL_LABELS: Record<Level, string> = {
  debutant: "Débutant",
  intermediaire: "Intermédiaire",
  avance: "Avancé",
};

export const GOAL_LABELS: Record<ProgramGoal, string> = {
  hypertrophie: "Hypertrophie",
  force: "Force",
  perte_de_poids: "Perte de poids",
  remise_en_forme: "Remise en forme",
  preparation_physique: "Préparation physique",
  autre: "Autre",
};

export const SET_TYPE_LABELS: Record<SetType, string> = {
  echauffement: "Échauffement",
  travail: "Série de travail",
  degressive: "Dégressive",
  rest_pause: "Rest-pause",
  autre: "Autre",
};

export const MUSCLE_GROUPS = [
  "Pectoraux",
  "Dos",
  "Épaules",
  "Biceps",
  "Triceps",
  "Avant-bras",
  "Quadriceps",
  "Ischio-jambiers",
  "Fessiers",
  "Mollets",
  "Abdominaux",
  "Lombaires",
  "Corps entier",
  "Cardio",
];

export const EQUIPMENT = [
  "Barre",
  "Haltères",
  "Machine",
  "Poulie",
  "Poids du corps",
  "Kettlebell",
  "Élastique",
  "Barre EZ",
  "Smith machine",
  "Autre",
];

export const MOVEMENT_TYPES = [
  "Polyarticulaire",
  "Isolation",
  "Poussée horizontale",
  "Poussée verticale",
  "Tirage horizontal",
  "Tirage vertical",
  "Flexion de genou",
  "Charnière de hanche",
  "Gainage",
  "Haltérophilie",
  "Cardio",
];

/** Convertit une valeur numérique Supabase (number | string | null) en number | null. */
export function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Lit un champ de formulaire numérique ("" → null). Accepte la virgule décimale. */
export function parseNum(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v.trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function emptyToNull(v: string | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  const t = v.trim();
  return t === "" ? null : t;
}

const nf1 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });

export function fmtNum(v: unknown, digits: 1 | 2 = 1): string {
  const n = num(v);
  if (n === null) return "—";
  return (digits === 1 ? nf1 : nf2).format(n);
}

export function fmtKg(v: unknown): string {
  const n = num(v);
  return n === null ? "—" : `${nf2.format(n)} kg`;
}

export function fmtSignedKg(v: number | null): string {
  if (v === null) return "—";
  const rounded = Math.round(v * 10) / 10;
  if (rounded === 0) return "0 kg";
  return `${rounded > 0 ? "+" : "−"}${nf1.format(Math.abs(rounded))} kg`;
}

export function fmtSigned(v: number | null, unit: string): string {
  if (v === null) return "—";
  const rounded = Math.round(v * 10) / 10;
  if (rounded === 0) return `0 ${unit}`;
  return `${rounded > 0 ? "+" : "−"}${nf1.format(Math.abs(rounded))} ${unit}`;
}

/** Parse une date ISO "YYYY-MM-DD" sans décalage de fuseau. */
export function parseDate(d: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [y, m, day] = d.split("-").map(Number);
    return new Date(y, m - 1, day);
  }
  return new Date(d);
}

export function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  return parseDate(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function fmtDateLong(d: string | null | undefined): string {
  if (!d) return "—";
  return parseDate(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

export function fmtDateShort(d: string | null | undefined): string {
  if (!d) return "—";
  return parseDate(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

export function fmtRelative(d: string): string {
  const diff = Date.now() - new Date(d).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return "hier";
  if (days < 30) return `il y a ${days} j`;
  return fmtDate(d);
}

export function todayISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function fmtRest(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return "—";
  if (seconds < 60) return `${seconds} s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m} min ${String(s).padStart(2, "0")}` : `${m} min`;
}

/** "3 min", "90", "1:30", "90s" → secondes */
export function parseRest(v: string): number | null {
  const t = v.trim().toLowerCase();
  if (!t) return null;
  const mmss = t.match(/^(\d+)\s*[:']\s*(\d{1,2})$/);
  if (mmss) return Number(mmss[1]) * 60 + Number(mmss[2]);
  const min = t.match(/^(\d+(?:[.,]\d+)?)\s*(min|mn|m)$/);
  if (min) return Math.round(Number(min[1].replace(",", ".")) * 60);
  const sec = t.match(/^(\d+)\s*(s|sec)?$/);
  if (sec) return Number(sec[1]);
  return null;
}

export function fullName(c: { first_name: string; last_name: string } | null | undefined): string {
  if (!c) return "—";
  return `${c.first_name} ${c.last_name}`;
}

export function initials(c: { first_name: string; last_name: string }): string {
  return `${c.first_name[0] ?? ""}${c.last_name[0] ?? ""}`.toUpperCase();
}

/** Recherche insensible aux accents et à la casse. */
export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export function matches(haystack: (string | null | undefined)[], needle: string): boolean {
  const n = normalize(needle);
  if (!n) return true;
  return haystack.some((h) => h && normalize(h).includes(n));
}

/** Échappe une saisie pour un filtre PostgREST ilike. */
export function ilikeSafe(q: string): string {
  return q.replace(/[%_,()\\*]/g, " ").trim();
}

export function errorMessage(e: unknown): string {
  if (!e) return "Une erreur inconnue est survenue.";
  const msg =
    typeof e === "string"
      ? e
      : typeof e === "object" && e !== null && "message" in e
        ? String((e as { message: unknown }).message)
        : "Une erreur inconnue est survenue.";
  if (/foreign key/i.test(msg) && /program_exercises/i.test(msg))
    return "Cet exercice est utilisé dans au moins un programme. Retirez-le des programmes avant de le supprimer.";
  if (/measurements_not_empty/i.test(msg)) return "Renseignez au moins une mensuration.";
  if (/violates check constraint/i.test(msg)) return "Une valeur saisie est hors limites. Vérifiez les champs.";
  if (/JWT|not authenticated|401/i.test(msg)) return "Votre session a expiré. Reconnectez-vous.";
  if (/Failed to fetch|NetworkError/i.test(msg)) return "Connexion impossible. Vérifiez votre réseau.";
  return msg;
}
