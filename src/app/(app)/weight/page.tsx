"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ChevronRight, Scale, Search } from "lucide-react";
import { Badge, Card, EmptyState, ErrorBlock, Input, LoadingBlock, PageHeader, ProgressBar, Select } from "@/components/ui";
import { WeightTracker } from "@/components/WeightTracker";
import { getSupabase } from "@/lib/supabase/client";
import { unwrap, useAsync } from "@/lib/hooks";
import { weightSummary } from "@/lib/calc";
import { fmtDate, fmtKg, fmtSignedKg, fullName, initials, matches } from "@/lib/format";
import type { Client, WeighIn, WeightGoal } from "@/lib/types";

function WeightInner() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const selected = params.get("client");
  const [q, setQ] = useState("");

  const { data, loading, error, reload } = useAsync(async () => {
    const sb = getSupabase();
    const [clients, weighIns, goals] = await Promise.all([
      sb.from("clients").select("*").eq("archived", false).order("last_name"),
      sb.from("weigh_ins").select("*").order("measured_on"),
      sb.from("weight_goals").select("*"),
    ]);
    return {
      clients: unwrap(clients) as Client[],
      weighIns: unwrap(weighIns) as WeighIn[],
      goals: unwrap(goals) as WeightGoal[],
    };
  });

  const rows = useMemo(() => {
    if (!data) return [];
    return data.clients.map((c) => ({
      client: c,
      summary: weightSummary(
        data.weighIns.filter((w) => w.client_id === c.id),
        data.goals.find((g) => g.client_id === c.id) ?? null,
      ),
    }));
  }, [data]);

  const tracked = rows.filter((r) => r.summary.hasData || r.summary.targetWeight !== null);
  const filtered = tracked.filter((r) => matches([fullName(r.client)], q));
  const current = data?.clients.find((c) => c.id === selected);

  if (selected) {
    return (
      <>
        <PageHeader
          back={
            <Link href="/weight" className="inline-flex items-center gap-1.5 text-sm text-ink-400 hover:text-ink-100">
              <ArrowLeft className="h-4 w-4" /> Suivi de perte de poids
            </Link>
          }
          title={current ? `Perte de poids — ${fullName(current)}` : "Perte de poids"}
          subtitle={
            current && (
              <Link href={`/clients/${current.id}`} className="text-royal-300 hover:text-royal-200">
                Ouvrir la fiche client
              </Link>
            )
          }
          actions={
            data && (
              <Select
                value={selected}
                onChange={(e) => router.replace(`${pathname}?client=${e.target.value}`)}
                className="w-64"
                aria-label="Changer de client"
              >
                {data.clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {fullName(c)}
                  </option>
                ))}
              </Select>
            )
          }
        />
        <WeightTracker clientId={selected} />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Perte de poids" subtitle="Suivi du poids, des objectifs et de la progression de chaque client." />

      {loading ? (
        <LoadingBlock />
      ) : error ? (
        <ErrorBlock message={error} onRetry={reload} />
      ) : (
        <div className="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un client suivi…" className="pl-10" />
            </div>
            <Select
              value=""
              onChange={(e) => e.target.value && router.push(`${pathname}?client=${e.target.value}`)}
              className="sm:w-72"
              aria-label="Démarrer un suivi"
            >
              <option value="">Ouvrir / démarrer le suivi d&apos;un client…</option>
              {data!.clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {fullName(c)}
                </option>
              ))}
            </Select>
          </div>

          {filtered.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Scale className="h-6 w-6" />}
                title={tracked.length ? "Aucun résultat" : "Aucun suivi de poids en cours"}
                text="Choisissez un client ci-dessus pour enregistrer une première pesée et définir un objectif."
              />
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map(({ client, summary }) => (
                <Link
                  key={client.id}
                  href={`${pathname}?client=${client.id}`}
                  className="card group p-4 transition hover:border-royal-500/50 hover:bg-ink-800"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-royal-600/25 font-display font-semibold text-royal-200">
                      {initials(client)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-white">{fullName(client)}</p>
                      <p className="text-xs text-ink-400">
                        {summary.lastDate ? `Dernière pesée le ${fmtDate(summary.lastDate)}` : "Aucune pesée"}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-ink-600 group-hover:text-royal-400" />
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-[10.5px] uppercase tracking-wider text-ink-500">Départ</p>
                      <p className="mt-0.5 text-sm font-semibold tabular-nums">{fmtKg(summary.startWeight)}</p>
                    </div>
                    <div>
                      <p className="text-[10.5px] uppercase tracking-wider text-ink-500">Actuel</p>
                      <p className="mt-0.5 text-sm font-semibold tabular-nums text-white">{fmtKg(summary.currentWeight)}</p>
                    </div>
                    <div>
                      <p className="text-[10.5px] uppercase tracking-wider text-ink-500">Objectif</p>
                      <p className="mt-0.5 text-sm font-semibold tabular-nums">{fmtKg(summary.targetWeight)}</p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <ProgressBar
                      value={summary.progressBar ?? 0}
                      tone={summary.status === "reached" ? "green" : summary.status === "opposite" ? "amber" : "blue"}
                    />
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="text-ink-400">{fmtSignedKg(summary.totalChange)} depuis le départ</span>
                      {summary.progressRaw !== null ? (
                        <Badge tone={summary.status === "reached" ? "green" : summary.status === "opposite" ? "amber" : "blue"}>
                          {summary.progressRaw} %
                        </Badge>
                      ) : (
                        <Badge>Sans objectif</Badge>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default function WeightPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <WeightInner />
    </Suspense>
  );
}
