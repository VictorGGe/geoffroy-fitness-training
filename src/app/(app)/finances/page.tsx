"use client";

import { useMemo, useState } from "react";
import { Building2, Check, ChevronLeft, ChevronRight, Copy, FileText, Pencil, Plus, Receipt, Settings2, Trash2, Wallet } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorBlock,
  Field,
  Input,
  LoadingBlock,
  Modal,
  PageHeader,
  ProgressBar,
  Select,
} from "@/components/ui";
import { useToast } from "@/components/toast";
import { cn } from "@/lib/cn";
import { getSupabase } from "@/lib/supabase/client";
import { unwrap, useAsync } from "@/lib/hooks";
import { errorMessage, fmtDate, fullName } from "@/lib/format";
import { discounted, FORMULAS } from "@/lib/pricing";
import {
  DEFAULT_RENT,
  DEFAULT_SETTINGS,
  defaultDateIn,
  eur,
  isMissingTable,
  monthEnd,
  monthKey,
  monthLabel,
  parseAmount,
  shiftMonth,
  summarize,
  type Expense,
  type FinanceSettings,
  type Invoice,
} from "@/lib/finance";
import type { Client } from "@/lib/types";

type ClientLite = Pick<Client, "id" | "first_name" | "last_name">;

/** Montants proposés à partir de la grille tarifaire */
const PRESETS = FORMULAS.flatMap((f) => [
  { key: `${f.key}-0`, label: `${f.name}${f.unit === "séance" ? " (séance)" : " — sans engagement"}`, amount: f.price },
  ...(f.commitments ?? []).map((c) => ({
    key: `${f.key}-${c.months}`,
    label: `${f.name} — ${c.months} mois (−${c.discount} %)`,
    amount: discounted(f.price, c.discount),
  })),
]);

export default function FinancesPage() {
  const toast = useToast();
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const year = month.slice(0, 4);

  const { data, loading, error, reload } = useAsync(async () => {
    const sb = getSupabase();
    const [inv, exp, set, cl] = await Promise.all([
      sb.from("invoices").select("*").gte("issued_on", `${year}-01-01`).lte("issued_on", `${year}-12-31`).order("issued_on", { ascending: false }),
      sb.from("expenses").select("*").gte("month", `${year}-01-01`).lte("month", `${year}-12-01`).order("created_at"),
      sb.from("finance_settings").select("charge_rate, net_goal").maybeSingle(),
      sb.from("clients").select("id, first_name, last_name").eq("archived", false).order("last_name"),
    ]);
    return {
      invoices: unwrap(inv) as Invoice[],
      expenses: unwrap(exp) as Expense[],
      settings: set.error ? DEFAULT_SETTINGS : ((set.data as FinanceSettings | null) ?? DEFAULT_SETTINGS),
      clients: (cl.data ?? []) as ClientLite[],
    };
  }, [year]);

  const [invoiceForm, setInvoiceForm] = useState<Invoice | "new" | null>(null);
  const [expenseForm, setExpenseForm] = useState<Expense | "new" | "loyer" | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toDelete, setToDelete] = useState<{ kind: "invoice" | "expense"; id: string; label: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const rate = Number(data?.settings.charge_rate ?? DEFAULT_SETTINGS.charge_rate);
  const goal = Number(data?.settings.net_goal ?? DEFAULT_SETTINGS.net_goal);

  const monthInvoices = useMemo(
    () => (data?.invoices ?? []).filter((i) => i.issued_on >= month && i.issued_on <= monthEnd(month)),
    [data, month],
  );
  const monthExpenses = useMemo(() => (data?.expenses ?? []).filter((e) => e.month === month), [data, month]);
  const s = summarize(monthInvoices, monthExpenses, rate);

  const yearRows = useMemo(() => {
    if (!data) return [];
    return Array.from({ length: 12 }, (_, i) => {
      const k = `${year}-${String(i + 1).padStart(2, "0")}-01`;
      const inv = data.invoices.filter((x) => x.issued_on >= k && x.issued_on <= monthEnd(k));
      const exp = data.expenses.filter((x) => x.month === k);
      return { key: k, ...summarize(inv, exp, rate), empty: inv.length === 0 && exp.length === 0 };
    });
  }, [data, year, rate]);
  const yearTotal = summarize(data?.invoices ?? [], data?.expenses ?? [], rate);
  const lastRent = useMemo(() => {
    const rents = (data?.expenses ?? []).filter((e) => e.category === "loyer" && e.month < month);
    return rents.length ? Number(rents[rents.length - 1].amount) : DEFAULT_RENT;
  }, [data, month]);

  async function togglePaid(i: Invoice) {
    const { error: e } = await getSupabase().from("invoices").update({ paid: !i.paid }).eq("id", i.id);
    if (e) return toast.error(errorMessage(e));
    reload();
  }

  async function copyPreviousExpenses() {
    const prev = (data?.expenses ?? []).filter((e) => e.month === shiftMonth(month, -1));
    if (!prev.length) return toast.info("Aucune dépense le mois précédent.");
    setBusy(true);
    const { error: e } = await getSupabase()
      .from("expenses")
      .insert(prev.map((p) => ({ month, category: p.category, label: p.label, amount: p.amount })));
    setBusy(false);
    if (e) return toast.error(errorMessage(e));
    toast.success("Dépenses du mois précédent reprises.");
    reload();
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setBusy(true);
    const { error: e } = await getSupabase()
      .from(toDelete.kind === "invoice" ? "invoices" : "expenses")
      .delete()
      .eq("id", toDelete.id);
    setBusy(false);
    if (e) return toast.error(errorMessage(e));
    setToDelete(null);
    reload();
  }

  const header = (
    <PageHeader
      title="Finances"
      subtitle="Tes factures, tes charges et ce qu'il te reste vraiment chaque mois. Visible par toi uniquement."
      actions={
        <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)} disabled={!data}>
          <Settings2 className="h-4 w-4" /> Charges {String(rate).replace(".", ",")} % · objectif {eur(goal, false)}
        </Button>
      }
    />
  );

  if (loading && !data) return (<>{header}<LoadingBlock /></>);
  if (error) {
    return (
      <>
        {header}
        {isMissingTable(error) ? (
          <Card>
            <EmptyState
              icon={<Wallet className="h-6 w-6" />}
              title="Une dernière étape dans Supabase"
              text="Exécute le fichier finances.sql dans Supabase → SQL Editor, puis recharge cette page."
              action={<Button onClick={reload}>Recharger</Button>}
            />
          </Card>
        ) : (
          <ErrorBlock message={error} onRetry={reload} />
        )}
      </>
    );
  }
  if (!data) return null;

  const pct = goal > 0 ? Math.max(0, Math.min(100, (s.net / goal) * 100)) : 0;

  return (
    <>
      {header}

      {/* Navigation mois */}
      <div className="mb-5 flex items-center justify-between gap-2 rounded-2xl border border-ink-700/70 bg-ink-900/80 p-1.5">
        <Button variant="ghost" size="icon" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Mois précédent">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="text-center">
          <p className="h-display text-xl text-white">{monthLabel(month)}</p>
          {month !== monthKey(new Date()) && (
            <button className="text-xs text-royal-300 hover:text-royal-200" onClick={() => setMonth(monthKey(new Date()))}>
              Revenir au mois en cours
            </button>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Mois suivant">
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Calcul du mois */}
      <section className="card mb-6 overflow-hidden animate-fade-in">
        <div className="grid gap-px bg-ink-700/50 sm:grid-cols-[1fr_auto]">
          <div className="space-y-2.5 bg-ink-850 p-5 text-[15px]">
            <Line label={`Factures (${s.count})`} value={eur(s.revenue)} strong />
            <Line label={`Charges ${String(rate).replace(".", ",")} %`} value={`− ${eur(s.charges)}`} tone="red" />
            <Line label="Loyer" value={`− ${eur(s.rent)}`} tone="red" />
            {s.other > 0 && <Line label="Autres dépenses" value={`− ${eur(s.other)}`} tone="red" />}
            {s.pending > 0 && <p className="text-xs text-amber-300">dont {eur(s.pending)} de factures pas encore payées</p>}
          </div>
          <div className="flex flex-col justify-center bg-gradient-to-br from-royal-700/30 to-ink-850 p-5 sm:min-w-[260px]">
            <p className="text-[12px] font-medium uppercase tracking-wider text-ink-400">Il te reste</p>
            <p className={cn("mt-1 font-display text-[40px] font-bold leading-none", s.net < 0 ? "text-red-400" : "text-white")}>{eur(s.net)}</p>
            <div className="mt-4">
              <ProgressBar value={pct} tone={s.net >= goal ? "green" : "blue"} />
              <p className="mt-1.5 text-xs text-ink-400">
                {s.net >= goal ? "Objectif atteint 🎉" : `Encore ${eur(goal - s.net, false)} pour atteindre ${eur(goal, false)}`}
                {s.net < goal && rate < 100 && (
                  <> · soit ≈ {eur(Math.ceil((goal - s.net) / (1 - rate / 100)), false)} de factures en plus</>
                )}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        {/* Factures */}
        <Card
          title={<span className="inline-flex items-center gap-2"><Receipt className="h-4 w-4 text-royal-400" /> Factures</span>}
          actions={
            <Button size="sm" onClick={() => setInvoiceForm("new")}>
              <Plus className="h-4 w-4" /> Ajouter
            </Button>
          }
          padded={false}
        >
          {monthInvoices.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-6 w-6" />}
              title="Aucune facture ce mois-ci"
              text="Ajoute chaque paiement d'un client : le calcul se fait tout seul."
              action={<Button onClick={() => setInvoiceForm("new")}><Plus className="h-4 w-4" /> Ajouter une facture</Button>}
            />
          ) : (
            <ul className="divide-y divide-ink-700/60">
              {monthInvoices.map((i) => (
                <li key={i.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink-100">{invoiceWho(i, data.clients)}</p>
                    <p className="truncate text-xs text-ink-400">
                      {fmtDate(i.issued_on)}
                      {i.label ? ` · ${i.label}` : ""}
                      {i.number ? ` · n° ${i.number}` : ""}
                    </p>
                    <button onClick={() => togglePaid(i)} className="mt-1 sm:hidden">
                      {i.paid ? <Badge tone="green"><Check className="h-3 w-3" /> Payée</Badge> : <Badge tone="amber">En attente</Badge>}
                    </button>
                  </div>
                  <button onClick={() => togglePaid(i)} title="Changer le statut" className="hidden sm:block">
                    {i.paid ? <Badge tone="green"><Check className="h-3 w-3" /> Payée</Badge> : <Badge tone="amber">En attente</Badge>}
                  </button>
                  <p className="w-20 text-right sm:w-24 font-semibold tabular-nums text-white">{eur(Number(i.amount))}</p>
                  <div className="flex">
                    <Button variant="ghost" size="icon" onClick={() => setInvoiceForm(i)} aria-label="Modifier">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setToDelete({ kind: "invoice", id: i.id, label: `${invoiceWho(i, data.clients)} — ${eur(Number(i.amount))}` })}
                      aria-label="Supprimer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Loyer et dépenses */}
        <Card
          title={<span className="inline-flex items-center gap-2"><Building2 className="h-4 w-4 text-royal-400" /> Loyer & dépenses</span>}
          actions={
            <Button size="sm" variant="secondary" onClick={() => setExpenseForm("new")}>
              <Plus className="h-4 w-4" /> Dépense
            </Button>
          }
          padded={false}
        >
          {!monthExpenses.some((e) => e.category === "loyer") && (
            <div className="border-b border-ink-700/60 p-4 sm:px-5">
              <Button className="w-full" onClick={() => setExpenseForm("loyer")}>
                <Building2 className="h-4 w-4" /> Ajouter le loyer de {monthLabel(month, false)}
              </Button>
            </div>
          )}
          {monthExpenses.length === 0 ? (
            <div className="p-5 text-center text-sm text-ink-400">
              Aucune dépense ce mois-ci.
              {(data.expenses ?? []).some((e) => e.month === shiftMonth(month, -1)) && (
                <div className="mt-3">
                  <Button variant="outline" size="sm" loading={busy} onClick={copyPreviousExpenses}>
                    <Copy className="h-4 w-4" /> Reprendre celles du mois précédent
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-ink-700/60">
              {monthExpenses.map((e) => (
                <li key={e.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink-100">{e.category === "loyer" ? "Loyer de la salle" : e.label || "Dépense"}</p>
                    {e.category === "loyer" && e.label && <p className="truncate text-xs text-ink-400">{e.label}</p>}
                  </div>
                  <p className="w-24 text-right font-semibold tabular-nums text-red-300">− {eur(Number(e.amount))}</p>
                  <div className="flex">
                    <Button variant="ghost" size="icon" onClick={() => setExpenseForm(e)} aria-label="Modifier">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setToDelete({ kind: "expense", id: e.id, label: `${e.category === "loyer" ? "Loyer" : e.label || "Dépense"} — ${eur(Number(e.amount))}` })}
                      aria-label="Supprimer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Bilan de l'année */}
      <Card title={`Bilan ${year}`} className="mt-6" padded={false}>
        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-700/60 text-left text-[11px] uppercase tracking-wider text-ink-400">
                <th className="px-5 py-2.5 font-medium">Mois</th>
                <th className="px-3 py-2.5 text-right font-medium">Factures</th>
                <th className="hidden sm:table-cell px-3 py-2.5 text-right font-medium">Charges</th>
                <th className="hidden sm:table-cell px-3 py-2.5 text-right font-medium">Loyer & dép.</th>
                <th className="px-5 py-2.5 text-right font-medium">Net</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {yearRows.map((r) => (
                <tr
                  key={r.key}
                  onClick={() => setMonth(r.key)}
                  className={cn(
                    "cursor-pointer border-b border-ink-800 hover:bg-ink-800/60",
                    r.key === month && "bg-royal-600/10",
                    r.empty && "text-ink-500",
                  )}
                >
                  <td className="px-5 py-2 capitalize">{monthLabel(r.key, false)}</td>
                  <td className="px-3 py-2 text-right">{r.empty ? "—" : eur(r.revenue, false)}</td>
                  <td className="hidden px-3 py-2 text-right sm:table-cell">{r.empty ? "—" : `− ${eur(r.charges, false)}`}</td>
                  <td className="hidden px-3 py-2 text-right sm:table-cell">{r.empty ? "—" : `− ${eur(r.expenses, false)}`}</td>
                  <td className={cn("px-5 py-2 text-right font-semibold", !r.empty && (r.net < 0 ? "text-red-400" : "text-white"))}>
                    {r.empty ? "—" : eur(r.net, false)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold text-white">
                <td className="px-5 py-3">Total</td>
                <td className="px-3 py-3 text-right">{eur(yearTotal.revenue, false)}</td>
                <td className="hidden px-3 py-3 text-right sm:table-cell">− {eur(yearTotal.charges, false)}</td>
                <td className="hidden px-3 py-3 text-right sm:table-cell">− {eur(yearTotal.expenses, false)}</td>
                <td className="px-5 py-3 text-right text-royal-300">{eur(yearTotal.net, false)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {invoiceForm && (
        <InvoiceModal
          initial={invoiceForm === "new" ? null : invoiceForm}
          month={month}
          clients={data.clients}
          onClose={() => setInvoiceForm(null)}
          onSaved={() => {
            setInvoiceForm(null);
            reload();
          }}
        />
      )}
      {expenseForm && (
        <ExpenseModal
          initial={typeof expenseForm === "string" ? null : expenseForm}
          rentMode={expenseForm === "loyer"}
          defaultRent={lastRent}
          month={month}
          onClose={() => setExpenseForm(null)}
          onSaved={() => {
            setExpenseForm(null);
            reload();
          }}
        />
      )}
      {settingsOpen && (
        <SettingsModal
          initial={{ charge_rate: rate, net_goal: goal }}
          onClose={() => setSettingsOpen(false)}
          onSaved={() => {
            setSettingsOpen(false);
            reload();
          }}
        />
      )}
      <ConfirmDialog
        open={!!toDelete}
        title="Supprimer ?"
        message={toDelete?.label}
        loading={busy}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}

function Line({ label, value, tone, strong }: { label: string; value: string; tone?: "red"; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-ink-300">{label}</span>
      <span className={cn("tabular-nums", strong ? "font-semibold text-white" : tone === "red" ? "text-red-300" : "text-ink-100")}>{value}</span>
    </div>
  );
}

function invoiceWho(i: Invoice, clients: ClientLite[]): string {
  const c = i.client_id ? clients.find((x) => x.id === i.client_id) : null;
  return c ? fullName(c) : i.client_name || "Client";
}

/* ------------------------------------------------------------------ */

function InvoiceModal({
  initial,
  month,
  clients,
  onClose,
  onSaved,
}: {
  initial: Invoice | null;
  month: string;
  clients: ClientLite[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [clientId, setClientId] = useState(initial?.client_id ?? (initial?.client_name ? "__other" : ""));
  const [otherName, setOtherName] = useState(initial?.client_name ?? "");
  const [label, setLabel] = useState(initial?.label ?? "");
  const [amount, setAmount] = useState(initial ? String(initial.amount).replace(".", ",") : "");
  const [date, setDate] = useState(initial?.issued_on ?? defaultDateIn(month));
  const [number, setNumber] = useState(initial?.number ?? "");
  const [paid, setPaid] = useState(initial?.paid ?? true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function pickPreset(key: string) {
    const p = PRESETS.find((x) => x.key === key);
    if (!p) return;
    setLabel(p.label);
    setAmount(String(p.amount).replace(".", ","));
  }

  async function save() {
    const v = parseAmount(amount);
    if (!v) return setErr("Indique un montant valide.");
    if (!clientId) return setErr("Choisis un client (ou « Autre personne »).");
    if (clientId === "__other" && !otherName.trim()) return setErr("Indique le nom de la personne.");
    if (!date) return setErr("Indique la date.");
    setSaving(true);
    const row = {
      client_id: clientId === "__other" ? null : clientId,
      client_name: clientId === "__other" ? otherName.trim() : null,
      label: label.trim() || null,
      number: number.trim() || null,
      amount: v,
      issued_on: date,
      paid,
    };
    const sb = getSupabase();
    const { error } = initial ? await sb.from("invoices").update(row).eq("id", initial.id) : await sb.from("invoices").insert(row);
    setSaving(false);
    if (error) return setErr(errorMessage(error));
    toast.success(initial ? "Facture modifiée." : "Facture ajoutée.");
    onSaved();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={initial ? "Modifier la facture" : "Nouvelle facture"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button loading={saving} onClick={save}>Enregistrer</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Client" required>
          <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">Choisir…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{fullName(c)}</option>
            ))}
            <option value="__other">Autre personne…</option>
          </Select>
        </Field>
        {clientId === "__other" && (
          <Field label="Nom de la personne" required>
            <Input value={otherName} onChange={(e) => setOtherName(e.target.value)} maxLength={120} />
          </Field>
        )}
        <Field label="Formule" hint="Remplit le libellé et le montant d'après ta grille tarifaire.">
          <Select value="" onChange={(e) => pickPreset(e.target.value)}>
            <option value="">Choisir une formule…</option>
            {PRESETS.map((p) => (
              <option key={p.key} value={p.key}>{p.label} — {eur(p.amount)}</option>
            ))}
          </Select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Montant (€)" required>
            <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="315" />
          </Field>
          <Field label="Date" required>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
        <Field label="Libellé">
          <Input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={160} placeholder="Ex. Progression — octobre" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="N° de facture (facultatif)">
            <Input value={number} onChange={(e) => setNumber(e.target.value)} maxLength={40} />
          </Field>
          <Field label="Statut">
            <div className="flex gap-2">
              <StatusChip active={paid} onClick={() => setPaid(true)}>Payée</StatusChip>
              <StatusChip active={!paid} onClick={() => setPaid(false)}>En attente</StatusChip>
            </div>
          </Field>
        </div>
        {err && <p className="text-sm text-red-400">{err}</p>}
      </div>
    </Modal>
  );
}

function StatusChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-10 flex-1 rounded-xl border text-sm font-medium transition",
        active ? "border-royal-500 bg-royal-600/20 text-white" : "border-ink-600 text-ink-300 hover:border-ink-500",
      )}
    >
      {children}
    </button>
  );
}

function ExpenseModal({
  initial,
  rentMode,
  defaultRent,
  month,
  onClose,
  onSaved,
}: {
  initial: Expense | null;
  rentMode: boolean;
  defaultRent: number;
  month: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [category, setCategory] = useState<Expense["category"]>(initial?.category ?? (rentMode ? "loyer" : "autre"));
  const [label, setLabel] = useState(initial?.label ?? "");
  const [amount, setAmount] = useState(
    initial ? String(initial.amount).replace(".", ",") : rentMode ? String(defaultRent).replace(".", ",") : "",
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    const v = parseAmount(amount);
    if (!v) return setErr("Indique un montant valide.");
    if (category === "autre" && !label.trim()) return setErr("Indique de quoi il s'agit.");
    setSaving(true);
    const row = { month: initial?.month ?? month, category, label: label.trim() || null, amount: v };
    const sb = getSupabase();
    const { error } = initial ? await sb.from("expenses").update(row).eq("id", initial.id) : await sb.from("expenses").insert(row);
    setSaving(false);
    if (error) return setErr(errorMessage(error));
    toast.success("Enregistré.");
    onSaved();
  }

  return (
    <Modal
      open
      size="sm"
      onClose={onClose}
      title={category === "loyer" ? `Loyer — ${monthLabel(initial?.month ?? month)}` : "Dépense"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button loading={saving} onClick={save}>Enregistrer</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Type">
          <div className="flex gap-2">
            <StatusChip active={category === "loyer"} onClick={() => setCategory("loyer")}>Loyer</StatusChip>
            <StatusChip active={category === "autre"} onClick={() => setCategory("autre")}>Autre dépense</StatusChip>
          </div>
        </Field>
        <Field label="Montant (€)" required>
          <Input inputMode="decimal" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="550" />
        </Field>
        <Field label={category === "loyer" ? "Note (facultatif)" : "Description"} required={category === "autre"}>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={160}
            placeholder={category === "loyer" ? "Ex. Salle — octobre" : "Ex. Matériel, assurance, pub…"}
          />
        </Field>
        {err && <p className="text-sm text-red-400">{err}</p>}
      </div>
    </Modal>
  );
}

function SettingsModal({ initial, onClose, onSaved }: { initial: FinanceSettings; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [rate, setRate] = useState(String(initial.charge_rate).replace(".", ","));
  const [goal, setGoal] = useState(String(initial.net_goal).replace(".", ","));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    const r = Number(rate.replace(",", "."));
    const g = Number(goal.replace(/\s/g, "").replace(",", "."));
    if (!Number.isFinite(r) || r < 0 || r > 80) return setErr("Le taux doit être entre 0 et 80 %.");
    if (!Number.isFinite(g) || g < 0) return setErr("Objectif invalide.");
    setSaving(true);
    const sb = getSupabase();
    const { data: u } = await sb.auth.getUser();
    const { error } = await sb
      .from("finance_settings")
      .upsert({ coach_id: u.user?.id, charge_rate: r, net_goal: g }, { onConflict: "coach_id" });
    setSaving(false);
    if (error) return setErr(errorMessage(error));
    toast.success("Réglages enregistrés.");
    onSaved();
  }

  return (
    <Modal
      open
      size="sm"
      onClose={onClose}
      title="Réglages"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button loading={saving} onClick={save}>Enregistrer</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Charges à déduire (%)" hint="Pourcentage retiré de tes factures chaque mois.">
          <Input inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
        </Field>
        <Field label="Objectif de revenu net par mois (€)">
          <Input inputMode="decimal" value={goal} onChange={(e) => setGoal(e.target.value)} />
        </Field>
        {err && <p className="text-sm text-red-400">{err}</p>}
      </div>
    </Modal>
  );
}
