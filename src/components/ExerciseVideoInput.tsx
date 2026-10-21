"use client";

import { useEffect, useRef, useState } from "react";
import { HardDrive, Link2, Smartphone, Trash2, Upload } from "lucide-react";
import { Button, Input } from "./ui";
import { InlineVideo } from "./ExerciseVideo";
import { cn } from "@/lib/cn";
import { getSupabase } from "@/lib/supabase/client";
import { errorMessage } from "@/lib/format";
import {
  fmtMB,
  isStoredVideo,
  makePoster,
  MAX_UPLOAD_BYTES,
  needsCompression,
  prepareVideo,
  storageUsage,
  uploadToStorage,
} from "@/lib/videoUpload";

type Phase = { step: "idle" } | { step: "ready"; file: File } | { step: "compress"; ratio: number } | { step: "upload"; ratio: number };

/**
 * Vidéo de démonstration d'un exercice : filmée / choisie sur le téléphone, ou lien YouTube.
 * `onUploaded` permet au formulaire de supprimer les envois non conservés.
 */
export function ExerciseVideoInput({
  value,
  onChange,
  title,
  onUploaded,
  onBusy,
}: {
  value: string;
  onChange: (url: string) => void;
  title: string;
  onUploaded: (url: string) => void;
  onBusy: (busy: boolean) => void;
}) {
  const [mode, setMode] = useState<"phone" | "link">(value && !isStoredVideo(value) ? "link" : "phone");
  const [phase, setPhase] = useState<Phase>({ step: "idle" });
  const [err, setErr] = useState<string | null>(null);
  const [usage, setUsage] = useState<{ bytes: number; count: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const busy = phase.step === "compress" || phase.step === "upload";

  useEffect(() => onBusy(busy), [busy, onBusy]);
  useEffect(() => {
    if (value && !isStoredVideo(value)) setMode("link");
  }, [value]);
  useEffect(() => {
    storageUsage().then(setUsage).catch(() => {});
  }, []);

  // Empêche de quitter la page pendant l'envoi
  useEffect(() => {
    if (!busy) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [busy]);

  async function process(file: File) {
    setErr(null);
    try {
      const { data } = await getSupabase().auth.getUser();
      if (!data.user) throw new Error("Session expirée : reconnecte-toi.");
      setPhase({ step: "compress", ratio: 0 });
      const poster = await makePoster(file);
      const prepared = await prepareVideo(file, (r) => setPhase({ step: "compress", ratio: r }));
      if (prepared.blob.size > MAX_UPLOAD_BYTES) throw new Error("Vidéo trop lourde (50 Mo maximum).");
      const base = `${data.user.id}/${crypto.randomUUID()}`;
      setPhase({ step: "upload", ratio: 0 });
      const url = await uploadToStorage(`${base}.${prepared.ext}`, prepared.blob, prepared.contentType, (r) => setPhase({ step: "upload", ratio: r }));
      if (poster) await uploadToStorage(`${base}.jpg`, poster, "image/jpeg").catch(() => {});
      onUploaded(url);
      onChange(url);
      setPhase({ step: "idle" });
      storageUsage().then(setUsage).catch(() => {});
    } catch (e) {
      setErr(errorMessage(e));
      setPhase({ step: "idle" });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function onFile(file: File | undefined) {
    if (!file) return;
    setErr(null);
    if (needsCompression(file)) setPhase({ step: "ready", file });
    else process(file);
  }

  const stored = isStoredVideo(value);

  return (
    <div className="space-y-3">
      <div className="inline-flex rounded-lg border border-ink-700 bg-ink-900 p-0.5 text-xs font-medium">
        {(
          [
            ["phone", "Mon téléphone", Smartphone],
            ["link", "Lien YouTube", Link2],
          ] as const
        ).map(([k, label, Icon]) => (
          <button
            key={k}
            type="button"
            disabled={busy}
            onClick={() => setMode(k)}
            className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 transition", mode === k ? "bg-royal-600 text-white" : "text-ink-400 hover:text-ink-100")}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>

      {mode === "link" ? (
        <Input
          type="url"
          value={stored ? "" : value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=…"
          aria-label="Lien vidéo"
        />
      ) : (
        <>
          <input
            ref={fileRef}
            type="file"
            accept="video/*"
            className="hidden"
            aria-label="Choisir une vidéo"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          {phase.step === "compress" || phase.step === "upload" ? (
            <div className="rounded-xl border border-royal-600/40 bg-royal-600/10 p-4">
              <p className="text-sm font-medium text-white">
                {phase.step === "compress" ? "Optimisation de la vidéo…" : "Envoi de la vidéo…"} {Math.round(phase.ratio * 100)} %
              </p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink-700">
                <div className="h-full rounded-full bg-royal-500 transition-[width] duration-300" style={{ width: `${Math.round(phase.ratio * 100)}%` }} />
              </div>
              <p className="mt-2 text-xs text-ink-400">Garde l&apos;écran allumé et cette page ouverte jusqu&apos;à la fin.</p>
            </div>
          ) : phase.step === "ready" ? (
            <div className="rounded-xl border border-ink-700 bg-ink-900 p-4">
              <p className="text-sm text-ink-200">
                <strong className="text-white">{phase.file.name}</strong> · {fmtMB(phase.file.size)}
              </p>
              <p className="mt-1 text-xs text-ink-400">
                La vidéo va être optimisée pour se lire sur tous les téléphones et prendre moins de place. Ça prend à peu près la durée de la vidéo.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => process(phase.file)}>
                  <Upload className="h-4 w-4" /> Optimiser et envoyer
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setPhase({ step: "idle" })}>
                  Annuler
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-ink-600 px-4 py-4 text-sm font-medium text-royal-300 transition hover:border-royal-500 hover:bg-royal-600/5"
            >
              <Smartphone className="h-4 w-4" /> {value ? "Remplacer par une vidéo du téléphone" : "Filmer ou choisir une vidéo"}
            </button>
          )}
        </>
      )}

      {err && <p className="text-sm text-red-300">{err}</p>}

      {value && !busy && (mode === "phone" ? stored : !stored) && /^https?:\/\//i.test(value) && (
        <div className="space-y-2">
          <InlineVideo url={value} title={title || "Vidéo"} />
          <Button size="sm" variant="ghost" className="text-red-300 hover:bg-red-500/10" onClick={() => onChange("")}>
            <Trash2 className="h-4 w-4" /> Retirer la vidéo
          </Button>
        </div>
      )}

      {mode === "phone" && usage && (
        <p className="flex items-center gap-1.5 text-[11px] text-ink-500">
          <HardDrive className="h-3.5 w-3.5" />
          Espace vidéo : {fmtMB(usage.bytes)} utilisés sur 1 Go ({usage.count} vidéo{usage.count > 1 ? "s" : ""}). Conseil : des vidéos courtes (30 s à 1 min).
        </p>
      )}
    </div>
  );
}
