"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, Maximize2, Mic, MicOff, Play, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { parseVideo, type VideoInfo } from "@/lib/video";

/* ------------------------------------------------------------------ */
/* Lecteur                                                             */
/* ------------------------------------------------------------------ */

export function VideoPlayer({
  info,
  title,
  autoplay = false,
  audioUrl,
}: {
  info: VideoInfo;
  title: string;
  autoplay?: boolean;
  /** Explication audio du coach, lue en même temps que la vidéo */
  audioUrl?: string | null;
}) {
  if (info.kind === "youtube" || info.kind === "vimeo") {
    // Son de la vidéo coupé par défaut (réactivable dans le lecteur)
    const sep = info.embed.includes("?") ? "&" : "?";
    const src = info.embed + sep + (info.kind === "youtube" ? "mute=1" : "muted=1") + (autoplay ? "&autoplay=1" : "");
    return (
      <iframe
        src={src}
        title={title}
        className="absolute inset-0 h-full w-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    );
  }
  if (info.kind === "file") return <FileVideo info={info} title={title} autoplay={autoplay} audioUrl={audioUrl} />;
  return null;
}

/** Vidéo hébergée : son coupé par défaut, explication audio synchronisée. */
function FileVideo({ info, title, autoplay, audioUrl }: { info: Extract<VideoInfo, { kind: "file" }>; title: string; autoplay: boolean; audioUrl?: string | null }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = true;
    v.defaultMuted = true;
  }, []);
  const voice = useVoiceSync(ref, audioUrl);
  return (
    <div className="absolute inset-0" onPointerDown={voice.unlock} onTouchStart={voice.unlock}>
      <video
        ref={ref}
        src={info.src}
        poster={info.thumb ?? undefined}
        controls
        playsInline
        muted
        preload="metadata"
        autoPlay={autoplay}
        aria-label={title}
        className="absolute inset-0 h-full w-full bg-black object-contain"
      />
      {audioUrl && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            voice.toggle();
          }}
          className={cn(
            "absolute left-2 top-2 z-10 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium backdrop-blur transition",
            voice.on ? "bg-royal-600/90 text-white" : "bg-black/60 text-white/80",
          )}
          aria-pressed={voice.on}
          title={voice.on ? "Couper l'explication audio" : "Activer l'explication audio"}
        >
          {voice.on ? <Mic className="h-3.5 w-3.5" /> : <MicOff className="h-3.5 w-3.5" />}
          Explication {voice.on ? "activée" : "coupée"}
        </button>
      )}
    </div>
  );
}

/**
 * Lit l'explication audio en même temps que la vidéo : lecture, pause,
 * déplacement dans la vidéo et vitesse restent synchronisés.
 */
export function useVoiceSync(videoRef: React.RefObject<HTMLVideoElement | null>, audioUrl?: string | null) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const unlocked = useRef(false);
  const [on, setOn] = useState(true);
  const onRef = useRef(on);
  onRef.current = on;

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !audioUrl) return;
    const a = new Audio(audioUrl);
    a.preload = "auto";
    audio.current = a;
    unlocked.current = false;
    const sync = () => {
      if (Math.abs(a.currentTime - v.currentTime) > 0.25) a.currentTime = Math.min(v.currentTime, a.duration || v.currentTime);
    };
    const play = () => {
      if (!onRef.current) return;
      sync();
      a.playbackRate = v.playbackRate;
      a.play().catch(() => {});
    };
    const pause = () => a.pause();
    const seek = () => {
      a.currentTime = v.currentTime;
      if (!v.paused && onRef.current) a.play().catch(() => {});
    };
    const rate = () => (a.playbackRate = v.playbackRate);
    const tick = () => !v.paused && onRef.current && sync();
    v.addEventListener("play", play);
    v.addEventListener("playing", play);
    v.addEventListener("pause", pause);
    v.addEventListener("ended", pause);
    v.addEventListener("waiting", pause);
    v.addEventListener("seeked", seek);
    v.addEventListener("ratechange", rate);
    v.addEventListener("timeupdate", tick);
    if (!v.paused) play();
    return () => {
      v.removeEventListener("play", play);
      v.removeEventListener("playing", play);
      v.removeEventListener("pause", pause);
      v.removeEventListener("ended", pause);
      v.removeEventListener("waiting", pause);
      v.removeEventListener("seeked", seek);
      v.removeEventListener("ratechange", rate);
      v.removeEventListener("timeupdate", tick);
      a.pause();
      a.src = "";
      audio.current = null;
    };
  }, [videoRef, audioUrl]);

  return {
    on,
    /** iPhone : la lecture du son doit être autorisée par un geste de l'utilisateur. */
    unlock: () => {
      const a = audio.current;
      if (!a || unlocked.current) return;
      unlocked.current = true;
      const v = videoRef.current;
      if (v && !v.paused) return;
      a.muted = true;
      a.play()
        .then(() => {
          a.pause();
          a.muted = false;
          if (v) a.currentTime = v.currentTime;
        })
        .catch(() => {
          a.muted = false;
          unlocked.current = false;
        });
    },
    toggle: () => {
      const a = audio.current;
      const v = videoRef.current;
      setOn((x) => {
        const next = !x;
        if (a) {
          if (!next) a.pause();
          else if (v && !v.paused) {
            a.currentTime = v.currentTime;
            a.play().catch(() => {});
          }
        }
        return next;
      });
    },
  };
}

/** Explication audio seule (vidéo YouTube / Vimeo, ou pas de vidéo). */
export function VoiceNote({ url, className }: { url: string; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-royal-500/25 bg-royal-600/[0.08] p-3", className)}>
      <p className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-royal-300">
        <Mic className="h-3.5 w-3.5" /> Explication audio du coach
      </p>
      <audio src={url} controls preload="none" className="w-full" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Fenêtre vidéo (avec plein écran)                                    */
/* ------------------------------------------------------------------ */

export function VideoModal({ url, title, onClose, audioUrl }: { url: string; title: string; onClose: () => void; audioUrl?: string | null }) {
  const info = parseVideo(url);
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !document.fullscreenElement && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  async function fullscreen() {
    const el = frameRef.current as (HTMLDivElement & { webkitRequestFullscreen?: () => void }) | null;
    try {
      if (el?.requestFullscreen) await el.requestFullscreen();
      else el?.webkitRequestFullscreen?.();
    } catch {
      /* iPhone : utiliser le bouton plein écran du lecteur */
    }
  }

  if (typeof document === "undefined" || !info) return null;
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-0 sm:p-6" role="dialog" aria-modal aria-label={`Vidéo : ${title}`}>
      <div className="absolute inset-0 bg-black/85 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="relative w-full max-w-4xl animate-scale-in">
        <div className="flex items-center gap-2 px-3 pb-2 sm:px-0">
          <p className="h-display min-w-0 flex-1 truncate text-lg text-white">{title}</p>
          {info.kind !== "link" && (
            <button
              onClick={fullscreen}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white/10 px-3 text-sm font-medium text-white hover:bg-white/20"
            >
              <Maximize2 className="h-4 w-4" /> Plein écran
            </button>
          )}
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20" aria-label="Fermer la vidéo">
            <X className="h-5 w-5" />
          </button>
        </div>
        {info.kind === "link" ? (
          <div className="rounded-2xl border border-ink-700 bg-ink-850 p-8 text-center">
            <p className="text-sm text-ink-300">Cette vidéo ne peut pas être lue directement dans l&apos;application.</p>
            <a
              href={info.href}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-royal-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-royal-500"
            >
              <ExternalLink className="h-4 w-4" /> Ouvrir la vidéo
            </a>
          </div>
        ) : (
          <div ref={frameRef} className="relative aspect-video w-full overflow-hidden bg-black sm:rounded-2xl">
            <VideoPlayer info={info} title={title} autoplay audioUrl={audioUrl} />
          </div>
        )}
        {audioUrl && info.kind !== "file" && <VoiceNote url={audioUrl} className="mx-3 mt-3 sm:mx-0" />}
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ */
/* Miniature cliquable (à côté de l'exercice)                           */
/* ------------------------------------------------------------------ */

export function VideoThumb({
  url,
  title,
  size = "md",
  audioUrl,
}: {
  url: string | null | undefined;
  title: string;
  size?: "sm" | "md";
  audioUrl?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [imgOk, setImgOk] = useState(true);
  const info = parseVideo(url);
  if (!info || !url) return null;
  const dims = size === "sm" ? "h-10 w-16" : "h-12 w-20 sm:h-14 sm:w-24";
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className={cn(
          "group relative shrink-0 overflow-hidden rounded-lg border border-ink-600 bg-ink-800 transition hover:border-royal-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal-400",
          dims,
        )}
        aria-label={`Voir la vidéo : ${title}`}
        title="Voir la vidéo"
      >
        {info.thumb && imgOk ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={info.thumb} alt="" className="h-full w-full object-cover opacity-80 transition group-hover:opacity-100" onError={() => setImgOk(false)} loading="lazy" />
        ) : (
          <span className="absolute inset-0 bg-gradient-to-br from-royal-700/60 to-ink-900" />
        )}
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-royal-600/95 text-white shadow-lg transition group-hover:scale-110">
            <Play className="ml-0.5 h-3.5 w-3.5 fill-current" />
          </span>
        </span>
      </button>
      {open && <VideoModal url={url} title={title} audioUrl={audioUrl} onClose={() => setOpen(false)} />}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Vidéo intégrée dans une page (fiche exercice)                        */
/* ------------------------------------------------------------------ */

export function InlineVideo({ url, title, audioUrl }: { url: string; title: string; audioUrl?: string | null }) {
  const info = parseVideo(url);
  const [open, setOpen] = useState(false);
  if (!info) return null;
  if (info.kind === "link") {
    return (
      <div className="space-y-2">
        <a href={info.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-royal-300 hover:text-royal-200">
          <ExternalLink className="h-4 w-4" /> Voir la vidéo de démonstration
        </a>
        {audioUrl && <VoiceNote url={audioUrl} />}
      </div>
    );
  }
  return (
    <div>
      <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-ink-700 bg-black">
        <VideoPlayer info={info} title={title} audioUrl={audioUrl} />
      </div>
      {audioUrl && info.kind !== "file" && <VoiceNote url={audioUrl} className="mt-2" />}
      <button onClick={() => setOpen(true)} className="mt-2 inline-flex items-center gap-1.5 text-sm text-royal-300 hover:text-royal-200">
        <Maximize2 className="h-4 w-4" /> Agrandir
      </button>
      {open && <VideoModal url={url} title={title} audioUrl={audioUrl} onClose={() => setOpen(false)} />}
    </div>
  );
}
