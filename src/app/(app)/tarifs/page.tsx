import type { Metadata } from "next";
import { Check } from "lucide-react";
import { PresentButton } from "@/components/PresentButton";
import { cn } from "@/lib/cn";
import { discounted, fmtEuro, FORMULAS, type Formula } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Grille tarifaire",
};

function BadgePill({ f }: { f: Formula }) {
  if (!f.badge) return null;
  const tones = {
    gold: "bg-amber-500/15 text-amber-300 border-amber-400/30",
    blue: "bg-royal-500 text-white border-royal-400",
    premium: "bg-white text-ink-950 border-white",
  };
  return (
    <span className={cn("rounded-md border px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider", tones[f.badge.tone])}>
      {f.badge.label}
    </span>
  );
}

function FormulaCard({ f }: { f: Formula }) {
  const premium = f.highlight === "premium";
  const popular = f.highlight === "popular";
  return (
    <article
      className={cn(
        "relative flex flex-col rounded-2xl border p-5 sm:p-6",
        premium
          ? "border-white/15 bg-gradient-to-b from-ink-750 to-ink-900 shadow-[0_20px_60px_-25px_rgba(255,255,255,0.25)]"
          : popular
            ? "border-royal-500/70 bg-ink-850 shadow-glow"
            : "border-ink-700/70 bg-ink-850/80",
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className={cn("h-display text-[22px]", f.key === "decouverte" ? "text-amber-300" : premium ? "text-white" : "text-royal-400")}>
            {f.name}
          </h2>
          <p className="text-sm text-ink-400">{f.rhythm}</p>
        </div>
        <BadgePill f={f} />
      </header>

      <p className="mt-4 flex items-baseline gap-1.5">
        <span className="font-display text-[46px] font-bold leading-none text-white">{fmtEuro(f.price)}</span>
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-400">{f.unit === "séance" ? "la séance" : "par mois"}</span>
      </p>

      <ul className="mt-5 space-y-2.5 text-sm">
        {f.features.map((x) => (
          <li key={x} className="flex items-start gap-2.5 text-ink-200">
            <Check className={cn("mt-0.5 h-4 w-4 shrink-0", f.key === "decouverte" ? "text-amber-300" : "text-royal-400")} />
            {x}
          </li>
        ))}
      </ul>

      {f.commitments && (
        <div className={cn("mt-5 rounded-xl border p-3.5", premium ? "border-white/10 bg-black/30" : "border-royal-500/20 bg-royal-500/[0.06]")}>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-royal-300">Engagement</p>
          <table className="w-full text-sm">
            <tbody>
              {f.commitments.map((c) => (
                <tr key={c.months}>
                  <td className="py-1 text-ink-300">{c.months} mois</td>
                  <td className="py-1 text-right font-bold text-royal-300">−{c.discount} %</td>
                  <td className="py-1 pl-3 text-right tabular-nums text-ink-400">
                    soit <span className="font-semibold text-white">{fmtEuro(discounted(f.price, c.discount))}</span> / mois
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

    </article>
  );
}

export default function TarifsPage() {
  return (
    <div id="grille-tarifaire" className="relative rounded-3xl bg-ink-950 px-1 py-2 [&:fullscreen]:overflow-y-auto [&:fullscreen]:px-8 [&:fullscreen]:py-10">
      <div className="flex justify-end">
        <PresentButton targetId="grille-tarifaire" />
      </div>
      <header className="mx-auto max-w-2xl text-center animate-fade-in">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-royal-400">Coaching sportif personnalisé</p>
        <h1 className="h-display mt-3 text-5xl text-white sm:text-6xl">Choisis ton suivi</h1>
        <p className="mt-3 text-ink-300">6 formules adaptées à ton rythme et à tes objectifs.</p>
      </header>

      <div className="mx-auto mt-10 grid max-w-6xl gap-5 md:grid-cols-2 xl:grid-cols-3">
        {FORMULAS.map((f) => (
          <FormulaCard key={f.key} f={f} />
        ))}
      </div>

      <p className="mx-auto mt-8 max-w-2xl text-center text-xs leading-relaxed text-ink-500">
        Les réductions s&apos;appliquent au tarif mensuel pendant toute la durée de l&apos;engagement. Toutes les formules incluent
        l&apos;accès à l&apos;espace personnel : programme, séances, chrono de repos et suivi de la progression.
      </p>
    </div>
  );
}
