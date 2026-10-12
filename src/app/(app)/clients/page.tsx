"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ChevronRight, Plus, Search, Users } from "lucide-react";
import { Badge, Button, Card, EmptyState, ErrorBlock, Input, LoadingBlock, PageHeader, Tabs } from "@/components/ui";
import { ClientForm } from "@/components/ClientForm";
import { getSupabase } from "@/lib/supabase/client";
import { unwrap, useAsync } from "@/lib/hooks";
import { fmtDate, initials, LEVEL_LABELS, matches } from "@/lib/format";
import type { Client } from "@/lib/types";

type Row = Client & { programs: { count: number }[] };

export default function ClientsPage() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [view, setView] = useState<"active" | "archived">("active");
  const [formOpen, setFormOpen] = useState(false);

  const { data, loading, error, reload } = useAsync(async () => {
    return unwrap(
      await getSupabase().from("clients").select("*, programs(count)").order("last_name").order("first_name"),
    ) as Row[];
  });

  const list = useMemo(
    () =>
      (data ?? [])
        .filter((c) => (view === "active" ? !c.archived : c.archived))
        .filter((c) => matches([c.first_name, c.last_name, `${c.first_name} ${c.last_name}`, c.goal], q)),
    [data, q, view],
  );
  const archivedCount = (data ?? []).filter((c) => c.archived).length;

  return (
    <>
      <PageHeader
        title="Mes clients"
        subtitle={data ? `${data.length - archivedCount} client(s) actif(s)` : undefined}
        actions={
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" /> Nouveau client
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un client…" className="pl-10" />
        </div>
        <div className="sm:w-auto [&>div]:mb-0">
          <Tabs
            value={view}
            onChange={setView}
            tabs={[
              { key: "active", label: "Actifs" },
              { key: "archived", label: `Archivés (${archivedCount})`, icon: <Archive className="h-3.5 w-3.5" /> },
            ]}
          />
        </div>
      </div>

      {loading ? (
        <LoadingBlock />
      ) : error ? (
        <ErrorBlock message={error} onRetry={reload} />
      ) : list.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Users className="h-6 w-6" />}
            title={q ? "Aucun résultat" : view === "archived" ? "Aucun client archivé" : "Aucun client pour le moment"}
            text={q ? "Essayez avec un autre nom." : view === "active" ? "Ajoutez votre premier client pour commencer." : undefined}
            action={
              !q && view === "active" ? (
                <Button onClick={() => setFormOpen(true)}>
                  <Plus className="h-4 w-4" /> Ajouter un client
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((c, i) => (
            <Link
              key={c.id}
              href={`/clients/${c.id}`}
              className="card group flex items-center gap-4 p-4 transition hover:border-royal-500/50 hover:bg-ink-800 animate-fade-in"
              style={{ animationDelay: `${Math.min(i, 12) * 25}ms` }}
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-royal-600/40 to-royal-800/30 font-display text-lg font-semibold text-royal-200">
                {initials(c)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-white">
                  {c.first_name} {c.last_name}
                </p>
                <p className="truncate text-sm text-ink-400">{c.goal || "Objectif non renseigné"}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {c.level && <Badge tone="blue">{LEVEL_LABELS[c.level]}</Badge>}
                  <Badge>{c.programs?.[0]?.count ?? 0} programme(s)</Badge>
                  {c.sessions_per_week != null && <Badge>{c.sessions_per_week}×/sem.</Badge>}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <ChevronRight className="h-5 w-5 text-ink-600 transition group-hover:translate-x-0.5 group-hover:text-royal-400" />
                <span className="hidden text-[11px] text-ink-500 sm:block">{fmtDate(c.created_at)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <ClientForm open={formOpen} onClose={() => setFormOpen(false)} onSaved={(id) => router.push(`/clients/${id}`)} />
    </>
  );
}
