"use client";

/** Inscriptions mémorisées sur ce téléphone (simple confort : la page fonctionne sans). */
export const MY_KEY = "vt-ct-inscriptions";

export interface SavedReg {
  token: string;
  label: string;
  starts_at: string;
}

export function loadSaved(): SavedReg[] {
  try {
    const v = JSON.parse(localStorage.getItem(MY_KEY) || "[]");
    return Array.isArray(v) ? v.filter((x) => x && typeof x.token === "string") : [];
  } catch {
    return [];
  }
}

export function saveReg(r: SavedReg) {
  try {
    const list = loadSaved().filter((x) => x.token !== r.token);
    list.unshift(r);
    localStorage.setItem(MY_KEY, JSON.stringify(list.slice(0, 20)));
  } catch {
    /* stockage indisponible : sans conséquence */
  }
}
