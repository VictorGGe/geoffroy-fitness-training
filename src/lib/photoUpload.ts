"use client";

/**
 * Photos des machines : réduites dans le navigateur (1600 px, JPEG) puis envoyées
 * dans l'espace de stockage du coach (même espace que les vidéos).
 */
import { getSupabase } from "./supabase/client";
import { storagePathFromUrl, uploadToStorage, VIDEO_BUCKET, VideoError } from "./videoUpload";

export const MAX_PHOTOS = 6;
const MAX_SIDE = 1600;

/** Réduit et convertit la photo en JPEG (les photos de téléphone font souvent 3 à 8 Mo). */
export async function preparePhoto(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/") && !/\.(jpe?g|png|heic|heif|webp)$/i.test(file.name)) {
    throw new VideoError("Ce fichier n'est pas une photo.");
  }
  let source: ImageBitmap | HTMLImageElement;
  let url: string | null = null;
  try {
    source = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
  } catch {
    url = URL.createObjectURL(file);
    source = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new VideoError("Impossible de lire cette photo. Essaie de la prendre directement avec l'appareil photo."));
      i.src = url!;
    });
  }
  try {
    const w0 = "naturalWidth" in source ? source.naturalWidth : source.width;
    const h0 = "naturalHeight" in source ? source.naturalHeight : source.height;
    const scale = Math.min(1, MAX_SIDE / Math.max(w0, h0));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(w0 * scale));
    canvas.height = Math.max(1, Math.round(h0 * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new VideoError("Impossible de préparer la photo.");
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.82));
    if (!blob) throw new VideoError("Impossible de préparer la photo.");
    return blob;
  } finally {
    if (url) URL.revokeObjectURL(url);
    if ("close" in source) source.close();
  }
}

/** Envoie la photo et renvoie son adresse publique. */
export async function uploadMachinePhoto(file: File, onProgress?: (r: number) => void): Promise<string> {
  const blob = await preparePhoto(file);
  const { data } = await getSupabase().auth.getUser();
  if (!data.user) throw new VideoError("Session expirée : reconnecte-toi.");
  const path = `${data.user.id}/machines/${crypto.randomUUID()}.jpg`;
  return uploadToStorage(path, blob, "image/jpeg", onProgress);
}

/** Supprime une photo de notre stockage si plus aucun programme ne l'utilise. */
export async function deleteStoredPhoto(url: string): Promise<void> {
  const path = storagePathFromUrl(url);
  if (!path || !path.includes("/machines/")) return;
  const sb = getSupabase();
  // Une photo copiée avec un programme dupliqué peut encore servir ailleurs
  const { count, error } = await sb.from("program_exercises").select("id", { count: "exact", head: true }).contains("image_urls", [url]);
  if (error || (count ?? 0) > 0) return;
  await sb.storage.from(VIDEO_BUCKET).remove([path]);
}
