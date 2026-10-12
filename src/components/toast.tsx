"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { CheckCircle2, Info, XCircle, X } from "lucide-react";
import { cn } from "./ui";

type ToastKind = "success" | "error" | "info";
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

const ToastCtx = createContext<{ push: (kind: ToastKind, message: string) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = Date.now() + Math.random();
      setToasts((t) => [...t.slice(-3), { id, kind, message }]);
      setTimeout(() => dismiss(id), kind === "error" ? 6500 : 3500);
    },
    [dismiss],
  );

  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[80] flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:items-end lg:pr-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.kind === "error" ? "alert" : "status"}
            className={cn(
              "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-2xl backdrop-blur animate-slide-up",
              t.kind === "success" && "border-emerald-500/30 bg-ink-850/95 text-ink-100",
              t.kind === "error" && "border-red-500/40 bg-ink-850/95 text-ink-100",
              t.kind === "info" && "border-royal-500/40 bg-ink-850/95 text-ink-100",
            )}
          >
            {t.kind === "success" && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />}
            {t.kind === "error" && <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />}
            {t.kind === "info" && <Info className="mt-0.5 h-4 w-4 shrink-0 text-royal-400" />}
            <span className="flex-1 leading-snug">{t.message}</span>
            <button onClick={() => dismiss(t.id)} className="text-ink-500 hover:text-ink-200" aria-label="Fermer">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast doit être utilisé dans ToastProvider");
  return {
    success: (m: string) => ctx.push("success", m),
    error: (m: string) => ctx.push("error", m),
    info: (m: string) => ctx.push("info", m),
  };
}
