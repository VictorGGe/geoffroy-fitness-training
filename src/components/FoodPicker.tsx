"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Clock, PenLine, ScanLine, Search, ShoppingBasket, Sprout } from "lucide-react";
import { Button, Field, Input, Modal, Spinner } from "./ui";
import { BarcodeScanner } from "./BarcodeScanner";
import { useToast } from "./toast";
import { cn } from "@/lib/cn";
import { getSupabase } from "@/lib/supabase/client";
import { errorMessage, normalize, parseNum } from "@/lib/format";
import { searchBaseFoods } from "@/lib/foods";
import { productByBarcode, searchProducts } from "@/lib/openfoodfacts";
import {
  itemFromEntry,
  kcalFromMacros,
  macrosFor,
  MEALS,
  type FoodEntry,
  type FoodItem,
  type FoodUnit,
  type Meal,
} from "@/lib/nutrition";

type Mode = "search" | "scan" | "manual";

export function Chip({ active, onClick, children, className }: { active: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border px-3 py-1.5 text-sm transition",
        active ? "border-royal-500 bg-royal-600/20 text-white" : "border-ink-700 bg-ink-900 text-ink-300 hover:border-ink-500",
        className,
      )}
    >
      {children}
    </button>
  );
}

const perLabel = (u: FoodUnit) => (u === "portion" ? "pour 1 portion" : `pour 100 ${u}`);

function FoodRow({ item, onClick, badge }: { item: FoodItem; onClick: () => void; badge?: React.ReactNode }) {
  return (
    <li>
      <button type="button" onClick={onClick} className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-ink-800">
        {item.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.image} alt="" className="h-10 w-10 shrink-0 rounded-lg bg-white object-contain" loading="lazy" />
        ) : (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ink-800 text-ink-400">
            {item.source === "off" ? <ShoppingBasket className="h-4 w-4" /> : <Sprout className="h-4 w-4" />}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-white">{item.name}</span>
          <span className="block truncate text-xs text-ink-400">
            {item.brand ? `${item.brand} · ` : ""}
            {Math.round(item.per.kcal)} kcal {perLabel(item.unit)} · P {item.per.protein} · G {item.per.carbs} · L {item.per.fat}
          </span>
        </span>
        {badge}
      </button>
    </li>
  );
}

export function FoodPicker({
  open,
  onClose,
  clientId,
  date,
  defaultMeal,
  editing,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  clientId: string;
  date: string;
  defaultMeal: Meal;
  editing?: FoodEntry | null;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [mode, setMode] = useState<Mode>("search");
  const [item, setItem] = useState<FoodItem | null>(null);
  const [qty, setQty] = useState("");
  const [meal, setMeal] = useState<Meal>(defaultMeal);
  const [saving, setSaving] = useState(false);

  // Recherche
  const [q, setQ] = useState("");
  const [recents, setRecents] = useState<FoodItem[]>([]);
  const [off, setOff] = useState<{ q: string; items: FoodItem[] } | null>(null);
  const [offLoading, setOffLoading] = useState(false);
  const [offError, setOffError] = useState<string | null>(null);

  // Scan
  const [scanState, setScanState] = useState<{ code: string; status: "loading" | "notfound" | "error"; msg?: string } | null>(null);
  const [scanKey, setScanKey] = useState(0);

  // Saisie manuelle
  const [man, setMan] = useState({ name: "", brand: "", unit: "g" as FoodUnit, kcal: "", protein: "", carbs: "", fat: "", barcode: "" });
  const [manErr, setManErr] = useState<string | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setMeal(editing?.meal ?? defaultMeal);
    setQ("");
    setOff(null);
    setOffError(null);
    setScanState(null);
    setManErr(null);
    setMan({ name: "", brand: "", unit: "g", kcal: "", protein: "", carbs: "", fat: "", barcode: "" });
    if (editing) {
      setItem(itemFromEntry(editing));
      setQty(String(Number(editing.quantity)).replace(".", ","));
    } else {
      setItem(null);
      setQty("");
      setMode("search");
    }
  }, [open, editing, defaultMeal]);

  // Aliments déjà utilisés par ce client (les plus récents d'abord)
  useEffect(() => {
    if (!open || editing) return;
    let cancelled = false;
    getSupabase()
      .from("food_entries")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(300)
      .then(({ data }) => {
        if (cancelled || !data) return;
        const seen = new Set<string>();
        const list: FoodItem[] = [];
        for (const e of data as FoodEntry[]) {
          const k = `${e.name}|${e.brand ?? ""}|${e.unit}`.toLowerCase();
          if (seen.has(k)) continue;
          seen.add(k);
          list.push({ ...itemFromEntry(e), portions: e.unit === "portion" ? undefined : [{ label: `Comme la dernière fois (${Number(e.quantity)} ${e.unit})`, qty: Number(e.quantity) }] });
        }
        setRecents(list);
      });
    return () => {
      cancelled = true;
    };
  }, [open, editing, clientId]);

  const base = useMemo(() => searchBaseFoods(q), [q]);
  const recentMatches = useMemo(() => {
    const n = normalize(q);
    return (n ? recents.filter((r) => normalize(`${r.name} ${r.brand ?? ""}`).includes(n)) : recents).slice(0, n ? 5 : 12);
  }, [q, recents]);

  function choose(f: FoodItem) {
    setItem(f);
    const first = f.portions?.[0]?.qty;
    setQty(f.unit === "portion" ? "1" : first ? String(first) : "100");
  }

  async function runOff() {
    const query = q.trim();
    if (query.length < 2) return;
    setOffLoading(true);
    setOffError(null);
    try {
      setOff({ q: query, items: await searchProducts(query) });
    } catch (e) {
      setOffError(errorMessage(e));
    } finally {
      setOffLoading(false);
    }
  }

  const onScan = useCallback(async (code: string) => {
    setScanState({ code, status: "loading" });
    try {
      const found = await productByBarcode(code);
      if (found) {
        setScanState(null);
        setItem(found);
        const first = found.portions?.[0]?.qty;
        setQty(first ? String(first) : "100");
      } else setScanState({ code, status: "notfound" });
    } catch (e) {
      setScanState({ code, status: "error", msg: errorMessage(e) });
    }
  }, []);

  function continueManual() {
    const name = man.name.trim();
    const kcal = parseNum(man.kcal);
    const p = man.protein.trim() ? parseNum(man.protein) : 0;
    const c = man.carbs.trim() ? parseNum(man.carbs) : 0;
    const f = man.fat.trim() ? parseNum(man.fat) : 0;
    if (!name) return setManErr("Indique le nom de l'aliment.");
    if (p === null || c === null || f === null || p < 0 || c < 0 || f < 0) return setManErr("Les macros doivent être des nombres positifs.");
    const k = kcal ?? (p || c || f ? kcalFromMacros(p, c, f) : null);
    if (k === null || k < 0) return setManErr("Indique les calories (ou au moins une macro pour les calculer).");
    const max = man.unit === "portion" ? 5000 : 1000;
    if (k > max) return setManErr(`Calories trop élevées (${max} kcal maximum ${perLabel(man.unit)}).`);
    if (man.unit !== "portion" && p + c + f > 100) return setManErr("Protéines + glucides + lipides ne peuvent pas dépasser 100 g pour 100 g.");
    setManErr(null);
    setItem({
      name,
      brand: man.brand.trim() || null,
      barcode: /^\d{6,14}$/.test(man.barcode) ? man.barcode : null,
      source: "manuel",
      unit: man.unit,
      per: { kcal: k, protein: p, carbs: c, fat: f },
    });
    setQty(man.unit === "portion" ? "1" : "100");
  }

  const quantity = parseNum(qty);
  const qtyValid = quantity !== null && quantity > 0 && quantity <= 5000;
  const totals = item && qtyValid ? macrosFor(item, quantity!) : null;

  async function save() {
    if (!item || !qtyValid || !totals) return;
    if (totals.kcal > 5000) return toast.error("Quantité trop importante pour une seule entrée.");
    setSaving(true);
    const sb = getSupabase();
    const row = {
      client_id: clientId,
      eaten_on: editing?.eaten_on ?? date,
      meal,
      name: item.name,
      brand: item.brand ?? null,
      barcode: item.barcode ?? null,
      source: item.source,
      unit: item.unit,
      quantity: quantity!,
      ...totals,
    };
    const { error } = editing ? await sb.from("food_entries").update(row).eq("id", editing.id) : await sb.from("food_entries").insert(row);
    setSaving(false);
    if (error) return toast.error(errorMessage(error));
    toast.success(editing ? "Aliment modifié." : `${item.name} ajouté.`);
    onSaved();
    if (editing) onClose();
    else {
      setItem(null);
      setQty("");
    }
  }

  /* ---------------- Étape 2 : quantité ---------------- */
  if (open && item) {
    const unitLabel = item.unit === "portion" ? "portion(s)" : item.unit;
    return (
      <Modal
        open
        onClose={onClose}
        title={editing ? "Modifier l'aliment" : "Quantité"}
        footer={
          <>
            {!editing && (
              <Button variant="secondary" onClick={() => setItem(null)} className="sm:mr-auto">
                <ArrowLeft className="h-4 w-4" /> Changer d&apos;aliment
              </Button>
            )}
            <Button onClick={save} loading={saving} disabled={!qtyValid}>
              {editing ? "Enregistrer" : "Ajouter"}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            {item.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.image} alt="" className="h-14 w-14 shrink-0 rounded-xl bg-white object-contain" />
            )}
            <div className="min-w-0">
              <p className="font-semibold text-white">{item.name}</p>
              <p className="text-xs text-ink-400">
                {item.brand ? `${item.brand} · ` : ""}
                {Math.round(item.per.kcal)} kcal {perLabel(item.unit)} · P {item.per.protein} g · G {item.per.carbs} g · L {item.per.fat} g
              </p>
            </div>
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

          <Field label={`Quantité (${unitLabel})`} required error={qty && !qtyValid ? "Quantité invalide (entre 0 et 5000)." : null}>
            <div className="relative">
              <Input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="decimal" autoFocus aria-label="Quantité" className="pr-20" />
              <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-ink-400">{unitLabel}</span>
            </div>
          </Field>
          {!!item.portions?.length && (
            <div className="-mt-2 flex flex-wrap gap-2">
              {item.portions.map((p) => (
                <Chip key={p.label} active={quantity === p.qty} onClick={() => setQty(String(p.qty))} className="text-xs">
                  {p.label}
                </Chip>
              ))}
            </div>
          )}

          <div className="grid grid-cols-4 gap-2 rounded-xl border border-ink-700 bg-ink-900 p-3 text-center">
            {[
              ["Calories", totals ? `${Math.round(totals.kcal)}` : "—", "kcal"],
              ["Protéines", totals ? `${totals.protein_g}` : "—", "g"],
              ["Glucides", totals ? `${totals.carbs_g}` : "—", "g"],
              ["Lipides", totals ? `${totals.fat_g}` : "—", "g"],
            ].map(([l, v, u]) => (
              <div key={l} className="min-w-0">
                <p className="truncate text-[11px] uppercase tracking-wider text-ink-500">{l}</p>
                <p className="mt-1 font-display text-xl font-semibold tabular-nums text-white">
                  {String(v).replace(".", ",")}
                  <span className="ml-0.5 text-xs font-normal text-ink-400">{u}</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    );
  }

  /* ---------------- Étape 1 : choix de l'aliment ---------------- */
  return (
    <Modal open={open} onClose={onClose} title="Ajouter un aliment" size="lg">
      <div className="mb-4 grid grid-cols-3 gap-1 rounded-xl border border-ink-700/70 bg-ink-900/80 p-1">
        {(
          [
            ["search", "Rechercher", Search],
            ["scan", "Scanner", ScanLine],
            ["manual", "À la main", PenLine],
          ] as const
        ).map(([k, label, Icon]) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              setMode(k);
              if (k === "scan") {
                setScanState(null);
                setScanKey((n) => n + 1);
              }
            }}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[13px] font-medium transition",
              mode === k ? "bg-royal-600 text-white" : "text-ink-400 hover:bg-ink-800 hover:text-ink-100",
            )}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {mode === "search" && (
        <div className="space-y-4">
          <form
            className="relative"
            onSubmit={(e) => {
              e.preventDefault();
              runOff();
            }}
          >
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
            <Input
              ref={searchRef}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setOffError(null);
              }}
              placeholder="Riz, poulet, skyr, une marque…"
              className="pl-10"
              autoFocus
              enterKeyHint="search"
              aria-label="Rechercher un aliment"
            />
          </form>

          {!!recentMatches.length && (
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-400">
                <Clock className="h-3.5 w-3.5" /> Déjà utilisés
              </p>
              <ul className="divide-y divide-ink-750 overflow-hidden rounded-xl border border-ink-700">
                {recentMatches.map((f) => (
                  <FoodRow key={`r-${f.name}-${f.brand}-${f.unit}`} item={f} onClick={() => choose(f)} />
                ))}
              </ul>
            </div>
          )}

          {q.trim() && (
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-400">
                <Sprout className="h-3.5 w-3.5" /> Aliments de base
              </p>
              {base.length ? (
                <ul className="divide-y divide-ink-750 overflow-hidden rounded-xl border border-ink-700">
                  {base.map((f) => (
                    <FoodRow key={f.key} item={f} onClick={() => choose(f)} />
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-500">Aucun aliment de base ne correspond.</p>
              )}
            </div>
          )}

          {q.trim().length >= 2 && (
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-400">
                <ShoppingBasket className="h-3.5 w-3.5" /> Produits du commerce
              </p>
              {off?.q === q.trim() ? (
                off.items.length ? (
                  <ul className="divide-y divide-ink-750 overflow-hidden rounded-xl border border-ink-700">
                    {off.items.map((f, i) => (
                      <FoodRow key={`o-${f.barcode ?? i}-${f.name}`} item={f} onClick={() => choose(f)} />
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-ink-500">Aucun produit trouvé. Essaie un autre mot ou ajoute-le à la main.</p>
                )
              ) : (
                <Button variant="secondary" onClick={runOff} loading={offLoading} className="h-auto min-h-10 w-full py-2">
                  {!offLoading && <Search className="h-4 w-4" />} Chercher « {q.trim()} » dans les produits du commerce
                </Button>
              )}
              {offError && <p className="mt-2 text-sm text-red-300">{offError}</p>}
              <p className="mt-2 text-[11px] text-ink-500">Données produits : Open Food Facts (base collaborative).</p>
            </div>
          )}

          {!q.trim() && !recentMatches.length && (
            <p className="py-6 text-center text-sm text-ink-400">
              Tape le nom d&apos;un aliment, scanne un code-barres, ou ajoute-le à la main.
            </p>
          )}
        </div>
      )}

      {mode === "scan" &&
        (scanState ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            {scanState.status === "loading" ? (
              <>
                <Spinner className="h-6 w-6" />
                <p className="text-sm text-ink-300">Recherche du produit {scanState.code}…</p>
              </>
            ) : (
              <>
                <p className="text-sm text-ink-200">
                  {scanState.status === "notfound"
                    ? `Le produit ${scanState.code} n'est pas encore dans la base Open Food Facts.`
                    : scanState.msg}
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setScanState(null);
                      setScanKey((n) => n + 1);
                    }}
                  >
                    <ScanLine className="h-4 w-4" /> Scanner à nouveau
                  </Button>
                  <Button
                    onClick={() => {
                      setMan((m) => ({ ...m, barcode: scanState.code }));
                      setMode("manual");
                      setScanState(null);
                    }}
                  >
                    <PenLine className="h-4 w-4" /> Saisir à la main
                  </Button>
                </div>
              </>
            )}
          </div>
        ) : (
          <BarcodeScanner key={scanKey} onDetected={onScan} />
        ))}

      {mode === "manual" && (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            continueManual();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nom de l'aliment" required>
              <Input value={man.name} onChange={(e) => setMan({ ...man, name: e.target.value })} placeholder="Ex. Lasagnes maison" maxLength={160} aria-label="Nom de l'aliment" />
            </Field>
            <Field label="Marque" hint="Facultatif">
              <Input value={man.brand} onChange={(e) => setMan({ ...man, brand: e.target.value })} maxLength={120} />
            </Field>
          </div>
          <div>
            <p className="label">Les valeurs sont indiquées…</p>
            <div className="flex flex-wrap gap-2">
              {(["g", "ml", "portion"] as FoodUnit[]).map((u) => (
                <Chip key={u} active={man.unit === u} onClick={() => setMan({ ...man, unit: u })}>
                  {perLabel(u)}
                </Chip>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(
              [
                ["kcal", "Calories (kcal)"],
                ["protein", "Protéines (g)"],
                ["carbs", "Glucides (g)"],
                ["fat", "Lipides (g)"],
              ] as const
            ).map(([k, label]) => (
              <Field key={k} label={label}>
                <Input value={man[k]} onChange={(e) => setMan({ ...man, [k]: e.target.value })} inputMode="decimal" placeholder="0" aria-label={label} />
              </Field>
            ))}
          </div>
          <p className="text-xs text-ink-500">
            Astuce : ces informations sont sur l&apos;étiquette, dans le tableau « valeurs nutritionnelles ». Si tu laisses les calories vides, elles sont calculées à partir des macros.
          </p>
          {manErr && <p className="text-sm text-red-300">{manErr}</p>}
          <div className="flex justify-end">
            <Button type="submit">Continuer</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
