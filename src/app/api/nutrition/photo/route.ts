import { NextResponse } from "next/server";
import { clean } from "@/lib/env";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { PhotoAnalysis } from "@/lib/mealPhoto";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Estimation des macros d'un repas à partir d'une photo (Claude, vision).
 * La photo n'est jamais enregistrée : elle est seulement envoyée pour l'analyse.
 */

const API = (process.env.ANTHROPIC_API_BASE || "https://api.anthropic.com").replace(/\/+$/, "");
const MAX_BYTES = 4_500_000;

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

function apiKey(): string {
  const k = clean(process.env.ANTHROPIC_API_KEY, "ANTHROPIC_API_KEY");
  return /^sk-ant-[\w-]{20,}$/.test(k) ? k : "";
}

const TOOL = {
  name: "enregistrer_repas",
  description: "Enregistre l'estimation nutritionnelle des aliments visibles sur la photo.",
  input_schema: {
    type: "object",
    properties: {
      is_food: { type: "boolean", description: "false si la photo ne montre pas de nourriture ou de boisson" },
      title: { type: "string", description: "Nom court du plat en français, ex. « Poulet, riz et brocolis »" },
      items: {
        type: "array",
        description: "Chaque aliment distinct visible, avec la quantité estimée dans l'assiette",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Nom de l'aliment en français, avec le mode de cuisson si utile (ex. « Riz basmati cuit »)" },
            grams: { type: "number", description: "Poids estimé en grammes (ou ml pour une boisson) de la portion visible" },
            kcal: { type: "number", description: "Calories de cette portion" },
            protein_g: { type: "number", description: "Protéines de cette portion, en g" },
            carbs_g: { type: "number", description: "Glucides de cette portion, en g" },
            fat_g: { type: "number", description: "Lipides de cette portion, en g" },
          },
          required: ["name", "grams", "kcal", "protein_g", "carbs_g", "fat_g"],
        },
      },
      confidence: { type: "string", enum: ["haute", "moyenne", "faible"] },
      note: { type: "string", description: "Une phrase courte en français : hypothèses importantes (sauce, huile de cuisson, taille de l'assiette…)" },
    },
    required: ["is_food", "title", "items", "confidence", "note"],
  },
} as const;

const SYSTEM = `Tu es une diététicienne experte qui estime les apports nutritionnels d'un repas à partir d'une photo.
Méthode : identifie chaque aliment distinct, estime son poids en grammes en t'aidant des repères visuels (taille de l'assiette ≈ 26 cm, couverts, mains, emballages), puis calcule calories, protéines, glucides et lipides de la portion à partir de valeurs nutritionnelles de référence (table Ciqual).
Pense aux matières grasses cachées (huile de cuisson, beurre, sauce) et ajoute-les comme un aliment séparé quand elles sont probables.
Reste réaliste : ne surestime ni ne sous-estime les portions. Les calories doivent être cohérentes avec les macros (4 kcal/g protéines et glucides, 9 kcal/g lipides, 7 kcal/g alcool).
Si l'utilisateur donne des précisions (quantités, ingrédients), elles priment sur ce que tu vois.
Réponds uniquement avec l'outil enregistrer_repas, en français.`;

const num = (v: unknown, max: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(max, Math.round(n * 10) / 10)) : 0;
};

export async function POST(req: Request) {
  const sb = await createSupabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return fail("Connecte-toi pour analyser une photo.", 401);

  const key = apiKey();
  if (!key) {
    return fail(
      user.app_metadata?.role === "client"
        ? "L'analyse photo n'est pas encore activée par ton coach."
        : "L'analyse photo n'est pas encore activée : ajoute la clé ANTHROPIC_API_KEY dans Vercel puis redéploie.",
      503,
    );
  }

  let body: { image?: string; hint?: string };
  try {
    body = await req.json();
  } catch {
    return fail("Photo invalide.");
  }
  const m = String(body.image ?? "").match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return fail("Photo invalide.");
  if (m[2].length * 0.75 > MAX_BYTES) return fail("Photo trop lourde.");
  const hint = String(body.hint ?? "").trim().slice(0, 300);

  let res: Response;
  try {
    res = await fetch(`${API}/v1/messages`, {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: clean(process.env.ANTHROPIC_MODEL, "ANTHROPIC_MODEL") || "claude-sonnet-5-5",
        max_tokens: 1500,
        system: SYSTEM,
        tools: [TOOL],
        tool_choice: { type: "tool", name: TOOL.name },
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: m[1], data: m[2] } },
              {
                type: "text",
                text: hint ? `Estime les apports de ce repas. Précisions de la personne : « ${hint} »` : "Estime les apports de ce repas.",
              },
            ],
          },
        ],
      }),
      cache: "no-store",
    });
  } catch {
    return fail("Le service d'analyse ne répond pas. Réessaie dans un instant.", 502);
  }

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("[photo-repas]", res.status, json?.error?.message);
    if (res.status === 401) return fail("La clé ANTHROPIC_API_KEY est refusée : vérifie-la dans Vercel.", 502);
    if (res.status === 429) return fail("Trop d'analyses en même temps. Réessaie dans une minute.", 429);
    if (/credit|billing|balance/i.test(String(json?.error?.message))) return fail("Crédit épuisé sur le compte Claude (console.anthropic.com).", 502);
    return fail("L'analyse a échoué. Réessaie avec une autre photo.", 502);
  }

  const block = (json.content ?? []).find((c: { type: string; name?: string }) => c.type === "tool_use" && c.name === TOOL.name);
  const input = block?.input ?? {};
  const result: PhotoAnalysis = {
    isFood: input.is_food !== false,
    title: String(input.title ?? "Repas").slice(0, 120),
    confidence: ["haute", "moyenne", "faible"].includes(input.confidence) ? input.confidence : "moyenne",
    note: String(input.note ?? "").slice(0, 400),
    items: (Array.isArray(input.items) ? input.items : [])
      .slice(0, 15)
      .map((i: Record<string, unknown>) => ({
        name: String(i.name ?? "Aliment").trim().slice(0, 150) || "Aliment",
        grams: num(i.grams, 3000),
        kcal: num(i.kcal, 4000),
        protein_g: num(i.protein_g, 500),
        carbs_g: num(i.carbs_g, 800),
        fat_g: num(i.fat_g, 400),
      }))
      .filter((i: { grams: number }) => i.grams > 0),
  };
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
