"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Check, ChevronLeft, ChevronRight, Clock, MapPin, Plus, Repeat, UserX } from "lucide-react";
import { Button, Card, EmptyState, ErrorBlock, LoadingBlock, PageHeader } from "@/components/ui";
import { AppointmentForm } from "@/components/AppointmentForm";
import { cn } from "@/lib/cn";
import { getSupabase } from "@/lib/supabase/client";
import { unwrap, useAsync } from "@/lib/hooks";
import {
  addDays,
  apptName,
  endOf,
  fmtDayLong,
  fmtDuration,
  fmtTime,
  kindInfo,
  KINDS,
  sameDay,
  startOfDay,
  startOfWeek,
  type Appointment,
} from "@/lib/agenda";

const HOUR_PX = 56;
const DAY_NAMES = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

type View = "week" | "day";

export default function AgendaPage() {
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));
  const [view, setView] = useState<View>("week");
  const [form, setForm] = useState<{ appt: Appointment | null; start?: Date | null } | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (window.innerWidth < 768) setView("day");
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const weekStart = startOfWeek(cursor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const { data, loading, error, reload } = useAsync(async () => {
    const res = await getSupabase()
      .from("appointments")
      .select("*, clients(id, first_name, last_name)")
      .gte("starts_at", weekStart.toISOString())
      .lt("starts_at", addDays(weekStart, 7).toISOString())
      .order("starts_at");
    return unwrap(res) as Appointment[];
  }, [weekStart.getTime()]);

  const list = data ?? [];
  const byDay = (d: Date) => list.filter((a) => sameDay(new Date(a.starts_at), d));
  const active = list.filter((a) => a.status !== "annule");
  const counts = KINDS.map((k) => ({ ...k, n: active.filter((a) => a.kind === k.key).length })).filter((k) => k.n > 0);

  function move(dir: -1 | 1) {
    setCursor((c) => addDays(c, view === "week" ? 7 * dir : dir));
  }

  const missing = !!error && /appointments/.test(error);
  const title =
    view === "week"
      ? `${weekStart.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} – ${addDays(weekStart, 6).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}`
      : fmtDayLong(cursor);

  return (
    <>
      <PageHeader
        title="Agenda"
        subtitle={
          counts.length ? (
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>{active.length} rendez-vous cette semaine</span>
              {counts.map((k) => (
                <span key={k.key} className="inline-flex items-center gap-1.5">
                  <span className={cn("h-2 w-2 rounded-full", k.dot)} /> {k.n} {k.label.toLowerCase()}
                  {k.n > 1 ? "s" : ""}
                </span>
              ))}
            </span>
          ) : (
            "Tes séances clients, bilans et rendez-vous."
          )
        }
        actions={
          <Button onClick={() => setForm({ appt: null, start: view === "day" && !sameDay(cursor, new Date()) ? atHour(cursor, 9) : null })}>
            <Plus className="h-4 w-4" /> Rendez-vous
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center rounded-xl border border-ink-700/70 bg-ink-900/80 p-1">
          <Button variant="ghost" size="icon" onClick={() => move(-1)} aria-label="Précédent">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setCursor(startOfDay(new Date()))}>
            Aujourd&apos;hui
          </Button>
          <Button variant="ghost" size="icon" onClick={() => move(1)} aria-label="Suivant">
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
        <p className="h-display min-w-0 flex-1 truncate text-lg text-white">{title}</p>
        <div className="inline-flex rounded-xl border border-ink-700/70 bg-ink-900/80 p-1 text-[13px] font-medium">
          {(
            [
              ["day", "Jour"],
              ["week", "Semaine"],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              onClick={() => setView(k)}
              className={cn("rounded-lg px-3 py-1.5 transition", view === k ? "bg-royal-600 text-white" : "text-ink-400 hover:text-ink-100")}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {missing ? (
        <Card>
          <EmptyState
            icon={<CalendarDays className="h-6 w-6" />}
            title="L'agenda n'est pas encore activé"
            text="Une petite étape dans Supabase : exécuter le fichier supabase/migrations/20261017000007_agenda.sql dans le SQL Editor."
          />
        </Card>
      ) : error ? (
        <ErrorBlock message={error} onRetry={reload} />
      ) : loading && !data ? (
        <LoadingBlock />
      ) : view === "week" ? (
        <WeekGrid days={days} byDay={byDay} now={now} onOpen={(a) => setForm({ appt: a })} onCreate={(d) => setForm({ appt: null, start: d })} />
      ) : (
        <DayList
          days={days}
          cursor={cursor}
          setCursor={setCursor}
          byDay={byDay}
          onOpen={(a) => setForm({ appt: a })}
          onCreate={(d) => setForm({ appt: null, start: d })}
        />
      )}

      {form && (
        <AppointmentForm open onClose={() => setForm(null)} appt={form.appt} initialStart={form.start ?? null} onSaved={reload} />
      )}
    </>
  );
}

function atHour(d: Date, h: number, m = 0): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m);
}

function StatusIcon({ a }: { a: Appointment }) {
  if (a.status === "fait") return <Check className="h-3.5 w-3.5 shrink-0 text-emerald-300" aria-label="Fait" />;
  if (a.status === "absent") return <UserX className="h-3.5 w-3.5 shrink-0 text-red-300" aria-label="Absent" />;
  return null;
}

/* ------------------------------------------------------------------ */
/* Vue semaine (grille horaire)                                         */
/* ------------------------------------------------------------------ */

/** Répartit les rendez-vous qui se chevauchent en colonnes côte à côte. */
function layout(items: Appointment[]) {
  const sorted = [...items].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const out: { a: Appointment; col: number; cols: number }[] = [];
  let group: { a: Appointment; col: number }[] = [];
  let groupEnd = 0;
  const flush = () => {
    const cols = Math.max(1, ...group.map((g) => g.col + 1));
    group.forEach((g) => out.push({ ...g, cols }));
    group = [];
  };
  for (const a of sorted) {
    const s = new Date(a.starts_at).getTime();
    if (group.length && s >= groupEnd) flush();
    const used = new Set(group.filter((g) => endOf(g.a).getTime() > s).map((g) => g.col));
    let col = 0;
    while (used.has(col)) col++;
    group.push({ a, col });
    groupEnd = Math.max(groupEnd, endOf(a).getTime());
  }
  if (group.length) flush();
  return out;
}

function WeekGrid({
  days,
  byDay,
  now,
  onOpen,
  onCreate,
}: {
  days: Date[];
  byDay: (d: Date) => Appointment[];
  now: Date;
  onOpen: (a: Appointment) => void;
  onCreate: (d: Date) => void;
}) {
  const all = days.flatMap(byDay);
  const minH = Math.min(7, ...all.map((a) => new Date(a.starts_at).getHours()));
  const maxH = Math.max(21, ...all.map((a) => Math.ceil((endOf(a).getHours() * 60 + endOf(a).getMinutes()) / 60)));
  const hours = Array.from({ length: maxH - minH }, (_, i) => minH + i);
  const scroller = useRef<HTMLDivElement>(null);

  return (
    <div className="card overflow-hidden">
      <div ref={scroller} className="scrollbar-thin overflow-x-auto">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-ink-700/60 bg-ink-900/60">
            <div />
            {days.map((d, i) => {
              const today = sameDay(d, now);
              return (
                <div key={i} className="px-2 py-2.5 text-center">
                  <p className={cn("text-[11px] font-medium uppercase tracking-wider", today ? "text-royal-300" : "text-ink-500")}>{DAY_NAMES[i]}</p>
                  <p
                    className={cn(
                      "mx-auto mt-0.5 flex h-8 w-8 items-center justify-center rounded-full font-display text-lg font-semibold",
                      today ? "bg-royal-600 text-white" : "text-ink-100",
                    )}
                  >
                    {d.getDate()}
                  </p>
                </div>
              );
            })}
          </div>
          <div className="relative grid grid-cols-[56px_repeat(7,1fr)]">
            <div>
              {hours.map((h) => (
                <div key={h} style={{ height: HOUR_PX }} className="relative pr-2 text-right text-[11px] tabular-nums text-ink-500">
                  <span className="absolute -top-2 right-2">{h}:00</span>
                </div>
              ))}
            </div>
            {days.map((d, di) => {
              const items = layout(byDay(d));
              const isToday = sameDay(d, now);
              const nowTop = ((now.getHours() - minH) * 60 + now.getMinutes()) * (HOUR_PX / 60);
              return (
                <div
                  key={di}
                  className={cn("relative border-l border-ink-750", isToday && "bg-royal-600/[0.04]")}
                  style={{ height: hours.length * HOUR_PX }}
                  onClick={(e) => {
                    if (e.target !== e.currentTarget) return;
                    const y = e.nativeEvent.offsetY;
                    const mins = Math.floor(y / (HOUR_PX / 2)) * 30;
                    onCreate(atHour(d, minH, 0 + mins));
                  }}
                  role="presentation"
                >
                  {hours.map((h, i) => (
                    <div key={h} className="pointer-events-none absolute inset-x-0 border-t border-ink-750/80" style={{ top: i * HOUR_PX }} />
                  ))}
                  {isToday && nowTop >= 0 && nowTop <= hours.length * HOUR_PX && (
                    <div className="pointer-events-none absolute inset-x-0 z-10 flex items-center" style={{ top: nowTop }}>
                      <span className="-ml-1 h-2 w-2 rounded-full bg-red-400" />
                      <span className="h-px flex-1 bg-red-400/80" />
                    </div>
                  )}
                  {items.map(({ a, col, cols }) => {
                    const s = new Date(a.starts_at);
                    const top = ((s.getHours() - minH) * 60 + s.getMinutes()) * (HOUR_PX / 60);
                    const h = Math.max(22, a.duration_min * (HOUR_PX / 60) - 2);
                    const k = kindInfo(a.kind);
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => onOpen(a)}
                        title={`${apptName(a)} · ${fmtTime(s)}–${fmtTime(endOf(a))}`}
                        className={cn(
                          "absolute z-[5] overflow-hidden rounded-lg border-l-[3px] px-1.5 py-1 text-left text-[11.5px] leading-tight shadow-sm transition hover:brightness-125",
                          k.block,
                          a.status === "annule" && "opacity-45 line-through",
                          a.status === "absent" && "opacity-70",
                        )}
                        style={{ top: top + 1, height: h, left: `calc(${(col / cols) * 100}% + 2px)`, width: `calc(${100 / cols}% - 4px)` }}
                      >
                        <span className="flex items-center gap-1 font-semibold">
                          <span className="truncate">{apptName(a)}</span>
                          <StatusIcon a={a} />
                        </span>
                        {h > 34 && (
                          <span className="block truncate text-[10.5px] text-white/70">
                            {fmtTime(s)} · {a.title && (a.clients || a.guest_name) ? a.title : k.label}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <p className="border-t border-ink-700/60 px-4 py-2 text-xs text-ink-500">Astuce : clique sur un créneau vide pour y placer un rendez-vous.</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Vue jour (liste, idéale sur téléphone)                               */
/* ------------------------------------------------------------------ */

function DayList({
  days,
  cursor,
  setCursor,
  byDay,
  onOpen,
  onCreate,
}: {
  days: Date[];
  cursor: Date;
  setCursor: (d: Date) => void;
  byDay: (d: Date) => Appointment[];
  onOpen: (a: Appointment) => void;
  onCreate: (d: Date) => void;
}) {
  const items = byDay(cursor);
  const today = new Date();
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-7 gap-1 rounded-2xl border border-ink-700/70 bg-ink-900/80 p-1.5">
        {days.map((d, i) => {
          const sel = sameDay(d, cursor);
          const n = byDay(d).filter((a) => a.status !== "annule");
          return (
            <button
              key={i}
              onClick={() => setCursor(d)}
              className={cn("flex flex-col items-center rounded-xl py-2 transition", sel ? "bg-royal-600 text-white" : "text-ink-300 hover:bg-ink-800")}
            >
              <span className={cn("text-[10.5px] font-medium uppercase", sel ? "text-white/80" : sameDay(d, today) ? "text-royal-300" : "text-ink-500")}>
                {DAY_NAMES[i]}
              </span>
              <span className="font-display text-lg font-semibold leading-tight">{d.getDate()}</span>
              <span className="mt-0.5 flex h-1.5 gap-0.5">
                {n.slice(0, 3).map((a) => (
                  <span key={a.id} className={cn("h-1.5 w-1.5 rounded-full", sel ? "bg-white/80" : kindInfo(a.kind).dot)} />
                ))}
              </span>
            </button>
          );
        })}
      </div>

      {items.length === 0 ? (
        <Card>
          <EmptyState
            icon={<CalendarDays className="h-6 w-6" />}
            title="Rien de prévu ce jour-là"
            action={
              <Button onClick={() => onCreate(atHour(cursor, sameDay(cursor, today) ? Math.min(21, today.getHours() + 1) : 9))}>
                <Plus className="h-4 w-4" /> Ajouter un rendez-vous
              </Button>
            }
          />
        </Card>
      ) : (
        <ul className="space-y-2.5">
          {items.map((a) => {
            const s = new Date(a.starts_at);
            const k = kindInfo(a.kind);
            return (
              <li key={a.id}>
                <button
                  onClick={() => onOpen(a)}
                  className={cn(
                    "card flex w-full items-stretch gap-3 p-3 text-left transition hover:border-royal-500/50 hover:bg-ink-800 sm:p-4",
                    a.status === "annule" && "opacity-50",
                  )}
                >
                  <div className="w-14 shrink-0 text-center">
                    <p className="font-display text-xl font-semibold tabular-nums text-white">{fmtTime(s)}</p>
                    <p className="text-[11px] text-ink-500">{fmtDuration(a.duration_min)}</p>
                  </div>
                  <span className={cn("w-1 shrink-0 rounded-full", k.dot)} />
                  <div className="min-w-0 flex-1">
                    <p className={cn("flex items-center gap-1.5 font-semibold text-white", a.status === "annule" && "line-through")}>
                      <span className="truncate">{apptName(a)}</span>
                      <StatusIcon a={a} />
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-400">
                      <span>
                        {k.label}
                        {a.title && (a.clients || a.guest_name) ? ` · ${a.title}` : ""}
                      </span>
                      {a.location && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {a.location}
                        </span>
                      )}
                      {a.series_id && (
                        <span className="inline-flex items-center gap-1">
                          <Repeat className="h-3 w-3" /> chaque semaine
                        </span>
                      )}
                      {a.status !== "prevu" && <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{a.status === "fait" ? "Fait" : a.status === "absent" ? "Absent" : "Annulé"}</span>}
                    </p>
                  </div>
                </button>
              </li>
            );
          })}
          <li>
            <button
              onClick={() => {
                const last = items[items.length - 1];
                onCreate(last ? endOf(last) : atHour(cursor, 9));
              }}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-ink-600 py-3 text-sm font-medium text-ink-300 transition hover:border-royal-500 hover:text-royal-300"
            >
              <Plus className="h-4 w-4" /> Ajouter un rendez-vous ce jour
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
