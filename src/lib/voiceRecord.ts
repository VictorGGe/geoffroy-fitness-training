"use client";

/**
 * Explication audio des exercices : enregistrement au micro du téléphone
 * (ou fichier audio importé), puis envoi dans l'espace de stockage du coach.
 */
import { getSupabase } from "./supabase/client";
import { storagePathFromUrl, uploadToStorage, VIDEO_BUCKET, VideoError } from "./videoUpload";

export const MAX_VOICE_SECONDS = 5 * 60;
export const MAX_VOICE_BYTES = 20 * 1024 * 1024;

const EXT: Record<string, string> = {
  "audio/webm": "webm",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/mpeg": "mp3",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
};

/** Format d'enregistrement pris en charge par le navigateur (webm sur Android, mp4 sur iPhone). */
export function recorderMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const t of ["audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/ogg;codecs=opus"]) {
    if (MediaRecorder.isTypeSupported?.(t)) return t;
  }
  return "";
}

export function canRecord(): boolean {
  return typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";
}

export async function openMic(): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  } catch (e) {
    const name = (e as DOMException)?.name;
    if (name === "NotAllowedError" || name === "SecurityError") {
      throw new VideoError("Accès au micro refusé. Autorise le micro pour ce site dans les réglages du navigateur, puis réessaie.");
    }
    if (name === "NotFoundError") throw new VideoError("Aucun micro détecté sur cet appareil.");
    throw new VideoError("Impossible d'utiliser le micro.");
  }
}

function baseType(t: string): string {
  const b = t.split(";")[0].trim().toLowerCase();
  if (b === "audio/x-m4a" || b === "audio/m4a") return "audio/mp4";
  if (b === "audio/mp3") return "audio/mpeg";
  if (b === "audio/x-wav" || b === "audio/wave") return "audio/wav";
  return b;
}

/** Envoie l'audio et renvoie son adresse publique. */
export async function uploadVoice(blob: Blob, onProgress?: (r: number) => void, fileName?: string): Promise<string> {
  let type = baseType(blob.type || "");
  if (!EXT[type] && fileName) {
    const ext = fileName.split(".").pop()?.toLowerCase();
    type = { m4a: "audio/mp4", mp3: "audio/mpeg", aac: "audio/aac", wav: "audio/wav", ogg: "audio/ogg", webm: "audio/webm", mp4: "audio/mp4" }[ext ?? ""] ?? "";
  }
  if (!EXT[type]) throw new VideoError("Format audio non pris en charge (utilise un fichier MP3, M4A ou un enregistrement).");
  if (blob.size > MAX_VOICE_BYTES) throw new VideoError("Fichier audio trop lourd (20 Mo maximum).");
  // Session locale (pas d'appel réseau) : l'identifiant sert seulement à choisir le dossier
  const { data } = await getSupabase().auth.getSession();
  const uid = data.session?.user.id;
  if (!uid) throw new VideoError("Session expirée : reconnecte-toi.");
  const path = `${uid}/audio/${crypto.randomUUID()}.${EXT[type]}`;
  return uploadToStorage(path, blob, type, onProgress);
}

export async function deleteStoredAudio(url: string | null | undefined): Promise<void> {
  if (!url) return;
  const path = storagePathFromUrl(url);
  if (!path || !path.includes("/audio/")) return;
  await getSupabase().storage.from(VIDEO_BUCKET).remove([path]);
}

export function fmtClock(s: number): string {
  const t = Math.max(0, Math.floor(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}
