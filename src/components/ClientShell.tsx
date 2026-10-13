"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ClipboardPlus, History, ListChecks, LogOut } from "lucide-react";
import { Logo } from "./Logo";
import { cn } from "@/lib/cn";
import { ModeProvider } from "@/lib/mode";

const NAV = [
  { href: "/espace", label: "Mes programmes", icon: ListChecks, exact: true },
  { href: "/espace/seances/nouvelle", label: "Nouvelle séance", icon: ClipboardPlus, exact: true },
  { href: "/espace/seances", label: "Mes séances", icon: History, exact: false },
];

export function ClientShell({ firstName, email, children }: { firstName: string; email: string; children: ReactNode }) {
  const pathname = usePathname();
  const active = (href: string, exact: boolean) =>
    exact ? pathname === href || (href === "/espace" && pathname.startsWith("/espace/programmes")) : pathname.startsWith(href) && pathname !== "/espace/seances/nouvelle";

  return (
    <ModeProvider mode="client">
      <div className="min-h-dvh">
        <header className="sticky top-0 z-30 border-b border-ink-800/80 bg-ink-950/85 backdrop-blur-md">
          <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-4 sm:px-6 lg:h-16">
            <Link href="/espace">
              <Logo />
            </Link>
            <nav className="ml-6 hidden items-center gap-1 md:flex">
              {NAV.map(({ href, label, icon: Icon, exact }) => (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition",
                    active(href, exact) ? "bg-royal-600/15 text-white" : "text-ink-400 hover:bg-ink-800 hover:text-ink-100",
                  )}
                >
                  <Icon className={cn("h-4 w-4", active(href, exact) && "text-royal-400")} />
                  {label}
                </Link>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-3">
              <span className="hidden text-right text-xs leading-tight text-ink-400 sm:block">
                {firstName && <span className="block text-sm font-medium text-ink-100">{firstName}</span>}
                {email}
              </span>
              <form action="/auth/signout" method="post">
                <button
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-ink-300 hover:bg-ink-800 hover:text-red-300"
                  aria-label="Se déconnecter"
                  title="Se déconnecter"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </form>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-4 pb-28 pt-6 sm:px-6 md:pb-12 lg:pt-8">{children}</main>

        <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-ink-800 bg-ink-900/95 backdrop-blur-md md:hidden">
          <div className="grid grid-cols-3">
            {NAV.map(({ href, label, icon: Icon, exact }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[10.5px] font-medium transition",
                  active(href, exact) ? "text-royal-400" : "text-ink-500",
                )}
              >
                <Icon className="h-5 w-5" />
                {label}
              </Link>
            ))}
          </div>
        </nav>
      </div>
    </ModeProvider>
  );
}
