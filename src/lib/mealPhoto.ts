/** Estimation des macros d'un repas à partir d'une photo. */

export interface PhotoItem {
  name: string;
  grams: number;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface PhotoAnalysis {
  isFood: boolean;
  title: string;
  confidence: "haute" | "moyenne" | "faible";
  note: string;
  items: PhotoItem[];
}

/** Marque utilisée pour reconnaître les aliments ajoutés par photo dans le journal. */
export const PHOTO_BRAND = "Estimation photo";

/** Recalcule une ligne quand on modifie la quantité (proportionnel aux grammes estimés). */
export function scaleItem(base: PhotoItem, grams: number): PhotoItem {
  const f = base.grams > 0 ? grams / base.grams : 0;
  const r = (v: number) => Math.round(v * f * 10) / 10;
  return { name: base.name, grams, kcal: Math.round(base.kcal * f), protein_g: r(base.protein_g), carbs_g: r(base.carbs_g), fat_g: r(base.fat_g) };
}

/** Réduit la photo (1024 px max, JPEG) : analyse plus rapide et moins chère. */
export async function shrinkPhoto(file: File, max = 1024): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Impossible de lire cette photo (format non pris en charge ?)."));
      i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Impossible de préparer la photo.");
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}
