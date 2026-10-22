"use client";

import { useEffect, useState } from "react";
import { BookOpenText } from "lucide-react";
import { Badge, LoadingBlock, Modal } from "./ui";
import { InlineVideo } from "./ExerciseVideo";
import { getSupabase } from "@/lib/supabase/client";
import type { Exercise } from "@/lib/types";

type Sheet = Pick<
  Exercise,
  "id" | "name" | "muscle_group" | "equipment" | "movement_type" | "description" | "execution_cues" | "common_mistakes" | "variations" | "video_url"
>;

const SECTIONS: { key: keyof Sheet; label: string }[] = [
  { key: "description", label: "À quoi ça sert" },
  { key: "execution_cues", label: "Comment le faire" },
  { key: "common_mistakes", label: "Erreurs à éviter" },
  { key: "variations", label: "Variantes" },
];

/** Fiche complète d'un exercice (vidéo + explications), lisible par le coach et par le client. */
export function ExerciseSheetModal({ exerciseId, name, onClose }: { exerciseId: string; name: string; onClose: () => void }) {
  const [ex, setEx] = useState<Sheet | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    getSupabase()
      .from("exercises")
      .select("id, name, muscle_group, equipment, movement_type, description, execution_cues, common_mistakes, variations, video_url")
      .eq("id", exerciseId)
      .maybeSingle()
      .then(({ data, error }) => (error || !data ? setFailed(true) : setEx(data as Sheet)));
  }, [exerciseId]);

  const empty = ex && !SECTIONS.some((s) => ex[s.key]);

  return (
    <Modal open onClose={onClose} title={ex?.name ?? name} size="lg">
      {failed ? (
        <p className="text-sm text-ink-400">Fiche indisponible.</p>
      ) : !ex ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-1.5">
            {ex.muscle_group && <Badge tone="blue">{ex.muscle_group}</Badge>}
            {ex.equipment && <Badge>{ex.equipment}</Badge>}
            {ex.movement_type && <Badge>{ex.movement_type}</Badge>}
          </div>
          {ex.video_url && <InlineVideo url={ex.video_url} title={ex.name} />}
          {SECTIONS.map(({ key, label }) =>
            ex[key] ? (
              <section key={key}>
                <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-royal-300">{label}</h3>
                <p className="whitespace-pre-line text-[15px] leading-relaxed text-ink-100">{String(ex[key])}</p>
              </section>
            ) : null,
          )}
          {empty && <p className="text-sm text-ink-400">Pas encore d&apos;explications pour cet exercice.</p>}
        </div>
      )}
    </Modal>
  );
}

/** Petit bouton « fiche » à placer à côté d'un exercice. */
export function ExerciseSheetButton({ exerciseId, name, className }: { exerciseId: string | null | undefined; name: string; className?: string }) {
  const [open, setOpen] = useState(false);
  if (!exerciseId) return null;
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className={
          className ??
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-royal-300 transition hover:bg-royal-600/15 hover:text-royal-200"
        }
        aria-label={`Fiche de l'exercice : ${name}`}
        title="Voir la fiche de l'exercice"
      >
        <BookOpenText className="h-4 w-4" />
      </button>
      {open && <ExerciseSheetModal exerciseId={exerciseId} name={name} onClose={() => setOpen(false)} />}
    </>
  );
}
