import type { Metadata } from "next";
import { Logo } from "@/components/Logo";
import { CT_BUSINESS } from "@/lib/crossTraining";

export const metadata: Metadata = {
  title: "Cross training — inscription",
  description: "Inscris-toi à une séance de cross training en petit groupe (3 à 6 personnes) avec Victor Training.",
};

/** Page publique (accès par QR code, sans compte) : aucune navigation vers le reste de l'application. */
export default function CrossTrainingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-ink-950">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_at_top,rgba(26,111,230,0.22),transparent_65%)]" />
      <header className="relative mx-auto flex max-w-3xl items-center justify-between px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
        <Logo />
        <span className="rounded-full border border-royal-500/30 bg-royal-600/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-royal-300">
          Petit groupe
        </span>
      </header>
      <main className="relative mx-auto max-w-3xl px-4 pb-16 pt-4 sm:px-6">{children}</main>
      <footer className="relative mx-auto max-w-3xl px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center text-[11px] leading-relaxed text-ink-500 sm:px-6">
        {CT_BUSINESS.name} · SIRET {CT_BUSINESS.siret} · {CT_BUSINESS.vat}
        <br />
        Paiement sécurisé par carte via Stripe. Tes données servent uniquement à gérer ton inscription.
      </footer>
    </div>
  );
}
