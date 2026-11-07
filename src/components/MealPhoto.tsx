"use client";

import { useRef, useState } from "react";
import { Camera, ImagePlus, RotateCcw, Sparkles, X } from "lucide-react";
import { Button, Input } from "./ui";
import { Chip } from "./FoodPicker";
import { useToast } from "./toast";
import { cn } from "@/lib/cn";
import { getSupabase } from "@/lib/supabase/client";
import { errorMessage, parseNum } from "@/lib/format";
import { MEALS, type Meal } from "@/lib/nutrition";
import { PHOTO_BRAND, scaleItem, shrinkPhoto, type PhotoAnalysis, type PhotoItem } from "@/lib/mealPhoto";

interface Row {
  base: PhotoItem;
  grams: string;
  keep: boolean;
}

const fmt = (v: number) => String(Math.round(v * 10) / 10).replace(".", ",");

/** Ajout d'un repas au journal à partir d'une photo (estimation des macros par IA). */
export function MealPhoto({
  clientId,
  date,
  defaultMeal,
  onSaved,
  onDone,
}: {
  clientId: string;
  date: string;
  defaultMeal: Meal;
  onSaved: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [hint, setHint] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PhotoAnalysis | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [meal, setMeal] = useState<Meal>(defaultMeal);
  const [saving, setSaving] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setResult(null);
    try {
      setPhoto(await shrinkPhoto(file));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function analyse() {
    if (!photo) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/nutrition/photo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ image: photo, hint }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "L'analyse a échoué.");
      const r = j as PhotoAnalysis;
      if (!r.isFood || !r.items.length) throw new Error("Je ne reconnais pas de repas sur cette photo. Essaie avec une photo plus nette, prise au-dessus de l'assiette.");
      setResult(r);
      setRows(r.items.map((i) => ({ base: i, grams: String(Math.round(i.grams)), keep: true })));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const items = rows.map((r) => {
    const g = parseNum(r.grams);
    return { ...r, valid: g !== null && g > 0 && g <= 5000, item: scaleItem(r.base, g && g > 0 ? g : 0) };
  });
  const kept = items.filter((r) => r.keep && r.valid);
  const total = kept.reduce(
    (t, r) => ({ kcal: t.kcal + r.item.kcal, p: t.p + r.item.protein_g, c: t.c + r.item.carbs_g, f: t.f + r.item.fat_g }),
    { kcal: 0, p: 0, c: 0, f: 0 },
  );

  async function save() {
    if (!kept.length) return;
    setSaving(true);
    const rowsToInsert = kept.map((r) => ({
      client_id: clientId,
      eaten_on: date,
      meal,
      name: r.item.name,
      brand: PHOTO_BRAND,
      barcode: null,
      source: "manuel",
      unit: "g",
      quantity: r.item.grams,
      kcal: Math.min(5000, r.item.kcal),
      protein_g: Math.min(1000, r.item.protein_g),
      carbs_g: Math.min(1000, r.item.carbs_g),
      fat_g: Math.min(1000, r.item.fat_g),
    }));
    const { error: e } = await getSupabase().from("food_entries").insert(rowsToInsert);
    setSaving(false);
    if (e) return toast.error(errorMessage(e));
    toast.success(`${rowsToInsert.length} aliment${rowsToInsert.length > 1 ? "s" : ""} ajouté${rowsToInsert.length > 1 ? "s" : ""} (${Math.round(total.kcal)} kcal).`);
    onSaved();
    onDone();
  }

  function reset() {
    setPhoto(null);
    setResult(null);
    setRows([]);
    setError(null);
    setHint("");
  }

  const inputs = (
    <>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
      <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
    </>
  );

  /* ---------- 1. Choix de la photo ---------- */
  if (!photo) {
    return (
      <div className="space-y-4">
        {inputs}
        <div className="rounded-2xl border border-dashed border-ink-600 bg-ink-900/60 p-6 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-royal-600/15 text-royal-300">
            <Sparkles className="h-6 w-6" />
          </span>
          <p className="mt-3 font-semibold text-white">Photographie ton assiette</p>
          <p className="mx-auto mt-1 max-w-xs text-sm text-ink-400">
            Les aliments, les quantités et les macros sont estimés automatiquement. Tu pourras tout ajuster avant d&apos;ajouter.
          </p>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <Button onClick={() => cameraRef.current?.click()}>
              <Camera className="h-4 w-4" /> Prendre une photo
            </Button>
            <Button variant="secondary" onClick={() => galleryRef.current?.click()}>
              <ImagePlus className="h-4 w-4" /> Choisir dans la galerie
            </Button>
          </div>
        </div>
        <p className="text-xs text-ink-500">
          Astuce : prends la photo bien au-dessus de l&apos;assiette, en entier et avec un bon éclairage. La photo n&apos;est pas conservée.
        </p>
        {error && <p className="rounded-lg bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
      </div>
    );
  }

  /* ---------- 2. Photo prise : précisions + analyse ---------- */
  if (!result) {
    return (
      <div className="space-y-4">
        {inputs}
        <div className="relative overflow-hidden rounded-2xl border border-ink-700 bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo} alt="Photo du repas" className={cn("max-h-72 w-full object-contain", busy && "opacity-60")} />
          {busy && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink-950/40">
              <span className="h-9 w-9 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              <p className="text-sm font-medium text-white">Analyse du repas…</p>
            </div>
          )}
          {!busy && (
            <button type="button" onClick={reset} className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80" aria-label="Changer de photo">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div>
          <label className="label" htmlFor="photo-hint">Précisions (facultatif)</label>
          <Input
            id="photo-hint"
            value={hint}
            onChange={(e) => setHint(e.target.value)}
            maxLength={300}
            placeholder="Ex. 150 g de poulet, riz complet, cuit à l'huile d'olive"
            disabled={busy}
          />
          <p className="mt-1 text-xs text-ink-500">Plus tu donnes de détails, plus l&apos;estimation est précise.</p>
        </div>
        {error && <p className="rounded-lg bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
        <Button className="w-full" size="lg" onClick={analyse} loading={busy}>
          <Sparkles className="h-4 w-4" /> Estimer les macros
        </Button>
      </div>
    );
  }

  /* ---------- 3. Résultat modifiable ---------- */
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-white">{result.title}</p>
          <p className="mt-0.5 text-xs text-ink-400">
            Fiabilité{" "}
            <span className={cn(result.confidence === "haute" ? "text-emerald-300" : result.confidence === "moyenne" ? "text-amber-300" : "text-red-300")}>
              {result.confidence}
            </span>
            {result.note ? ` · ${result.note}` : ""}
          </p>
        </div>
      </div>

      <ul className="divide-y divide-ink-750 overflow-hidden rounded-xl border border-ink-700">
        {items.map((r, idx) => (
          <li key={idx} className={cn("flex items-center gap-3 px-3 py-2.5", !r.keep && "opacity-45")}>
            <input
              type="checkbox"
              checked={r.keep}
              onChange={(e) => setRows(rows.map((x, i) => (i === idx ? { ...x, keep: e.target.checked } : x)))}
              className="h-[18px] w-[18px] shrink-0 accent-royal-500"
              aria-label={`Garder ${r.base.name}`}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{r.base.name}</p>
              <p className="truncate text-xs text-ink-400">
                {Math.round(r.item.kcal)} kcal · P {fmt(r.item.protein_g)} · G {fmt(r.item.carbs_g)} · L {fmt(r.item.fat_g)}
              </p>
            </div>
            <div className="relative w-[84px] shrink-0">
              <Input
                value={r.grams}
                onChange={(e) => setRows(rows.map((x, i) => (i === idx ? { ...x, grams: e.target.value } : x)))}
                inputMode="decimal"
                className={cn("h-9 pr-7 text-right", !r.valid && "border-red-500")}
                aria-label={`Quantité de ${r.base.name} en grammes`}
              />
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-ink-400">g</span>
            </div>
          </li>
        ))}
      </ul>

      <div className="grid grid-cols-4 gap-2 rounded-xl border border-royal-500/30 bg-royal-600/[0.08] p-3 text-center">
        {[
          ["Calories", `${Math.round(total.kcal)}`, "kcal"],
          ["Protéines", fmt(total.p), "g"],
          ["Glucides", fmt(total.c), "g"],
          ["Lipides", fmt(total.f), "g"],
        ].map(([l, v, u]) => (
          <div key={l} className="min-w-0">
            <p className="truncate text-[11px] uppercase tracking-wider text-ink-400">{l}</p>
            <p className="mt-1 font-display text-xl font-semibold tabular-nums text-white">
              {v}
              <span className="ml-0.5 text-xs font-normal text-ink-400">{u}</span>
            </p>
          </div>
        ))}
      </div>

      <div>
        <p className="label">Repas</p>
        <div className="flex flex-wrap gap-2">
          {MEALS.map((m) => (
            <Chip key={m.key} active={meal === m.key} onClick={() => setMeal(m.key)}>
              {m.label}
            </Chip>
          ))}
        </div>
      </div>

      <p className="text-xs text-ink-500">Estimation automatique : ajuste les grammes si besoin. Décoche ce que tu n&apos;as pas mangé.</p>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Button variant="secondary" onClick={reset}>
          <RotateCcw className="h-4 w-4" /> Autre photo
        </Button>
        <Button onClick={save} loading={saving} disabled={!kept.length || items.some((r) => r.keep && !r.valid)}>
          Ajouter au journal ({Math.round(total.kcal)} kcal)
        </Button>
      </div>
    </div>
  );
}
