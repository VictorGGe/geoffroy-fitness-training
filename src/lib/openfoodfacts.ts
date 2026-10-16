/**
 * Open Food Facts : base collaborative et gratuite de produits alimentaires.
 * Interrogée directement depuis le navigateur (aucune clé, aucune donnée client envoyée :
 * seulement le texte recherché ou le code-barres).
 */
import type { FoodItem } from "./nutrition";

const BASE = "https://world.openfoodfacts.org";
const FIELDS = "code,product_name,product_name_fr,generic_name_fr,brands,nutriments,serving_quantity,quantity,image_small_url,image_front_small_url";

interface OffProduct {
  code?: string;
  product_name?: string;
  product_name_fr?: string;
  generic_name_fr?: string;
  brands?: string;
  quantity?: string;
  serving_quantity?: number | string;
  image_small_url?: string;
  image_front_small_url?: string;
  nutriments?: Record<string, number | string | undefined>;
}

const n = (v: unknown): number | null => {
  const x = typeof v === "string" ? Number(v.replace(",", ".")) : typeof v === "number" ? v : NaN;
  return Number.isFinite(x) && x >= 0 ? x : null;
};
const r1 = (v: number) => Math.round(v * 10) / 10;

export function toFoodItem(p: OffProduct): FoodItem | null {
  const nu = p.nutriments ?? {};
  let kcal = n(nu["energy-kcal_100g"]);
  if (kcal === null) {
    const kj = n(nu["energy_100g"]) ?? n(nu["energy-kj_100g"]);
    if (kj !== null) kcal = kj / 4.184;
  }
  if (kcal === null || kcal > 1000) return null;
  const name = (p.product_name_fr || p.product_name || p.generic_name_fr || "").trim();
  if (!name) return null;
  const isLiquid = /\b\d+([.,]\d+)?\s*(ml|cl|l)\b/i.test(p.quantity ?? "");
  const unit = isLiquid ? "ml" : "g";
  const serving = n(p.serving_quantity);
  return {
    name: name.slice(0, 160),
    brand: p.brands?.split(",")[0]?.trim().slice(0, 120) || null,
    barcode: p.code && /^\d{6,14}$/.test(p.code) ? p.code : null,
    source: "off",
    unit,
    per: {
      kcal: Math.round(kcal),
      protein: r1(n(nu["proteins_100g"]) ?? 0),
      carbs: r1(n(nu["carbohydrates_100g"]) ?? 0),
      fat: r1(n(nu["fat_100g"]) ?? 0),
    },
    portions: serving && serving > 0 && serving <= 2000 ? [{ label: `1 portion (${Math.round(serving)} ${unit})`, qty: Math.round(serving) }] : undefined,
    image: p.image_front_small_url || p.image_small_url || null,
  };
}

async function getJson(url: string, timeoutMs = 12000): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } });
    if (res.status === 404) return null;
    if (res.status === 429) throw new Error("Trop de recherches d'affilée : patiente quelques secondes puis réessaie.");
    if (!res.ok) throw new Error("La base Open Food Facts ne répond pas pour le moment. Réessaie ou saisis l'aliment à la main.");
    return await res.json();
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new Error("La base Open Food Facts met trop de temps à répondre. Réessaie ou saisis l'aliment à la main.");
    }
    if (e instanceof TypeError) throw new Error("Impossible de joindre la base Open Food Facts (connexion internet ?).");
    throw e;
  } finally {
    clearTimeout(t);
  }
}

/** Recherche de produits du commerce par nom ou marque. */
export async function searchProducts(q: string): Promise<FoodItem[]> {
  const params = new URLSearchParams({
    search_terms: q.trim(),
    search_simple: "1",
    action: "process",
    json: "1",
    page_size: "24",
    sort_by: "unique_scans_n",
    lc: "fr",
    fields: FIELDS,
  });
  const data = (await getJson(`${BASE}/cgi/search.pl?${params}`)) as { products?: OffProduct[] } | null;
  const seen = new Set<string>();
  return (data?.products ?? [])
    .map(toFoodItem)
    .filter((f): f is FoodItem => {
      if (!f) return false;
      const k = `${f.name}|${f.brand}`.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
}

/** Produit exact à partir du code-barres (EAN). */
export async function productByBarcode(code: string): Promise<FoodItem | null> {
  const clean = code.replace(/\D/g, "");
  if (!/^\d{6,14}$/.test(clean)) return null;
  const data = (await getJson(`${BASE}/api/v2/product/${clean}.json?fields=${FIELDS}`)) as { status?: number; product?: OffProduct } | null;
  if (!data || data.status !== 1 || !data.product) return null;
  const item = toFoodItem({ ...data.product, code: data.product.code ?? clean });
  return item ? { ...item, barcode: clean } : null;
}
