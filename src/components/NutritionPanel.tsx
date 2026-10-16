"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Copy, MessageSquare, Pencil, Plus, Target, Trash2, Utensils } from "lucide-react";
import { Button, Card, EmptyState, ErrorBlock, LoadingBlock, StatCard } from "./ui";
import { TimeChart } from "./charts";
import { FoodPicker } from "./FoodPicker";
import { NutritionTargetsForm } from "./NutritionTargetsForm";
import { useToast } from "./toast";
import { cn } from "@/lib/cn";
import { useMode } from "@/lib/mode";
import { getSupabase } from "@/lib/supabase/client";
import { unwrap, useAsync } from "@/lib/hooks";
import { errorMessage, parseDate, todayISO } from "@/lib/format";
import { fmtKcal, fmtQty, MEALS, sumMacros, type FoodEntry, type Meal, type NutritionTarget } from "@/lib/nutrition";

function shiftISO(d: string, days: number): string {
  const x = parseDate(d);
  x.setDate(x.getDate() + days);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}

function dayLabel(d: string): string {
  const t = todayISO();
  if (d === t) return "Aujourd'hui";
  if (d === shiftISO(t, -1)) return "Hier";
  const s = parseDate(d).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const fr = (n: number) => String(Math.round(n)).replace(".", ",");

function Ring({ value, target }: { value: number; target: number | null }) {
  const pct = target ? value / target : 0;
  const over = target !== null && pct > 1.05;
  const r = 52;
  const c = 2 * Math.PI * r;
  const dash = Math.min(1, pct) * c;
  return (
    <div className="relative h-36 w-36 shrink-0">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="currentColor" strokeWidth="10" className="text-ink-700" />
        {target && (
          <circle
            cx="60"
            cy="60"
            r={r}
            fill="none"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c}`}
            className={cn("transition-[stroke-dasharray] duration-700", over ? "stroke-amber-400" : "stroke-royal-500")}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="font-display text-3xl font-semibold leading-none tabular-nums text-white">{fr(value)}</span>
        <span className="mt-1 text-[11px] text-ink-400">{target ? `/ ${fr(target)} kcal` : "kcal"}</span>
      </div>
    </div>
  );
}

function MacroBar({ label, value, target, color }: { label: string; value: number; target: number | null; color: string }) {
  const pct = target ? Math.min(100, (value / target) * 100) : 0;
  const over = target !== null && value > target * 1.1;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium text-ink-200">{label}</span>
        <span className="tabular-nums text-ink-300">
          <strong className={cn("text-white", over && "text-amber-300")}>{fr(value)}</strong>
          {target !== null ? ` / ${fr(target)} g` : " g"}
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-ink-700">
        <div className={cn("h-full rounded-full transition-[width] duration-700", over ? "bg-amber-400" : color)} style={{ width: `${target ? pct : 0}%` }} />
      </div>
    </div>
  );
}

function isMissingTable(msg: string | null) {
  return !!msg && /food_entries|nutrition_targets|schema cache/i.test(msg);
}

export function NutritionPanel({ clientId }: { clientId: string }) {
  const toast = useToast();
  const isClient = useMode() === "client";
  const [date, setDate] = useState(todayISO());
  const [picker, setPicker] = useState<{ meal: Meal; editing?: FoodEntry | null } | null>(null);
  const [targetsOpen, setTargetsOpen] = useState(false);
  const [copying, setCopying] = useState(false);

  const target = useAsync(async () => {
    const res = await getSupabase().from("nutrition_targets").select("*").eq("client_id", clientId).maybeSingle();
    return unwrap(res) as NutritionTarget | null;
  }, [clientId]);

  const day = useAsync(async () => {
    const sb = getSupabase();
    const [cur, prev] = await Promise.all([
      sb.from("food_entries").select("*").eq("client_id", clientId).eq("eaten_on", date).order("created_at"),
      sb.from("food_entries").select("id", { count: "exact", head: true }).eq("client_id", clientId).eq("eaten_on", shiftISO(date, -1)),
    ]);
    return { entries: unwrap(cur) as FoodEntry[], prevCount: prev.count ?? 0 };
  }, [clientId, date]);

  const history = useAsync(async () => {
    const from = shiftISO(todayISO(), -29);
    const res = await getSupabase()
      .from("food_entries")
      .select("eaten_on, kcal, protein_g, carbs_g, fat_g")
      .eq("client_id", clientId)
      .gte("eaten_on", from)
      .order("eaten_on");
    return unwrap(res) as Pick<FoodEntry, "eaten_on" | "kcal" | "protein_g" | "carbs_g" | "fat_g">[];
  }, [clientId]);

  function refresh() {
    day.reload();
    history.reload();
  }

  async function remove(e: FoodEntry) {
    const { error } = await getSupabase().from("food_entries").delete().eq("id", e.id);
    if (error) return toast.error(errorMessage(error));
    toast.success("Aliment retiré.");
    refresh();
  }

  async function copyPrevious() {
    setCopying(true);
    const sb = getSupabase();
    const { data, error } = await sb.from("food_entries").select("*").eq("client_id", clientId).eq("eaten_on", shiftISO(date, -1)).order("created_at");
    if (error || !data) {
      setCopying(false);
      return toast.error(errorMessage(error));
    }
    const rows = (data as FoodEntry[]).map((e) => ({
      client_id: clientId,
      eaten_on: date,
      meal: e.meal,
      name: e.name,
      brand: e.brand,
      barcode: e.barcode,
      source: e.source,
      unit: e.unit,
      quantity: e.quantity,
      kcal: e.kcal,
      protein_g: e.protein_g,
      carbs_g: e.carbs_g,
      fat_g: e.fat_g,
    }));
    const res = await sb.from("food_entries").insert(rows);
    setCopying(false);
    if (res.error) return toast.error(errorMessage(res.error));
    toast.success(`${rows.length} aliment(s) copié(s) depuis la veille.`);
    refresh();
  }

  const err = target.error ?? day.error;
  if (isMissingTable(err)) {
    return (
      <Card>
        <EmptyState
          icon={<Utensils className="h-6 w-6" />}
          title="Le suivi alimentaire n'est pas encore activé"
          text={
            isClient
              ? "Ton coach doit encore activer cette fonctionnalité."
              : "Une petite étape est nécessaire dans Supabase : exécuter le fichier supabase/migrations/20261016000006_nutrition.sql dans le SQL Editor."
          }
        />
      </Card>
    );
  }
  if (err) return <ErrorBlock message={err} onRetry={() => (target.reload(), day.reload())} />;
  if (target.loading || day.loading || !day.data) return <LoadingBlock />;

  const t = target.data;
  const entries = day.data.entries;
  const total = sumMacros(entries);
  const remaining = t ? t.kcal - total.kcal : null;

  // Historique : totaux par jour réellement renseigné
  const byDay = new Map<string, ReturnType<typeof sumMacros>>();
  for (const e of history.data ?? []) byDay.set(e.eaten_on, sumMacros([byDay.get(e.eaten_on) ?? { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }, e]));
  const daysData = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([d, m]) => ({ date: d, kcal: Math.round(m.kcal), protein: Math.round(m.protein_g) }));
  const last7 = daysData.filter((x) => x.date >= shiftISO(todayISO(), -6));
  const avg = (k: "kcal" | "protein") => (last7.length ? Math.round(last7.reduce((a, x) => a + x[k], 0) / last7.length) : null);

  return (
    <div className="space-y-5">
      {/* Navigation par jour */}
      <div className="flex items-center justify-between gap-2 rounded-2xl border border-ink-700/70 bg-ink-900/80 p-1.5">
        <Button variant="ghost" size="icon" onClick={() => setDate(shiftISO(date, -1))} aria-label="Jour précédent">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex min-w-0 flex-1 flex-col items-center">
          <label className="relative cursor-pointer">
            <span className="h-display block truncate text-lg text-white">{dayLabel(date)}</span>
            <input
              type="date"
              value={date}
              max={todayISO()}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              onClick={(e) => {
                try {
                  (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.();
                } catch {
                  /* navigateur sans showPicker */
                }
              }}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              aria-label="Choisir une date"
            />
          </label>
          {date !== todayISO() && (
            <button type="button" onClick={() => setDate(todayISO())} className="text-xs text-royal-300 hover:text-royal-200">
              Revenir à aujourd&apos;hui
            </button>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={() => setDate(shiftISO(date, 1))} disabled={date >= todayISO()} aria-label="Jour suivant">
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Bilan du jour */}
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
            <Ring value={total.kcal} target={t?.kcal ?? null} />
            <div className="w-full min-w-0 flex-1 space-y-3">
              <p className="text-sm text-ink-300">
                {t ? (
                  remaining! >= 0 ? (
                    <>
                      Encore <strong className="text-white">{fmtKcal(remaining!)}</strong> disponibles
                    </>
                  ) : (
                    <>
                      Objectif dépassé de <strong className="text-amber-300">{fmtKcal(-remaining!)}</strong>
                    </>
                  )
                ) : (
                  <>{isClient ? "Ton coach n'a pas encore fixé tes objectifs." : "Aucun objectif fixé pour ce client."}</>
                )}
              </p>
              <MacroBar label="Protéines" value={total.protein_g} target={t ? Number(t.protein_g) : null} color="bg-royal-500" />
              <MacroBar label="Glucides" value={total.carbs_g} target={t ? Number(t.carbs_g) : null} color="bg-sky-400" />
              <MacroBar label="Lipides" value={total.fat_g} target={t ? Number(t.fat_g) : null} color="bg-indigo-400" />
            </div>
          </div>
        </Card>

        <Card
          title={isClient ? "Mes objectifs" : "Objectifs du client"}
          actions={
            !isClient && (
              <Button size="sm" variant={t ? "secondary" : "primary"} onClick={() => setTargetsOpen(true)}>
                {t ? <Pencil className="h-4 w-4" /> : <Target className="h-4 w-4" />} {t ? "Modifier" : "Définir"}
              </Button>
            )
          }
        >
          {t ? (
            <div className="space-y-3">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-ink-400">Calories</dt>
                <dd className="text-right font-semibold text-white">{fmtKcal(t.kcal)}</dd>
                <dt className="text-ink-400">Protéines</dt>
                <dd className="text-right text-ink-100">{fr(Number(t.protein_g))} g</dd>
                <dt className="text-ink-400">Glucides</dt>
                <dd className="text-right text-ink-100">{fr(Number(t.carbs_g))} g</dd>
                <dt className="text-ink-400">Lipides</dt>
                <dd className="text-right text-ink-100">{fr(Number(t.fat_g))} g</dd>
              </dl>
              {t.note && (
                <p className="flex gap-2 rounded-xl border border-ink-700 bg-ink-900 p-3 text-sm text-ink-200">
                  <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-royal-400" />
                  <span className="whitespace-pre-line">{t.note}</span>
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-ink-400">
              {isClient
                ? "Tu peux déjà noter ce que tu manges : tes totaux s'affichent au-dessus."
                : "Définis les calories et les macros : l'application propose un calcul à partir du bilan de départ et de la dernière pesée."}
            </p>
          )}
        </Card>
      </div>

      {/* Repas */}
      {entries.length === 0 && day.data.prevCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-ink-600 px-4 py-3 text-sm text-ink-300">
          <span>Tu manges souvent la même chose ? Reprends les repas de la veille en un clic.</span>
          <Button size="sm" variant="secondary" onClick={copyPrevious} loading={copying}>
            {!copying && <Copy className="h-4 w-4" />} Copier la veille
          </Button>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {MEALS.map((m) => {
          const list = entries.filter((e) => e.meal === m.key);
          const sub = sumMacros(list);
          return (
            <Card
              key={m.key}
              padded={false}
              title={
                <span className="flex items-baseline gap-2">
                  {m.label}
                  {list.length > 0 && <span className="font-sans text-xs font-normal tracking-normal text-ink-400">{fmtKcal(sub.kcal)}</span>}
                </span>
              }
              actions={
                <Button size="sm" variant="ghost" onClick={() => setPicker({ meal: m.key })} aria-label={`Ajouter au ${m.label}`}>
                  <Plus className="h-4 w-4" /> Ajouter
                </Button>
              }
            >
              {list.length === 0 ? (
                <button
                  type="button"
                  onClick={() => setPicker({ meal: m.key })}
                  className="w-full px-4 py-5 text-center text-sm text-ink-500 transition hover:bg-ink-800 hover:text-ink-300 sm:px-5"
                >
                  Rien de noté pour l&apos;instant
                </button>
              ) : (
                <ul className="divide-y divide-ink-750">
                  {list.map((e) => (
                    <li key={e.id} className="group flex items-center gap-2 px-4 py-2.5 sm:px-5">
                      <button type="button" onClick={() => setPicker({ meal: e.meal, editing: e })} className="min-w-0 flex-1 text-left">
                        <span className="block truncate text-sm font-medium text-ink-100">
                          {e.name}
                          {e.brand && <span className="font-normal text-ink-400"> · {e.brand}</span>}
                        </span>
                        <span className="block truncate text-xs text-ink-400">
                          {fmtQty(e.unit, e.quantity)} · P {fr(Number(e.protein_g))} · G {fr(Number(e.carbs_g))} · L {fr(Number(e.fat_g))}
                        </span>
                      </button>
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-white">{fr(Number(e.kcal))}</span>
                      <Button variant="ghost" size="icon" onClick={() => remove(e)} aria-label={`Retirer ${e.name}`} className="shrink-0 text-ink-500 hover:text-red-300">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          );
        })}
      </div>

      {/* Tendance */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Moyenne 7 jours" value={avg("kcal") !== null ? `${avg("kcal")!.toLocaleString("fr-FR")}` : "—"} hint={t ? `objectif ${fmtKcal(t.kcal)}` : "kcal / jour renseigné"} />
        <StatCard label="Protéines moy. 7 j" value={avg("protein") !== null ? `${avg("protein")} g` : "—"} hint={t ? `objectif ${fr(Number(t.protein_g))} g` : undefined} />
        <StatCard label="Jours renseignés" value={`${last7.length} / 7`} hint="sur les 7 derniers jours" />
      </div>
      <Card title="Calories des 30 derniers jours">
        {daysData.length >= 2 ? (
          <TimeChart
            data={daysData}
            series={[{ key: "kcal", label: "Calories" }]}
            unit="kcal"
            references={t ? [{ y: t.kcal, label: `Objectif ${t.kcal}` }] : []}
          />
        ) : (
          <p className="py-6 text-center text-sm text-ink-400">La courbe apparaîtra après au moins deux journées renseignées.</p>
        )}
      </Card>

      {picker && (
        <FoodPicker
          open
          onClose={() => setPicker(null)}
          clientId={clientId}
          date={date}
          defaultMeal={picker.meal}
          editing={picker.editing}
          onSaved={refresh}
        />
      )}
      {!isClient && (
        <NutritionTargetsForm open={targetsOpen} onClose={() => setTargetsOpen(false)} clientId={clientId} current={t} onSaved={target.reload} />
      )}
    </div>
  );
}
