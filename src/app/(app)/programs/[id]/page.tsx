"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ClipboardPlus,
  Copy,
  FileDown,
  GripVertical,
  Layers,
  Pencil,
  Plus,
  RefreshCw,
  Smartphone,
  Trash2,
  UserPlus,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorBlock,
  Field,
  Input,
  LinkButton,
  LoadingBlock,
  Modal,
  PageHeader,
  Select,
  Textarea,
  cn,
} from "@/components/ui";
import { useToast } from "@/components/toast";
import { ProgramForm } from "@/components/ProgramForm";
import { ExercisePicker } from "@/components/ExercisePicker";
import { VideoThumb } from "@/components/ExerciseVideo";
import { ExerciseSheetButton } from "@/components/ExerciseSheet";
import { SchemeChips } from "@/components/SchemeChips";
import { getLastScheme, schemeLabel, schemePatch, SCHEMES, setLastScheme, type Scheme } from "@/lib/schemes";
import { getSupabase } from "@/lib/supabase/client";
import { copySession, duplicateProgram, fetchProgramFull } from "@/lib/data";
import { useAsync } from "@/lib/hooks";
import { usePaths } from "@/lib/mode";
import {
  emptyToNull,
  errorMessage,
  fmtDate,
  fmtNum,
  fmtRest,
  fullName,
  GOAL_LABELS,
  LEVEL_LABELS,
  num,
  parseNum,
  parseRest,
  SET_TYPE_LABELS,
  cardioSummary,
  durationInput,
  isCardioExercise,
  parseDuration,
  parseHrRange,
} from "@/lib/format";
import type { Client, Exercise, ProgramExercise, ProgramSession } from "@/lib/types";

export default function ProgramEditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const paths = usePaths();
  const { data, loading, error, reload, setData } = useAsync(() => fetchProgramFull(id), [id]);

  const [infoOpen, setInfoOpen] = useState(false);
  const [dupOpen, setDupOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState<string | null>(null);

  if (loading) return <LoadingBlock />;
  if (error || !data) return <ErrorBlock message={error ?? "Programme introuvable."} onRetry={reload} />;
  const { program, sessions } = data;
  const sb = getSupabase();

  async function run(fn: () => PromiseLike<{ error: unknown }> | Promise<void>, success?: string) {
    try {
      const res = await fn();
      if (res && typeof res === "object" && "error" in res && res.error) throw res.error;
      if (success) toast.success(success);
    } catch (e) {
      toast.error(errorMessage(e));
    }
    await reload();
  }

  async function addSession() {
    const letter = String.fromCharCode(65 + (sessions.length % 26));
    await run(
      () => sb.from("program_sessions").insert({ program_id: program.id, name: `Séance ${letter}`, position: sessions.length }),
      "Séance ajoutée.",
    );
  }

  async function moveSession(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= sessions.length) return;
    const reordered = arrayMove(sessions, index, target);
    setData({ program, sessions: reordered });
    await run(async () => {
      const results = await Promise.all(
        reordered.map((s, i) => sb.from("program_sessions").update({ position: i }).eq("id", s.id)),
      );
      const failed = results.find((r) => r.error);
      if (failed) throw failed.error;
    });
  }

  async function addExercises(sessionId: string, exs: Exercise[], scheme?: Scheme | null) {
    const session = sessions.find((s) => s.id === sessionId);
    const start = session?.program_exercises?.length ?? 0;
    await run(
      () =>
        sb.from("program_exercises").insert(
          exs.map((e, i) => ({
            session_id: sessionId,
            exercise_id: e.id,
            position: start + i,
            set_type: "travail",
            ...(isCardioExercise(e) ? { sets: 1 } : scheme ? schemePatch(scheme) : { sets: null }),
          })),
        ),
      exs.length > 1 ? `${exs.length} exercices ajoutés.` : "Exercice ajouté.",
    );
  }

  async function reorderExercises(sessionId: string, ordered: ProgramExercise[]) {
    setData({
      program,
      sessions: sessions.map((s) => (s.id === sessionId ? { ...s, program_exercises: ordered } : s)),
    });
    try {
      const results = await Promise.all(
        ordered.map((e, i) => sb.from("program_exercises").update({ position: i }).eq("id", e.id)),
      );
      const failed = results.find((r) => r.error);
      if (failed) throw failed.error;
    } catch (e) {
      toast.error(errorMessage(e));
      reload();
    }
  }

  async function toggleArchive() {
    await run(
      () => sb.from("programs").update({ archived: !program.archived }).eq("id", program.id),
      program.archived ? "Programme réactivé." : "Programme archivé.",
    );
  }

  async function deleteProgram() {
    setDeleting(true);
    const { error } = await sb.from("programs").delete().eq("id", program.id);
    setDeleting(false);
    if (error) return toast.error(errorMessage(error));
    toast.success("Programme supprimé. L'historique des séances réalisées est conservé.");
    router.replace(program.client_id ? `/clients/${program.client_id}?tab=programmes` : "/programs");
  }

  async function exportPdf(format: "a4" | "mobile") {
    setPdfBusy(format);
    try {
      const { exportProgramPdf } = await import("@/lib/pdf");
      await exportProgramPdf(program, sessions, format);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setPdfBusy(null);
    }
  }

  const totalExercises = sessions.reduce((n, s) => n + (s.program_exercises?.length ?? 0), 0);

  return (
    <>
      <PageHeader
        back={
          <Link
            href={paths.clientPrograms(program.client_id)}
            className="inline-flex items-center gap-1.5 text-sm text-ink-400 hover:text-ink-100"
          >
            <ArrowLeft className="h-4 w-4" />
            {paths.isClient ? "Mes programmes" : program.clients ? fullName(program.clients) : "Programmes"}
          </Link>
        }
        title={program.name}
        subtitle={
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {program.archived && <Badge tone="amber">Archivé</Badge>}
            {program.is_template && <Badge tone="blue">★ Modèle</Badge>}
            {program.goal && <Badge tone="blue">{GOAL_LABELS[program.goal]}</Badge>}
            {program.level && <Badge>{LEVEL_LABELS[program.level]}</Badge>}
            {program.split_type && <Badge>{program.split_type}</Badge>}
            {program.duration_weeks && <Badge>{program.duration_weeks} semaines</Badge>}
            {program.sessions_per_week != null && <Badge>{program.sessions_per_week} séances / sem.</Badge>}
            <span className="ml-1 text-xs text-ink-500">
              Créé le {fmtDate(program.created_at)} · modifié le {fmtDate(program.updated_at)}
            </span>
          </div>
        }
        actions={
          <>
            {program.client_id && (
              <LinkButton href={paths.sessionNew({ client: program.client_id, program: program.id })} variant="primary">
                <ClipboardPlus className="h-4 w-4" /> Saisir une séance
              </LinkButton>
            )}
            <Button variant="secondary" onClick={() => exportPdf("a4")} loading={pdfBusy === "a4"}>
              <FileDown className="h-4 w-4" /> PDF
            </Button>
            <Button variant="secondary" onClick={() => exportPdf("mobile")} loading={pdfBusy === "mobile"} title="PDF optimisé smartphone">
              <Smartphone className="h-4 w-4" /> PDF mobile
            </Button>
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <div className="order-2 min-w-0 space-y-4 lg:order-1">
          {sessions.length === 0 ? (
            <Card>
              <EmptyState
                title="Aucune séance"
                text="Ajoutez une première séance (Séance A, Jour 1…) puis ses exercices."
                action={
                  <Button onClick={addSession}>
                    <Plus className="h-4 w-4" /> Ajouter une séance
                  </Button>
                }
              />
            </Card>
          ) : (
            sessions.map((s, i) => (
              <SessionCard
                key={s.id}
                session={s}
                index={i}
                count={sessions.length}
                onMove={(dir) => moveSession(i, dir)}
                onRename={(name) => run(() => sb.from("program_sessions").update({ name }).eq("id", s.id))}
                onSaveNotes={(notes) => run(() => sb.from("program_sessions").update({ notes }).eq("id", s.id), "Note enregistrée.")}
                onCopy={() => run(() => copySession(s, program.id, sessions.length), "Séance copiée.")}
                onDelete={() => run(() => sb.from("program_sessions").delete().eq("id", s.id), "Séance supprimée.")}
                onAddExercise={() => setPickerFor(s.id)}
                onReorder={(ordered) => reorderExercises(s.id, ordered)}
                onSaveExercise={(exId, patch, quiet) =>
                  run(() => sb.from("program_exercises").update(patch).eq("id", exId), quiet ? undefined : "Paramètres enregistrés.")
                }
                onApplyScheme={(scheme) => {
                  const targets = (s.program_exercises ?? []).filter((pe) => !isCardioExercise(pe.exercises) && pe.duration_seconds == null);
                  return run(async () => {
                    const results = await Promise.all(targets.map((pe) => sb.from("program_exercises").update(schemePatch(scheme)).eq("id", pe.id)));
                    const failed = results.find((r) => r.error);
                    if (failed) throw failed.error;
                  }, `${schemeLabel(scheme)} appliqué à ${targets.length} exercice(s).`);
                }}
                onDeleteExercise={(exId) => run(() => sb.from("program_exercises").delete().eq("id", exId), "Exercice retiré.")}
              />
            ))
          )}
          {sessions.length > 0 && (
            <button
              onClick={addSession}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-ink-600 py-4 text-sm font-medium text-ink-300 transition hover:border-royal-500 hover:bg-royal-600/5 hover:text-royal-300"
            >
              <Plus className="h-4 w-4" /> Ajouter une séance
            </button>
          )}
        </div>

        <aside className="order-1 min-w-0 space-y-4 lg:order-2">
          <Card
            title="Programme"
            actions={
              paths.isClient ? undefined : (
                <Button size="sm" variant="ghost" onClick={() => setInfoOpen(true)}>
                  <Pencil className="h-3.5 w-3.5" /> Modifier
                </Button>
              )
            }
          >
            <dl className="space-y-3 text-sm">
              {!paths.isClient && <div className="flex justify-between gap-3">
                <dt className="text-ink-400">Client</dt>
                <dd className="text-right">
                  {program.clients ? (
                    <Link href={`/clients/${program.clients.id}`} className="text-royal-300 hover:text-royal-200">
                      {fullName(program.clients)}
                    </Link>
                  ) : (
                    <span className="text-ink-500">Aucun (modèle)</span>
                  )}
                </dd>
              </div>}
              <div className="flex justify-between gap-3">
                <dt className="text-ink-400">Contenu</dt>
                <dd>
                  {sessions.length} séance(s) · {totalExercises} exercice(s)
                </dd>
              </div>
              {program.description && (
                <div>
                  <dt className="mb-1 text-ink-400">Description</dt>
                  <dd className="whitespace-pre-line text-ink-200">{program.description}</dd>
                </div>
              )}
              {program.instructions && (
                <div>
                  <dt className="mb-1 text-ink-400">Consignes particulières</dt>
                  <dd className="whitespace-pre-line text-ink-200">{program.instructions}</dd>
                </div>
              )}
            </dl>
          </Card>
          {!paths.isClient && <Card title="Actions">
            <div className="grid gap-2">
              <Button variant="secondary" className="justify-start" onClick={() => setDupOpen(true)}>
                <UserPlus className="h-4 w-4" /> Dupliquer / réassigner
              </Button>
              <Button variant="secondary" className="justify-start" onClick={toggleArchive}>
                {program.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                {program.archived ? "Réactiver le programme" : "Archiver le programme"}
              </Button>
              <Button variant="ghost" className="justify-start text-red-300 hover:bg-red-500/10 hover:text-red-200" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-4 w-4" /> Supprimer
              </Button>
            </div>
          </Card>}
        </aside>
      </div>

      <ProgramForm open={infoOpen} onClose={() => setInfoOpen(false)} program={program} onSaved={() => reload()} />
      <DuplicateModal
        open={dupOpen}
        onClose={() => setDupOpen(false)}
        defaultName={program.name}
        currentClientId={program.client_id}
        onDone={async (opts) => {
          const newId = await duplicateProgram(program.id, opts);
          toast.success("Programme dupliqué.");
          router.push(`/programs/${newId}`);
        }}
      />
      <ExercisePicker
        open={!!pickerFor}
        onClose={() => setPickerFor(null)}
        withScheme
        onPick={(exs, scheme) => (pickerFor ? addExercises(pickerFor, exs, scheme) : undefined)}
      />
      <ConfirmDialog
        open={confirmDelete}
        title="Supprimer ce programme ?"
        message={
          <>
            Le programme <strong className="text-white">{program.name}</strong>, ses séances et ses exercices seront supprimés
            définitivement. Les séances déjà réalisées restent dans l&apos;historique du client.
            <br />
            <span className="mt-2 block text-ink-400">Astuce : vous pouvez plutôt l&apos;archiver.</span>
          </>
        }
        loading={deleting}
        onConfirm={deleteProgram}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */

function SessionCard({
  session,
  index,
  count,
  onMove,
  onRename,
  onSaveNotes,
  onCopy,
  onDelete,
  onAddExercise,
  onReorder,
  onSaveExercise,
  onDeleteExercise,
  onApplyScheme,
}: {
  session: ProgramSession;
  index: number;
  count: number;
  onMove: (dir: -1 | 1) => void;
  onRename: (name: string) => void;
  onSaveNotes: (notes: string | null) => void;
  onCopy: () => void;
  onDelete: () => void;
  onAddExercise: () => void;
  onReorder: (ordered: ProgramExercise[]) => void;
  onSaveExercise: (id: string, patch: Partial<ProgramExercise>, quiet?: boolean) => Promise<void>;
  onDeleteExercise: (id: string) => void;
  onApplyScheme: (scheme: Scheme) => Promise<void>;
}) {
  const [name, setName] = useState(session.name);
  const [schemeOpen, setSchemeOpen] = useState(false);
  const [schemeKey, setSchemeKey] = useState<string>("4x8-10");
  const [confirmDel, setConfirmDel] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [notes, setNotes] = useState(session.notes ?? "");
  const exercises = session.program_exercises ?? [];

  useEffect(() => setName(session.name), [session.name]);
  useEffect(() => setNotes(session.notes ?? ""), [session.notes]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = exercises.findIndex((x) => x.id === active.id);
    const to = exercises.findIndex((x) => x.id === over.id);
    onReorder(arrayMove(exercises, from, to));
  }

  return (
    <section className="card overflow-hidden animate-fade-in">
      <header className="flex flex-wrap items-center gap-2 border-b border-ink-700/60 bg-ink-800/60 px-3 py-2.5 sm:px-4">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-royal-600 font-display text-base font-semibold text-white">
          {index + 1}
        </span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            const t = name.trim();
            if (!t) return setName(session.name);
            if (t !== session.name) onRename(t);
          }}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          maxLength={80}
          className="min-w-[9rem] flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 font-display text-lg font-semibold uppercase tracking-wide text-white outline-none hover:border-ink-600 focus:border-royal-500"
          aria-label="Nom de la séance"
        />
        <div className="flex items-center">
          {exercises.length > 0 && (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => {
                setSchemeKey(getLastScheme());
                setSchemeOpen(true);
              }}
              title="Même séries × répétitions pour toute la séance"
              aria-label="Appliquer un schéma à toute la séance"
            >
              <Layers className="h-4 w-4" />
            </Button>
          )}
          <Button size="icon" variant="ghost" onClick={() => onMove(-1)} disabled={index === 0} aria-label="Monter la séance">
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => onMove(1)} disabled={index === count - 1} aria-label="Descendre la séance">
            <ArrowDown className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={onCopy} title="Copier la séance" aria-label="Copier la séance">
            <Copy className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => setNotesOpen((v) => !v)} title="Note de séance" aria-label="Note de séance">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="hover:text-red-300"
            onClick={() => setConfirmDel(true)}
            aria-label="Supprimer la séance"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {(notesOpen || session.notes) && (
        <div className="border-b border-ink-700/60 px-4 py-3">
          {notesOpen ? (
            <div className="space-y-2">
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Note pour cette séance (échauffement, objectif du jour…)" maxLength={2000} />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setNotesOpen(false)}>
                  Fermer
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    onSaveNotes(emptyToNull(notes));
                    setNotesOpen(false);
                  }}
                >
                  Enregistrer
                </Button>
              </div>
            </div>
          ) : (
            <p className="whitespace-pre-line text-sm text-ink-300">{session.notes}</p>
          )}
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={exercises.map((e) => e.id)} strategy={verticalListSortingStrategy}>
          <ul className="divide-y divide-ink-750">
            {exercises.map((pe, i) => (
              <SortableExerciseRow
                key={pe.id}
                pe={pe}
                index={i}
                onSave={(patch, quiet) => onSaveExercise(pe.id, patch, quiet)}
                onDelete={() => onDeleteExercise(pe.id)}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      <div className="p-3">
        <Button variant="ghost" size="sm" onClick={onAddExercise} className="w-full border border-dashed border-ink-600 text-royal-300 hover:border-royal-500">
          <Plus className="h-4 w-4" /> Ajouter un exercice
        </Button>
      </div>

      <Modal
        open={schemeOpen}
        onClose={() => setSchemeOpen(false)}
        title="Toute la séance"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setSchemeOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={async () => {
                const sc = SCHEMES.find((x) => x.key === schemeKey);
                if (!sc) return;
                setLastScheme(sc.key);
                setSchemeOpen(false);
                await onApplyScheme(sc);
              }}
            >
              Appliquer
            </Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-ink-300">
          Mettre les mêmes séries, répétitions et repos à tous les exercices de musculation de <strong className="text-white">{session.name}</strong>.
          Les charges et les autres réglages ne changent pas.
        </p>
        <SchemeChips value={schemeKey} onChange={setSchemeKey} />
      </Modal>

      <ConfirmDialog
        open={confirmDel}
        title="Supprimer cette séance ?"
        message={
          <>
            La séance <strong className="text-white">{session.name}</strong> et ses {exercises.length} exercice(s) seront retirés du
            programme. Les séances déjà réalisées sont conservées dans l&apos;historique.
          </>
        }
        onConfirm={() => {
          setConfirmDel(false);
          onDelete();
        }}
        onCancel={() => setConfirmDel(false)}
      />
    </section>
  );
}

function paramsSummary(pe: ProgramExercise) {
  const parts: string[] = [];
  const cardio = cardioSummary(pe);
  if (cardio.length) {
    if (pe.sets && pe.sets > 1) parts.push(`${pe.sets} ×`);
    parts.push(...cardio);
  }
  if (pe.reps) parts.push(`${pe.sets ?? "?"} × ${pe.reps}`);
  else if (pe.sets && !cardio.length) parts.push(`${pe.sets} série(s)`);
  if (num(pe.load_kg) !== null) parts.push(`${fmtNum(pe.load_kg, 2)} kg`);
  if (num(pe.rpe) !== null) parts.push(`RPE ${fmtNum(pe.rpe)}`);
  if (pe.rir !== null && pe.rir !== undefined) parts.push(`RIR ${pe.rir}`);
  if (pe.rest_seconds != null) parts.push(`Repos ${fmtRest(pe.rest_seconds)}`);
  if (pe.tempo) parts.push(`Tempo ${pe.tempo}`);
  return parts;
}

/** Réglages secondaires affichés sous le nom (les 4 principaux sont modifiables directement). */
function extrasSummary(pe: ProgramExercise) {
  const parts: string[] = [];
  if (num(pe.rpe) !== null) parts.push(`RPE ${fmtNum(pe.rpe)}`);
  if (pe.rir !== null && pe.rir !== undefined) parts.push(`RIR ${pe.rir}`);
  if (pe.tempo) parts.push(`Tempo ${pe.tempo}`);
  return parts;
}

function restInput(s: number | null | undefined): string {
  if (s == null) return "";
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m}:${String(r).padStart(2, "0")}` : `${m} min`;
}

/** Séries, répétitions, charge et repos modifiables directement dans la liste (enregistrement automatique). */
function QuickParams({ pe, onSave }: { pe: ProgramExercise; onSave: (patch: Partial<ProgramExercise>) => Promise<void> }) {
  const [f, setF] = useState({
    sets: pe.sets?.toString() ?? "",
    reps: pe.reps ?? "",
    load: num(pe.load_kg)?.toString().replace(".", ",") ?? "",
    rest: restInput(pe.rest_seconds),
  });
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => setF((x) => ({ ...x, sets: pe.sets?.toString() ?? "" })), [pe.sets]);
  useEffect(() => setF((x) => ({ ...x, reps: pe.reps ?? "" })), [pe.reps]);
  useEffect(() => setF((x) => ({ ...x, load: num(pe.load_kg)?.toString().replace(".", ",") ?? "" })), [pe.load_kg]);
  useEffect(() => setF((x) => ({ ...x, rest: restInput(pe.rest_seconds) })), [pe.rest_seconds]);

  async function commit(k: keyof typeof f) {
    setErr(null);
    const v = f[k].trim();
    let patch: Partial<ProgramExercise> | null = null;
    if (k === "sets") {
      const n = v ? parseNum(v) : null;
      if (v && (n === null || !Number.isInteger(n) || n < 0 || n > 50)) return setErr("Séries : nombre entre 0 et 50.");
      if (n !== (pe.sets ?? null)) patch = { sets: n };
    } else if (k === "reps") {
      if ((v || null) !== (pe.reps ?? null)) patch = { reps: v.slice(0, 30) || null };
    } else if (k === "load") {
      const n = v ? parseNum(v) : null;
      if (v && (n === null || n < 0 || n > 1000)) return setErr("Charge invalide.");
      if (n !== num(pe.load_kg)) patch = { load_kg: n };
    } else {
      const n = v ? parseRest(v) : null;
      if (v && (n === null || n > 3600)) return setErr("Repos : ex. 90, 1:30 ou 2 min.");
      if (n !== (pe.rest_seconds ?? null)) patch = { rest_seconds: n };
    }
    if (patch) await onSave(patch);
  }

  const cells: { k: keyof typeof f; label: string; ph: string; mode: "numeric" | "decimal" | "text" }[] = [
    { k: "sets", label: "Séries", ph: "4", mode: "numeric" },
    { k: "reps", label: "Répét.", ph: "8-10", mode: "text" },
    { k: "load", label: "Charge kg", ph: "—", mode: "decimal" },
    { k: "rest", label: "Repos", ph: "1:30", mode: "text" },
  ];
  return (
    <div className="px-3 pb-3 sm:pl-[3.25rem] sm:pr-4">
      <div className="grid max-w-md grid-cols-4 gap-2">
        {cells.map((c) => (
          <label key={c.k} className="min-w-0">
            <span className="mb-0.5 block truncate text-[10.5px] font-medium uppercase tracking-wider text-ink-500">{c.label}</span>
            <input
              className="input-sm text-center tabular-nums"
              value={f[c.k]}
              inputMode={c.mode}
              placeholder={c.ph}
              maxLength={c.k === "reps" ? 30 : 12}
              aria-label={`${c.label} — ${pe.exercises?.name ?? "exercice"}`}
              onChange={(e) => setF({ ...f, [c.k]: e.target.value })}
              onBlur={() => commit(c.k)}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            />
          </label>
        ))}
      </div>
      {err && <p className="mt-1.5 text-xs text-red-400">{err}</p>}
    </div>
  );
}

function SortableExerciseRow({
  pe,
  index,
  onSave,
  onDelete,
}: {
  pe: ProgramExercise;
  index: number;
  onSave: (patch: Partial<ProgramExercise>, quiet?: boolean) => Promise<void>;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: pe.id });
  const [editing, setEditing] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [swapOpen, setSwapOpen] = useState(false);
  const isStrength = !isCardioExercise(pe.exercises) && pe.duration_seconds == null && num(pe.distance_km) === null && pe.hr_min == null && !pe.intensity;
  const summary = isStrength ? extrasSummary(pe) : paramsSummary(pe);

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("bg-ink-850/80", isDragging && "relative z-10 rounded-xl shadow-glow ring-1 ring-royal-500")}
    >
      <div className="flex items-start gap-2 px-2 py-3 sm:px-3">
        <button
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          className="mt-0.5 flex h-8 w-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-ink-500 hover:bg-ink-750 hover:text-ink-200 active:cursor-grabbing"
          aria-label="Déplacer l'exercice"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <VideoThumb url={pe.exercises?.video_url} title={pe.exercises?.name ?? "Exercice"} size="sm" />
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setEditing((v) => !v)}>
          <div className="flex items-start gap-2">
            <span className="mt-0.5 text-xs font-semibold tabular-nums text-ink-500">{index + 1}.</span>
            <span className="line-clamp-2 font-medium leading-snug text-white">{pe.exercises?.name ?? "Exercice supprimé"}</span>
            {pe.set_type && pe.set_type !== "travail" && <Badge tone="amber">{SET_TYPE_LABELS[pe.set_type]}</Badge>}
          </div>
          {isStrength ? (
            summary.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {summary.map((s) => (
                  <span key={s} className="rounded-md bg-ink-750 px-2 py-0.5 text-[12px] tabular-nums text-ink-200">
                    {s}
                  </span>
                ))}
              </div>
            )
          ) : summary.length > 0 ? (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {summary.map((s) => (
                <span key={s} className="rounded-md bg-ink-750 px-2 py-0.5 text-[12px] tabular-nums text-ink-200">
                  {s}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-xs text-ink-500">Touchez pour définir séries, répétitions, charge…</p>
          )}
          {pe.technical_cues && !editing && <p className="mt-1.5 line-clamp-2 text-xs italic text-ink-400">{pe.technical_cues}</p>}
        </button>
        <div className="flex">
          <ExerciseSheetButton exerciseId={pe.exercise_id} name={pe.exercises?.name ?? "Exercice"} />
          <Button size="icon" variant="ghost" onClick={() => setEditing((v) => !v)} aria-label="Modifier les paramètres">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" className="hover:text-red-300" onClick={() => setConfirmDel(true)} aria-label="Retirer l'exercice">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {isStrength && !editing && <QuickParams pe={pe} onSave={(patch) => onSave(patch, true)} />}
      {editing && (
        <ParamsEditor
          pe={pe}
          onCancel={() => setEditing(false)}
          onSwap={() => setSwapOpen(true)}
          onSave={async (patch) => {
            await onSave(patch);
            setEditing(false);
          }}
        />
      )}
      <ExercisePicker
        open={swapOpen}
        onClose={() => setSwapOpen(false)}
        multiple={false}
        title="Remplacer l'exercice"
        onPick={(exs) => onSave({ exercise_id: exs[0].id })}
      />
      <ConfirmDialog
        open={confirmDel}
        title="Retirer cet exercice ?"
        message={
          <>
            <strong className="text-white">{pe.exercises?.name}</strong> sera retiré de cette séance. La fiche de l&apos;exercice reste dans
            la bibliothèque.
          </>
        }
        confirmLabel="Retirer"
        onConfirm={() => {
          setConfirmDel(false);
          onDelete();
        }}
        onCancel={() => setConfirmDel(false)}
      />
    </li>
  );
}

function ParamsEditor({
  pe,
  onSave,
  onCancel,
  onSwap,
}: {
  pe: ProgramExercise;
  onSave: (patch: Partial<ProgramExercise>) => Promise<void>;
  onCancel: () => void;
  onSwap: () => void;
}) {
  const [f, setF] = useState({
    sets: pe.sets?.toString() ?? "",
    reps: pe.reps ?? "",
    load_kg: num(pe.load_kg)?.toString().replace(".", ",") ?? "",
    rpe: num(pe.rpe)?.toString().replace(".", ",") ?? "",
    rir: pe.rir?.toString() ?? "",
    rest: restInput(pe.rest_seconds),
    tempo: pe.tempo ?? "",
    set_type: pe.set_type ?? "",
    technical_cues: pe.technical_cues ?? "",
    comments: pe.comments ?? "",
    duration: durationInput(pe.duration_seconds),
    distance: num(pe.distance_km)?.toString().replace(".", ",") ?? "",
    intensity: pe.intensity ?? "",
    hr: pe.hr_min != null ? (pe.hr_max != null && pe.hr_max !== pe.hr_min ? `${pe.hr_min}-${pe.hr_max}` : String(pe.hr_min)) : "",
  });
  const [cardio, setCardio] = useState(
    isCardioExercise(pe.exercises) || pe.duration_seconds != null || num(pe.distance_km) !== null || pe.hr_min != null || !!pe.intensity,
  );
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [advanced, setAdvanced] = useState(
    num(pe.rpe) !== null || pe.rir != null || !!pe.tempo || (!!pe.set_type && pe.set_type !== "travail") || !!pe.comments,
  );
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF((x) => ({ ...x, [k]: e.target.value }));

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    setErr(null);
    const sets = parseNum(f.sets);
    const load = parseNum(f.load_kg);
    const rpe = parseNum(f.rpe);
    const rir = parseNum(f.rir);
    const rest = f.rest.trim() ? parseRest(f.rest) : null;
    if (f.sets && (sets === null || !Number.isInteger(sets) || sets < 0 || sets > 50)) return setErr("Séries : nombre entier entre 0 et 50.");
    if (f.load_kg && (load === null || load < 0 || load > 1000)) return setErr("Charge invalide.");
    if (f.rpe && (rpe === null || rpe < 1 || rpe > 10)) return setErr("RPE : entre 1 et 10.");
    if (f.rir && (rir === null || !Number.isInteger(rir) || rir < 0 || rir > 10)) return setErr("RIR : entier entre 0 et 10.");
    if (f.rest.trim() && (rest === null || rest > 3600)) return setErr("Repos : ex. 90, 90 s, 2 min ou 2:30.");
    const duration = f.duration.trim() ? parseDuration(f.duration) : null;
    if (f.duration.trim() && (duration === null || duration > 86400)) return setErr("Durée : ex. 20 (minutes), 32:30 ou 1h15.");
    const distance = parseNum(f.distance);
    if (f.distance.trim() && (distance === null || distance < 0 || distance > 1000)) return setErr("Distance invalide (en km).");
    const hr = parseHrRange(f.hr);
    if (hr === "invalid") return setErr("FC cible : ex. 140 ou 130-150 (bpm).");
    setSaving(true);
    try {
      await onSave({
        sets,
        reps: emptyToNull(f.reps),
        load_kg: load,
        rpe,
        rir,
        rest_seconds: rest,
        tempo: emptyToNull(f.tempo),
        set_type: (emptyToNull(f.set_type) as ProgramExercise["set_type"]) ?? null,
        technical_cues: emptyToNull(f.technical_cues),
        comments: emptyToNull(f.comments),
        duration_seconds: duration,
        distance_km: distance,
        intensity: emptyToNull(f.intensity),
        hr_min: hr[0],
        hr_max: hr[1],
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="border-t border-ink-700/60 bg-ink-900/70 px-3 py-4 sm:px-5 animate-fade-in">
      <div className="mb-4 inline-flex rounded-lg border border-ink-700 bg-ink-900 p-0.5 text-xs font-medium">
        {[
          { v: false, label: "Musculation" },
          { v: true, label: "Cardio" },
        ].map((o) => (
          <button
            key={o.label}
            type="button"
            onClick={() => setCardio(o.v)}
            className={cn("rounded-md px-3 py-1.5 transition", cardio === o.v ? "bg-royal-600 text-white" : "text-ink-400 hover:text-ink-100")}
          >
            {o.label}
          </button>
        ))}
      </div>
      {cardio ? (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Durée" hint="Minutes, ou 32:30, 1h15">
          <Input value={f.duration} onChange={set("duration")} placeholder="30" />
        </Field>
        <Field label="Distance (km)">
          <Input inputMode="decimal" value={f.distance} onChange={set("distance")} placeholder="5" />
        </Field>
        <Field label="FC cible (bpm)" hint="Ex. 130-150">
          <Input value={f.hr} onChange={set("hr")} placeholder="130-150" />
        </Field>
        <Field label="RPE cible">
          <Input inputMode="decimal" value={f.rpe} onChange={set("rpe")} placeholder="6" />
        </Field>
        <Field label="Intensité" className="col-span-2" hint="Zone, allure, vitesse, % FC max…">
          <Input value={f.intensity} onChange={set("intensity")} placeholder="Zone 2 · allure 6:00/km" maxLength={60} />
        </Field>
        <Field label="Blocs / répétitions">
          <Input inputMode="numeric" value={f.sets} onChange={set("sets")} placeholder="1" />
        </Field>
        <Field label="Récup. entre blocs">
          <Input value={f.rest} onChange={set("rest")} placeholder="1:30" />
        </Field>
        <Field label="Consignes" className="col-span-2 sm:col-span-4">
          <Textarea value={f.technical_cues} onChange={set("technical_cues")} rows={2} placeholder="Ex. : rester en aisance respiratoire, cadence 85-90 rpm" maxLength={2000} />
        </Field>
        <Field label="Commentaire" className="col-span-2 sm:col-span-4">
          <Textarea value={f.comments} onChange={set("comments")} rows={2} maxLength={2000} />
        </Field>
      </div>
      ) : (
      <div className="space-y-4">
        <div>
          <p className="label">Remplissage rapide</p>
          <SchemeChips
            size="sm"
            value={SCHEMES.find((x) => String(x.sets) === f.sets && x.reps === f.reps && restInput(x.rest) === f.rest)?.key ?? null}
            onChange={(key) => {
              const sc = SCHEMES.find((x) => x.key === key);
              if (sc) setF((x) => ({ ...x, sets: String(sc.sets), reps: sc.reps, rest: restInput(sc.rest) }));
            }}
          />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Séries">
            <Input inputMode="numeric" value={f.sets} onChange={set("sets")} placeholder="4" />
          </Field>
          <Field label="Répétitions">
            <Input value={f.reps} onChange={set("reps")} placeholder="6-8" maxLength={30} />
          </Field>
          <Field label="Charge (kg)">
            <Input inputMode="decimal" value={f.load_kg} onChange={set("load_kg")} placeholder="80" />
          </Field>
          <Field label="Repos">
            <Input value={f.rest} onChange={set("rest")} placeholder="1:30" />
          </Field>
        </div>
        <Field label="Consignes techniques">
          <Textarea value={f.technical_cues} onChange={set("technical_cues")} rows={2} placeholder="Ex. : omoplates serrées, contrôler la descente" maxLength={2000} />
        </Field>
        <button
          type="button"
          onClick={() => setAdvanced((v) => !v)}
          className="text-sm font-medium text-royal-300 hover:text-royal-200"
          aria-expanded={advanced}
        >
          {advanced ? "− Moins d'options" : "+ Plus d'options (RPE, RIR, tempo, type de série, commentaire)"}
        </button>
        {advanced && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 animate-fade-in">
            <Field label="RPE cible">
              <Input inputMode="decimal" value={f.rpe} onChange={set("rpe")} placeholder="8" />
            </Field>
            <Field label="RIR cible">
              <Input inputMode="numeric" value={f.rir} onChange={set("rir")} placeholder="2" />
            </Field>
            <Field label="Tempo">
              <Input value={f.tempo} onChange={set("tempo")} placeholder="3-1-1-0" maxLength={20} />
            </Field>
            <Field label="Type de série">
              <Select value={f.set_type} onChange={set("set_type")}>
                <option value="">—</option>
                {Object.entries(SET_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Commentaire" className="col-span-2 sm:col-span-4">
              <Textarea value={f.comments} onChange={set("comments")} rows={2} maxLength={2000} />
            </Field>
          </div>
        )}
      </div>
      )}
      {err && <p className="mt-3 text-sm text-red-400">{err}</p>}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <Button size="sm" variant="ghost" onClick={onSwap}>
          <RefreshCw className="h-3.5 w-3.5" /> Remplacer l&apos;exercice
        </Button>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={onCancel}>
            Annuler
          </Button>
          <Button size="sm" type="submit" loading={saving}>
            Enregistrer
          </Button>
        </div>
      </div>
    </form>
  );
}

function DuplicateModal({
  open,
  onClose,
  defaultName,
  currentClientId,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  defaultName: string;
  currentClientId: string | null;
  onDone: (opts: { name: string; client_id: string | null; is_template: boolean }) => Promise<void>;
}) {
  const toast = useToast();
  const [clients, setClients] = useState<Pick<Client, "id" | "first_name" | "last_name">[]>([]);
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState("");
  const [isTemplate, setIsTemplate] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(`${defaultName} (copie)`);
    setClientId(currentClientId ?? "");
    setIsTemplate(false);
    getSupabase()
      .from("clients")
      .select("id, first_name, last_name")
      .eq("archived", false)
      .order("last_name")
      .then(({ data }) => setClients(data ?? []));
  }, [open, defaultName, currentClientId]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Dupliquer le programme"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button
            loading={busy}
            onClick={async () => {
              if (!name.trim()) return;
              setBusy(true);
              try {
                await onDone({ name: name.trim(), client_id: clientId || null, is_template: isTemplate });
                onClose();
              } catch (e) {
                toast.error(errorMessage(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            Dupliquer
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-ink-400">
          Une copie indépendante est créée : la modifier n&apos;affectera jamais le programme d&apos;origine.
        </p>
        <Field label="Nom de la copie">
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
        </Field>
        <Field label="Associer au client">
          <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">— Aucun (modèle) —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {fullName(c)}
              </option>
            ))}
          </Select>
        </Field>
        <label className="flex items-center gap-3">
          <input type="checkbox" checked={isTemplate} onChange={(e) => setIsTemplate(e.target.checked)} className="h-4 w-4 accent-royal-500" />
          <span className="text-sm text-ink-200">Marquer la copie comme modèle réutilisable</span>
        </label>
      </div>
    </Modal>
  );
}
