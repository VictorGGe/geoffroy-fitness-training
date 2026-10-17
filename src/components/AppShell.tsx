"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { CalendarDays, ClipboardCheck, Dumbbell, Euro, LayoutDashboard, ListChecks, LogOut, MoreHorizontal, Scale, Search, Users, X } from "lucide-react";
import { Logo } from "./Logo";
import { cn } from "./ui";

const NAV = [
  { href: "/dashboard", label: "Tableau de bord", short: "Accueil", icon: LayoutDashboard },
  { href: "/agenda", label: "Agenda", short: "Agenda", icon: CalendarDays },
  { href: "/clients", label: "Mes clients", short: "Clients", icon: Users },
  { href: "/bilans", label: "Bilan de départ", short: "Bilan", icon: ClipboardCheck },
  { href: "/programs", label: "Programmes", short: "Prog.", icon: ListChecks },
  { href: "/exercises", label: "Bibliothèque d'exercices", short: "Exos", icon: Dumbbell },
  { href: "/weight", label: "Suivi de perte de poids", short: "Poids", icon: Scale },
  { href: "/tarifs", label: "Grille tarifaire", short: "Tarifs", icon: Euro },
];

const MAIN_HREFS = ["/dashboard", "/agenda", "/clients", "/programs"];
const MAIN = NAV.filter((n) => MAIN_HREFS.includes(n.href));
const MORE = NAV.filter((n) => !MAIN_HREFS.includes(n.href));

function GlobalSearch({ autoFocus, onDone }: { autoFocus?: boolean; onDone?: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!q.trim()) return;
        router.push(`/search?q=${encodeURIComponent(q.trim())}`);
        onDone?.();
      }}
      className="relative w-full"
    >
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
      <input
        ref={ref}
        autoFocus={autoFocus}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Rechercher un client, un programme, un exercice…"
        className="h-10 w-full rounded-xl border border-ink-700 bg-ink-900/80 pl-9 pr-14 text-sm text-ink-100 outline-none transition placeholder:text-ink-500 focus:border-royal-500 focus:ring-2 focus:ring-royal-500/25"
        aria-label="Recherche globale"
      />
      <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-ink-600 px-1.5 text-[10px] text-ink-500 sm:block">
        Ctrl K
      </kbd>
    </form>
  );
}

export function AppShell({ email, children }: { email: string; children: ReactNode }) {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  useEffect(() => {
    setSearchOpen(false);
    setMoreOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-dvh lg:pl-[264px]">
      {/* Barre latérale (ordinateur) */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] flex-col border-r border-ink-800 bg-ink-900/90 backdrop-blur lg:flex">
        <div className="px-5 pb-6 pt-6">
          <Link href="/dashboard">
            <Logo />
          </Link>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition",
                isActive(href) ? "bg-royal-600/15 text-white" : "text-ink-400 hover:bg-ink-800 hover:text-ink-100",
              )}
            >
              {isActive(href) && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r bg-royal-500" />}
              <Icon className={cn("h-[18px] w-[18px]", isActive(href) ? "text-royal-400" : "text-ink-500 group-hover:text-ink-300")} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-ink-800 p-4">
          <p className="truncate text-xs text-ink-500" title={email}>
            {email}
          </p>
          <form action="/auth/signout" method="post" className="mt-2">
            <button className="flex items-center gap-2 text-sm text-ink-400 transition hover:text-red-300">
              <LogOut className="h-4 w-4" /> Se déconnecter
            </button>
          </form>
        </div>
      </aside>

      {/* Barre supérieure */}
      <header className="sticky top-0 z-30 border-b border-ink-800/80 bg-ink-950/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:h-16">
          <Link href="/dashboard" className="lg:hidden">
            <Logo />
          </Link>
          <div className="hidden flex-1 lg:block lg:max-w-xl">
            <GlobalSearch />
          </div>
          <div className="ml-auto flex items-center gap-1 lg:hidden">
            <button
              onClick={() => setSearchOpen((v) => !v)}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-ink-300 hover:bg-ink-800"
              aria-label="Rechercher"
            >
              <Search className="h-5 w-5" />
            </button>
            <form action="/auth/signout" method="post">
              <button
                className="flex h-10 w-10 items-center justify-center rounded-xl text-ink-300 hover:bg-ink-800 hover:text-red-300"
                aria-label="Se déconnecter"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </form>
          </div>
        </div>
        {searchOpen && (
          <div className="border-t border-ink-800 px-4 py-3 lg:hidden animate-fade-in">
            <GlobalSearch autoFocus onDone={() => setSearchOpen(false)} />
          </div>
        )}
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:pb-12 lg:pt-8">{children}</main>

      {/* Navigation inférieure (mobile) : l'essentiel + « Plus » */}
      {moreOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" />
          <div
            className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-ink-700 bg-ink-900 px-3 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-3 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between px-2">
              <p className="h-display text-lg text-white">Plus</p>
              <button onClick={() => setMoreOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-300 hover:bg-ink-800" aria-label="Fermer">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {MORE.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border px-3 py-3 text-sm font-medium transition",
                    isActive(href) ? "border-royal-500 bg-royal-600/15 text-white" : "border-ink-700 bg-ink-850 text-ink-200 hover:border-ink-500",
                  )}
                >
                  <Icon className="h-5 w-5 text-royal-400" /> {label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-50 border-t border-ink-800 bg-ink-900/95 backdrop-blur-md lg:hidden">
        <div className="grid grid-cols-5">
          {MAIN.map(({ href, short, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex min-w-0 flex-col items-center gap-1 px-0.5 py-2.5 text-[10.5px] font-medium transition",
                isActive(href) ? "text-royal-400" : "text-ink-500",
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="max-w-full truncate">{short}</span>
            </Link>
          ))}
          <button
            onClick={() => setMoreOpen((v) => !v)}
            className={cn(
              "flex min-w-0 flex-col items-center gap-1 px-0.5 py-2.5 text-[10.5px] font-medium transition",
              moreOpen || MORE.some((m) => isActive(m.href)) ? "text-royal-400" : "text-ink-500",
            )}
            aria-expanded={moreOpen}
          >
            <MoreHorizontal className="h-5 w-5" />
            Plus
          </button>
        </div>
      </nav>
    </div>
  );
}
