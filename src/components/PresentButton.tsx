"use client";

import { useEffect, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";

/** Affiche un bloc en plein écran, pratique pour présenter pendant un bilan. */
export function PresentButton({ targetId }: { targetId: string }) {
  const [full, setFull] = useState(false);
  useEffect(() => {
    const on = () => setFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);

  async function toggle() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.getElementById(targetId)?.requestFullscreen();
    } catch {
      /* plein écran indisponible (ex. iPhone) : la page reste lisible normalement */
    }
  }

  return (
    <button
      onClick={toggle}
      className="inline-flex items-center gap-2 rounded-xl border border-ink-600 px-3 py-2 text-sm font-medium text-ink-200 transition hover:border-royal-500 hover:text-white"
    >
      {full ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
      {full ? "Quitter le plein écran" : "Présenter en plein écran"}
    </button>
  );
}
