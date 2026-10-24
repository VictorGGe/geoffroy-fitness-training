"use client";

/**
 * Podomètre dans le navigateur : détecte les pas grâce à l'accéléromètre du téléphone.
 * Il compte tant que la page est ouverte et l'écran allumé (un site web ne peut pas
 * compter en arrière-plan ; le total de la journée se recopie depuis l'appli Santé / Google Fit).
 */
import { useCallback, useEffect, useRef, useState } from "react";

export type PedoStatus = "idle" | "counting" | "denied" | "unsupported";

interface Detector {
  gravity: number | null;
  smooth: number[];
  armed: boolean;
  lastStep: number;
  peaks: number[];
}

const MIN_INTERVAL_MS = 280; // > 3,5 pas/s : impossible en marchant ou en courant
const LOW = 0.35; // re-armement (m/s²)

/** Analyse un échantillon d'accélération ; renvoie true si un pas vient d'être détecté. */
export function detectStep(d: Detector, x: number, y: number, z: number, now: number): boolean {
  const mag = Math.sqrt(x * x + y * y + z * z);
  d.gravity = d.gravity === null ? mag : d.gravity * 0.92 + mag * 0.08; // composante lente (gravité)
  const dyn = mag - d.gravity;
  d.smooth.push(dyn);
  if (d.smooth.length > 4) d.smooth.shift();
  const v = d.smooth.reduce((a, b) => a + b, 0) / d.smooth.length;
  // Seuil adaptatif : moitié de l'amplitude moyenne des derniers pas, au moins 1 m/s²
  const avgPeak = d.peaks.length ? d.peaks.reduce((a, b) => a + b, 0) / d.peaks.length : 2;
  const high = Math.max(1.0, avgPeak * 0.5);
  if (v < LOW) d.armed = true;
  if (d.armed && v > high && now - d.lastStep > MIN_INTERVAL_MS) {
    d.armed = false;
    d.lastStep = now;
    d.peaks.push(v);
    if (d.peaks.length > 8) d.peaks.shift();
    return true;
  }
  return false;
}

export function newDetector(): Detector {
  return { gravity: null, smooth: [], armed: false, lastStep: 0, peaks: [] };
}

export function usePedometer() {
  const [status, setStatus] = useState<PedoStatus>("idle");
  const [steps, setSteps] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const det = useRef<Detector>(newDetector());
  const handler = useRef<((e: DeviceMotionEvent) => void) | null>(null);
  const wake = useRef<{ release: () => Promise<void> } | null>(null);

  const stopListening = useCallback(() => {
    if (handler.current) window.removeEventListener("devicemotion", handler.current);
    handler.current = null;
    wake.current?.release().catch(() => {});
    wake.current = null;
  }, []);

  useEffect(() => stopListening, [stopListening]);

  /** À appeler directement depuis un toucher (l'iPhone demande l'autorisation à ce moment-là). */
  const start = useCallback(async () => {
    if (typeof window === "undefined" || !("DeviceMotionEvent" in window)) {
      setStatus("unsupported");
      return;
    }
    const DME = window.DeviceMotionEvent as unknown as { requestPermission?: () => Promise<"granted" | "denied"> };
    if (typeof DME.requestPermission === "function") {
      try {
        if ((await DME.requestPermission()) !== "granted") {
          setStatus("denied");
          return;
        }
      } catch {
        setStatus("denied");
        return;
      }
    }
    det.current = newDetector();
    setSteps(0);
    setStartedAt(Date.now());
    let received = false;
    const h = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity;
      if (!a || a.x == null || a.y == null || a.z == null) return;
      received = true;
      if (detectStep(det.current, a.x, a.y, a.z, e.timeStamp || performance.now())) setSteps((n) => n + 1);
    };
    handler.current = h;
    window.addEventListener("devicemotion", h);
    setStatus("counting");
    try {
      const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
      if (nav.wakeLock) wake.current = await nav.wakeLock.request("screen");
    } catch {
      /* non supporté */
    }
    // Aucun capteur (ordinateur) : on prévient au bout de 3 s
    setTimeout(() => {
      if (!received && handler.current === h) {
        stopListening();
        setStatus("unsupported");
      }
    }, 3000);
  }, [stopListening]);

  const stop = useCallback(() => {
    stopListening();
    setStatus("idle");
  }, [stopListening]);

  const reset = useCallback(() => {
    setSteps(0);
    setStartedAt(null);
  }, []);

  return { status, steps, startedAt, start, stop, reset };
}
