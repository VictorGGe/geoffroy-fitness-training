"use client";

/**
 * Vidéos filmées avec le téléphone :
 *  1. compression dans le navigateur (720p, ~1,6 Mb/s) pour tenir sous 50 Mo et se lire partout ;
 *  2. image d'aperçu (miniature) ;
 *  3. envoi vers le stockage Supabase avec barre de progression.
 */
import { getSupabase } from "./supabase/client";
import { SUPABASE_KEY, SUPABASE_URL } from "./env";

export const VIDEO_BUCKET = "exercise-videos";
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
/** En dessous de cette taille, un MP4/WebM est envoyé tel quel (plus rapide). */
const DIRECT_UPLOAD_BYTES = 20 * 1024 * 1024;
export const MAX_DURATION_S = 5 * 60;
const MAX_SIDE = 1280;
const VIDEO_BPS = 1_600_000;

export class VideoError extends Error {}

export function fmtMB(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0).replace(".", ",")} Mo`;
}

/** Vidéo hébergée dans notre espace de stockage ? */
export function isStoredVideo(url: string | null | undefined): boolean {
  return !!url && url.includes(`/storage/v1/object/public/${VIDEO_BUCKET}/`);
}

export function storagePathFromUrl(url: string): string | null {
  const i = url.indexOf(`/storage/v1/object/public/${VIDEO_BUCKET}/`);
  if (i < 0) return null;
  return decodeURIComponent(url.slice(i + `/storage/v1/object/public/${VIDEO_BUCKET}/`.length).split("?")[0]);
}

export function posterUrlFor(url: string): string {
  return url.replace(/\.(mp4|webm|mov|m4v)(\?.*)?$/i, ".jpg");
}

function loadVideo(file: Blob): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.preload = "auto";
    v.playsInline = true;
    v.muted = true;
    v.src = URL.createObjectURL(file);
    v.onloadedmetadata = () => resolve(v);
    v.onerror = () => reject(new VideoError("Cette vidéo ne peut pas être lue par le navigateur. Essaie de l'exporter en MP4 depuis ton téléphone."));
  });
}

function scaled(w: number, h: number) {
  const k = Math.min(1, MAX_SIDE / Math.max(w, h));
  // dimensions paires (exigé par certains encodeurs)
  return { w: Math.max(2, Math.round((w * k) / 2) * 2), h: Math.max(2, Math.round((h * k) / 2) * 2) };
}

/** Image d'aperçu (JPEG) prise vers la première seconde. */
export async function makePoster(file: Blob): Promise<Blob | null> {
  try {
    const v = await loadVideo(file);
    const t = Math.min(1, (v.duration || 1) / 3);
    await new Promise<void>((res) => {
      v.onseeked = () => res();
      v.currentTime = t;
      setTimeout(res, 3000);
    });
    const { w, h } = scaled(v.videoWidth || 640, v.videoHeight || 360);
    const c = document.createElement("canvas");
    const k = Math.min(1, 480 / Math.max(w, h));
    c.width = Math.round(w * k);
    c.height = Math.round(h * k);
    c.getContext("2d")!.drawImage(v, 0, 0, c.width, c.height);
    URL.revokeObjectURL(v.src);
    return await new Promise((res) => c.toBlob((b) => res(b), "image/jpeg", 0.8));
  } catch {
    return null;
  }
}

function pickMime(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates = [
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4;codecs=avc1,mp4a",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  return candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? null;
}

export interface Prepared {
  blob: Blob;
  ext: "mp4" | "webm" | "mov" | "m4v";
  contentType: string;
  compressed: boolean;
}

/** Faut-il compresser ? (gros fichier, ou format pas lisible partout comme le .mov d'iPhone) */
export function needsCompression(file: File): boolean {
  const lower = file.name.toLowerCase();
  const universal = /\.(mp4|webm)$/.test(lower) || file.type === "video/mp4" || file.type === "video/webm";
  return file.size > DIRECT_UPLOAD_BYTES || !universal;
}

/**
 * Prépare la vidéo à l'envoi. La compression se fait en lisant la vidéo une fois
 * (elle dure donc à peu près la durée de la vidéo) : l'écran doit rester allumé.
 */
export async function prepareVideo(file: File, onProgress: (ratio: number) => void): Promise<Prepared> {
  if (!file.type.startsWith("video/") && !/\.(mp4|mov|m4v|webm|3gp)$/i.test(file.name)) {
    throw new VideoError("Ce fichier n'est pas une vidéo.");
  }
  if (!needsCompression(file)) {
    const webm = file.type === "video/webm" || /\.webm$/i.test(file.name);
    return { blob: file, ext: webm ? "webm" : "mp4", contentType: webm ? "video/webm" : "video/mp4", compressed: false };
  }

  const mime = pickMime();
  if (!mime) {
    if (file.size <= MAX_UPLOAD_BYTES) {
      const mov = /\.mov$/i.test(file.name) || file.type === "video/quicktime";
      return { blob: file, ext: mov ? "mov" : "mp4", contentType: file.type || "video/mp4", compressed: false };
    }
    throw new VideoError("Vidéo trop lourde (50 Mo maximum) et ce navigateur ne sait pas la compresser. Raccourcis-la ou filme en 720p.");
  }

  const v = await loadVideo(file);
  if (!v.duration || !Number.isFinite(v.duration)) throw new VideoError("Durée de la vidéo illisible.");
  if (v.duration > MAX_DURATION_S) throw new VideoError(`Vidéo trop longue (${Math.round(v.duration / 60)} min). Maximum 5 minutes : raccourcis-la dans ta galerie.`);

  const { w, h } = scaled(v.videoWidth, v.videoHeight);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const stream = canvas.captureStream(30);

  // Son : passe par Web Audio (sans sortir sur le haut-parleur)
  let audioCtx: AudioContext | null = null;
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new AC();
    await audioCtx.resume();
    v.muted = false;
    v.volume = 1;
    const src = audioCtx.createMediaElementSource(v);
    const dest = audioCtx.createMediaStreamDestination();
    src.connect(dest);
    dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
  } catch {
    v.muted = true; // pas de son : on garde l'image
  }

  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: VIDEO_BPS, audioBitsPerSecond: 96_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const stopped = new Promise<void>((res) => (rec.onstop = () => res()));

  let raf = 0;
  const draw = () => {
    ctx.drawImage(v, 0, 0, w, h);
    onProgress(Math.min(0.99, v.currentTime / v.duration));
    if (!v.ended && !v.paused) raf = requestAnimationFrame(draw);
  };

  v.currentTime = 0;
  rec.start(1000);
  try {
    await v.play();
  } catch {
    rec.stop();
    throw new VideoError("Impossible de lire la vidéo pour la compresser. Réessaie en touchant le bouton d'envoi.");
  }
  raf = requestAnimationFrame(draw);
  let hiddenAbort: (() => void) | null = null;
  try {
    await new Promise<void>((res, rej) => {
      v.onended = () => res();
      v.onpause = () => {
        if (v.ended) res();
        else if (document.visibilityState === "visible") v.play().catch(() => {});
      };
      hiddenAbort = () => {
        if (document.visibilityState === "hidden") rej(new VideoError("Compression interrompue : garde l'écran allumé et l'application ouverte pendant l'opération, puis réessaie."));
      };
      document.addEventListener("visibilitychange", hiddenAbort);
    });
  } catch (e) {
    cancelAnimationFrame(raf);
    v.pause();
    rec.stop();
    stream.getTracks().forEach((t) => t.stop());
    audioCtx?.close().catch(() => {});
    throw e;
  } finally {
    if (hiddenAbort) document.removeEventListener("visibilitychange", hiddenAbort);
  }
  cancelAnimationFrame(raf);
  ctx.drawImage(v, 0, 0, w, h);
  rec.stop();
  await stopped;
  stream.getTracks().forEach((t) => t.stop());
  audioCtx?.close().catch(() => {});
  URL.revokeObjectURL(v.src);
  onProgress(1);

  const type = mime.split(";")[0];
  const blob = new Blob(chunks, { type });
  if (blob.size < 1000) throw new VideoError("La compression a échoué (écran éteint ou application en arrière-plan ?). Réessaie en gardant l'écran allumé.");
  if (blob.size > MAX_UPLOAD_BYTES) throw new VideoError("Même compressée, la vidéo dépasse 50 Mo. Raccourcis-la un peu.");
  return { blob, ext: type === "video/webm" ? "webm" : "mp4", contentType: type, compressed: true };
}

/** Envoi avec progression (XMLHttpRequest, car fetch ne donne pas l'avancement). */
export async function uploadToStorage(path: string, blob: Blob, contentType: string, onProgress?: (ratio: number) => void): Promise<string> {
  const { data } = await getSupabase().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new VideoError("Session expirée : reconnecte-toi.");
  const base = SUPABASE_URL.replace(/\/$/, "");
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${base}/storage/v1/object/${VIDEO_BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("apikey", SUPABASE_KEY);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("cache-control", "max-age=31536000");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let msg = xhr.responseText;
      try {
        const j = JSON.parse(xhr.responseText);
        msg = j.message || j.error || msg;
      } catch {
        /* texte brut */
      }
      if (xhr.status === 404 || /bucket not found/i.test(msg)) {
        return reject(new VideoError("L'espace vidéo n'est pas encore activé : exécute le fichier SQL 20261021000008_exercise_videos.sql dans Supabase."));
      }
      if (xhr.status === 413 || /too large|exceeded/i.test(msg)) return reject(new VideoError("Vidéo trop lourde (50 Mo maximum)."));
      if (xhr.status === 403 || /row-level security|unauthorized/i.test(msg)) return reject(new VideoError("Envoi refusé. Vérifie que l'espace vidéo est activé dans Supabase."));
      reject(new VideoError(`Envoi impossible (${xhr.status}) : ${String(msg).slice(0, 140)}`));
    };
    xhr.onerror = () => reject(new VideoError("Connexion interrompue pendant l'envoi. Vérifie ton réseau et réessaie."));
    xhr.send(blob);
  });
  return `${base}/storage/v1/object/public/${VIDEO_BUCKET}/${path}`;
}

/** Supprime une vidéo (et sa miniature) de notre stockage. Sans effet sur un lien YouTube. */
export async function deleteStoredVideo(url: string | null | undefined): Promise<void> {
  if (!url || !isStoredVideo(url)) return;
  const path = storagePathFromUrl(url);
  if (!path) return;
  await getSupabase()
    .storage.from(VIDEO_BUCKET)
    .remove([path, path.replace(/\.(mp4|webm|mov|m4v)$/i, ".jpg")]);
}

/** Espace utilisé par les vidéos du coach (le plan gratuit Supabase offre 1 Go). */
export async function storageUsage(): Promise<{ bytes: number; count: number } | null> {
  const sb = getSupabase();
  const { data: u } = await sb.auth.getUser();
  if (!u.user) return null;
  const { data, error } = await sb.storage.from(VIDEO_BUCKET).list(u.user.id, { limit: 1000 });
  if (error || !data) return null;
  const bytes = data.reduce((n, o) => n + (Number((o.metadata as { size?: number } | null)?.size) || 0), 0);
  return { bytes, count: data.filter((o) => !o.name.endsWith(".jpg")).length };
}
