"use client";

import { cn } from "@/lib/cn";
import { restShort, schemeLabel, SCHEMES } from "@/lib/schemes";

/** Boutons « 4 × 8-10 · 1 min 30 » pour choisir un schéma de séries en un clic. */
export function SchemeChips({
  value,
  onChange,
  allowNone = false,
  size = "md",
}: {
  value: string | null;
  onChange: (key: string) => void;
  allowNone?: boolean;
  size?: "sm" | "md";
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {SCHEMES.map((s) => (
        <button
          key={s.key}
          type="button"
          onClick={() => onChange(s.key)}
          title={s.hint}
          className={cn(
            "rounded-lg border text-left transition",
            size === "sm" ? "px-2.5 py-1" : "px-3 py-1.5",
            value === s.key ? "border-royal-500 bg-royal-600/20 text-white" : "border-ink-700 bg-ink-900 text-ink-300 hover:border-ink-500",
          )}
        >
          <span className={cn("block font-semibold tabular-nums", size === "sm" ? "text-[13px]" : "text-sm")}>{schemeLabel(s)}</span>
          <span className="block text-[11px] text-ink-400">repos {restShort(s.rest)}</span>
        </button>
      ))}
      {allowNone && (
        <button
          type="button"
          onClick={() => onChange("none")}
          className={cn(
            "rounded-lg border px-3 py-1.5 text-sm transition",
            value === "none" ? "border-royal-500 bg-royal-600/20 text-white" : "border-ink-700 bg-ink-900 text-ink-400 hover:border-ink-500",
          )}
        >
          Je remplirai après
        </button>
      )}
    </div>
  );
}
