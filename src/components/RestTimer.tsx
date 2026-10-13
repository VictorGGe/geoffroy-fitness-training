"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Minus, Pause, Play, Plus, Timer, X } from "lucide-react";
import { cn } from "@/lib/cn";

/* ------------------------------------------------------------------ */
/* Son et vibration                                                    */
/* ------------------------------------------------------------------ */

let audioCtx: AudioContext | null = null;

/** À appeler lors d'un clic : les navigateurs mobiles n'autorisent le son qu'après un geste. */
export function unlockAudio() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    if (!audioCtx) audioCtx = new Ctx();
    if (audioCtx.state === "suspended") void audioCtx.resume();
    // Son silencieux pour « débloquer » l'audio sur iOS
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    g.gain.value = 0;
    o.connect(g).connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + 0.01);
  } catch {
    /* son indisponible : la vibration et l'affichage suffisent */
  }
}

function beep(times = 3) {
  try {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    for (let i = 0; i < times; i++) {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = "sine";
      o.frequency.value = i === times - 1 ? 1320 : 880;
      const t0 = now + i * 0.32;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.35, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.24);
      o.connect(g).connect(audioCtx.destination);
      o.start(t0);
      o.stop(t0 + 0.26);
    }
  } catch {
    /* ignore */
  }
}

function vibrate(pattern: number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ */
/* Chronomètre                                                         */
/* ------------------------------------------------------------------ */

export interface RestRequest {
  /** Identifiant unique : un nouvel id relance le chrono */
  id: string;
  label: string;
  seconds: number;
}

const fmt = (s: number) => {
  const a = Math.abs(s);
  return `${s < 0 ? "+" : ""}${Math.floor(a / 60)}:${String(a % 60).padStart(2, "0")}`;
};

/**
 * Compte à rebours de repos. Basé sur l'heure réelle : il reste juste même si
 * l'écran se met en veille ou si l'onglet passe en arrière-plan.
 */
export function RestTimer({
  request,
  onDone,
  onClose,
}: {
  request: RestRequest | null;
  /** Appelé avec la durée de repos réellement écoulée (en secondes) */
  onDone: (elapsedSeconds: number) => void;
  onClose: () => void;
}) {
  const [total, setTotal] = useState(0);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [pausedLeft, setPausedLeft] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const startedAt = useRef(0);
  const pausedMs = useRef(0);
  const pauseStart = useRef<number | null>(null);
  const alerted = useRef(false);
  const wakeLock = useRef<{ release: () => Promise<void> } | null>(null);
  const baseTitle = useRef<string>("");

  // Nouveau départ
  useEffect(() => {
    if (!request) return;
    const t = Date.now();
    startedAt.current = t;
    pausedMs.current = 0;
    pauseStart.current = null;
    alerted.current = false;
    setTotal(request.seconds);
    setEndsAt(t + request.seconds * 1000);
    setPausedLeft(null);
    setNow(t);
    vibrate([40]);
  }, [request?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const running = !!request && pausedLeft === null && endsAt !== null;
  const remaining = request ? (pausedLeft !== null ? pausedLeft : Math.ceil(((endsAt ?? now) - now) / 1000)) : 0;

  // Tic
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [running]);

  // Fin du repos : son + vibration (une seule fois)
  useEffect(() => {
    if (running && remaining <= 0 && !alerted.current) {
      alerted.current = true;
      beep(3);
      vibrate([300, 150, 300, 150, 500]);
    }
  }, [running, remaining]);

  // Écran allumé pendant le repos + compte à rebours dans le titre de l'onglet
  useEffect(() => {
    if (!request) return;
    baseTitle.current = baseTitle.current || document.title;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock
      ?.request("screen")
      .then((l) => (wakeLock.current = l))
      .catch(() => {});
    return () => {
      wakeLock.current?.release().catch(() => {});
      wakeLock.current = null;
      if (baseTitle.current) document.title = baseTitle.current;
    };
  }, [request?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (request) document.title = `${remaining > 0 ? "⏱" : "🔔"} ${fmt(remaining)} · Repos`;
  }, [request, remaining]);

  if (!request) return null;

  const done = remaining <= 0;
  const progress = total > 0 ? Math.min(1, Math.max(0, 1 - remaining / total)) : 1;

  function adjust(delta: number) {
    if (pausedLeft !== null) setPausedLeft((p) => (p ?? 0) + delta);
    else setEndsAt((e) => (e ?? Date.now()) + delta * 1000);
    setTotal((t) => Math.max(1, t + delta));
    if (remaining + delta > 0) alerted.current = false;
  }

  function togglePause() {
    if (pausedLeft !== null) {
      if (pauseStart.current) pausedMs.current += Date.now() - pauseStart.current;
      pauseStart.current = null;
      setEndsAt(Date.now() + pausedLeft * 1000);
      setPausedLeft(null);
      setNow(Date.now());
    } else {
      pauseStart.current = Date.now();
      setPausedLeft(remaining);
    }
  }

  function finish() {
    const pausedNow = pauseStart.current ? Date.now() - pauseStart.current : 0;
    const elapsed = Math.max(0, Math.round((Date.now() - startedAt.current - pausedMs.current - pausedNow) / 1000));
    onDone(elapsed);
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border p-3 shadow-2xl backdrop-blur animate-slide-up",
        done ? "border-emerald-500/50 bg-emerald-950/90" : "border-royal-500/50 bg-ink-900/95",
      )}
      role="timer"
      aria-live="polite"
    >
      <div
        className={cn("absolute inset-y-0 left-0 transition-[width] duration-300 ease-linear", done ? "bg-emerald-500/15" : "bg-royal-600/20")}
        style={{ width: `${progress * 100}%` }}
      />
      <div className="relative flex items-center gap-3">
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", done ? "bg-emerald-500 text-white" : "bg-royal-600 text-white")}>
          <Timer className={cn("h-5 w-5", running && !done && "animate-pulse")} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11.5px] uppercase tracking-wider text-ink-400">{done ? "Repos terminé — c'est reparti !" : request.label}</p>
          <p className={cn("font-display text-[34px] font-semibold leading-none tabular-nums", done ? "text-emerald-300" : "text-white")}>
            {fmt(remaining)}
            {pausedLeft !== null && <span className="ml-2 align-middle text-xs font-normal text-amber-300">en pause</span>}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => adjust(-15)} className="hidden h-10 w-10 items-center justify-center rounded-xl text-ink-300 hover:bg-ink-750 sm:flex" aria-label="Retirer 15 secondes">
            <Minus className="h-4 w-4" />
          </button>
          <button onClick={() => adjust(15)} className="flex h-10 items-center justify-center gap-0.5 rounded-xl px-2 text-xs font-semibold text-ink-200 hover:bg-ink-750" aria-label="Ajouter 15 secondes">
            <Plus className="h-3.5 w-3.5" />
            15s
          </button>
          {!done && (
            <button onClick={togglePause} className="flex h-10 w-10 items-center justify-center rounded-xl text-ink-200 hover:bg-ink-750" aria-label={pausedLeft !== null ? "Reprendre" : "Pause"}>
              {pausedLeft !== null ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </button>
          )}
          <button
            onClick={finish}
            className={cn("flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-white", done ? "bg-emerald-600 hover:bg-emerald-500" : "bg-royal-600 hover:bg-royal-500")}
            aria-label="Terminer le repos"
          >
            <Check className="h-4 w-4" />
            <span className="hidden sm:inline">Terminé</span>
          </button>
          <button onClick={onClose} className="flex h-10 w-8 items-center justify-center rounded-xl text-ink-500 hover:text-ink-200" aria-label="Fermer le chrono">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

/** Choix rapide d'une durée quand aucun repos n'est prévu. */
export const REST_PRESETS = [60, 90, 120, 180, 240];
