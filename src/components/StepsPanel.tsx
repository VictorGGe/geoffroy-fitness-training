"use client";

import { useState } from "react";
import { Activity, Footprints, Pencil, Smartphone, Square, Target } from "lucide-react";
import { Button, Card, EmptyState, ErrorBlock, Field, Input, LoadingBlock, Modal } from "./ui";
import { KcalChip } from "./KcalChip";
import { useToast } from "./toast";
import { cn } from "@/lib/cn";
import { useMode } from "@/lib/mode";
import { getSupabase } from "@/lib/supabase/client";
import { unwrap, useAsync } from "@/lib/hooks";
import { errorMessage, parseDate, todayISO } from "@/lib/format";
import { useClientWeight } from "@/lib/calories";
import { usePedometer } from "@/lib/pedometer";

interface DayRow {
  day: string;
  steps: number;
  source: "manuel" | "capteur";
}

const DEFAULT_GOAL = 8000;

function shift(day: string, n: number): string {
  const d = parseDate(day);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const fmt = (n: number) => Math.round(n).toLocaleString("fr-FR");
/** ~0,04 kcal par pas pour 80 kg (0,0005 × poids). */
const stepKcal = (steps: number, kg: number) => steps * 0.0005 * kg;

function isMissing(msg: string | null) {
  return !!msg && /daily_steps|step_goals|schema cache/i.test(msg);
}

export function StepsPanel({ clientId, compact = false }: { clientId: string; compact?: boolean }) {
  const toast = useToast();
  const isClient = useMode() === "client";
  const today = todayISO();
  const [day, setDay] = useState(today);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [counterOpen, setCounterOpen] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);
  const weight = useClientWeight(clientId, !isClient);

  const { data, loading, error, reload } = useAsync(async () => {
    const sb = getSupabase();
    const [rows, goal] = await Promise.all([
      sb.from("daily_steps").select("day, steps, source").eq("client_id", clientId).gte("day", shift(today, -29)).order("day"),
      sb.from("step_goals").select("daily_goal").eq("client_id", clientId).maybeSingle(),
    ]);
    return { rows: unwrap(rows) as DayRow[], goal: (unwrap(goal) as { daily_goal: number } | null)?.daily_goal ?? null };
  }, [clientId]);

  if (isMissing(error)) {
    return compact ? null : (
      <Card>
        <EmptyState
          icon={<Footprints className="h-6 w-6" />}
          title="Le podomètre n'est pas encore activé"
          text={isClient ? "Ton coach doit encore activer cette fonctionnalité." : "Exécute le fichier supabase/migrations/20261024000010_steps.sql dans Supabase > SQL Editor."}
        />
      </Card>
    );
  }
  if (error) return compact ? null : <ErrorBlock message={error} onRetry={reload} />;
  if (loading || !data) return compact ? null : <LoadingBlock />;

  const byDay = new Map(data.rows.map((r) => [r.day, r]));
  const goal = data.goal ?? DEFAULT_GOAL;
  const todaySteps = byDay.get(today)?.steps ?? 0;
  const pct = Math.min(1, todaySteps / goal);
  const last7 = Array.from({ length: 7 }, (_, i) => shift(today, i - 6));
  const last14 = Array.from({ length: 14 }, (_, i) => shift(today, i - 13));
  const filled7 = last7.map((d) => byDay.get(d)?.steps).filter((v): v is number => v != null);
  const avg7 = filled7.length ? filled7.reduce((a, b) => a + b, 0) / filled7.length : null;
  const reached7 = filled7.filter((v) => v >= goal).length;
  const maxBar = Math.max(goal, ...last14.map((d) => byDay.get(d)?.steps ?? 0)) * 1.08;

  async function saveSteps(targetDay: string, steps: number, source: "manuel" | "capteur") {
    const { error: e } = await getSupabase()
      .from("daily_steps")
      .upsert({ client_id: clientId, day: targetDay, steps: Math.max(0, Math.min(150000, Math.round(steps))), source }, { onConflict: "client_id,day" });
    if (e) throw e;
  }

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const n = Number(value.replace(/[\s. ]/g, ""));
    if (!Number.isFinite(n) || n < 0 || n > 150000) return toast.error("Nombre de pas invalide.");
    setSaving(true);
    try {
      await saveSteps(day, n, "manuel");
      toast.success(`${fmt(n)} pas enregistrés.`);
      setValue("");
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const R = 46;
  const C = 2 * Math.PI * R;

  return (
    <div className={cn("space-y-4", compact && "mb-5")}>
      <Card
        title={
          <span className="flex items-center gap-2">
            <Footprints className="h-4 w-4 text-royal-400" /> {isClient ? "Mes pas" : "Pas quotidiens"}
          </span>
        }
        actions={
          !isClient && (
            <Button size="sm" variant="ghost" onClick={() => setGoalOpen(true)}>
              <Target className="h-4 w-4" /> Objectif
            </Button>
          )
        }
      >
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="relative mx-auto h-32 w-32 shrink-0">
            <svg viewBox="0 0 110 110" className="h-full w-full -rotate-90">
              <circle cx="55" cy="55" r={R} fill="none" strokeWidth="10" className="stroke-ink-700" />
              <circle
                cx="55"
                cy="55"
                r={R}
                fill="none"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${pct * C} ${C}`}
                className={cn("transition-[stroke-dasharray] duration-700", pct >= 1 ? "stroke-emerald-400" : "stroke-royal-500")}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="font-display text-2xl font-semibold tabular-nums leading-none text-white">{fmt(todaySteps)}</span>
              <span className="mt-1 text-[11px] text-ink-400">/ {fmt(goal)} pas</span>
            </div>
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <p className="text-sm text-ink-300">
              {todaySteps >= goal ? (
                <strong className="text-emerald-300">Objectif du jour atteint, bravo !</strong>
              ) : (
                <>
                  Encore <strong className="text-white">{fmt(goal - todaySteps)} pas</strong> pour l&apos;objectif du jour
                  {data.goal == null && <span className="text-ink-500"> (objectif conseillé)</span>}.
                </>
              )}
              {!isClient && <KcalChip kcal={stepKcal(todaySteps, weight.kg)} className="ml-2 align-middle" />}
            </p>
            <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
              <Field label={day === today ? "Pas d'aujourd'hui (total)" : "Pas du jour choisi (total)"} className="min-w-[8rem] flex-1">
                <Input value={value} onChange={(e) => setValue(e.target.value)} inputMode="numeric" placeholder={todaySteps ? String(todaySteps) : "8000"} aria-label="Nombre de pas" />
              </Field>
              <Input
                type="date"
                value={day}
                max={today}
                onChange={(e) => e.target.value && setDay(e.target.value)}
                className="w-auto"
                aria-label="Jour"
              />
              <Button type="submit" loading={saving}>
                Enregistrer
              </Button>
            </form>
            <p className="text-xs text-ink-500">
              Astuce : recopie le total affiché par l&apos;appli <strong>Santé</strong> (iPhone) ou <strong>Google Fit</strong> (Android), ou compte tes pas en direct pendant une marche.
            </p>
            <Button variant="secondary" size="sm" onClick={() => setCounterOpen(true)}>
              <Smartphone className="h-4 w-4" /> Compter mes pas maintenant
            </Button>
          </div>
        </div>
      </Card>

      <>
          {!compact && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="card p-4">
              <p className="text-[12px] font-medium uppercase tracking-wider text-ink-400">Moyenne 7 jours</p>
              <p className="mt-2 font-display text-3xl font-semibold text-white">{avg7 != null ? fmt(avg7) : "—"}</p>
              {!isClient && avg7 != null && <KcalChip kcal={stepKcal(avg7, weight.kg)} className="mt-2" title="Dépense moyenne liée aux pas (visible uniquement par toi)" />}
            </div>
            <div className="card p-4">
              <p className="text-[12px] font-medium uppercase tracking-wider text-ink-400">Objectif atteint</p>
              <p className="mt-2 font-display text-3xl font-semibold text-white">
                {reached7} / 7 <span className="text-sm font-normal text-ink-400">jours</span>
              </p>
            </div>
            <div className="card p-4">
              <p className="text-[12px] font-medium uppercase tracking-wider text-ink-400">Objectif</p>
              <p className="mt-2 font-display text-3xl font-semibold text-white">
                {fmt(goal)} <span className="text-sm font-normal text-ink-400">pas / jour</span>
              </p>
            </div>
          </div>
          )}

          <Card title="14 derniers jours">
            <div className="relative">
              <div
                className="pointer-events-none absolute inset-x-0 border-t border-dashed border-emerald-400/70"
                style={{ bottom: `${(goal / maxBar) * 160 + 22}px` }}
              >
                <span className="absolute -top-4 right-0 text-[10px] text-emerald-300">objectif {fmt(goal)}</span>
              </div>
              <div className="flex h-[182px] items-end gap-1 sm:gap-2">
                {last14.map((d) => {
                  const v = byDay.get(d)?.steps ?? 0;
                  const dd = parseDate(d);
                  return (
                    <div key={d} className="flex min-w-0 flex-1 flex-col items-center gap-1" title={`${dd.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })} : ${fmt(v)} pas`}>
                      <div className="flex h-[160px] w-full items-end">
                        <div
                          className={cn("w-full rounded-t-md transition-[height] duration-700", v >= goal ? "bg-emerald-400" : v ? "bg-royal-500" : "bg-ink-700")}
                          style={{ height: v ? `${Math.max(3, (v / maxBar) * 160)}px` : "3px" }}
                        />
                      </div>
                      <span className={cn("text-[10px] tabular-nums", d === today ? "font-semibold text-royal-300" : "text-ink-500")}>{dd.getDate()}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
      </>

      {counterOpen && (
        <LiveCounter
          onClose={() => setCounterOpen(false)}
          onAdd={async (n) => {
            try {
              await saveSteps(today, todaySteps + n, "capteur");
              toast.success(`${fmt(n)} pas ajoutés à aujourd'hui.`);
              setCounterOpen(false);
              reload();
            } catch (err) {
              toast.error(errorMessage(err));
            }
          }}
        />
      )}
      {goalOpen && (
        <GoalModal
          current={data.goal}
          onClose={() => setGoalOpen(false)}
          onSave={async (g) => {
            const { error: e } = await getSupabase().from("step_goals").upsert({ client_id: clientId, daily_goal: g }, { onConflict: "client_id" });
            if (e) return toast.error(errorMessage(e));
            toast.success("Objectif de pas enregistré.");
            setGoalOpen(false);
            reload();
          }}
        />
      )}
    </div>
  );
}

function LiveCounter({ onClose, onAdd }: { onClose: () => void; onAdd: (n: number) => Promise<void> }) {
  const p = usePedometer();
  const [adding, setAdding] = useState(false);
  const counting = p.status === "counting";
  return (
    <Modal
      open
      onClose={() => {
        p.stop();
        onClose();
      }}
      title="Compter mes pas"
      size="sm"
      footer={
        p.steps > 0 && !counting ? (
          <Button
            loading={adding}
            onClick={async () => {
              setAdding(true);
              await onAdd(p.steps);
              setAdding(false);
            }}
          >
            Ajouter {p.steps.toLocaleString("fr-FR")} pas à aujourd&apos;hui
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-5 text-center">
        <div className={cn("rounded-3xl border p-6", counting ? "border-royal-600/50 bg-royal-600/10" : "border-ink-700 bg-ink-900")}>
          <Activity className={cn("mx-auto h-6 w-6", counting ? "animate-pulse text-royal-300" : "text-ink-500")} />
          <p className="mt-2 font-display text-6xl font-semibold tabular-nums text-white" aria-label="Pas comptés">
            {p.steps.toLocaleString("fr-FR")}
          </p>
          <p className="text-sm text-ink-400">pas</p>
        </div>
        {p.status === "unsupported" && <p className="text-sm text-red-300">Aucun capteur de mouvement détecté. Utilise un téléphone, ou recopie tes pas depuis l&apos;appli Santé / Google Fit.</p>}
        {p.status === "denied" && <p className="text-sm text-red-300">Accès aux mouvements refusé. Autorise « Mouvement et orientation » pour ce site dans les réglages du navigateur.</p>}
        {counting ? (
          <Button size="lg" variant="danger" className="w-full" onClick={p.stop}>
            <Square className="h-5 w-5" /> Arrêter
          </Button>
        ) : (
          <Button size="lg" className="w-full" onClick={p.start}>
            <Footprints className="h-5 w-5" /> {p.steps ? "Reprendre" : "Démarrer"}
          </Button>
        )}
        <p className="text-xs leading-relaxed text-ink-500">
          Garde le téléphone en main ou dans une poche, écran allumé et cette page ouverte : un site web ne peut pas compter quand l&apos;écran est verrouillé.
        </p>
      </div>
    </Modal>
  );
}

function GoalModal({ current, onClose, onSave }: { current: number | null; onClose: () => void; onSave: (g: number) => Promise<void> }) {
  const [v, setV] = useState(String(current ?? DEFAULT_GOAL));
  const [busy, setBusy] = useState(false);
  const n = Number(v.replace(/\s/g, ""));
  const ok = Number.isInteger(n) && n >= 1000 && n <= 50000;
  return (
    <Modal
      open
      onClose={onClose}
      title="Objectif de pas"
      size="sm"
      footer={
        <Button
          disabled={!ok}
          loading={busy}
          onClick={async () => {
            setBusy(true);
            await onSave(n);
            setBusy(false);
          }}
        >
          <Pencil className="h-4 w-4" /> Enregistrer
        </Button>
      }
    >
      <div className="space-y-3">
        <Field label="Pas par jour" hint="Repères : 6 000 (reprise), 8 000 à 10 000 (perte de poids), 12 000 et plus (très actif).">
          <Input value={v} onChange={(e) => setV(e.target.value)} inputMode="numeric" aria-label="Objectif de pas" autoFocus />
        </Field>
        <div className="flex flex-wrap gap-2">
          {[6000, 8000, 10000, 12000].map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setV(String(g))}
              className={cn("rounded-lg border px-3 py-1.5 text-sm", n === g ? "border-royal-500 bg-royal-600/20 text-white" : "border-ink-700 text-ink-300")}
            >
              {g.toLocaleString("fr-FR")}
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
