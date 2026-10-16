"use client";

import { useEffect, useRef, useState } from "react";
import { CameraOff, ScanLine } from "lucide-react";
import { Button, Input } from "./ui";

/** Lecture d'un code-barres avec la caméra du téléphone (ou saisie du code à la main). */
export function BarcodeScanner({ onDetected }: { onDetected: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<"starting" | "scanning" | "error">("starting");
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const done = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let stop: (() => void) | null = null;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("error");
        setError("Ce navigateur ne permet pas d'utiliser la caméra. Tape le code-barres à la main ci-dessous.");
        return;
      }
      try {
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
          import("@zxing/browser"),
          import("@zxing/library"),
        ]);
        if (cancelled || !videoRef.current) return;
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E]);
        const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 120 });
        const controls = await reader.decodeFromConstraints(
          { audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } },
          videoRef.current,
          (result) => {
            if (!result || done.current) return;
            done.current = true;
            if (navigator.vibrate) navigator.vibrate(80);
            controls.stop();
            onDetected(result.getText());
          },
        );
        if (cancelled) {
          controls.stop();
          return;
        }
        stop = () => controls.stop();
        setStatus("scanning");
      } catch (e) {
        if (cancelled) return;
        const name = e instanceof DOMException ? e.name : "";
        setStatus("error");
        setError(
          name === "NotAllowedError"
            ? "L'accès à la caméra a été refusé. Autorise-le dans les réglages du navigateur, ou tape le code-barres à la main."
            : name === "NotFoundError"
              ? "Aucune caméra trouvée sur cet appareil. Tape le code-barres à la main."
              : "Impossible de démarrer la caméra. Tape le code-barres à la main.",
        );
      }
    }
    start();
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [onDetected]);

  return (
    <div className="space-y-4">
      {status !== "error" ? (
        <div className="relative mx-auto aspect-[4/3] w-full max-w-md overflow-hidden rounded-2xl border border-ink-700 bg-black">
          <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="relative h-[38%] w-[78%] rounded-xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]">
              <span className="absolute inset-x-3 top-1/2 h-0.5 -translate-y-1/2 animate-pulse bg-royal-400" />
            </div>
          </div>
          <p className="absolute inset-x-0 bottom-3 text-center text-xs font-medium text-white/90">
            {status === "starting" ? "Démarrage de la caméra…" : "Place le code-barres dans le cadre"}
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-ink-700 bg-ink-900 p-6 text-center">
          <CameraOff className="h-6 w-6 text-ink-400" />
          <p className="text-sm text-ink-300">{error}</p>
        </div>
      )}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const code = manual.replace(/\D/g, "");
          if (code.length >= 6) onDetected(code);
        }}
      >
        <Input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          inputMode="numeric"
          placeholder="Ou tape le code-barres (ex. 3017620422003)"
          aria-label="Code-barres"
        />
        <Button type="submit" variant="secondary" disabled={manual.replace(/\D/g, "").length < 6}>
          <ScanLine className="h-4 w-4" /> OK
        </Button>
      </form>
    </div>
  );
}
