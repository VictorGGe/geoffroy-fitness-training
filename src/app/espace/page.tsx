"use client";

import Link from "next/link";
import { ChevronRight, ClipboardPlus, Dumbbell, ListChecks } from "lucide-react";
import { Badge, Card, EmptyState, ErrorBlock, LinkButton, LoadingBlock, PageHeader } from "@/components/ui";
import { getSupabase } from "@/lib/supabase/client";
import { getMyClientProfile } from "@/lib/data";
import { MyAppointments } from "@/components/AgendaWidgets";
import { StepsPanel } from "@/components/StepsPanel";
import { EnergyPanel } from "@/components/EnergyPanel";
import { unwrap, useAsync } from "@/lib/hooks";
import { fmtDate, fmtRelative, GOAL_LABELS, LEVEL_LABELS } from "@/lib/format";
import type { Program, WorkoutLog } from "@/lib/types";

type Row = Program & { program_sessions: { count: number }[] };

export default function ClientHomePage() {
  const { data, loading, error, reload } = useAsync(async () => {
    const sb = getSupabase();
    const [me, programs, logs] = await Promise.all([
      getMyClientProfile(),
      sb.from("programs").select("*, program_sessions(count)").order("archived").order("updated_at", { ascending: false }),
      sb.from("workout_logs").select("id, performed_on, session_name, program_name").order("performed_on", { ascending: false }).limit(3),
    ]);
    return { me, programs: unwrap(programs) as Row[], logs: unwrap(logs) as WorkoutLog[] };
  });

  if (loading) return <LoadingBlock />;
  if (error || !data) return <ErrorBlock message={error ?? "Erreur de chargement."} onRetry={reload} />;

  const active = data.programs.filter((p) => !p.archived);
  const archived = data.programs.filter((p) => p.archived);

  return (
    <>
      <PageHeader
        title={data.me ? `Salut ${data.me.first_name}` : "Mon espace"}
        subtitle="Ton programme d'entraînement, préparé par Victor."
        actions={
          <LinkButton href="/espace/seances/nouvelle">
            <ClipboardPlus className="h-4 w-4" /> Noter une séance
          </LinkButton>
        }
      />

      <MyAppointments />
      {data.me && <StepsPanel clientId={data.me.id} compact />}
      {data.me && <EnergyPanel clientId={data.me.id} compact />}

      <Card title="Mes programmes" padded={false}>
        {active.length === 0 ? (
          <EmptyState
            icon={<ListChecks className="h-6 w-6" />}
            title="Aucun programme pour le moment"
            text="Ton coach va bientôt te préparer un programme. Il apparaîtra ici automatiquement."
          />
        ) : (
          <ul className="divide-y divide-ink-750">
            {active.map((p) => (
              <li key={p.id}>
                <Link href={`/espace/programmes/${p.id}`} className="group flex items-center gap-4 px-4 py-4 transition hover:bg-ink-800 sm:px-5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-royal-600/20 text-royal-300">
                    <Dumbbell className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-white">{p.name}</p>
                    <p className="mt-0.5 truncate text-sm text-ink-400">
                      {p.program_sessions?.[0]?.count ?? 0} séance(s)
                      {p.sessions_per_week != null ? ` · ${p.sessions_per_week} par semaine` : ""}
                      {p.duration_weeks ? ` · ${p.duration_weeks} semaines` : ""}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {p.goal && <Badge tone="blue">{GOAL_LABELS[p.goal]}</Badge>}
                      {p.level && <Badge>{LEVEL_LABELS[p.level]}</Badge>}
                      <span className="text-[11px] text-ink-500">mis à jour {fmtRelative(p.updated_at)}</span>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-ink-600 transition group-hover:text-royal-400" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card
        className="mt-5"
        title="Mes dernières séances"
        padded={false}
        actions={
          <Link href="/espace/seances" className="text-xs text-royal-300 hover:text-royal-200">
            Tout voir
          </Link>
        }
      >
        {data.logs.length === 0 ? (
          <p className="px-5 py-6 text-sm text-ink-400">Aucune séance notée pour l&apos;instant. Après ton entraînement, clique sur « Noter une séance ».</p>
        ) : (
          <ul className="divide-y divide-ink-750">
            {data.logs.map((l) => (
              <li key={l.id}>
                <Link href={`/espace/seances/${l.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-ink-800 sm:px-5">
                  <ClipboardPlus className="h-4 w-4 text-royal-400" />
                  <span className="min-w-0 flex-1 truncate text-sm text-white">
                    {l.session_name ?? "Séance libre"}
                    {l.program_name && <span className="text-ink-400"> · {l.program_name}</span>}
                  </span>
                  <span className="text-xs text-ink-500">{fmtDate(l.performed_on)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {archived.length > 0 && (
        <Card className="mt-5" title="Anciens programmes" padded={false}>
          <ul className="divide-y divide-ink-750">
            {archived.map((p) => (
              <li key={p.id}>
                <Link href={`/espace/programmes/${p.id}`} className="flex items-center gap-3 px-4 py-3 text-sm text-ink-300 hover:bg-ink-800 sm:px-5">
                  <span className="flex-1 truncate">{p.name}</span>
                  <ChevronRight className="h-4 w-4 text-ink-600" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
