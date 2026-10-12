"use client";

import { useMemo, useState } from "react";
import { Download, Dumbbell, ExternalLink, Pencil, Plus, Search, Trash2 } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorBlock,
  Input,
  LoadingBlock,
  Modal,
  PageHeader,
  Select,
} from "@/components/ui";
import { ExerciseForm } from "@/components/ExerciseForm";
import { useToast } from "@/components/toast";
import { getSupabase } from "@/lib/supabase/client";
import { importStarterLibrary } from "@/lib/data";
import { unwrap, useAsync } from "@/lib/hooks";
import { errorMessage, matches } from "@/lib/format";
import type { Exercise } from "@/lib/types";

type Row = Exercise & { program_exercises: { count: number }[] };

export default function ExercisesPage() {
  const toast = useToast();
  const [q, setQ] = useState("");
  const [muscle, setMuscle] = useState("");
  const [equipment, setEquipment] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Exercise | null>(null);
  const [viewing, setViewing] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);

  const { data, loading, error, reload } = useAsync(async () => {
    return unwrap(await getSupabase().from("exercises").select("*, program_exercises(count)").order("name")) as Row[];
  });

  const muscles = useMemo(() => [...new Set((data ?? []).map((e) => e.muscle_group).filter(Boolean) as string[])].sort(), [data]);
  const equipments = useMemo(() => [...new Set((data ?? []).map((e) => e.equipment).filter(Boolean) as string[])].sort(), [data]);
  const list = useMemo(
    () =>
      (data ?? []).filter(
        (e) =>
          (!muscle || e.muscle_group === muscle) &&
          (!equipment || e.equipment === equipment) &&
          matches([e.name, e.muscle_group, e.equipment, e.movement_type], q),
      ),
    [data, q, muscle, equipment],
  );

  async function importLibrary() {
    setBusy(true);
    try {
      const n = await importStarterLibrary();
      toast.success(n ? `${n} exercices importés.` : "La bibliothèque de base est déjà présente.");
      reload();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    const { error } = await getSupabase().from("exercises").delete().eq("id", deleting.id);
    setBusy(false);
    if (error) return toast.error(errorMessage(error));
    toast.success("Exercice supprimé.");
    setDeleting(null);
    setViewing(null);
    reload();
  }

  return (
    <>
      <PageHeader
        title="Bibliothèque d'exercices"
        subtitle={data ? `${data.length} exercice(s)` : undefined}
        actions={
          <>
            <Button variant="secondary" onClick={importLibrary} loading={busy && !deleting}>
              <Download className="h-4 w-4" /> Bibliothèque de base
            </Button>
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> Nouvel exercice
            </Button>
          </>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_200px_200px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un exercice…" className="pl-10" />
        </div>
        <Select value={muscle} onChange={(e) => setMuscle(e.target.value)} aria-label="Groupe musculaire">
          <option value="">Tous les muscles</option>
          {muscles.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </Select>
        <Select value={equipment} onChange={(e) => setEquipment(e.target.value)} aria-label="Matériel">
          <option value="">Tout le matériel</option>
          {equipments.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </Select>
      </div>

      {loading ? (
        <LoadingBlock />
      ) : error ? (
        <ErrorBlock message={error} onRetry={reload} />
      ) : list.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Dumbbell className="h-6 w-6" />}
            title={data?.length ? "Aucun exercice trouvé" : "Votre bibliothèque est vide"}
            text={data?.length ? "Modifiez la recherche ou les filtres." : "Importez une bibliothèque de base (≈ 45 exercices) ou créez vos propres exercices."}
            action={
              !data?.length ? (
                <Button onClick={importLibrary} loading={busy}>
                  <Download className="h-4 w-4" /> Importer la bibliothèque de base
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((e) => (
            <button
              key={e.id}
              onClick={() => setViewing(e)}
              className="card group flex flex-col items-start p-4 text-left transition hover:border-royal-500/50 hover:bg-ink-800"
            >
              <p className="font-semibold text-white">{e.name}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {e.muscle_group && <Badge tone="blue">{e.muscle_group}</Badge>}
                {e.equipment && <Badge>{e.equipment}</Badge>}
                {e.movement_type && <Badge>{e.movement_type}</Badge>}
              </div>
              <p className="mt-3 text-xs text-ink-500">
                Utilisé dans {e.program_exercises?.[0]?.count ?? 0} séance(s) de programme
                {e.video_url ? " · vidéo disponible" : ""}
              </p>
            </button>
          ))}
        </div>
      )}

      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing?.name ?? ""}
        size="lg"
        footer={
          viewing && (
            <>
              <Button variant="ghost" className="text-red-300 hover:bg-red-500/10 sm:mr-auto" onClick={() => setDeleting(viewing)}>
                <Trash2 className="h-4 w-4" /> Supprimer
              </Button>
              <Button
                onClick={() => {
                  setEditing(viewing);
                  setViewing(null);
                  setFormOpen(true);
                }}
              >
                <Pencil className="h-4 w-4" /> Modifier
              </Button>
            </>
          )
        }
      >
        {viewing && (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-1.5">
              {viewing.muscle_group && <Badge tone="blue">{viewing.muscle_group}</Badge>}
              {viewing.equipment && <Badge>{viewing.equipment}</Badge>}
              {viewing.movement_type && <Badge>{viewing.movement_type}</Badge>}
            </div>
            {[
              ["Description technique", viewing.description],
              ["Consignes d'exécution", viewing.execution_cues],
              ["Erreurs fréquentes", viewing.common_mistakes],
              ["Variantes possibles", viewing.variations],
              ["Notes personnelles", viewing.notes],
            ].map(([label, value]) =>
              value ? (
                <div key={label}>
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-400">{label}</h3>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-ink-200">{value}</p>
                </div>
              ) : null,
            )}
            {viewing.video_url && (
              <a
                href={viewing.video_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-royal-300 hover:text-royal-200"
              >
                <ExternalLink className="h-4 w-4" /> Voir la vidéo de démonstration
              </a>
            )}
            {!viewing.description && !viewing.execution_cues && !viewing.common_mistakes && !viewing.variations && !viewing.notes && (
              <p className="text-sm text-ink-400">Aucun détail technique renseigné. Cliquez sur « Modifier » pour compléter la fiche.</p>
            )}
          </div>
        )}
      </Modal>

      <ExerciseForm open={formOpen} onClose={() => setFormOpen(false)} exercise={editing} onSaved={() => reload()} />

      <ConfirmDialog
        open={!!deleting}
        title="Supprimer cet exercice ?"
        message={
          (deleting?.program_exercises?.[0]?.count ?? 0) > 0 ? (
            <>
              <strong className="text-white">{deleting?.name}</strong> est utilisé dans {deleting?.program_exercises?.[0]?.count} séance(s)
              de programme. Retirez-le d&apos;abord de ces programmes : la suppression sera refusée sinon.
            </>
          ) : (
            <>
              <strong className="text-white">{deleting?.name}</strong> sera supprimé de la bibliothèque. Les performances déjà enregistrées
              conservent le nom de l&apos;exercice.
            </>
          )
        }
        loading={busy}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
