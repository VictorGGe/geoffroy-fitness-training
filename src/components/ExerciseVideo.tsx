"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, Maximize2, Play, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { parseVideo, type VideoInfo } from "@/lib/video";

/* ------------------------------------------------------------------ */
/* Lecteur                                                             */
/* ------------------------------------------------------------------ */

export function VideoPlayer({ info, title, autoplay = false }: { info: VideoInfo; title: string; autoplay?: boolean }) {
  if (info.kind === "youtube" || info.kind === "vimeo") {
    const src = info.embed + (autoplay ? `${info.embed.includes("?") ? "&" : "?"}autoplay=1` : "");
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
  if (info.kind === "file") {
    return (
      <video
        src={info.src}
        poster={info.thumb ?? undefined}
        controls
        playsInline
        preload="metadata"
        autoPlay={autoplay}
        className="absolute inset-0 h-full w-full bg-black object-contain"
      />
    );
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Fenêtre vidéo (avec plein écran)                                    */
/* ------------------------------------------------------------------ */

export function VideoModal({ url, title, onClose }: { url: string; title: string; onClose: () => void }) {
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
            <VideoPlayer info={info} title={title} autoplay />
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ */
/* Miniature cliquable (à côté de l'exercice)                           */
/* ------------------------------------------------------------------ */

export function VideoThumb({ url, title, size = "md" }: { url: string | null | undefined; title: string; size?: "sm" | "md" }) {
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
      {open && <VideoModal url={url} title={title} onClose={() => setOpen(false)} />}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Vidéo intégrée dans une page (fiche exercice)                        */
/* ------------------------------------------------------------------ */

export function InlineVideo({ url, title }: { url: string; title: string }) {
  const info = parseVideo(url);
  const [open, setOpen] = useState(false);
  if (!info) return null;
  if (info.kind === "link") {
    return (
      <a href={info.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-royal-300 hover:text-royal-200">
        <ExternalLink className="h-4 w-4" /> Voir la vidéo de démonstration
      </a>
    );
  }
  return (
    <div>
      <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-ink-700 bg-black">
        <VideoPlayer info={info} title={title} />
      </div>
      <button onClick={() => setOpen(true)} className="mt-2 inline-flex items-center gap-1.5 text-sm text-royal-300 hover:text-royal-200">
        <Maximize2 className="h-4 w-4" /> Agrandir
      </button>
      {open && <VideoModal url={url} title={title} onClose={() => setOpen(false)} />}
    </div>
  );
}
