/** Schémas de séries / répétitions prêts à l'emploi pour remplir un programme en un clic. */
export interface Scheme {
  key: string;
  sets: number;
  reps: string;
  rest: number;
  hint: string;
}

export const SCHEMES: Scheme[] = [
  { key: "5x5", sets: 5, reps: "5", rest: 180, hint: "Force" },
  { key: "4x6-8", sets: 4, reps: "6-8", rest: 150, hint: "Force / volume" },
  { key: "4x8-10", sets: 4, reps: "8-10", rest: 90, hint: "Prise de muscle" },
  { key: "3x10-12", sets: 3, reps: "10-12", rest: 75, hint: "Prise de muscle" },
  { key: "3x12-15", sets: 3, reps: "12-15", rest: 60, hint: "Endurance musculaire" },
  { key: "3x15-20", sets: 3, reps: "15-20", rest: 45, hint: "Finition / circuit" },
];

export function restShort(s: number): string {
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m} min ${String(r).padStart(2, "0")}` : `${m} min`;
}

export function schemeLabel(s: Scheme): string {
  return `${s.sets} × ${s.reps}`;
}

const STORAGE_KEY = "vt:last-scheme";

export function getLastScheme(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "4x8-10";
  } catch {
    return "4x8-10";
  }
}

export function setLastScheme(key: string) {
  try {
    localStorage.setItem(STORAGE_KEY, key);
  } catch {
    /* stockage indisponible : sans importance */
  }
}

export function schemePatch(s: Scheme) {
  return { sets: s.sets, reps: s.reps, rest_seconds: s.rest };
}
