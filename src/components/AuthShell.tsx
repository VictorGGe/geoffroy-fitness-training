import type { ReactNode } from "react";
import { Logo } from "./Logo";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[880px] -translate-x-1/2 rounded-full bg-royal-600/20 blur-[120px]" />
      <div className="relative w-full max-w-[400px] animate-fade-in">
        <div className="mb-8 flex justify-center">
          <Logo size="lg" />
        </div>
        <div className="card p-6 sm:p-8">
          <h1 className="h-display text-2xl text-white">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-ink-400">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
        <p className="mt-6 text-center text-xs text-ink-500">Espace privé — accès réservé au coach.</p>
      </div>
    </main>
  );
}
