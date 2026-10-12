"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  ChevronRight,
  ClipboardList,
  ClipboardPlus,
  Dumbbell,
  Info,
  ListChecks,
  Pencil,
  Plus,
  Ruler,
  Scale,
  Trash2,
  TrendingUp,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorBlock,
  LinkButton,
  LoadingBlock,
  PageHeader,
  Tabs,
} from "@/components/ui";
import { ClientForm } from "@/components/ClientForm";
import { ProgramForm } from "@/components/ProgramForm";
import { ProgressionPanel, SessionHistory } from "@/components/TrainingPanels";
import { WeightTracker } from "@/components/WeightTracker";
import { MeasurementsPanel } from "@/components/MeasurementsPanel";
import { ReviewsPanel } from "@/components/ReviewsPanel";
import { useToast } from "@/components/toast";
import { getSupabase } from "@/lib/supabase/client";
import { unwrap, useAsync } from "@/lib/hooks";
import { errorMessage, fmtDate, fmtDateLong, fmtRelative, GOAL_LABELS, initials, LEVEL_LABELS } from "@/lib/format";
import type { Client, Program } from "@/lib/types";

const TABS = [
  { key: "infos", label: "Informations", icon: <Info className="h-3.5 w-3.5" /> },
  { key: "programmes", label: "Programmes", icon: <ListChecks className="h-3.5 w-3.5" /> },
  { key: "seances", label: "Historique des séances", icon: <Dumbbell className="h-3.5 w-3.5" /> },
  { key: "progression", label: "Progression sportive", icon: <TrendingUp className="h-3.5 w-3.5" /> },
  { key: "poids", label: "Perte de poids", icon: <Scale className="h-3.5 w-3.5" /> },
  { key: "mensurations", label: "Mensurations", icon: <Ruler className="h-3.5 w-3.5" /> },
  { key: "bilans", label: "Bilans", icon: <ClipboardList className="h-3.5 w-3.5" /> },
] as const;
type TabKey = (typeof TABS)[number]["key"];

function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const toast = useToast();
  const tabParam = params.get("tab") as TabKey | null;
  const tab: TabKey = TABS.some((t) => t.key === tabParam) ? tabParam! : "infos";

  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { data: client, loading, error, reload } = useAsync(
    async () => unwrap(await getSupabase().from("clients").select("*").eq("id", id).single()) as Client,
    [id],
  );

  function setTab(t: TabKey) {
    router.replace(`${pathname}?tab=${t}`, { scroll: false });
  }

  if (loading) return <LoadingBlock />;
  if (error || !client) return <ErrorBlock message={error ?? "Client introuvable."} onRetry={reload} />;

  async function toggleArchive() {
    const { error } = await getSupabase().from("clients").update({ archived: !client!.archived }).eq("id", id);
    if (error) return toast.error(errorMessage(error));
    toast.success(client!.archived ? "Client réactivé." : "Client archivé. Toutes ses données sont conservées.");
    reload();
  }

  async function deleteClient() {
    setDeleting(true);
    const { error } = await getSupabase().from("clients").delete().eq("id", id);
    setDeleting(false);
    if (error) return toast.error(errorMessage(error));
    toast.success("Client supprimé.");
    router.replace("/clients");
  }

  return (
    <>
      <PageHeader
        back={
          <Link href="/clients" className="inline-flex items-center gap-1.5 text-sm text-ink-400 hover:text-ink-100">
            <ArrowLeft className="h-4 w-4" /> Mes clients
          </Link>
        }
        title={
          <span className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-royal-500 to-royal-700 font-display text-xl text-white">
              {initials(client)}
            </span>
            <span className="truncate">
              {client.first_name} {client.last_name}
            </span>
          </span>
        }
        subtitle={
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {client.archived && <Badge tone="amber">Archivé</Badge>}
            {client.goal && <Badge tone="blue">{client.goal}</Badge>}
            {client.level && <Badge>{LEVEL_LABELS[client.level]}</Badge>}
            {client.sessions_per_week != null && <Badge>{client.sessions_per_week} séances / sem.</Badge>}
            <span className="ml-1 text-xs text-ink-500">Fiche créée le {fmtDate(client.created_at)}</span>
          </div>
        }
        actions={
          <>
            <LinkButton href={`/sessions/new?client=${client.id}`}>
              <ClipboardPlus className="h-4 w-4" /> Saisir une séance
            </LinkButton>
            <Button variant="secondary" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" /> Modifier
            </Button>
          </>
        }
      />

      <Tabs tabs={TABS.map((t) => ({ ...t }))} value={tab} onChange={setTab} />

      <div key={tab} className="animate-fade-in">
        {tab === "infos" && (
          <InfoTab client={client} onArchive={toggleArchive} onDelete={() => setConfirmDelete(true)} onEdit={() => setEditOpen(true)} />
        )}
        {tab === "programmes" && <ProgramsTab clientId={client.id} />}
        {tab === "seances" && <SessionHistory clientId={client.id} />}
        {tab === "progression" && <ProgressionPanel clientId={client.id} />}
        {tab === "poids" && <WeightTracker clientId={client.id} />}
        {tab === "mensurations" && <MeasurementsPanel clientId={client.id} />}
        {tab === "bilans" && <ReviewsPanel clientId={client.id} />}
      </div>

      <ClientForm open={editOpen} onClose={() => setEditOpen(false)} client={client} onSaved={() => reload()} />
      <ConfirmDialog
        open={confirmDelete}
        title="Supprimer définitivement ce client ?"
        message={
          <>
            Toutes les données de <strong className="text-white">{client.first_name} {client.last_name}</strong> seront supprimées :
            programmes, séances réalisées, pesées, mensurations et bilans. Cette action est irréversible.
            <span className="mt-2 block text-ink-400">Pour conserver l&apos;historique, préférez l&apos;archivage.</span>
          </>
        }
        confirmLabel="Supprimer définitivement"
        loading={deleting}
        onConfirm={deleteClient}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}

function InfoTab({ client, onArchive, onDelete, onEdit }: { client: Client; onArchive: () => void; onDelete: () => void; onEdit: () => void }) {
  const rows: [string, string | null][] = [
    ["Objectif principal", client.goal],
    ["Niveau sportif", client.level ? LEVEL_LABELS[client.level] : null],
    ["Séances par semaine", client.sessions_per_week != null ? String(client.sessions_per_week) : null],
    ["Date de création de la fiche", fmtDateLong(client.created_at)],
    ["Dernière modification", fmtDateLong(client.updated_at)],
  ];
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <div className="space-y-5">
        <Card
          title="Informations"
          actions={
            <Button size="sm" variant="ghost" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" /> Modifier
            </Button>
          }
        >
          <dl className="grid gap-4 sm:grid-cols-2">
            {rows.map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs uppercase tracking-wider text-ink-500">{k}</dt>
                <dd className="mt-1 text-ink-100">{v || <span className="text-ink-600">Non renseigné</span>}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card title="Contraintes d'entraînement">
          <p className="whitespace-pre-line text-sm leading-relaxed text-ink-200">
            {client.constraints || <span className="text-ink-500">Aucune contrainte renseignée.</span>}
          </p>
        </Card>
        <Card title="Notes privées du coach">
          <p className="whitespace-pre-line text-sm leading-relaxed text-ink-200">
            {client.notes || <span className="text-ink-500">Aucune note.</span>}
          </p>
        </Card>
      </div>
      <Card title="Gestion de la fiche">
        <div className="grid gap-2">
          <Button variant="secondary" className="justify-start" onClick={onArchive}>
            {client.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
            {client.archived ? "Réactiver le client" : "Archiver le client"}
          </Button>
          <Button variant="ghost" className="justify-start text-red-300 hover:bg-red-500/10 hover:text-red-200" onClick={onDelete}>
            <Trash2 className="h-4 w-4" /> Supprimer le client
          </Button>
          <p className="mt-2 text-xs leading-relaxed text-ink-500">
            L&apos;archivage masque le client des listes actives tout en conservant l&apos;intégralité de son historique.
          </p>
        </div>
      </Card>
    </div>
  );
}

function ProgramsTab({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const { data, loading, error, reload } = useAsync(async () => {
    return unwrap(
      await getSupabase()
        .from("programs")
        .select("*, program_sessions(count)")
        .eq("client_id", clientId)
        .order("archived")
        .order("updated_at", { ascending: false }),
    ) as (Program & { program_sessions: { count: number }[] })[];
  }, [clientId]);

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} onRetry={reload} />;

  const active = (data ?? []).filter((p) => !p.archived);
  const archived = (data ?? []).filter((p) => p.archived);

  const List = ({ items }: { items: typeof active }) => (
    <ul className="divide-y divide-ink-750">
      {items.map((p) => (
        <li key={p.id}>
          <Link href={`/programs/${p.id}`} className="group flex items-center gap-3 px-4 py-3.5 hover:bg-ink-800 sm:px-5">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-white">{p.name}</p>
              <p className="mt-0.5 text-sm text-ink-400">
                {p.program_sessions?.[0]?.count ?? 0} séance(s)
                {p.goal ? ` · ${GOAL_LABELS[p.goal]}` : ""}
                {p.duration_weeks ? ` · ${p.duration_weeks} sem.` : ""} · modifié {fmtRelative(p.updated_at)}
              </p>
            </div>
            <ChevronRight className="h-5 w-5 text-ink-600 group-hover:text-royal-400" />
          </Link>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4" /> Nouveau programme
        </Button>
      </div>
      <Card title={`Programmes actifs (${active.length})`} padded={false}>
        {active.length ? (
          <List items={active} />
        ) : (
          <EmptyState icon={<ListChecks className="h-6 w-6" />} title="Aucun programme actif" text="Créez un programme à partir d'un modèle ou d'un programme existant." />
        )}
      </Card>
      {archived.length > 0 && (
        <Card title={`Programmes archivés (${archived.length})`} padded={false}>
          <List items={archived} />
        </Card>
      )}
      <ProgramForm open={formOpen} onClose={() => setFormOpen(false)} defaultClientId={clientId} onSaved={(pid) => router.push(`/programs/${pid}`)} />
    </div>
  );
}

export default function ClientPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <ClientDetail />
    </Suspense>
  );
}
