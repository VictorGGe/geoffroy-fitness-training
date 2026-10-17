"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarDays, Check, MapPin, Plus, UserX } from "lucide-react";
import { Button, Card } from "./ui";
import { AppointmentForm } from "./AppointmentForm";
import { cn } from "@/lib/cn";
import { getSupabase } from "@/lib/supabase/client";
import { useAsync } from "@/lib/hooks";
import { addDays, apptName, endOf, fmtDuration, fmtTime, kindInfo, sameDay, startOfDay, type Appointment } from "@/lib/agenda";

function Row({ a, showDay, onOpen }: { a: Appointment; showDay?: boolean; onOpen: () => void }) {
  const s = new Date(a.starts_at);
  const k = kindInfo(a.kind);
  const now = new Date();
  const live = now >= s && now < endOf(a) && a.status === "prevu";
  return (
    <li>
      <button
        onClick={onOpen}
        className={cn("flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-ink-800 sm:px-5", a.status === "annule" && "opacity-50")}
      >
        <div className="w-14 shrink-0">
          {showDay && (
            <p className="text-[11px] font-medium uppercase text-ink-500">
              {sameDay(s, now) ? "Auj." : sameDay(s, addDays(startOfDay(now), 1)) ? "Demain" : s.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" })}
            </p>
          )}
          <p className="font-display text-lg font-semibold tabular-nums leading-tight text-white">{fmtTime(s)}</p>
        </div>
        <span className={cn("h-9 w-1 shrink-0 rounded-full", k.dot)} />
        <div className="min-w-0 flex-1">
          <p className={cn("flex items-center gap-1.5 truncate text-sm font-medium text-white", a.status === "annule" && "line-through")}>
            <span className="truncate">{apptName(a)}</span>
            {a.status === "fait" && <Check className="h-3.5 w-3.5 shrink-0 text-emerald-300" />}
            {a.status === "absent" && <UserX className="h-3.5 w-3.5 shrink-0 text-red-300" />}
            {live && <span className="rounded bg-red-500/20 px-1.5 text-[10px] font-semibold uppercase text-red-300">En cours</span>}
          </p>
          <p className="truncate text-xs text-ink-400">
            {k.label} · {fmtDuration(a.duration_min)}
            {a.location && (
              <>
                {" · "}
                <MapPin className="inline h-3 w-3" /> {a.location}
              </>
            )}
          </p>
        </div>
      </button>
    </li>
  );
}

/** Tableau de bord : les rendez-vous du jour (ou les prochains si la journée est vide). */
export function TodayAgenda() {
  const [form, setForm] = useState<{ appt: Appointment | null } | null>(null);
  const { data, reload } = useAsync(async () => {
    const d0 = startOfDay(new Date());
    const { data, error } = await getSupabase()
      .from("appointments")
      .select("*, clients(id, first_name, last_name)")
      .gte("starts_at", d0.toISOString())
      .lt("starts_at", addDays(d0, 8).toISOString())
      .order("starts_at")
      .limit(30);
    if (error) return null; // agenda pas encore activé : on n'affiche rien
    return data as Appointment[];
  });
  if (!data) return null;
  const today = data.filter((a) => sameDay(new Date(a.starts_at), new Date()));
  const upcoming = data.filter((a) => !sameDay(new Date(a.starts_at), new Date()) && a.status !== "annule").slice(0, 4);
  const list = today.length ? today : upcoming;

  return (
    <>
      <Card
        className="mb-6"
        padded={false}
        title={
          <span className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-royal-400" />
            {today.length ? `Aujourd'hui · ${today.filter((a) => a.status !== "annule").length} rendez-vous` : "Aujourd'hui · rien de prévu"}
          </span>
        }
        actions={
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={() => setForm({ appt: null })} aria-label="Nouveau rendez-vous">
              <Plus className="h-4 w-4" /> RDV
            </Button>
            <Link href="/agenda" className="px-2 text-xs text-royal-300 hover:text-royal-200">
              Agenda
            </Link>
          </div>
        }
      >
        {list.length === 0 ? (
          <p className="px-4 py-4 text-sm text-ink-400 sm:px-5">Aucun rendez-vous dans les 7 prochains jours.</p>
        ) : (
          <>
            {!today.length && <p className="px-4 pt-3 text-xs font-medium uppercase tracking-wider text-ink-500 sm:px-5">Prochains rendez-vous</p>}
            <ul className="divide-y divide-ink-750">
              {list.map((a) => (
                <Row key={a.id} a={a} showDay={!today.length} onOpen={() => setForm({ appt: a })} />
              ))}
            </ul>
          </>
        )}
      </Card>
      {form && <AppointmentForm open onClose={() => setForm(null)} appt={form.appt} onSaved={reload} />}
    </>
  );
}

/** Fiche client : ses prochains rendez-vous + planifier. */
export function ClientAppointments({ clientId }: { clientId: string }) {
  const [form, setForm] = useState<{ appt: Appointment | null } | null>(null);
  const { data, reload } = useAsync(async () => {
    const { data, error } = await getSupabase()
      .from("appointments")
      .select("*, clients(id, first_name, last_name)")
      .eq("client_id", clientId)
      .gte("starts_at", startOfDay(new Date()).toISOString())
      .order("starts_at")
      .limit(6);
    if (error) return null;
    return data as Appointment[];
  }, [clientId]);
  if (!data) return null;
  return (
    <>
      <Card
        title="Prochains rendez-vous"
        padded={false}
        actions={
          <Button size="sm" variant="secondary" onClick={() => setForm({ appt: null })}>
            <Plus className="h-4 w-4" /> Planifier
          </Button>
        }
      >
        {data.length === 0 ? (
          <p className="px-4 py-4 text-sm text-ink-400 sm:px-5">Aucun rendez-vous prévu.</p>
        ) : (
          <ul className="divide-y divide-ink-750">
            {data.map((a) => (
              <Row key={a.id} a={a} showDay onOpen={() => setForm({ appt: a })} />
            ))}
          </ul>
        )}
      </Card>
      {form && <AppointmentForm open onClose={() => setForm(null)} appt={form.appt} initialClientId={clientId} onSaved={reload} />}
    </>
  );
}

/** Espace client : ses prochains rendez-vous (lecture seule, sans les notes du coach). */
export function MyAppointments() {
  const { data } = useAsync(async () => {
    const { data, error } = await getSupabase().rpc("my_appointments");
    if (error) return null;
    return (data ?? []) as Pick<Appointment, "id" | "kind" | "title" | "starts_at" | "duration_min" | "location" | "status">[];
  });
  if (!data || data.length === 0) return null;
  const now = new Date();
  const list = data.filter((a) => endOf(a) > now).slice(0, 5);
  if (!list.length) return null;
  return (
    <Card title="Mes prochains rendez-vous" padded={false} className="mb-5">
      <ul className="divide-y divide-ink-750">
        {list.map((a) => {
          const s = new Date(a.starts_at);
          const k = kindInfo(a.kind);
          const day = s.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
          return (
            <li key={a.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
              <span className={cn("h-9 w-1 shrink-0 rounded-full", k.dot)} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white">
                  {sameDay(s, now) ? "Aujourd'hui" : day.charAt(0).toUpperCase() + day.slice(1)} à {fmtTime(s)}
                </p>
                <p className="truncate text-xs text-ink-400">
                  {a.title || k.label} · {fmtDuration(a.duration_min)}
                  {a.location ? ` · ${a.location}` : ""}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
