"use client";

import { useEffect, useMemo, useState } from "react";
import { Flame, Footprints, Gauge, MapPin, Pause, Play, Satellite, Square, Timer, Trash2, Volume2, VolumeX } from "lucide-react";
import { Button, Card, ConfirmDialog, EmptyState, Field, Input, LoadingBlock, Modal, PageHeader, Select, Textarea } from "./ui";
import { Chip } from "./FoodPicker";
import { useToast } from "./toast";
import { cn } from "@/lib/cn";
import { useMode } from "@/lib/mode";
import { getSupabase } from "@/lib/supabase/client";
import { getMyClientProfile } from "@/lib/data";
import { errorMessage, fullName, parseNum } from "@/lib/format";
import { activityOf, estimateCalories, fmtClock, fmtKm, fmtPace, useRunTracker, type Pt, type RunMode, type Split } from "@/lib/run";
import { deleteRun, listRuns, saveRun, type RunRow } from "@/lib/runData";
import type { Client } from "@/lib/types";

/* ------------------------------------------------------------------ */
/* Tracé du parcours (sans carte : simple dessin des positions GPS)     */
/* ------------------------------------------------------------------ */

export function RouteTrace({ route, className }: { route: Pt[][]; className?: string }) {
  const pts = route.flat();
  if (pts.length < 2) return null;
  const lat0 = pts.reduce((n, p) => n + p[0], 0) / pts.length;
  const k = Math.cos((lat0 * Math.PI) / 180);
  const xs = pts.map((p) => p[1] * k);
  const ys = pts.map((p) => -p[0]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const W = 320;
  const H = 220;
  const pad = 14;
  const scale = Math.min((W - 2 * pad) / Math.max(maxX - minX, 1e-9), (H - 2 * pad) / Math.max(maxY - minY, 1e-9));
  const ox = (W - (maxX - minX) * scale) / 2;
  const oy = (H - (maxY - minY) * scale) / 2;
  const proj = (p: Pt) => [ox + (p[1] * k - minX) * scale, oy + (-p[0] - minY) * scale] as const;
  const first = proj(pts[0]);
  const last = proj(pts[pts.length - 1]);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={cn("w-full rounded-xl border border-ink-700 bg-ink-900", className)} role="img" aria-label="Tracé du parcours">
      <defs>
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-ink-800" />
        </pattern>
      </defs>
      <rect width={W} height={H} fill="url(#grid)" />
      {route
        .filter((s) => s.length > 1)
        .map((seg, i) => (
          <polyline
            key={i}
            points={seg.map((p) => proj(p).join(",")).join(" ")}
            fill="none"
            stroke="#2884FB"
            strokeWidth="3.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
      <circle cx={first[0]} cy={first[1]} r="6" fill="#22c55e" stroke="#0b0d12" strokeWidth="2" />
      <circle cx={last[0]} cy={last[1]} r="6" fill="#ef4444" stroke="#0b0d12" strokeWidth="2" />
    </svg>
  );
}

function SplitsTable({ splits }: { splits: Split[] }) {
  if (!splits.length) return null;
  const best = Math.min(...splits.map((s) => s.s));
  return (
    <table className="table-base">
      <thead>
        <tr>
          <th>Km</th>
          <th>Temps</th>
          <th className="w-1/2">Allure</th>
        </tr>
      </thead>
      <tbody>
        {splits.map((s) => (
          <tr key={s.km} className="border-b border-ink-750">
            <td className="px-3 py-2 tabular-nums text-ink-300">{s.km}</td>
            <td className={cn("px-3 py-2 tabular-nums", s.s === best ? "font-semibold text-emerald-300" : "text-white")}>{fmtPace(s.s)} /km</td>
            <td className="px-3 py-2">
              <div className="h-2 rounded-full bg-ink-700">
                <div className="h-full rounded-full bg-royal-500" style={{ width: `${Math.min(100, (best / s.s) * 100)}%` }} />
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Stat({ label, value, unit, icon, big }: { label: string; value: string; unit?: string; icon: React.ReactNode; big?: boolean }) {
  return (
    <div className="rounded-2xl border border-ink-700/70 bg-ink-900/70 p-3 text-center sm:p-4">
      <p className="flex items-center justify-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-ink-400">
        {icon} {label}
      </p>
      <p className={cn("mt-1 font-display font-semibold tabular-nums leading-none text-white", big ? "text-5xl" : "text-3xl")}>
        {value}
        {unit && <span className="ml-1 text-sm font-normal text-ink-400">{unit}</span>}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

export function RunPage() {
  const toast = useToast();
  const isClient = useMode() === "client";
  const [voice, setVoice] = useState(true);
  const [mode, setMode] = useState<RunMode>("gps");
  const [clients, setClients] = useState<Pick<Client, "id" | "first_name" | "last_name">[]>([]);
  const [clientId, setClientId] = useState<string>("");
  const [weight, setWeight] = useState("");
  const [runs, setRuns] = useState<RunRow[] | null | undefined>(undefined);
  const [detail, setDetail] = useState<RunRow | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [feeling, setFeeling] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [manualKm, setManualKm] = useState("");
  const [saving, setSaving] = useState(false);
  const t = useRunTracker({ voice });
  const { data } = t;

  // Préférences
  useEffect(() => {
    try {
      setVoice(localStorage.getItem("vt:run-voice") !== "0");
      const m = localStorage.getItem("vt:run-mode");
      if (m === "gps" || m === "tapis") setMode(m);
    } catch {
      /* ignoré */
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("vt:run-voice", voice ? "1" : "0");
      localStorage.setItem("vt:run-mode", mode);
    } catch {
      /* ignoré */
    }
  }, [voice, mode]);

  // Client concerné
  useEffect(() => {
    if (isClient) {
      getMyClientProfile().then((p) => p && setClientId(p.id));
      getSupabase()
        .rpc("my_latest_weight")
        .then(({ data: w }) => w && setWeight(String(w).replace(".", ",")));
    } else {
      getSupabase()
        .from("clients")
        .select("id, first_name, last_name")
        .eq("archived", false)
        .order("first_name")
        .then(({ data: c }) => setClients(c ?? []));
      try {
        const last = localStorage.getItem("vt:run-client");
        if (last) setClientId(last);
      } catch {
        /* ignoré */
      }
    }
  }, [isClient]);

  useEffect(() => {
    if (!clientId) return;
    if (!isClient) {
      try {
        localStorage.setItem("vt:run-client", clientId);
      } catch {
        /* ignoré */
      }
      getSupabase()
        .from("weigh_ins")
        .select("weight_kg")
        .eq("client_id", clientId)
        .order("measured_on", { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data: w }) => setWeight(w?.weight_kg ? String(w.weight_kg).replace(".", ",") : ""));
    }
    setRuns(undefined);
    listRuns(clientId).then(setRuns);
  }, [clientId, isClient]);

  // Le GPS se prépare dès l'écran de départ (le signal met parfois quelques secondes)
  const { startGps, stopGps } = t;
  useEffect(() => {
    if (data.status === "idle" && mode === "gps") startGps();
    if (data.status === "idle" && mode === "tapis") stopGps();
  }, [data.status, mode, startGps, stopGps]);

  // Pas de fermeture accidentelle pendant la course
  useEffect(() => {
    if (data.status !== "running" && data.status !== "paused") return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [data.status]);

  const w = parseNum(weight);
  const distanceM = data.status === "finished" && data.mode === "tapis" ? (parseNum(manualKm) ?? 0) * 1000 : data.distanceM;
  const calories = estimateCalories(distanceM, t.elapsed, w);
  const avgPace = distanceM >= 50 ? t.elapsed / (distanceM / 1000) : null;

  async function save() {
    if (!clientId) return toast.error("Choisis le client.");
    if (data.mode === "tapis" && !(parseNum(manualKm) && parseNum(manualKm)! > 0)) return toast.error("Indique la distance affichée par le tapis.");
    setSaving(true);
    try {
      const { warning } = await saveRun({
        clientId,
        mode: data.mode,
        activity: activityOf(distanceM, t.elapsed),
        startedAt: data.startedAt ?? Date.now(),
        durationS: t.elapsed,
        distanceM,
        calories,
        weightKg: w && w >= 20 && w <= 400 ? w : null,
        splits: data.splits,
        route: data.route,
        feeling,
        note: note.trim() || null,
      });
      if (warning) toast.error(warning);
      else toast.success("Course enregistrée 💪");
      t.reset();
      setFeeling(null);
      setNote("");
      setManualKm("");
      listRuns(clientId).then(setRuns);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  /* ---------------- En course ---------------- */
  if (data.status === "running" || data.status === "paused") {
    const paused = data.status === "paused";
    return (
      <div className="mx-auto max-w-xl space-y-4">
        {t.restored && (
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            Course en cours récupérée. La distance parcourue pendant que l&apos;application était fermée n&apos;a pas pu être mesurée.
          </p>
        )}
        <div className={cn("rounded-3xl border p-5 text-center transition", paused ? "border-amber-500/40 bg-amber-500/5" : "border-royal-600/40 bg-royal-600/10")}>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-400">{paused ? "En pause" : data.mode === "tapis" ? "Tapis" : "Course en cours"}</p>
          <p className="mt-2 font-display text-7xl font-semibold tabular-nums leading-none text-white sm:text-8xl" aria-label="Chrono">
            {fmtClock(t.elapsed)}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {data.mode === "gps" ? (
            <Stat label="Distance" value={fmtKm(data.distanceM)} unit="km" icon={<MapPin className="h-3.5 w-3.5" />} big />
          ) : (
            <Stat label="Distance" value="—" unit="à la fin" icon={<MapPin className="h-3.5 w-3.5" />} big />
          )}
          <Stat label="Allure actuelle" value={fmtPace(t.currentPace)} unit="/km" icon={<Gauge className="h-3.5 w-3.5" />} big />
          <Stat label="Allure moyenne" value={fmtPace(t.avgPace)} unit="/km" icon={<Timer className="h-3.5 w-3.5" />} />
          <Stat
            label="Calories"
            value={estimateCalories(data.distanceM, t.elapsed, w) != null ? String(estimateCalories(data.distanceM, t.elapsed, w)) : "—"}
            unit="kcal"
            icon={<Flame className="h-3.5 w-3.5" />}
          />
        </div>
        {data.mode === "gps" && (
          <p className={cn("flex items-center justify-center gap-1.5 text-xs", t.signal.error ? "text-red-300" : "text-ink-500")}>
            <Satellite className="h-3.5 w-3.5" />
            {t.signal.error ?? (t.signal.accuracy != null ? `GPS ±${t.signal.accuracy} m` : "Recherche du GPS…")}
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          {paused ? (
            <Button size="lg" className="h-16 text-lg" onClick={t.resume}>
              <Play className="h-6 w-6" /> Reprendre
            </Button>
          ) : (
            <Button size="lg" variant="secondary" className="h-16 text-lg" onClick={t.pause}>
              <Pause className="h-6 w-6" /> Pause
            </Button>
          )}
          <Button size="lg" variant="danger" className="h-16 text-lg" onClick={() => setConfirmEnd(true)}>
            <Square className="h-5 w-5" /> Terminer
          </Button>
        </div>
        {data.splits.length > 0 && (
          <Card title="Temps au kilomètre" padded={false}>
            <SplitsTable splits={data.splits} />
          </Card>
        )}
        <p className="text-center text-xs text-ink-500">Garde l&apos;écran allumé et l&apos;application ouverte : le GPS du navigateur s&apos;arrête en arrière-plan.</p>
        <ConfirmDialog
          open={confirmEnd}
          title="Terminer la course ?"
          message="Tu pourras ensuite vérifier le résumé et l'enregistrer."
          confirmLabel="Terminer"
          danger={false}
          onConfirm={() => {
            setConfirmEnd(false);
            t.finish();
          }}
          onCancel={() => setConfirmEnd(false)}
        />
      </div>
    );
  }

  /* ---------------- Résumé ---------------- */
  if (data.status === "finished") {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <PageHeader title="Bravo !" subtitle="Vérifie le résumé puis enregistre ta course." />
        {data.mode === "tapis" && (
          <Card>
            <Field label="Distance affichée par le tapis (km)" required>
              <Input value={manualKm} onChange={(e) => setManualKm(e.target.value)} inputMode="decimal" placeholder="5,2" autoFocus aria-label="Distance du tapis en km" />
            </Field>
          </Card>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Temps" value={fmtClock(t.elapsed)} icon={<Timer className="h-3.5 w-3.5" />} />
          <Stat label="Distance" value={fmtKm(distanceM)} unit="km" icon={<MapPin className="h-3.5 w-3.5" />} />
          <Stat label="Allure moyenne" value={fmtPace(avgPace)} unit="/km" icon={<Gauge className="h-3.5 w-3.5" />} />
          <Stat label="Calories" value={calories != null ? String(calories) : "—"} unit="kcal" icon={<Flame className="h-3.5 w-3.5" />} />
        </div>
        {data.route.flat().length > 1 && (
          <Card title="Parcours">
            <RouteTrace route={data.route} />
          </Card>
        )}
        {data.splits.length > 0 && (
          <Card title="Temps au kilomètre" padded={false}>
            <SplitsTable splits={data.splits} />
          </Card>
        )}
        <Card>
          <div className="space-y-4">
            <div>
              <p className="label">Effort ressenti (1 = très facile, 10 = maximal)</p>
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <Chip key={n} active={feeling === n} onClick={() => setFeeling(feeling === n ? null : n)} className="w-10 px-0 text-center">
                    {n}
                  </Chip>
                ))}
              </div>
            </div>
            <Field label="Commentaire">
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={2000} placeholder="Sensations, parcours, météo…" />
            </Field>
            {!w && <p className="text-xs text-ink-400">Calories : indique le poids sur l&apos;écran de départ pour les estimer.</p>}
          </div>
        </Card>
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Button size="lg" onClick={save} loading={saving}>
            Enregistrer la course
          </Button>
          <Button size="lg" variant="ghost" className="text-red-300 hover:bg-red-500/10" onClick={() => setConfirmDiscard(true)} aria-label="Supprimer la course">
            <Trash2 className="h-5 w-5" />
          </Button>
        </div>
        <ConfirmDialog
          open={confirmDiscard}
          title="Supprimer cette course ?"
          message="Elle ne sera pas enregistrée."
          onConfirm={() => {
            setConfirmDiscard(false);
            t.reset();
          }}
          onCancel={() => setConfirmDiscard(false)}
        />
      </div>
    );
  }

  /* ---------------- Départ + historique ---------------- */
  const gpsReady = t.signal.accuracy != null && t.signal.accuracy <= 35 && !t.signal.error;
  return (
    <>
      <PageHeader title="Course à pied" subtitle="Chrono, distance, allure et calories, directement sur le téléphone." />
      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <Card>
          <div className="space-y-5">
            {!isClient && (
              <Field label="Pour quel client ?" required>
                <Select value={clientId} onChange={(e) => setClientId(e.target.value)} aria-label="Client">
                  <option value="">— Choisir —</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {fullName(c)}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <div>
              <p className="label">Où cours-tu ?</p>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ["gps", "Dehors", "GPS"],
                    ["tapis", "Tapis", "intérieur"],
                  ] as const
                ).map(([k, l, sub]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setMode(k)}
                    className={cn(
                      "rounded-xl border px-3 py-3 text-left transition",
                      mode === k ? "border-royal-500 bg-royal-600/20 text-white" : "border-ink-700 bg-ink-900 text-ink-300 hover:border-ink-500",
                    )}
                  >
                    <span className="block font-semibold">{l}</span>
                    <span className="block text-xs text-ink-400">{sub}</span>
                  </button>
                ))}
              </div>
            </div>
            {mode === "gps" ? (
              <p className={cn("flex items-start gap-2 text-sm", t.signal.error ? "text-red-300" : gpsReady ? "text-emerald-300" : "text-amber-200")}>
                <Satellite className="mt-0.5 h-4 w-4 shrink-0" />
                {t.signal.error ?? (gpsReady ? `GPS prêt (précision ±${t.signal.accuracy} m)` : t.signal.accuracy != null ? `Signal GPS faible (±${t.signal.accuracy} m)… attends quelques secondes à l'extérieur.` : "Recherche du GPS… autorise la localisation si le téléphone la demande.")}
              </p>
            ) : (
              <p className="text-sm text-ink-400">Le chrono tourne pendant ta course ; à la fin, tu indiques la distance affichée par le tapis.</p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Poids (kg)" hint="Pour estimer les calories">
                <Input value={weight} onChange={(e) => setWeight(e.target.value)} inputMode="decimal" placeholder="70" aria-label="Poids" />
              </Field>
              <div>
                <p className="label">Annonces vocales</p>
                <button
                  type="button"
                  onClick={() => setVoice((v) => !v)}
                  className={cn(
                    "flex h-[46px] w-full items-center justify-center gap-2 rounded-xl border text-sm transition",
                    voice ? "border-royal-500 bg-royal-600/15 text-white" : "border-ink-700 bg-ink-900 text-ink-400",
                  )}
                  aria-pressed={voice}
                >
                  {voice ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />} {voice ? "Chaque km" : "Désactivées"}
                </button>
              </div>
            </div>
            <Button
              size="lg"
              className="h-16 w-full rounded-2xl text-lg"
              disabled={!clientId}
              onClick={() => {
                // Débloque la voix sur iPhone (doit partir du geste)
                try {
                  if (voice) window.speechSynthesis?.speak(new SpeechSynthesisUtterance(""));
                } catch {
                  /* ignoré */
                }
                t.start(mode);
              }}
            >
              <Play className="h-6 w-6" /> Démarrer
            </Button>
            {mode === "gps" && (
              <p className="text-xs leading-relaxed text-ink-500">
                Pendant la course, garde l&apos;écran allumé et l&apos;application ouverte (l&apos;écran reste allumé automatiquement sur la plupart des
                téléphones). Le GPS d&apos;un navigateur s&apos;arrête quand la page passe en arrière-plan.
              </p>
            )}
          </div>
        </Card>

        <Card title="Dernières courses" padded={false}>
          {!clientId ? (
            <p className="px-4 py-6 text-sm text-ink-400 sm:px-5">Choisis un client pour voir ses courses.</p>
          ) : runs === undefined ? (
            <LoadingBlock />
          ) : runs === null ? (
            <p className="px-4 py-6 text-sm text-ink-400 sm:px-5">
              {isClient ? "L'historique des courses sera bientôt disponible." : "Historique indisponible : exécute le fichier SQL 20261022000009_runs.sql dans Supabase."}
            </p>
          ) : runs.length === 0 ? (
            <EmptyState icon={<Footprints className="h-6 w-6" />} title="Aucune course pour l'instant" text="Lance ta première course !" />
          ) : (
            <ul className="divide-y divide-ink-750">
              {runs.map((r) => {
                const pace = r.distance_m >= 50 ? r.duration_s / (r.distance_m / 1000) : null;
                return (
                  <li key={r.id}>
                    <button onClick={() => setDetail(r)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-ink-800 sm:px-5">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-royal-600/15 text-royal-300">
                        <Footprints className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-white">
                          {fmtKm(r.distance_m)} km · {fmtClock(r.duration_s)}
                        </p>
                        <p className="truncate text-xs text-ink-400">
                          {new Date(r.started_at).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })} · {fmtPace(pace)} /km
                          {r.calories ? ` · ${r.calories} kcal` : ""}
                          {r.mode === "tapis" ? " · tapis" : ""}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      {detail && (
        <RunDetail
          run={detail}
          onClose={() => setDetail(null)}
          onDeleted={() => {
            setDetail(null);
            listRuns(clientId).then(setRuns);
          }}
        />
      )}
    </>
  );
}

function RunDetail({ run, onClose, onDeleted }: { run: RunRow; onClose: () => void; onDeleted: () => void }) {
  const toast = useToast();
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const pace = run.distance_m >= 50 ? run.duration_s / (run.distance_m / 1000) : null;
  const title = useMemo(
    () => new Date(run.started_at).toLocaleString("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }),
    [run.started_at],
  );
  return (
    <>
      <Modal
        open={!ask}
        onClose={onClose}
        title={run.mode === "tapis" ? "Course sur tapis" : run.activity === "marche" ? "Marche" : "Course"}
        size="lg"
        footer={
          <Button variant="ghost" className="text-red-300 hover:bg-red-500/10 sm:mr-auto" onClick={() => setAsk(true)}>
            <Trash2 className="h-4 w-4" /> Supprimer
          </Button>
        }
      >
        <div className="space-y-4">
          <p className="text-sm capitalize text-ink-400">{title}</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Temps" value={fmtClock(run.duration_s)} icon={<Timer className="h-3.5 w-3.5" />} />
            <Stat label="Distance" value={fmtKm(run.distance_m)} unit="km" icon={<MapPin className="h-3.5 w-3.5" />} />
            <Stat label="Allure" value={fmtPace(pace)} unit="/km" icon={<Gauge className="h-3.5 w-3.5" />} />
            <Stat label="Calories" value={run.calories != null ? String(run.calories) : "—"} unit="kcal" icon={<Flame className="h-3.5 w-3.5" />} />
          </div>
          {run.route?.flat().length > 1 && <RouteTrace route={run.route} />}
          {run.splits?.length > 0 && <SplitsTable splits={run.splits} />}
          {(run.feeling || run.note) && (
            <p className="rounded-xl border border-ink-700 bg-ink-900 p-3 text-sm text-ink-200">
              {run.feeling ? <strong className="text-white">Effort ressenti : {run.feeling}/10. </strong> : null}
              {run.note}
            </p>
          )}
        </div>
      </Modal>
      <ConfirmDialog
        open={ask}
        title="Supprimer cette course ?"
        message="Elle sera aussi retirée de l'historique des séances."
        loading={busy}
        onConfirm={async () => {
          setBusy(true);
          try {
            await deleteRun(run);
            toast.success("Course supprimée.");
            onDeleted();
          } catch (e) {
            toast.error(errorMessage(e));
          } finally {
            setBusy(false);
            setAsk(false);
          }
        }}
        onCancel={() => setAsk(false)}
      />
    </>
  );
}

