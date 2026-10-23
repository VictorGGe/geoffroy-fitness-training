"use client";

import { Flame } from "lucide-react";
import { cn } from "@/lib/cn";
import { useMode } from "@/lib/mode";

/** Calories estimées — visible uniquement par le coach. */
export function KcalChip({ kcal, title, strong, className }: { kcal: number | null | undefined; title?: string; strong?: boolean; className?: string }) {
  const isClient = useMode() === "client";
  if (isClient || kcal == null || kcal <= 0) return null;
  return (
    <span
      title={title ?? "Calories estimées (visible uniquement par toi)"}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[11.5px] font-medium tabular-nums",
        strong ? "border-amber-400/40 bg-amber-500/15 text-amber-200" : "border-amber-500/25 bg-amber-500/10 text-amber-300",
        className,
      )}
    >
      <Flame className="h-3 w-3" />≈ {Math.round(kcal).toLocaleString("fr-FR")} kcal
    </span>
  );
}
