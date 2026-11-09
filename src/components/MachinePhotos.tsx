"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, ChevronLeft, ChevronRight, ImagePlus, Images, Trash2, X } from "lucide-react";
import { Button, Modal } from "./ui";
import { useToast } from "./toast";
import { useMode } from "@/lib/mode";
import { cn } from "@/lib/cn";
import { errorMessage } from "@/lib/format";
import { getSupabase } from "@/lib/supabase/client";
import { deleteStoredPhoto, MAX_PHOTOS, uploadMachinePhoto } from "@/lib/photoUpload";

/* ------------------------------------------------------------------ */
/* Visionneuse plein écran                                              */
/* ------------------------------------------------------------------ */

export function PhotoViewer({ urls, title, start = 0, onClose }: { urls: string[]; title: string; start?: number; onClose: () => void }) {
  const [i, setI] = useState(Math.min(start, urls.length - 1));
  const touchX = useRef<number | null>(null);
  const n = urls.length;
  const go = (d: number) => setI((v) => (v + d + n) % n);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setI((v) => (v + 1) % n);
      if (e.key === "ArrowLeft") setI((v) => (v - 1 + n) % n);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, n]);

  if (typeof document === "undefined" || !n) return null;
  return createPortal(
    <div className="fixed inset-0 z-[80] flex flex-col bg-black/95 animate-fade-in" role="dialog" aria-modal aria-label={`Photos : ${title}`}>
      <div className="flex items-center gap-2 px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <p className="h-display min-w-0 flex-1 truncate text-lg text-white">{title}</p>
        {n > 1 && <span className="text-sm tabular-nums text-white/70">{i + 1} / {n}</span>}
        <button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20" aria-label="Fermer">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div
        className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-[max(1rem,env(safe-area-inset-bottom))]"
        onClick={(e) => e.target === e.currentTarget && onClose()}
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX.current == null || n < 2) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
          touchX.current = null;
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={urls[i]} alt={`${title} — photo ${i + 1}`} className="max-h-full max-w-full rounded-lg object-contain" />
        {n > 1 && (
          <>
            <button onClick={() => go(-1)} className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70" aria-label="Photo précédente">
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button onClick={() => go(1)} className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70" aria-label="Photo suivante">
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ */
/* Miniature cliquable (à côté de l'exercice)                           */
/* ------------------------------------------------------------------ */

export function PhotoThumb({ urls, title, size = "md" }: { urls: string[] | null | undefined; title: string; size?: "sm" | "md" }) {
  const [open, setOpen] = useState(false);
  const list = (urls ?? []).filter(Boolean);
  if (!list.length) return null;
  const dims = size === "sm" ? "h-10 w-12" : "h-12 w-14 sm:h-14 sm:w-16";
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
        aria-label={`Voir la photo de la machine : ${title}`}
        title="Voir la photo de la machine"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={list[0]} alt="" loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />
        {list.length > 1 && (
          <span className="absolute bottom-0.5 right-0.5 rounded bg-black/70 px-1 text-[10px] font-semibold leading-4 text-white">{list.length}</span>
        )}
      </button>
      {open && <PhotoViewer urls={list} title={title} onClose={() => setOpen(false)} />}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Gestion des photos par le coach                                      */
/* ------------------------------------------------------------------ */

const SQL_MSG = "Une dernière étape : exécute le fichier photos-machines.sql dans Supabase → SQL Editor, puis réessaie.";

/** Bouton appareil photo (coach uniquement) : ajouter / retirer les photos de la machine d'un exercice du programme. */
export function MachinePhotosButton({
  programExerciseId,
  urls,
  title,
  onChange,
}: {
  programExerciseId: string;
  urls: string[] | null | undefined;
  title: string;
  onChange: (urls: string[]) => Promise<void>;
}) {
  const isClient = useMode() === "client";
  const [open, setOpen] = useState(false);
  if (isClient) return null;
  const count = (urls ?? []).length;
  return (
    <>
      <Button
        size="icon"
        variant="ghost"
        onClick={() => setOpen(true)}
        aria-label="Photos de la machine"
        title="Photos de la machine"
        className={cn("relative", count > 0 && "text-royal-300")}
      >
        <Camera className="h-4 w-4" />
        {count > 0 && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-royal-400" />}
      </Button>
      {open && <MachinePhotosModal programExerciseId={programExerciseId} initial={urls ?? []} title={title} onChange={onChange} onClose={() => setOpen(false)} />}
    </>
  );
}

function MachinePhotosModal({
  programExerciseId,
  initial,
  title,
  onChange,
  onClose,
}: {
  programExerciseId: string;
  initial: string[];
  title: string;
  onChange: (urls: string[]) => Promise<void>;
  onClose: () => void;
}) {
  const toast = useToast();
  const [urls, setUrls] = useState<string[]>(initial);
  const [pending, setPending] = useState<{ id: string; preview: string; progress: number }[]>([]);
  const [viewAt, setViewAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const current = useRef<string[]>(initial);
  const busy = pending.length > 0;
  const room = MAX_PHOTOS - urls.length - pending.length;

  async function ready(): Promise<boolean> {
    // Vérifie que la colonne existe (fichier SQL exécuté) avant d'envoyer quoi que ce soit
    const { error: e } = await getSupabase().from("program_exercises").select("image_urls").eq("id", programExerciseId).limit(1);
    if (e) {
      setError(/image_urls|schema cache|does not exist/i.test(e.message) ? SQL_MSG : errorMessage(e));
      return false;
    }
    return true;
  }

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    setError(null);
    if (!(await ready())) return;
    const take = files.slice(0, Math.max(0, MAX_PHOTOS - current.current.length));
    if (take.length < files.length) toast.info(`${MAX_PHOTOS} photos maximum par exercice.`);
    for (const file of take) {
      const id = crypto.randomUUID();
      const preview = URL.createObjectURL(file);
      setPending((p) => [...p, { id, preview, progress: 0 }]);
      try {
        const url = await uploadMachinePhoto(file, (r) => setPending((p) => p.map((x) => (x.id === id ? { ...x, progress: r } : x))));
        const next = [...current.current, url];
        try {
          await onChange(next);
          current.current = next;
          setUrls(next);
        } catch (err) {
          deleteStoredPhoto(url).catch(() => {});
          throw err;
        }
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        URL.revokeObjectURL(preview);
        setPending((p) => p.filter((x) => x.id !== id));
      }
    }
  }

  async function remove(url: string) {
    const next = current.current.filter((u) => u !== url);
    try {
      await onChange(next);
      current.current = next;
      setUrls(next);
      deleteStoredPhoto(url).catch(() => {});
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Modal
      open
      onClose={() => !busy && onClose()}
      title="Photos de la machine"
      footer={
        <Button onClick={onClose} disabled={busy}>
          {busy ? "Envoi en cours…" : "Terminé"}
        </Button>
      }
    >
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFiles} />
      <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden" onChange={onFiles} />
      <p className="mb-4 text-sm text-ink-400">
        <span className="font-medium text-ink-100">{title}</span> — ton client verra ces photos à côté de l&apos;exercice pour repérer la machine.
      </p>

      {urls.length + pending.length > 0 ? (
        <div className="mb-4 grid grid-cols-3 gap-2">
          {urls.map((u, idx) => (
            <div key={u} className="group relative aspect-square overflow-hidden rounded-xl border border-ink-700 bg-ink-900">
              <button type="button" className="h-full w-full" onClick={() => setViewAt(idx)} aria-label={`Agrandir la photo ${idx + 1}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u} alt="" className="h-full w-full object-cover" />
              </button>
              <button
                type="button"
                onClick={() => remove(u)}
                disabled={busy}
                className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white hover:bg-red-600 disabled:opacity-50"
                aria-label={`Supprimer la photo ${idx + 1}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          {pending.map((p) => (
            <div key={p.id} className="relative aspect-square overflow-hidden rounded-xl border border-ink-700 bg-ink-900">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.preview} alt="" className="h-full w-full object-cover opacity-50" />
              <div className="absolute inset-x-2 bottom-2 h-1.5 overflow-hidden rounded-full bg-black/60">
                <div className="h-full bg-royal-400 transition-all" style={{ width: `${Math.max(8, Math.round(p.progress * 100))}%` }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mb-4 flex flex-col items-center rounded-2xl border border-dashed border-ink-600 bg-ink-900/60 px-4 py-7 text-center">
          <Images className="h-8 w-8 text-ink-500" />
          <p className="mt-2 text-sm text-ink-300">Aucune photo pour cet exercice.</p>
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <Button onClick={() => cameraRef.current?.click()} disabled={room <= 0}>
          <Camera className="h-4 w-4" /> Prendre une photo
        </Button>
        <Button variant="secondary" onClick={() => galleryRef.current?.click()} disabled={room <= 0}>
          <ImagePlus className="h-4 w-4" /> Depuis la galerie
        </Button>
      </div>
      <p className="mt-2 text-xs text-ink-500">Jusqu&apos;à {MAX_PHOTOS} photos par exercice (ex. la machine de face, puis le réglage du siège).</p>
      {error && <p className="mt-3 rounded-lg bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}

      {viewAt !== null && <PhotoViewer urls={urls} title={title} start={viewAt} onClose={() => setViewAt(null)} />}
    </Modal>
  );
}
