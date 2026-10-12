"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, ClipboardPlus, Dumbbell, ListChecks, Plus, Scale, Search, UserPlus, Users } from "lucide-react";
import { Badge, Card, EmptyState, ErrorBlock, Input, LoadingBlock, PageHeader, StatCard } from "@/components/ui";
import { ClientForm } from "@/components/ClientForm";
import { ProgramForm } from "@/components/ProgramForm";
import { getSupabase } from "@/lib/supabase/client";
import { unwrap, useAsync } from "@/lib/hooks";
import { fmtDate, fmtRelative, fullName, GOAL_LABELS, initials, matches, todayISO } from "@/lib/format";
import type { Client, Program, WorkoutLog } from "@/lib/types";

export default function DashboardPage() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [clientOpen, setClientOpen] = useState(false);
  const [programOpen, setProgramOpen] = useState(false);

  const { data, loading, error, reload } = useAsync(async () => {
    const sb = getSupabase();
    const ms = todayISO().slice(0, 8) + "01";
    const [clients, programs, logs, monthLogs, tracked] = await Promise.all([
      sb.from("clients").select("*").order("created_at", { ascending: false }),
      sb.from("programs").select("*, clients(id, first_name, last_name)").order("updated_at", { ascending: false }),
      sb
        .from("workout_logs")
        .select("id, performed_on, session_name, program_name, client_id, clients(id, first_name, last_name)")
        .order("performed_on", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(6),
      sb.from("workout_logs").select("id", { count: "exact", head: true }).gte("performed_on", ms),
      sb.from("weigh_ins").select("client_id"),
    ]);
    if (monthLogs.error) throw monthLogs.error;
    return {
      clients: unwrap(clients) as Client[],
      programs: unwrap(programs) as Program[],
      logs: unwrap(logs) as unknown as (WorkoutLog & { clients: Pick<Client, "id" | "first_name" | "last_name"> | null })[],
      monthCount: monthLogs.count ?? 0,
      trackedCount: new Set((unwrap(tracked) as { client_id: string }[]).map((w) => w.client_id)).size,
    };
  });

  const results = useMemo(() => {
    if (!data || !q.trim()) return null;
    return {
      clients: data.clients.filter((c) => matches([fullName(c), c.goal], q)).slice(0, 5),
      programs: data.programs.filter((p) => matches([p.name, p.clients ? fullName(p.clients) : null], q)).slice(0, 5),
    };
  }, [data, q]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";

  if (loading) return <LoadingBlock />;
  if (error || !data) return <ErrorBlock message={error ?? "Erreur"} onRetry={reload} />;

  const activeClients = data.clients.filter((c) => !c.archived);
  const activePrograms = data.programs.filter((p) => !p.archived);

  return (
    <>
      <PageHeader
        title={`${greeting} Geoffroy`}
        subtitle={new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
      />

      {/* Recherche rapide */}
      <div className="relative mb-6">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-500" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && q.trim() && router.push(`/search?q=${encodeURIComponent(q.trim())}`)}
          placeholder="Recherche rapide : client ou programme…"
          className="h-12 rounded-2xl pl-12 text-base"
        />
        {results && (
          <div className="card absolute inset-x-0 top-14 z-20 overflow-hidden p-2 animate-scale-in">
            {results.clients.length + results.programs.length === 0 ? (
              <p className="px-3 py-4 text-sm text-ink-400">Aucun résultat.</p>
            ) : (
              <>
                {results.clients.map((c) => (
                  <Link key={c.id} href={`/clients/${c.id}`} className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-ink-800">
                    <Users className="h-4 w-4 text-royal-400" />
                    <span className="flex-1 text-sm text-white">{fullName(c)}</span>
                    <Badge>Client</Badge>
                  </Link>
                ))}
                {results.programs.map((p) => (
                  <Link key={p.id} href={`/programs/${p.id}`} className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-ink-800">
                    <ListChecks className="h-4 w-4 text-royal-400" />
                    <span className="flex-1 truncate text-sm text-white">
                      {p.name}
                      {p.clients && <span className="text-ink-400"> · {fullName(p.clients)}</span>}
                    </span>
                    <Badge>Programme</Badge>
                  </Link>
                ))}
              </>
            )}
            <Link href={`/search?q=${encodeURIComponent(q.trim())}`} className="mt-1 block rounded-xl px-3 py-2 text-sm text-royal-300 hover:bg-ink-800">
              Recherche complète (exercices, séances, performances) →
            </Link>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Clients actifs" value={activeClients.length} hint={`${data.clients.length} au total`} icon={<Users className="h-4 w-4" />} accent />
        <StatCard label="Programmes" value={data.programs.length} hint={`${activePrograms.length} actif(s)`} icon={<ListChecks className="h-4 w-4" />} />
        <StatCard label="Séances ce mois" value={data.monthCount} hint="séances réalisées saisies" icon={<Dumbbell className="h-4 w-4" />} />
        <StatCard label="Suivis de poids" value={data.trackedCount} hint="clients avec pesées" icon={<Scale className="h-4 w-4" />} />
      </div>

      {/* Raccourcis */}
      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Nouveau client", icon: UserPlus, onClick: () => setClientOpen(true) },
          { label: "Nouveau programme", icon: Plus, onClick: () => setProgramOpen(true) },
          { label: "Saisir une séance", icon: ClipboardPlus, onClick: () => router.push("/sessions/new") },
          { label: "Suivi de perte de poids", icon: Scale, onClick: () => router.push("/weight") },
        ].map(({ label, icon: Icon, onClick }) => (
          <button
            key={label}
            onClick={onClick}
            className="group flex items-center gap-3 rounded-2xl border border-ink-700/70 bg-ink-850/60 px-4 py-4 text-left transition hover:border-royal-500/60 hover:bg-royal-600/10"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-royal-600/15 text-royal-400 transition group-hover:bg-royal-600 group-hover:text-white">
              <Icon className="h-5 w-5" />
            </span>
            <span className="text-sm font-medium text-ink-100">{label}</span>
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Card title="Programmes récemment modifiés" padded={false} actions={<Link href="/programs" className="text-xs text-royal-300 hover:text-royal-200">Tout voir</Link>}>
          {data.programs.length === 0 ? (
            <EmptyState title="Aucun programme" />
          ) : (
            <ul className="divide-y divide-ink-750">
              {data.programs.slice(0, 6).map((p) => (
                <li key={p.id}>
                  <Link href={`/programs/${p.id}`} className="group flex items-center gap-3 px-4 py-3 hover:bg-ink-800 sm:px-5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white">{p.name}</p>
                      <p className="truncate text-xs text-ink-400">
                        {p.clients ? fullName(p.clients) : "Modèle"}
                        {p.goal ? ` · ${GOAL_LABELS[p.goal]}` : ""}
                      </p>
                    </div>
                    <span className="text-xs text-ink-500">{fmtRelative(p.updated_at)}</span>
                    <ChevronRight className="h-4 w-4 text-ink-600 group-hover:text-royal-400" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Clients récemment ajoutés" padded={false} actions={<Link href="/clients" className="text-xs text-royal-300 hover:text-royal-200">Tout voir</Link>}>
          {data.clients.length === 0 ? (
            <EmptyState title="Aucun client" text="Ajoutez votre premier client." />
          ) : (
            <ul className="divide-y divide-ink-750">
              {data.clients.slice(0, 6).map((c) => (
                <li key={c.id}>
                  <Link href={`/clients/${c.id}`} className="group flex items-center gap-3 px-4 py-3 hover:bg-ink-800 sm:px-5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-royal-600/20 font-display text-sm font-semibold text-royal-200">
                      {initials(c)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white">{fullName(c)}</p>
                      <p className="truncate text-xs text-ink-400">{c.goal || "Objectif non renseigné"}</p>
                    </div>
                    <span className="text-xs text-ink-500">{fmtDate(c.created_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Dernières séances réalisées" padded={false} className="lg:col-span-2">
          {data.logs.length === 0 ? (
            <EmptyState title="Aucune séance enregistrée" text="Les séances saisies apparaîtront ici." />
          ) : (
            <ul className="grid divide-y divide-ink-750 md:grid-cols-2 md:divide-y-0">
              {data.logs.map((l) => (
                <li key={l.id} className="md:border-b md:border-ink-750">
                  <Link href={`/sessions/${l.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-ink-800 sm:px-5">
                    <Dumbbell className="h-4 w-4 text-royal-400" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white">{l.clients ? fullName(l.clients) : "Client"}</p>
                      <p className="truncate text-xs text-ink-400">
                        {l.session_name ?? "Séance libre"}
                        {l.program_name ? ` · ${l.program_name}` : ""}
                      </p>
                    </div>
                    <span className="text-xs text-ink-500">{fmtDate(l.performed_on)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <ClientForm open={clientOpen} onClose={() => setClientOpen(false)} onSaved={(id) => router.push(`/clients/${id}`)} />
      <ProgramForm open={programOpen} onClose={() => setProgramOpen(false)} onSaved={(id) => router.push(`/programs/${id}`)} />
    </>
  );
}
