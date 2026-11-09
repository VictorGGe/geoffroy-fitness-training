"use client";

import { useEffect, useRef, useState } from "react";
import { FileAudio, Mic, RotateCcw, Square, Trash2, Video } from "lucide-react";
import { Button } from "./ui";
import { useVoiceSync } from "./ExerciseVideo";
import { cn } from "@/lib/cn";
import { errorMessage } from "@/lib/format";
import { parseVideo } from "@/lib/video";
import { canRecord, fmtClock, MAX_VOICE_SECONDS, openMic, recorderMime, uploadVoice } from "@/lib/voiceRecord";

type Phase = "idle" | "recording" | "review" | "uploading";

/**
 * Explication audio d'un exercice : enregistrer sa voix en regardant la vidéo (synchronisé),
 * au micro simplement, ou importer un fichier audio du téléphone.
 */
export function ExerciseAudioInput({
  value,
  onChange,
  videoUrl,
  title,
  onUploaded,
  onBusy,
}: {
  value: string;
  onChange: (url: string) => void;
  videoUrl: string;
  title: string;
  onUploaded: (url: string) => void;
  onBusy: (busy: boolean) => void;
}) {
  const info = parseVideo(videoUrl);
  const fileVideo = info?.kind === "file" ? info : null;
  const [phase, setPhase] = useState<Phase>("idle");
  const [withVideo, setWithVideo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [take, setTake] = useState<{ blob: Blob; url: string } | null>(null);
  const [progress, setProgress] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<number | null>(null);

  useEffect(() => onBusy(phase === "recording" || phase === "uploading"), [phase, onBusy]);
  useEffect(() => () => cleanup(), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => {
    if (take) URL.revokeObjectURL(take.url);
  }, [take]);

  // La vidéo démarre en même temps que l'enregistrement : la voix sera calée dessus
  useEffect(() => {
    if (phase !== "recording" || !withVideo) return;
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    v.currentTime = 0;
    v.play().catch(() => setError("La vidéo n'a pas pu démarrer : touche-la pour la lancer, puis recommence l'enregistrement pour que la voix soit bien calée."));
  }, [phase, withVideo]);

  // Relecture de la prise sur la vidéo (son de la vidéo coupé)
  useVoiceSync(videoRef, phase === "review" && withVideo ? take?.url : null);

  function cleanup() {
    if (timer.current) window.clearInterval(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }

  async function start(overVideo: boolean) {
    setError(null);
    setTake(null);
    setWithVideo(overVideo);
    try {
      const s = await openMic();
      stream.current = s;
      const mime = recorderMime();
      const r = new MediaRecorder(s, mime ? { mimeType: mime } : undefined);
      chunks.current = [];
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.onstop = () => {
        cleanup();
        const blob = new Blob(chunks.current, { type: r.mimeType || mime || "audio/webm" });
        if (blob.size < 1000) {
          setPhase("idle");
          return setError("Enregistrement vide : vérifie le micro et réessaie.");
        }
        setTake({ blob, url: URL.createObjectURL(blob) });
        setPhase("review");
      };
      rec.current = r;
      const t0 = Date.now();
      setElapsed(0);
      timer.current = window.setInterval(() => {
        const sec = (Date.now() - t0) / 1000;
        setElapsed(sec);
        if (sec >= MAX_VOICE_SECONDS) stop();
      }, 250);
      r.start(1000);
      setPhase("recording");
    } catch (e) {
      cleanup();
      setPhase("idle");
      setError(errorMessage(e));
    }
  }

  function stop() {
    videoRef.current?.pause();
    if (rec.current && rec.current.state !== "inactive") rec.current.stop();
  }

  async function upload(blob: Blob, name?: string) {
    setError(null);
    setPhase("uploading");
    setProgress(0);
    try {
      const url = await uploadVoice(blob, setProgress, name);
      onUploaded(url);
      onChange(url);
      setTake(null);
      setPhase("idle");
    } catch (e) {
      setError(errorMessage(e));
      setPhase(take ? "review" : "idle");
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) await upload(f, f.name);
  }

  const showVideo = !!fileVideo && withVideo && (phase === "recording" || phase === "review");

  return (
    <div className="space-y-3">
      <input ref={fileRef} type="file" accept="audio/*,.m4a,.mp3,.aac,.wav" className="hidden" onChange={onFile} />

      {showVideo && fileVideo && (
        <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-ink-700 bg-black">
          <video
            ref={videoRef}
            src={fileVideo.src}
            poster={fileVideo.thumb ?? undefined}
            muted
            playsInline
            controls={phase === "review"}
            preload="auto"
            onEnded={() => phase === "recording" && stop()}
            onClick={(e) => phase === "recording" && e.currentTarget.paused && e.currentTarget.play().catch(() => {})}
            className="absolute inset-0 h-full w-full object-contain"
            aria-label={title}
          />
          {phase === "recording" && (
            <span className="absolute left-2 top-2 inline-flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-1 text-xs font-semibold text-white">
              <span className="h-2 w-2 animate-pulse rounded-full bg-white" /> REC {fmtClock(elapsed)}
            </span>
          )}
        </div>
      )}

      {phase === "recording" ? (
        <div className="flex items-center gap-3 rounded-xl border border-red-500/40 bg-red-500/10 p-3">
          <span className="h-3 w-3 shrink-0 animate-pulse rounded-full bg-red-500" />
          <p className="min-w-0 flex-1 text-sm text-ink-100">
            Enregistrement… <span className="tabular-nums text-ink-300">{fmtClock(elapsed)}</span>
            {withVideo && <span className="block text-xs text-ink-400">Explique l&apos;exercice pendant que la vidéo défile. L&apos;enregistrement s&apos;arrête à la fin de la vidéo.</span>}
          </p>
          <Button variant="danger" size="sm" onClick={stop}>
            <Square className="h-3.5 w-3.5 fill-current" /> Arrêter
          </Button>
        </div>
      ) : phase === "review" && take ? (
        <div className="space-y-2 rounded-xl border border-ink-700 bg-ink-900/60 p-3">
          <p className="text-sm text-ink-200">
            {withVideo ? "Lance la vidéo pour réécouter ton explication dessus." : "Réécoute ton explication :"}
          </p>
          {!withVideo && <audio src={take.url} controls className="w-full" />}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => upload(take.blob)}>Garder cet audio</Button>
            <Button size="sm" variant="secondary" onClick={() => start(withVideo)}>
              <RotateCcw className="h-4 w-4" /> Recommencer
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setPhase("idle")}>Annuler</Button>
          </div>
        </div>
      ) : phase === "uploading" ? (
        <div className="rounded-xl border border-ink-700 bg-ink-900/60 p-3">
          <p className="mb-2 text-sm text-ink-200">Envoi de l&apos;audio… {Math.round(progress * 100)} %</p>
          <div className="h-1.5 overflow-hidden rounded-full bg-ink-700">
            <div className="h-full bg-royal-500 transition-all" style={{ width: `${Math.max(5, progress * 100)}%` }} />
          </div>
        </div>
      ) : (
        <>
          {value && (
            <div className="flex items-center gap-2 rounded-xl border border-royal-500/25 bg-royal-600/[0.08] p-2.5">
              <Mic className="h-4 w-4 shrink-0 text-royal-300" />
              <audio src={value} controls preload="none" className="h-9 min-w-0 flex-1" />
              <Button size="icon" variant="ghost" onClick={() => onChange("")} aria-label="Supprimer l'explication audio" className="hover:text-red-300">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
          <div className={cn("grid gap-2", fileVideo ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
            {fileVideo && (
              <Button variant="secondary" onClick={() => start(true)} disabled={!canRecord()}>
                <Video className="h-4 w-4" /> {value ? "Réenregistrer" : "Enregistrer"} sur la vidéo
              </Button>
            )}
            <Button variant="secondary" onClick={() => start(false)} disabled={!canRecord()}>
              <Mic className="h-4 w-4" /> Enregistrer au micro
            </Button>
            <Button variant="secondary" onClick={() => fileRef.current?.click()}>
              <FileAudio className="h-4 w-4" /> Importer un audio
            </Button>
          </div>
          <p className="text-xs text-ink-500">
            {fileVideo
              ? "« Enregistrer sur la vidéo » lance la vidéo sans le son pendant que tu parles : ton explication sera parfaitement calée dessus."
              : "Ton explication sera proposée au client à côté de la vidéo. Le son des vidéos est coupé par défaut."}
          </p>
        </>
      )}
      {error && <p className="rounded-lg bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
    </div>
  );
}
