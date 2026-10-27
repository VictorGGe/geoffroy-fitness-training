/**
 * Finances du coach : factures, charges (taux en %), loyer et autres dépenses.
 * Net du mois = factures − charges (taux × factures) − loyer et dépenses.
 */

export interface Invoice {
  id: string;
  client_id: string | null;
  client_name: string | null;
  label: string | null;
  number: string | null;
  amount: number;
  issued_on: string;
  paid: boolean;
}

export interface Expense {
  id: string;
  month: string;
  category: "loyer" | "autre";
  label: string | null;
  amount: number;
}

export interface FinanceSettings {
  charge_rate: number;
  net_goal: number;
}

export const DEFAULT_SETTINGS: FinanceSettings = { charge_rate: 19, net_goal: 2000 };
export const DEFAULT_RENT = 550;

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** « 2026-10-01 » */
export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  return monthKey(new Date(y, m - 1 + delta, 1));
}

/** Dernier jour du mois, au format « 2026-10-31 ». */
export function monthEnd(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
}

export function monthLabel(key: string, withYear = true): string {
  const [y, m] = key.split("-").map(Number);
  const name = MONTHS[m - 1];
  return withYear ? `${name.charAt(0).toUpperCase()}${name.slice(1)} ${y}` : name;
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Date du jour si elle tombe dans le mois affiché, sinon le 1er du mois. */
export function defaultDateIn(key: string): string {
  const t = todayISO();
  return t.slice(0, 7) === key.slice(0, 7) ? t : key;
}

const r2 = (v: number) => Math.round(v * 100) / 100;

export interface MonthSummary {
  revenue: number;
  pending: number;
  charges: number;
  rent: number;
  other: number;
  expenses: number;
  net: number;
  count: number;
}

export function summarize(invoices: Invoice[], expenses: Expense[], rate: number): MonthSummary {
  const revenue = r2(invoices.reduce((s, i) => s + Number(i.amount), 0));
  const pending = r2(invoices.filter((i) => !i.paid).reduce((s, i) => s + Number(i.amount), 0));
  const charges = r2((revenue * rate) / 100);
  const rent = r2(expenses.filter((e) => e.category === "loyer").reduce((s, e) => s + Number(e.amount), 0));
  const other = r2(expenses.filter((e) => e.category !== "loyer").reduce((s, e) => s + Number(e.amount), 0));
  const exp = r2(rent + other);
  return { revenue, pending, charges, rent, other, expenses: exp, net: r2(revenue - charges - exp), count: invoices.length };
}

export function eur(v: number, cents = true): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: cents && !Number.isInteger(v) ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  })
    .format(v)
    .replace(/ /g, " ");
}

/** « 315,50 » ou « 315.5 » → 315.5 */
export function parseAmount(s: string): number | null {
  const v = Number(String(s).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(v) && v > 0 && v <= 100000 ? Math.round(v * 100) / 100 : null;
}

export function isMissingTable(e: unknown): boolean {
  const msg = String((e as { message?: string })?.message ?? e ?? "");
  return /invoices|expenses|finance_settings|schema cache|does not exist/i.test(msg);
}
