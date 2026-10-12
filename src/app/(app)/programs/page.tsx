"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, ListChecks, Plus, Search } from "lucide-react";
import { Badge, Button, Card, EmptyState, ErrorBlock, Input, LoadingBlock, PageHeader, Select } from "@/components/ui";
import { ProgramForm } from "@/components/ProgramForm";
import { getSupabase } from "@/lib/supabase/client";
import { unwrap, useAsync } from "@/lib/hooks";
import { fmtRelative, fullName, GOAL_LABELS, LEVEL_LABELS, matches } from "@/lib/format";
import type { Program } from "@/lib/types";

type Row = Program & { program_sessions: { count: number }[] };

function ProgramsInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"active" | "archived" | "templates" | "all">("active");
  const [client, setClient] = useState("");
  const [goal, setGoal] = useState("");
  const [split, setSplit] = useState("");
  const [formOpen, setFormOpen] = useState(params.get("new") === "1");

  const { data, loading, error, reload } = useAsync(async () => {
    return unwrap(
      await getSupabase()
        .from("programs")
        .select("*, clients(id, first_name, last_name), program_sessions(count)")
        .order("updated_at", { ascending: false }),
    ) as Row[];
  });

  const clients = useMemo(() => {
    const m = new Map<string, string>();
    (data ?? []).forEach((p) => p.clients && m.set(p.clients.id, fullName(p.clients)));
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [data]);
  const splits = useMemo(() => [...new Set((data ?? []).map((p) => p.split_type).filter(Boolean) as string[])].sort(), [data]);

  const list = useMemo(
    () =>
      (data ?? []).filter((p) => {
        if (status === "active" && p.archived) return false;
        if (status === "archived" && !p.archived) return false;
        if (status === "templates" && !p.is_template) return false;
        if (client === "__none" && p.client_id) return false;
        if (client && client !== "__none" && p.client_id !== client) return false;
        if (goal && p.goal !== goal) return false;
        if (split && p.split_type !== split) return false;
        return matches([p.name, p.description, p.split_type, p.clients ? fullName(p.clients) : null], q);
      }),
    [data, status, client, goal, split, q],
  );

  return (
    <>
      <PageHeader
        title="Programmes"
        subtitle={data ? `${data.filter((p) => !p.archived).length} programme(s) actif(s)` : undefined}
        actions={
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" /> Nouveau programme
          </Button>
        }
      />

      <Card className="mb-4" padded>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher…" className="pl-10" />
          </div>
          <Select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Statut">
            <option value="active">Programmes actifs</option>
            <option value="archived">Programmes archivés</option>
            <option value="templates">Modèles</option>
            <option value="all">Tous</option>
          </Select>
          <Select value={client} onChange={(e) => setClient(e.target.value)} aria-label="Client">
            <option value="">Tous les clients</option>
            <option value="__none">Sans client (modèles)</option>
            {clients.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </Select>
          <Select value={goal} onChange={(e) => setGoal(e.target.value)} aria-label="Objectif">
            <option value="">Tous les objectifs</option>
            {Object.entries(GOAL_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
          <Select value={split} onChange={(e) => setSplit(e.target.value)} aria-label="Type de programme">
            <option value="">Tous les types</option>
            {splits.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </div>
      </Card>

      {loading ? (
        <LoadingBlock />
      ) : error ? (
        <ErrorBlock message={error} onRetry={reload} />
      ) : list.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ListChecks className="h-6 w-6" />}
            title="Aucun programme"
            text={data?.length ? "Aucun programme ne correspond à ces filtres." : "Créez votre premier programme à partir d'un modèle ou d'une page blanche."}
            action={
              !data?.length ? (
                <Button onClick={() => setFormOpen(true)}>
                  <Plus className="h-4 w-4" /> Créer un programme
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <Card padded={false}>
          <ul className="divide-y divide-ink-750">
            {list.map((p) => (
              <li key={p.id}>
                <Link href={`/programs/${p.id}`} className="group flex items-center gap-4 px-4 py-3.5 transition hover:bg-ink-800 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-semibold text-white">{p.name}</p>
                      {p.is_template && <Badge tone="blue">★ Modèle</Badge>}
                      {p.archived && <Badge tone="amber">Archivé</Badge>}
                    </div>
                    <p className="mt-0.5 truncate text-sm text-ink-400">
                      {p.clients ? fullName(p.clients) : "Sans client"} · {p.program_sessions?.[0]?.count ?? 0} séance(s)
                      {p.split_type ? ` · ${p.split_type}` : ""}
                    </p>
                  </div>
                  <div className="hidden flex-wrap justify-end gap-1.5 md:flex">
                    {p.goal && <Badge tone="blue">{GOAL_LABELS[p.goal]}</Badge>}
                    {p.level && <Badge>{LEVEL_LABELS[p.level]}</Badge>}
                  </div>
                  <span className="hidden w-24 text-right text-xs text-ink-500 sm:block">{fmtRelative(p.updated_at)}</span>
                  <ChevronRight className="h-5 w-5 text-ink-600 transition group-hover:text-royal-400" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <ProgramForm open={formOpen} onClose={() => setFormOpen(false)} onSaved={(id) => router.push(`/programs/${id}`)} />
    </>
  );
}

export default function ProgramsPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <ProgramsInner />
    </Suspense>
  );
}
