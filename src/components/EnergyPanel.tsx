"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Dumbbell, Flame, Footprints, Scale, Utensils } from "lucide-react";
import { Button, Card, ErrorBlock, LoadingBlock } from "./ui";
import { cn } from "@/lib/cn";
import { useMode } from "@/lib/mode";
import { useAsync } from "@/lib/hooks";
import { parseDate } from "@/lib/format";
import { isoDay, loadWeekEnergy, mondayOf, type DayEnergy } from "@/lib/energy";

const fmt = (n: number) => Math.round(n).toLocaleString("fr-FR");
const DAY = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function activity(d: DayEnergy) {
  return d.sessionsKcal + d.stepsKcal;
}

export function EnergyPanel({ clientId, compact = false }: { clientId: string; compact?: boolean }) {
  const isClient = useMode() === "client";
  const [monday, setMonday] = useState(() => mondayOf(new Date()));
  const today = isoDay(new Date());
  const { data, loading, error, reload } = useAsync(() => loadWeekEnergy(clientId, monday, isClient), [clientId, monday.getTime(), isClient]);

  if (error) return compact ? null : <ErrorBlock message={error} onRetry={reload} />;
  if (loading || !data) return compact ? null : <LoadingBlock />;

  const past = data.days.filter((d) => d.day <= today); // jours écoulés de la semaine
  const sessionsKcal = data.days.reduce((n, d) => n + d.sessionsKcal, 0);
  const stepsKcal = data.days.reduce((n, d) => n + d.stepsKcal, 0);
  const nSessions = data.days.reduce((n, d) => n + d.sessions.length, 0);
  const totalSteps = data.days.reduce((n, d) => n + (d.steps ?? 0), 0);
  const activityKcal = sessionsKcal + stepsKcal;
  const showBase = !isClient && data.bmr != null;
  const totalKcal = showBase ? past.reduce((n, d) => n + (d.baseKcal ?? 0) + activity(d), 0) : null;
  const fed = past.filter((d) => d.intakeKcal != null);
  const intake = fed.reduce((n, d) => n + (d.intakeKcal ?? 0), 0);
  const balance = showBase && fed.length ? fed.reduce((n, d) => n + (d.intakeKcal ?? 0) - (d.baseKcal ?? 0) - activity(d), 0) : null;

  const maxV = Math.max(
    1,
    ...data.days.map((d) => (showBase ? (d.baseKcal ?? 0) : 0) + activity(d)),
    ...(showBase ? data.days.map((d) => d.intakeKcal ?? 0) : []),
  ) * 1.1;
  const H = compact ? 90 : 170;
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  const isCurrent = isoDay(monday) === isoDay(mondayOf(new Date()));
  const label = `${monday.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} – ${sunday.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`;
  const move = (n: number) => setMonday((m) => new Date(m.getFullYear(), m.getMonth(), m.getDate() + 7 * n));

  const chart = (
    <div>
      <div className="flex items-end gap-1.5 sm:gap-3" style={{ height: H + 20 }}>
        {data.days.map((d, i) => {
          const base = showBase ? (d.baseKcal ?? 0) : 0;
          const future = d.day > today;
          const h = (v: number) => (v / maxV) * H;
          return (
            <div
              key={d.day}
              className="flex min-w-0 flex-1 flex-col items-center gap-1"
              title={`${parseDate(d.day).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric" })} : activité ${fmt(activity(d))} kcal${d.intakeKcal != null && showBase ? ` · repas ${fmt(d.intakeKcal)} kcal` : ""}`}
            >
              <div className="relative flex w-full flex-col justify-end" style={{ height: H }}>
                {showBase && d.intakeKcal != null && (
                  <div className="absolute inset-x-0 z-10 border-t-2 border-white/90" style={{ bottom: h(d.intakeKcal) }} />
                )}
                <div className={cn("flex w-full flex-col-reverse overflow-hidden rounded-t-md", future && "opacity-30")}>
                  {showBase && !future && <div className="bg-ink-600" style={{ height: h(base) }} />}
                  <div className="bg-sky-400" style={{ height: h(d.stepsKcal) }} />
                  <div className="bg-amber-400" style={{ height: h(d.sessionsKcal) }} />
                </div>
              </div>
              <span className={cn("text-[10.5px]", d.day === today ? "font-semibold text-royal-300" : "text-ink-500")}>{DAY[i]}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-400">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-amber-400" /> Séances
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-sky-400" /> Pas
        </span>
        {showBase && (
          <>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-ink-600" /> Métabolisme de base
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-3 bg-white" /> Repas notés
            </span>
          </>
        )}
      </div>
    </div>
  );

  if (compact) {
    return (
      <Card
        className="mb-5"
        title={
          <span className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-amber-400" /> Ma dépense cette semaine
          </span>
        }
      >
        <p className="mb-3 text-sm text-ink-300">
          <strong className="font-display text-2xl text-white">{fmt(activityKcal)}</strong> kcal grâce à ton activité · {nSessions} séance{nSessions > 1 ? "s" : ""} ·{" "}
          {fmt(totalSteps)} pas
        </p>
        {chart}
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2 rounded-2xl border border-ink-700/70 bg-ink-900/80 p-1.5">
        <Button variant="ghost" size="icon" onClick={() => move(-1)} aria-label="Semaine précédente">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="text-center">
          <p className="h-display text-lg text-white">{isCurrent ? "Cette semaine" : `Semaine du ${label}`}</p>
          {isCurrent ? (
            <p className="text-xs text-ink-400">{label}</p>
          ) : (
            <button className="text-xs text-royal-300" onClick={() => setMonday(mondayOf(new Date()))}>
              Revenir à cette semaine
            </button>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={() => move(1)} disabled={isCurrent} aria-label="Semaine suivante">
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      <div className={cn("grid grid-cols-1 gap-3", showBase ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2")}>
        <div className="card border-amber-500/40 bg-gradient-to-br from-amber-500/10 to-ink-850 p-4">
          <p className="flex items-center gap-1.5 text-[12px] font-medium uppercase tracking-wider text-ink-400">
            <Flame className="h-3.5 w-3.5 text-amber-400" /> Activité
          </p>
          <p className="mt-2 font-display text-3xl font-semibold text-white">
            {fmt(activityKcal)} <span className="text-sm font-normal text-ink-400">kcal</span>
          </p>
          <p className="mt-1 text-xs text-ink-400">
            Séances {fmt(sessionsKcal)} · Pas {fmt(stepsKcal)}
          </p>
        </div>
        {showBase && (
          <div className="card p-4">
            <p className="flex items-center gap-1.5 text-[12px] font-medium uppercase tracking-wider text-ink-400">
              <Scale className="h-3.5 w-3.5 text-royal-400" /> Dépense totale
            </p>
            <p className="mt-2 font-display text-3xl font-semibold text-white">
              {fmt(totalKcal ?? 0)} <span className="text-sm font-normal text-ink-400">kcal</span>
            </p>
            <p className="mt-1 text-xs text-ink-400">
              ≈ {fmt((totalKcal ?? 0) / Math.max(1, past.length))} kcal / jour sur {past.length} jour{past.length > 1 ? "s" : ""}
            </p>
          </div>
        )}
        <div className="card p-4">
          <p className="flex items-center gap-1.5 text-[12px] font-medium uppercase tracking-wider text-ink-400">
            <Utensils className="h-3.5 w-3.5 text-royal-400" /> Repas notés
          </p>
          <p className="mt-2 font-display text-3xl font-semibold text-white">
            {fed.length ? fmt(intake) : "—"} {fed.length > 0 && <span className="text-sm font-normal text-ink-400">kcal</span>}
          </p>
          <p className="mt-1 text-xs text-ink-400">
            {fed.length ? `sur ${fed.length} jour${fed.length > 1 ? "s" : ""} renseigné${fed.length > 1 ? "s" : ""}` : "aucun repas noté cette semaine"}
          </p>
        </div>
        {showBase && (
          <div className={cn("card p-4", balance != null && (balance < 0 ? "border-emerald-500/40" : "border-red-500/40"))}>
            <p className="text-[12px] font-medium uppercase tracking-wider text-ink-400">Bilan calorique</p>
            {balance != null ? (
              <>
                <p className={cn("mt-2 font-display text-3xl font-semibold", balance < 0 ? "text-emerald-300" : "text-red-300")}>
                  {balance < 0 ? "−" : "+"}
                  {fmt(Math.abs(balance))} <span className="text-sm font-normal text-ink-400">kcal</span>
                </p>
                <p className="mt-1 text-xs text-ink-400">
                  {balance < 0 ? "Déficit" : "Surplus"} sur les jours avec repas notés, soit ≈ {balance < 0 ? "−" : "+"}
                  {(Math.abs(balance) / 7700).toFixed(2).replace(".", ",")} kg
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-ink-400">Disponible quand des repas sont notés.</p>
            )}
          </div>
        )}
      </div>

      <Card title="Jour par jour">{chart}</Card>

      <Card title="Détail" padded={false}>
        <ul className="divide-y divide-ink-750">
          {data.days.map((d, i) => {
            const empty = !d.sessions.length && !d.steps && d.intakeKcal == null;
            return (
              <li key={d.day} className={cn("flex flex-wrap items-start gap-x-4 gap-y-1 px-4 py-3 sm:px-5", d.day > today && "opacity-40")}>
                <div className="w-20 shrink-0">
                  <p className={cn("text-sm font-semibold", d.day === today ? "text-royal-300" : "text-white")}>
                    {DAY[i]} {parseDate(d.day).getDate()}
                  </p>
                  {showBase && d.day <= today && <p className="text-[11px] text-ink-500">{fmt((d.baseKcal ?? 0) + activity(d))} kcal</p>}
                </div>
                <div className="min-w-0 flex-1 space-y-1 text-sm">
                  {d.sessions.map((s, k) => (
                    <p key={k} className="flex items-center gap-2 text-ink-200">
                      <Dumbbell className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                      <span className="truncate">{s.name}</span>
                      <span className="ml-auto shrink-0 tabular-nums text-amber-300">{fmt(s.kcal)} kcal</span>
                    </p>
                  ))}
                  {d.steps != null && (
                    <p className="flex items-center gap-2 text-ink-200">
                      <Footprints className="h-3.5 w-3.5 shrink-0 text-sky-400" />
                      {fmt(d.steps)} pas
                      <span className="ml-auto shrink-0 tabular-nums text-sky-300">{fmt(d.stepsKcal)} kcal</span>
                    </p>
                  )}
                  {d.intakeKcal != null && (
                    <p className="flex items-center gap-2 text-ink-400">
                      <Utensils className="h-3.5 w-3.5 shrink-0" />
                      Repas notés
                      <span className="ml-auto shrink-0 tabular-nums">{fmt(d.intakeKcal)} kcal</span>
                    </p>
                  )}
                  {empty && <p className="text-ink-500">{d.day > today ? "À venir" : "Rien de noté"}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      <p className="text-xs leading-relaxed text-ink-500">
        Estimations (±20 %) calculées pour {String(data.kg).replace(".", ",")} kg
        {data.weightSource === "défaut" ? " (poids par défaut, aucune pesée)" : data.weightSource === "bilan" ? " (poids du bilan)" : " (dernière pesée)"}.
        {showBase && ` Métabolisme de base : ${fmt(data.bmr ?? 0)} kcal/jour (âge, taille et sexe du bilan).`}
        {!isClient && data.bmr == null && " Pour la dépense totale et le bilan calorique, renseigne l'âge, la taille et le sexe dans le bilan de départ."}
        {!data.stepsAvailable && " Podomètre non activé."}
      </p>
    </div>
  );
}
