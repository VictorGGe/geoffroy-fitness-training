"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Activity, Dumbbell, ListChecks, Search, Trophy, Users } from "lucide-react";
import { Badge, Card, EmptyState, ErrorBlock, Input, LoadingBlock, PageHeader } from "@/components/ui";
import { getSupabase } from "@/lib/supabase/client";
import { unwrap, useAsync } from "@/lib/hooks";
import { fmtDate, fmtNum, fullName, GOAL_LABELS, ilikeSafe } from "@/lib/format";
import type { Client, Exercise, Program, WorkoutLog, WorkoutSet } from "@/lib/types";

type ClientRef = { clients: Pick<Client, "id" | "first_name" | "last_name"> | null };

function SearchInner() {
  const params = useSearchParams();
  const router = useRouter();
  const q = params.get("q") ?? "";
  const [input, setInput] = useState(q);
  useEffect(() => setInput(q), [q]);

  const { data, loading, error, reload } = useAsync(async () => {
    const term = ilikeSafe(q);
    if (term.length < 2) return null;
    const like = `%${term}%`;
    const sb = getSupabase();
    const words = term.split(/\s+/).filter(Boolean);
    // Nom complet : chaque mot doit apparaître dans le prénom ou le nom
    let clientQuery = sb.from("clients").select("*").order("last_name").limit(20);
    for (const w of words) clientQuery = clientQuery.or(`first_name.ilike.%${w}%,last_name.ilike.%${w}%,goal.ilike.%${w}%`);

    const [clients, programs, exercises, sessions, perfs] = await Promise.all([
      clientQuery,
      sb
        .from("programs")
        .select("*, clients(id, first_name, last_name)")
        .or(`name.ilike.${like},description.ilike.${like},split_type.ilike.${like}`)
        .order("updated_at", { ascending: false })
        .limit(20),
      sb.from("exercises").select("*").or(`name.ilike.${like},muscle_group.ilike.${like},equipment.ilike.${like}`).order("name").limit(20),
      sb
        .from("workout_logs")
        .select("*, clients(id, first_name, last_name)")
        .or(`session_name.ilike.${like},program_name.ilike.${like},coach_comments.ilike.${like}`)
        .order("performed_on", { ascending: false })
        .limit(20),
      sb
        .from("workout_sets")
        .select("*, workout_logs!inner(id, performed_on, client_id, clients(id, first_name, last_name))")
        .or(`exercise_name.ilike.${like},comment.ilike.${like}`)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    // Performances : meilleure série par client et par exercice
    type PerfRow = WorkoutSet & { workout_logs: { id: string; performed_on: string } & ClientRef };
    const best = new Map<string, PerfRow & { count: number }>();
    for (const s of (unwrap(perfs) as PerfRow[]) ?? []) {
      const key = `${s.workout_logs.clients?.id}-${s.exercise_name}`;
      const cur = best.get(key);
      if (!cur) best.set(key, { ...s, count: 1 });
      else {
        cur.count += 1;
        if ((s.load_kg ?? 0) > (cur.load_kg ?? 0)) best.set(key, { ...s, count: cur.count });
      }
    }

    return {
      clients: unwrap(clients) as Client[],
      programs: unwrap(programs) as Program[],
      exercises: unwrap(exercises) as Exercise[],
      sessions: unwrap(sessions) as (WorkoutLog & ClientRef)[],
      perfs: [...best.values()].slice(0, 20),
    };
  }, [q]);

  const total = data ? data.clients.length + data.programs.length + data.exercises.length + data.sessions.length + data.perfs.length : 0;

  return (
    <>
      <PageHeader title="Recherche" subtitle={q ? `Résultats pour « ${q} »` : "Clients, programmes, exercices, séances et performances"} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (input.trim()) router.replace(`/search?q=${encodeURIComponent(input.trim())}`);
        }}
        className="relative mb-6"
      >
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-500" />
        <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Rechercher…" className="h-12 rounded-2xl pl-12 text-base" autoFocus />
      </form>

      {!q || q.trim().length < 2 ? (
        <Card>
          <EmptyState icon={<Search className="h-6 w-6" />} title="Saisissez au moins 2 caractères" />
        </Card>
      ) : loading ? (
        <LoadingBlock label="Recherche…" />
      ) : error ? (
        <ErrorBlock message={error} onRetry={reload} />
      ) : !data || total === 0 ? (
        <Card>
          <EmptyState icon={<Search className="h-6 w-6" />} title="Aucun résultat" text="Essayez un autre terme." />
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {data.clients.length > 0 && (
            <Section title="Clients" icon={<Users className="h-4 w-4" />} count={data.clients.length}>
              {data.clients.map((c) => (
                <Row key={c.id} href={`/clients/${c.id}`} title={fullName(c)} sub={c.goal ?? undefined} badge={c.archived ? "Archivé" : undefined} />
              ))}
            </Section>
          )}
          {data.programs.length > 0 && (
            <Section title="Programmes" icon={<ListChecks className="h-4 w-4" />} count={data.programs.length}>
              {data.programs.map((p) => (
                <Row
                  key={p.id}
                  href={`/programs/${p.id}`}
                  title={p.name}
                  sub={[p.clients ? fullName(p.clients) : "Modèle", p.goal ? GOAL_LABELS[p.goal] : null].filter(Boolean).join(" · ")}
                  badge={p.archived ? "Archivé" : p.is_template ? "Modèle" : undefined}
                />
              ))}
            </Section>
          )}
          {data.exercises.length > 0 && (
            <Section title="Exercices" icon={<Dumbbell className="h-4 w-4" />} count={data.exercises.length}>
              {data.exercises.map((e) => (
                <Row key={e.id} href="/exercises" title={e.name} sub={[e.muscle_group, e.equipment].filter(Boolean).join(" · ")} />
              ))}
            </Section>
          )}
          {data.sessions.length > 0 && (
            <Section title="Séances" icon={<Activity className="h-4 w-4" />} count={data.sessions.length}>
              {data.sessions.map((s) => (
                <Row
                  key={s.id}
                  href={`/sessions/${s.id}`}
                  title={`${s.session_name ?? "Séance libre"} — ${s.clients ? fullName(s.clients) : ""}`}
                  sub={`${fmtDate(s.performed_on)}${s.program_name ? ` · ${s.program_name}` : ""}`}
                />
              ))}
            </Section>
          )}
          {data.perfs.length > 0 && (
            <Section title="Performances" icon={<Trophy className="h-4 w-4" />} count={data.perfs.length}>
              {data.perfs.map((p) => (
                <Row
                  key={p.id}
                  href={p.workout_logs.clients ? `/clients/${p.workout_logs.clients.id}?tab=progression` : "#"}
                  title={`${p.exercise_name} — ${p.workout_logs.clients ? fullName(p.workout_logs.clients) : ""}`}
                  sub={`Meilleure série : ${p.load_kg != null ? `${fmtNum(p.load_kg, 2)} kg` : "—"} × ${p.reps ?? "—"} le ${fmtDate(p.workout_logs.performed_on)} · ${p.count} série(s)`}
                />
              ))}
            </Section>
          )}
        </div>
      )}
    </>
  );
}

function Section({ title, icon, count, children }: { title: string; icon: React.ReactNode; count: number; children: React.ReactNode }) {
  return (
    <Card
      padded={false}
      title={
        <span className="flex items-center gap-2">
          <span className="text-royal-400">{icon}</span>
          {title}
          <Badge>{count}</Badge>
        </span>
      }
    >
      <ul className="divide-y divide-ink-750">{children}</ul>
    </Card>
  );
}

function Row({ href, title, sub, badge }: { href: string; title: string; sub?: string; badge?: string }) {
  return (
    <li>
      <Link href={href} className="flex items-center gap-3 px-4 py-3 hover:bg-ink-800 sm:px-5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white">{title}</p>
          {sub && <p className="truncate text-xs text-ink-400">{sub}</p>}
        </div>
        {badge && <Badge tone="amber">{badge}</Badge>}
      </Link>
    </li>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <SearchInner />
    </Suspense>
  );
}
