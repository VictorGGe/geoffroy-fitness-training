"use client";

/**
 * Course à pied : chrono, distance GPS, allure, calories.
 * Fonctionne dans le navigateur du téléphone, écran allumé et application ouverte
 * (les navigateurs coupent le GPS quand la page passe en arrière-plan).
 */
import { useCallback, useEffect, useRef, useState } from "react";

export type RunMode = "gps" | "tapis";
export type RunStatus = "idle" | "running" | "paused" | "finished";
export type Pt = [lat: number, lng: number, t: number];

export interface Split {
  km: number;
  s: number; // durée de ce kilomètre (secondes)
}

export interface RunData {
  status: RunStatus;
  mode: RunMode;
  startedAt: number | null; // epoch ms
  elapsedMs: number; // cumul des segments terminés
  segmentStart: number | null; // epoch ms du segment en cours
  distanceM: number;
  route: Pt[][]; // un tableau par segment (coupé à chaque pause)
  splits: Split[];
  recent: { t: number; d: number }[]; // pour l'allure instantanée
}

const EMPTY: RunData = {
  status: "idle",
  mode: "gps",
  startedAt: null,
  elapsedMs: 0,
  segmentStart: null,
  distanceM: 0,
  route: [],
  splits: [],
  recent: [],
};

const STORAGE_KEY = "vt:run-in-progress";
const MAX_ACCURACY_M = 35; // au-delà, le point GPS est trop imprécis
const MAX_SPEED_MS = 8.5; // ~30 km/h : au-delà, c'est un saut GPS
const ROUTE_STEP_M = 8;

/* ------------------------------ Calculs ------------------------------ */

export function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function fmtClock(totalS: number): string {
  const s = Math.max(0, Math.floor(totalS));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/** Allure en min:s par km (ex. 5:32). */
export function fmtPace(sPerKm: number | null | undefined): string {
  if (!sPerKm || !Number.isFinite(sPerKm) || sPerKm <= 0 || sPerKm > 3600) return "--:--";
  const r = Math.round(sPerKm);
  return `${Math.floor(r / 60)}:${String(r % 60).padStart(2, "0")}`;
}

export function fmtKm(m: number, digits = 2): string {
  return (m / 1000).toFixed(digits).replace(".", ",");
}

export function speedKmh(distanceM: number, seconds: number): number {
  return seconds > 0 ? distanceM / 1000 / (seconds / 3600) : 0;
}

/**
 * Calories estimées.
 *  • Course : ~1 kcal par kg et par km (environ 1,036 selon les études).
 *  • Marche (< 7 km/h) : ~0,55 kcal par kg et par km.
 *  • Sans distance : estimation au temps (MET 8 en course, 3,5 en marche).
 */
export function estimateCalories(distanceM: number, seconds: number, weightKg: number | null): number | null {
  if (!weightKg || weightKg < 20 || seconds <= 0) return null;
  const km = distanceM / 1000;
  const v = speedKmh(distanceM, seconds);
  if (km >= 0.05) return Math.round(weightKg * km * (v >= 7 ? 1.036 : 0.55));
  return Math.round((v >= 7 || km === 0 ? 8 : 3.5) * weightKg * (seconds / 3600));
}

export function activityOf(distanceM: number, seconds: number): "course" | "marche" {
  return distanceM > 50 && speedKmh(distanceM, seconds) < 7 ? "marche" : "course";
}

function elapsedOf(d: RunData, now = Date.now()): number {
  return (d.elapsedMs + (d.status === "running" && d.segmentStart ? now - d.segmentStart : 0)) / 1000;
}

function lastPoint(d: RunData): Pt | null {
  const seg = d.route[d.route.length - 1];
  return seg && seg.length ? seg[seg.length - 1] : null;
}

/* ------------------------------ Annonces ------------------------------ */

export function speak(text: string) {
  try {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "fr-FR";
    u.rate = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch {
    /* pas de synthèse vocale */
  }
}

function paceWords(sPerKm: number): string {
  const r = Math.round(sPerKm);
  const m = Math.floor(r / 60);
  const s = r % 60;
  return `${m} minute${m > 1 ? "s" : ""}${s ? ` ${s}` : ""}`;
}

/* ------------------------------ Hook ------------------------------ */

export interface GpsSignal {
  accuracy: number | null;
  error: string | null;
  lastAt: number | null;
}

export function useRunTracker(opts: { voice: boolean }) {
  const [data, setData] = useState<RunData>(EMPTY);
  const [signal, setSignal] = useState<GpsSignal>({ accuracy: null, error: null, lastAt: null });
  const [, setTick] = useState(0);
  const ref = useRef<RunData>(EMPTY);
  const anchor = useRef<{ lat: number; lng: number; t: number } | null>(null);
  const watchId = useRef<number | null>(null);
  const wake = useRef<{ release: () => Promise<void> } | null>(null);
  const voice = useRef(opts.voice);
  voice.current = opts.voice;

  const commit = useCallback((next: RunData) => {
    ref.current = next;
    setData(next);
    try {
      if (next.status === "running" || next.status === "paused") localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* stockage indisponible */
    }
  }, []);

  // Reprise d'une course interrompue (page rechargée, téléphone verrouillé…)
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as RunData;
      if (saved.status === "running" || saved.status === "paused") {
        commit({ ...saved, route: saved.route.length ? [...saved.route, []] : [] });
        setRestored(true);
      }
    } catch {
      /* ignoré */
    }
  }, [commit]);

  // Chrono : rafraîchit l'affichage chaque seconde
  useEffect(() => {
    if (data.status !== "running") return;
    const i = setInterval(() => setTick((n) => n + 1), 500);
    return () => clearInterval(i);
  }, [data.status]);

  // Garder l'écran allumé pendant la course
  const lockScreen = useCallback(async () => {
    try {
      const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
      if (nav.wakeLock && !wake.current) wake.current = await nav.wakeLock.request("screen");
    } catch {
      /* non supporté */
    }
  }, []);
  const unlockScreen = useCallback(() => {
    wake.current?.release().catch(() => {});
    wake.current = null;
  }, []);
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible" && ref.current.status === "running") {
        wake.current = null;
        lockScreen();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [lockScreen]);

  const onPosition = useCallback(
    (p: GeolocationPosition) => {
      const { latitude: lat, longitude: lng, accuracy } = p.coords;
      const t = p.timestamp || Date.now();
      setSignal({ accuracy: Math.round(accuracy), error: null, lastAt: Date.now() });
      const d = ref.current;
      if (d.status !== "running" || d.mode !== "gps" || accuracy > MAX_ACCURACY_M) return;

      const elapsed = elapsedOf(d);
      const fix = { lat, lng, t };
      if (!anchor.current) {
        anchor.current = fix;
        const route = d.route.length ? d.route.map((s) => s) : [[]];
        route[route.length - 1] = [...route[route.length - 1], [round5(lat), round5(lng), Math.round(elapsed)]];
        commit({ ...d, route });
        return;
      }
      const dist = haversine(anchor.current, fix);
      const dt = (t - anchor.current.t) / 1000;
      if (dt <= 0) return;
      if (dist / dt > MAX_SPEED_MS) {
        // Saut GPS : on l'ignore, sauf si le signal est revenu après une longue coupure
        if (dt > 30) anchor.current = fix;
        return;
      }
      if (dist < Math.max(3, accuracy * 0.5)) return; // bruit sur place

      anchor.current = fix;
      const distanceM = d.distanceM + dist;
      const route = d.route.length ? d.route.slice() : [[]];
      const seg = route[route.length - 1].slice();
      const lp = seg[seg.length - 1] ?? lastPoint(d);
      if (!lp || haversine({ lat: lp[0], lng: lp[1] }, fix) >= ROUTE_STEP_M) seg.push([round5(lat), round5(lng), Math.round(elapsed)]);
      route[route.length - 1] = seg;

      const recent = [...d.recent.filter((r) => r.t >= elapsed - 60), { t: elapsed, d: distanceM }];
      const splits = d.splits.slice();
      while (distanceM >= (splits.length + 1) * 1000) {
        const before = splits.reduce((n, s) => n + s.s, 0);
        const sp = { km: splits.length + 1, s: Math.round(elapsed - before) };
        splits.push(sp);
        try {
          navigator.vibrate?.([200, 100, 200]);
        } catch {
          /* ignoré */
        }
        if (voice.current) speak(`${sp.km} kilomètre${sp.km > 1 ? "s" : ""}. Temps : ${paceWords(elapsed)}. Dernier kilomètre en ${paceWords(sp.s)}.`);
      }
      commit({ ...d, distanceM, route, recent, splits });
    },
    [commit],
  );

  const onError = useCallback((e: GeolocationPositionError) => {
    setSignal((s) => ({
      ...s,
      error:
        e.code === e.PERMISSION_DENIED
          ? "Localisation refusée. Autorise-la pour ce site dans les réglages du navigateur, ou utilise le mode Tapis."
          : e.code === e.POSITION_UNAVAILABLE
            ? "Signal GPS introuvable. Va à l'extérieur, loin des bâtiments."
            : "Le GPS met du temps à répondre…",
    }));
  }, []);

  const startGps = useCallback(() => {
    if (watchId.current !== null || typeof navigator === "undefined" || !navigator.geolocation) {
      if (typeof navigator !== "undefined" && !navigator.geolocation) setSignal((s) => ({ ...s, error: "Ce téléphone ne donne pas accès au GPS. Utilise le mode Tapis." }));
      return;
    }
    watchId.current = navigator.geolocation.watchPosition(onPosition, onError, { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 });
  }, [onPosition, onError]);

  const stopGps = useCallback(() => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
  }, []);

  useEffect(() => () => {
    stopGps();
    unlockScreen();
  }, [stopGps, unlockScreen]);

  // Course restaurée en mode GPS : relancer le suivi
  useEffect(() => {
    if (restored && ref.current.mode === "gps") startGps();
  }, [restored, startGps]);

  const start = useCallback(
    (mode: RunMode) => {
      const now = Date.now();
      anchor.current = null;
      commit({ ...EMPTY, status: "running", mode, startedAt: now, segmentStart: now, route: mode === "gps" ? [[]] : [] });
      if (mode === "gps") startGps();
      lockScreen();
      if (voice.current) speak("C'est parti !");
    },
    [commit, startGps, lockScreen],
  );

  const pause = useCallback(() => {
    const d = ref.current;
    if (d.status !== "running") return;
    const now = Date.now();
    anchor.current = null;
    commit({ ...d, status: "paused", elapsedMs: d.elapsedMs + (d.segmentStart ? now - d.segmentStart : 0), segmentStart: null });
    if (voice.current) speak("Pause");
  }, [commit]);

  const resume = useCallback(() => {
    const d = ref.current;
    if (d.status !== "paused") return;
    anchor.current = null;
    commit({ ...d, status: "running", segmentStart: Date.now(), route: d.mode === "gps" ? [...d.route, []] : d.route });
    if (d.mode === "gps") startGps();
    lockScreen();
    if (voice.current) speak("C'est reparti");
  }, [commit, startGps, lockScreen]);

  const finish = useCallback(() => {
    const d = ref.current;
    const now = Date.now();
    const elapsedMs = d.elapsedMs + (d.status === "running" && d.segmentStart ? now - d.segmentStart : 0);
    stopGps();
    unlockScreen();
    const next: RunData = { ...d, status: "finished", elapsedMs, segmentStart: null, route: d.route.filter((s) => s.length) };
    ref.current = next;
    setData(next);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignoré */
    }
    if (voice.current) speak(`Bravo ! ${fmtKm(d.distanceM)} kilomètres en ${paceWords(elapsedMs / 1000)}.`);
  }, [stopGps, unlockScreen]);

  const reset = useCallback(() => {
    stopGps();
    unlockScreen();
    anchor.current = null;
    commit(EMPTY);
    setRestored(false);
  }, [commit, stopGps, unlockScreen]);

  const setDistance = useCallback(
    (m: number) => {
      const d = ref.current;
      commit({ ...d, distanceM: Math.max(0, Math.round(m)) });
    },
    [commit],
  );

  // Allure instantanée : sur les 30 dernières secondes (au moins 20 m parcourus)
  const elapsed = elapsedOf(data);
  let currentPace: number | null = null;
  if (data.status === "running" && data.recent.length >= 2) {
    const last = data.recent[data.recent.length - 1];
    const from = data.recent.find((r) => r.t >= last.t - 30) ?? data.recent[0];
    const dd = last.d - from.d;
    const dtt = last.t - from.t;
    if (dd >= 20 && dtt > 0 && elapsed - last.t < 20) currentPace = dtt / (dd / 1000);
  }
  const avgPace = data.distanceM >= 50 ? elapsed / (data.distanceM / 1000) : null;

  return { data, signal, elapsed, currentPace, avgPace, restored, start, pause, resume, finish, reset, setDistance, startGps, stopGps };
}

function round5(x: number) {
  return Math.round(x * 1e5) / 1e5;
}
