"use client";

import Link from "next/link";
import { forwardRef, useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Loader2, X } from "lucide-react";

export function cn(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

/* ------------------------------------------------------------------ */
/* Boutons                                                             */
/* ------------------------------------------------------------------ */

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg" | "icon";

const variants: Record<Variant, string> = {
  primary:
    "bg-royal-600 text-white hover:bg-royal-500 active:bg-royal-700 shadow-[0_6px_20px_-8px_rgba(47,85,228,0.8)]",
  secondary: "bg-ink-750 text-ink-100 hover:bg-ink-700 border border-ink-600/60",
  outline: "border border-ink-600 text-ink-200 hover:border-royal-500 hover:text-white",
  ghost: "text-ink-300 hover:bg-ink-750 hover:text-white",
  danger: "bg-red-600/90 text-white hover:bg-red-500",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-5 text-[15px] gap-2 rounded-xl",
  icon: "h-9 w-9 rounded-lg justify-center",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, className, children, disabled, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        "inline-flex shrink-0 items-center justify-center font-medium transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal-400",
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
});

export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex shrink-0 items-center justify-center font-medium transition-all duration-150",
        variants[variant],
        sizes[size],
        className,
      )}
    >
      {children}
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Champs de formulaire                                                */
/* ------------------------------------------------------------------ */

export function Field({
  label,
  hint,
  error,
  children,
  className,
  required,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
  className?: string;
  required?: boolean;
}) {
  return (
    <div className={className}>
      <label className="label">
        {label}
        {required && <span className="ml-0.5 text-royal-400">*</span>}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-xs text-red-400">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-ink-500">{hint}</p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...rest },
  ref,
) {
  return <input ref={ref} className={cn("input", className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, rows = 3, ...rest }, ref) {
    return <textarea ref={ref} rows={rows} className={cn("input resize-y leading-relaxed", className)} {...rest} />;
  },
);

export function Select({
  className,
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <select
      className={cn(
        "input appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%239AA2B2%22 stroke-width=%222.5%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[length:12px] bg-[right_14px_center] bg-no-repeat pr-9",
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  );
}

/* ------------------------------------------------------------------ */
/* Mise en page                                                        */
/* ------------------------------------------------------------------ */

export function PageHeader({
  title,
  subtitle,
  actions,
  back,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  back?: ReactNode;
}) {
  return (
    <div className="mb-6 animate-fade-in">
      {back && <div className="mb-3">{back}</div>}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="h-display truncate text-3xl text-white sm:text-[34px]">{title}</h1>
          {subtitle && <div className="mt-1 text-sm text-ink-400">{subtitle}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function Card({
  children,
  className,
  title,
  actions,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  actions?: ReactNode;
  padded?: boolean;
}) {
  return (
    <section className={cn("card animate-fade-in", className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-ink-700/60 px-4 py-3 sm:px-5">
          <h2 className="h-display text-[17px] text-ink-100">{title}</h2>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={padded ? "p-4 sm:p-5" : ""}>{children}</div>
    </section>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  accent,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "card relative overflow-hidden p-4 sm:p-5 animate-fade-in",
        accent && "border-royal-600/50 bg-gradient-to-br from-royal-700/30 to-ink-850",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[12px] font-medium uppercase tracking-wider text-ink-400">{label}</p>
        {icon && <span className="text-royal-400">{icon}</span>}
      </div>
      <p className="mt-2 font-display text-[30px] font-semibold leading-none tracking-wide text-white">{value}</p>
      {hint && <div className="mt-2 text-xs text-ink-400">{hint}</div>}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "blue" | "green" | "amber" | "red";
  className?: string;
}) {
  const tones = {
    neutral: "bg-ink-750 text-ink-300 border-ink-600/60",
    blue: "bg-royal-600/15 text-royal-300 border-royal-500/30",
    green: "bg-emerald-500/10 text-emerald-300 border-emerald-500/25",
    amber: "bg-amber-500/10 text-amber-300 border-amber-500/25",
    red: "bg-red-500/10 text-red-300 border-red-500/25",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon?: ReactNode;
  title: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      {icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-royal-600/10 text-royal-400">
          {icon}
        </div>
      )}
      <p className="font-medium text-ink-100">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-ink-400">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-5 w-5 animate-spin text-royal-400", className)} />;
}

export function LoadingBlock({ label = "Chargement…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-sm text-ink-400">
      <Spinner /> {label}
    </div>
  );
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="card flex flex-col items-center gap-3 border-red-500/30 p-8 text-center">
      <AlertTriangle className="h-6 w-6 text-red-400" />
      <p className="text-sm text-ink-200">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Réessayer
        </Button>
      )}
    </div>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { key: T; label: string; icon?: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="scrollbar-thin -mx-4 mb-5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="inline-flex min-w-full gap-1 rounded-xl border border-ink-700/70 bg-ink-900/80 p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            className={cn(
              "flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-[13px] font-medium transition",
              value === t.key
                ? "bg-royal-600 text-white shadow-[0_4px_14px_-6px_rgba(47,85,228,0.9)]"
                : "text-ink-400 hover:bg-ink-800 hover:text-ink-100",
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ProgressBar({ value, tone = "blue" }: { value: number; tone?: "blue" | "green" | "amber" }) {
  const colors = { blue: "bg-royal-500", green: "bg-emerald-500", amber: "bg-amber-500" };
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-ink-700">
      <div
        className={cn("h-full rounded-full transition-[width] duration-700 ease-out", colors[tone])}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Modale et confirmation                                              */
/* ------------------------------------------------------------------ */

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;
  const widths = { sm: "sm:max-w-md", md: "sm:max-w-xl", lg: "sm:max-w-3xl", xl: "sm:max-w-5xl" };

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal aria-labelledby={titleId}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div
        ref={panelRef}
        className={cn(
          "relative flex max-h-[92dvh] w-full flex-col rounded-t-2xl border border-ink-700 bg-ink-850 shadow-2xl animate-slide-up sm:rounded-2xl sm:animate-scale-in",
          widths[size],
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-ink-700/70 px-5 py-4">
          <h2 id={titleId} className="h-display text-xl text-white">
            {title}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fermer">
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="scrollbar-thin flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && (
          <div className="safe-bottom flex flex-col-reverse gap-2 border-t border-ink-700/70 px-5 py-4 sm:flex-row sm:justify-end">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Supprimer",
  danger = true,
  loading,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            Annuler
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex gap-3">
        {danger && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-400">
            <AlertTriangle className="h-5 w-5" />
          </div>
        )}
        <div className="text-sm leading-relaxed text-ink-300">{message}</div>
      </div>
    </Modal>
  );
}
