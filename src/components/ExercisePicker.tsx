"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Plus, Search } from "lucide-react";
import { Badge, Button, Input, LoadingBlock, Modal, Select, cn } from "./ui";
import { ExerciseForm } from "./ExerciseForm";
import { getSupabase } from "@/lib/supabase/client";
import { matches } from "@/lib/format";
import type { Exercise } from "@/lib/types";

/** Sélection d'un ou plusieurs exercices de la bibliothèque (avec création rapide). */
export function ExercisePicker({
  open,
  onClose,
  onPick,
  multiple = true,
  title = "Ajouter des exercices",
}: {
  open: boolean;
  onClose: () => void;
  onPick: (exercises: Exercise[]) => void | Promise<void>;
  multiple?: boolean;
  title?: string;
}) {
  const [all, setAll] = useState<Exercise[] | null>(null);
  const [q, setQ] = useState("");
  const [muscle, setMuscle] = useState("");
  const [selected, setSelected] = useState<Exercise[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQ("");
    setSelected([]);
    getSupabase()
      .from("exercises")
      .select("*")
      .order("name")
      .then(({ data }) => setAll((data as Exercise[]) ?? []));
  }, [open]);

  const muscles = useMemo(
    () => [...new Set((all ?? []).map((e) => e.muscle_group).filter(Boolean) as string[])].sort(),
    [all],
  );
  const list = useMemo(
    () =>
      (all ?? []).filter(
        (e) => (!muscle || e.muscle_group === muscle) && matches([e.name, e.muscle_group, e.equipment], q),
      ),
    [all, q, muscle],
  );

  async function confirm(items: Exercise[]) {
    if (!items.length) return;
    setBusy(true);
    try {
      await onPick(items);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  function toggle(e: Exercise) {
    if (!multiple) return confirm([e]);
    setSelected((s) => (s.some((x) => x.id === e.id) ? s.filter((x) => x.id !== e.id) : [...s, e]));
  }

  return (
    <>
      <Modal
        open={open && !createOpen}
        onClose={onClose}
        title={title}
        size="lg"
        footer={
          multiple ? (
            <>
              <Button variant="secondary" onClick={onClose}>
                Annuler
              </Button>
              <Button onClick={() => confirm(selected)} disabled={!selected.length} loading={busy}>
                Ajouter {selected.length ? `(${selected.length})` : ""}
              </Button>
            </>
          ) : undefined
        }
      >
        <div className="mb-3 flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher…" className="pl-10" autoFocus />
          </div>
          <Select value={muscle} onChange={(e) => setMuscle(e.target.value)} className="sm:w-48">
            <option value="">Tous les muscles</option>
            {muscles.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </Select>
        </div>

        {all === null ? (
          <LoadingBlock />
        ) : (
          <div className="space-y-1">
            {list.map((e) => {
              const isSel = selected.some((x) => x.id === e.id);
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => toggle(e)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition",
                    isSel ? "border-royal-500 bg-royal-600/15" : "border-transparent hover:bg-ink-800",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border",
                      isSel ? "border-royal-500 bg-royal-600 text-white" : "border-ink-600",
                    )}
                  >
                    {isSel && <Check className="h-3.5 w-3.5" />}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink-100">{e.name}</span>
                  <span className="hidden gap-1 sm:flex">
                    {e.muscle_group && <Badge tone="blue">{e.muscle_group}</Badge>}
                    {e.equipment && <Badge>{e.equipment}</Badge>}
                  </span>
                </button>
              );
            })}
            {list.length === 0 && <p className="py-6 text-center text-sm text-ink-400">Aucun exercice trouvé.</p>}
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="mt-2 flex w-full items-center gap-2 rounded-xl border border-dashed border-ink-600 px-3 py-3 text-sm text-royal-300 transition hover:border-royal-500 hover:bg-royal-600/10"
            >
              <Plus className="h-4 w-4" />
              {q.trim() ? `Créer l'exercice « ${q.trim()} »` : "Créer un nouvel exercice"}
            </button>
          </div>
        )}
      </Modal>
      <ExerciseForm
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        initialName={q.trim()}
        onSaved={(ex) => {
          setAll((a) => [...(a ?? []), ex].sort((x, y) => x.name.localeCompare(y.name)));
          if (multiple) setSelected((s) => [...s, ex]);
          else confirm([ex]);
        }}
      />
    </>
  );
}
