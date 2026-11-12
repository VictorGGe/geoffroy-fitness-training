"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ChevronDown, Copy, FileDown, FileText, MessageCircle, PenLine, Pencil, Plus, Printer, QrCode, Receipt, Send, Share2, Trash2, X } from "lucide-react";
import QRCode from "qrcode";
import { SignaturePad, type SignaturePadHandle } from "./SignaturePad";
import { Badge, Button, Card, ConfirmDialog, EmptyState, ErrorBlock, Field, Input, LoadingBlock, Modal, Select, Textarea } from "./ui";
import { useToast } from "./toast";
import { cn } from "@/lib/cn";
import { getSupabase } from "@/lib/supabase/client";
import { unwrap, useAsync } from "@/lib/hooks";
import { errorMessage, todayISO } from "@/lib/format";
import {
  addDays,
  defaultConditions,
  eur,
  fmtDateFr,
  lineTotal,
  nextQuoteNumber,
  QUOTE_PRESETS,
  QUOTE_STATUS,
  QUOTE_VALIDITY_DAYS,
  quoteSignLink,
  quoteTotal,
  type Quote,
  type QuoteCondition,
  type QuoteItem,
} from "@/lib/quotes";
import type { Client } from "@/lib/types";

/** Onglet « Devis » de la fiche client. */
export function QuotesPanel({ client }: { client: Client }) {
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(async () => {
    const sb = getSupabase();
    const [q, all, acc] = await Promise.all([
      sb.from("quotes").select("*").eq("client_id", client.id).order("issued_on", { ascending: false }).order("created_at", { ascending: false }),
      sb.from("quotes").select("number"),
      sb.from("client_accounts").select("email").eq("client_id", client.id).maybeSingle(),
    ]);
    return {
      quotes: unwrap(q) as Quote[],
      numbers: ((all.data ?? []) as { number: string }[]).map((x) => x.number),
      accountEmail: (acc.data as { email?: string } | null)?.email ?? null,
    };
  }, [client.id]);
  const [editing, setEditing] = useState<Quote | "new" | { copy: Quote } | null>(null);
  const [toDelete, setToDelete] = useState<Quote | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function pdf(q: Quote, format: "pdf" | "print" | "word" = "pdf") {
    setBusy(`pdf-${q.id}`);
    try {
      if (format === "word") {
        const { exportQuoteDocx } = await import("@/lib/quoteDocx");
        await exportQuoteDocx(q, client);
      } else {
        const { exportQuotePdf } = await import("@/lib/quotePdf");
        await exportQuotePdf(q, client, { print: format === "print" });
      }
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  const [signLink, setSignLink] = useState<Quote | null>(null);
  const [coachSign, setCoachSign] = useState<Quote | null>(null);

  async function setStatus(q: Quote, status: Quote["status"]) {
    const { error: e } = await getSupabase().from("quotes").update({ status }).eq("id", q.id);
    if (e) return toast.error(errorMessage(e));
    reload();
  }

  /** Devis accepté → facture dans Finances (à marquer payée à réception). */
  async function toInvoice(q: Quote) {
    setBusy(`inv-${q.id}`);
    const sb = getSupabase();
    const { data: inv, error: e } = await sb
      .from("invoices")
      .insert({
        client_id: client.id,
        label: `Devis ${q.number}`,
        number: q.number.replace(/^DEV/, "FAC"),
        amount: q.total,
        issued_on: todayISO(),
        paid: false,
      })
      .select("id")
      .single();
    if (!e && inv) await sb.from("quotes").update({ invoice_id: inv.id, status: "accepte" }).eq("id", q.id);
    setBusy(null);
    if (e) return toast.error(errorMessage(e));
    toast.success("Facture créée dans Finances (en attente de paiement).");
    reload();
  }

  async function remove() {
    if (!toDelete) return;
    setBusy("del");
    const { error: e } = await getSupabase().from("quotes").delete().eq("id", toDelete.id);
    setBusy(null);
    if (e) return toast.error(errorMessage(e));
    setToDelete(null);
    reload();
  }

  if (loading && !data) return <LoadingBlock />;
  if (error) {
    return /quotes|schema cache|does not exist/i.test(error) ? (
      <Card>
        <EmptyState icon={<FileText className="h-6 w-6" />} title="Module devis pas encore installé" text="Exécute le fichier devis.sql dans Supabase → SQL Editor." />
      </Card>
    ) : (
      <ErrorBlock message={error} onRetry={reload} />
    );
  }
  if (!data) return null;

  return (
    <>
      <Card
        title={<span className="inline-flex items-center gap-2"><FileText className="h-4 w-4 text-royal-400" /> Devis</span>}
        actions={
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4" /> Nouveau devis
          </Button>
        }
        padded={false}
      >
        {data.quotes.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-6 w-6" />}
            title="Aucun devis pour ce client"
            text="Choisis une formule ou fais un devis libre. Le PDF obtenu se remplit et se signe directement par le client, sur son téléphone ou son ordinateur."
            action={<Button onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> Créer un devis</Button>}
          />
        ) : (
          <ul className="divide-y divide-ink-700/60">
            {data.quotes.map((q) => (
              <li key={q.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 sm:px-5">
                <div className="min-w-0 flex-1 basis-52">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-white">{q.number}</p>
                    <Badge tone={QUOTE_STATUS[q.status].tone}>{QUOTE_STATUS[q.status].label}</Badge>
                    {q.invoice_id && <Badge tone="blue"><Receipt className="h-3 w-3" /> Facturé</Badge>}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-ink-400">
                    {fmtDateFr(q.issued_on)} · {q.items[0]?.label ?? "—"}
                  </p>
                  <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                    {q.client_signed_at ? (
                      <span className="inline-flex items-center gap-1 text-emerald-300">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Signé par {q.client_signed_name} le {new Date(q.client_signed_at).toLocaleDateString("fr-FR")}
                      </span>
                    ) : (
                      <span className="text-ink-500">Pas encore signé par le client</span>
                    )}
                    {q.coach_signed_at ? (
                      <span className="inline-flex items-center gap-1 text-emerald-300">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Ta signature
                      </span>
                    ) : (
                      <button className="text-royal-300 hover:text-royal-200" onClick={() => setCoachSign(q)}>
                        Signer de mon côté
                      </button>
                    )}
                  </p>
                </div>
                <p className="w-24 text-right font-display text-lg font-semibold tabular-nums text-white">{eur(Number(q.total))}</p>
                <div className="flex items-center gap-1">
                  <Select
                    value={q.status}
                    onChange={(e) => setStatus(q, e.target.value as Quote["status"])}
                    className="h-9 w-[118px] text-sm"
                    aria-label="Statut du devis"
                  >
                    {Object.entries(QUOTE_STATUS).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </Select>
                  <DownloadMenu loading={busy === `pdf-${q.id}`} onPick={(f) => pdf(q, f)} />
                  {!q.client_signed_at && q.sign_token && (
                    <Button size="sm" onClick={() => setSignLink(q)} title="Envoyer le lien de signature en ligne">
                      <Send className="h-4 w-4" /> Faire signer
                    </Button>
                  )}
                  {q.status === "accepte" && !q.invoice_id && (
                    <Button size="sm" variant="ghost" loading={busy === `inv-${q.id}`} onClick={() => toInvoice(q)} title="Créer la facture dans Finances">
                      <Receipt className="h-4 w-4" /> Facturer
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" onClick={() => setEditing(q)} aria-label="Modifier le devis">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setEditing({ copy: q })} aria-label="Dupliquer le devis" title="Dupliquer">
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setToDelete(q)} aria-label="Supprimer le devis" className="hover:text-red-300">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {editing && (
        <QuoteModal
          client={client}
          initial={editing === "new" ? null : "copy" in editing ? editing.copy : editing}
          isCopy={editing !== "new" && "copy" in editing}
          numbers={data.numbers}
          lastQuote={data.quotes[0] ?? null}
          accountEmail={data.accountEmail}
          onClose={() => setEditing(null)}
          onSaved={async (q, andPdf) => {
            setEditing(null);
            reload();
            if (andPdf) await pdf(q);
          }}
        />
      )}
      {signLink && (
        <SignLinkModal
          quote={signLink}
          client={client}
          onClose={() => setSignLink(null)}
          onShared={() => {
            if (signLink.status === "brouillon") setStatus(signLink, "envoye");
          }}
        />
      )}
      {coachSign && (
        <CoachSignModal
          quote={coachSign}
          onClose={() => setCoachSign(null)}
          onSigned={() => {
            setCoachSign(null);
            toast.success("Ta signature est ajoutée au devis.");
            reload();
          }}
        />
      )}
      <ConfirmDialog
        open={!!toDelete}
        title="Supprimer ce devis ?"
        message={toDelete ? `${toDelete.number} — ${eur(Number(toDelete.total))}` : ""}
        loading={busy === "del"}
        onConfirm={remove}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */

const EMPTY_ITEM: QuoteItem = { label: "", sub: "", qty: 1, unit_price: 0 };

/** Prestations courantes à ajouter en un clic (prix à compléter si besoin). */
const QUICK_ITEMS: QuoteItem[] = [
  { label: "Séance de Personal Training individuelle", sub: "Durée et horaires définis avec le Client", qty: 1, unit_price: 40 },
  { label: "Séance en duo", sub: "2 personnes, au club", qty: 1, unit_price: 0 },
  { label: "Programme d'entraînement personnalisé", sub: "Conçu selon les objectifs du Client", qty: 1, unit_price: 0 },
  { label: "Plan alimentaire personnalisé", sub: "Adapté aux objectifs et aux habitudes du Client", qty: 1, unit_price: 0 },
  { label: "Bilan complet", sub: "Objectifs, santé, mesures et tests physiques", qty: 1, unit_price: 0 },
  { label: "Suivi à distance", sub: "Programme et suivi sur l'application, par mois", qty: 1, unit_price: 0 },
];
const QUICK_LABELS: Record<string, string> = {
  "Séance de Personal Training individuelle": "Séance individuelle",
  "Séance en duo": "Séance en duo",
  "Programme d'entraînement personnalisé": "Programme personnalisé",
  "Plan alimentaire personnalisé": "Plan alimentaire",
  "Bilan complet": "Bilan complet",
  "Suivi à distance": "Suivi à distance",
};

function QuoteModal({
  client,
  initial,
  isCopy,
  numbers,
  lastQuote,
  accountEmail,
  onClose,
  onSaved,
}: {
  client: Client;
  initial: Quote | null;
  isCopy: boolean;
  numbers: string[];
  lastQuote: Quote | null;
  accountEmail: string | null;
  onClose: () => void;
  onSaved: (q: Quote, andPdf: boolean) => void;
}) {
  const today = todayISO();
  const editingExisting = !!initial && !isCopy;
  const [number, setNumber] = useState(editingExisting ? initial!.number : nextQuoteNumber(numbers, new Date().getFullYear()));
  const [issued, setIssued] = useState(editingExisting ? initial!.issued_on : today);
  const [validUntil, setValidUntil] = useState(editingExisting ? initial!.valid_until : addDays(today, QUOTE_VALIDITY_DAYS));
  const [preset, setPreset] = useState("");
  const [intro, setIntro] = useState(initial?.intro ?? "");
  // Nouveau devis : prêt pour un devis libre (une ligne vide + conditions par défaut) ; une formule peut le remplacer
  const [items, setItems] = useState<QuoteItem[]>(initial?.items?.length ? initial.items : [{ ...EMPTY_ITEM }]);
  const [conditions, setConditions] = useState<QuoteCondition[]>(
    initial?.conditions?.length ? initial.conditions : defaultConditions(null, 0, addDays(today, QUOTE_VALIDITY_DAYS)),
  );
  const [email, setEmail] = useState(initial?.client_email ?? lastQuote?.client_email ?? accountEmail ?? "");
  const [phone, setPhone] = useState(initial?.client_phone ?? lastQuote?.client_phone ?? "");
  const [address, setAddress] = useState(initial?.client_address ?? lastQuote?.client_address ?? "");
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState<"save" | "pdf" | null>(null);

  const total = useMemo(() => quoteTotal(items), [items]);
  const presetObj = QUOTE_PRESETS.find((p) => p.key === preset) ?? null;
  const auto = useRef<{ payment?: string; validity?: string }>({});

  // Quand le total ou la date de validité change, les conditions générées automatiquement suivent
  useEffect(() => {
    setConditions((cs) => {
      const gen = defaultConditions(presetObj, total, validUntil);
      const pay = gen.find((c) => c.label === "Paiement")!.value;
      const val = gen.find((c) => c.label === "Validité du devis")!.value;
      const next = cs.map((c) => {
        if (c.label === "Paiement" && (c.value === auto.current.payment || !c.value)) return { ...c, value: pay };
        if (c.label === "Validité du devis" && (c.value === auto.current.validity || !c.value)) return { ...c, value: val };
        return c;
      });
      auto.current = { payment: pay, validity: val };
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, validUntil]);

  function applyPreset(key: string) {
    setPreset(key);
    if (key === "libre") {
      setIntro("");
      setItems([{ ...EMPTY_ITEM }]);
      const gen = defaultConditions(null, 0, validUntil);
      auto.current = { payment: gen.find((c) => c.label === "Paiement")!.value, validity: gen.find((c) => c.label === "Validité du devis")!.value };
      setConditions(gen);
      return;
    }
    const p = QUOTE_PRESETS.find((x) => x.key === key);
    if (!p) return;
    setIntro(p.intro);
    setItems(p.items.map((i) => ({ ...i })));
    const gen = defaultConditions(p, quoteTotal(p.items), validUntil);
    auto.current = { payment: gen.find((c) => c.label === "Paiement")!.value, validity: gen.find((c) => c.label === "Validité du devis")!.value };
    setConditions(gen);
  }

  const setItem = (idx: number, patch: Partial<QuoteItem>) => setItems((xs) => xs.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  const num = (s: string) => {
    const v = Number(s.replace(",", "."));
    return Number.isFinite(v) ? v : 0;
  };

  async function save(andPdf: boolean) {
    const clean = items.filter((i) => i.label.trim());
    if (!number.trim()) return setErr("Indique un numéro de devis.");
    if (!clean.length) return setErr("Ajoute au moins une ligne (ou choisis une formule).");
    if (clean.some((i) => i.qty <= 0 || (!i.included && i.unit_price < 0))) return setErr("Vérifie les quantités et les prix.");
    setErr(null);
    setSaving(andPdf ? "pdf" : "save");
    const row = {
      client_id: client.id,
      number: number.trim(),
      issued_on: issued,
      valid_until: validUntil,
      intro: intro.trim() || null,
      client_email: email.trim() || null,
      client_phone: phone.trim() || null,
      client_address: address.trim() || null,
      items: clean.map((i) => ({ label: i.label.trim(), sub: i.sub?.trim() || undefined, qty: i.qty, unit_price: i.included ? 0 : i.unit_price, included: i.included || undefined })),
      conditions: conditions.filter((c) => c.label.trim() || c.value.trim()),
      total: quoteTotal(clean),
    };
    const sb = getSupabase();
    const res = editingExisting
      ? await sb.from("quotes").update(row).eq("id", initial!.id).select("*").single()
      : await sb.from("quotes").insert(row).select("*").single();
    setSaving(null);
    if (res.error) {
      return setErr(/duplicate key|unique/i.test(res.error.message) ? `Le numéro ${row.number} existe déjà : choisis-en un autre.` : errorMessage(res.error));
    }
    onSaved(res.data as Quote, andPdf);
  }

  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      title={editingExisting ? `Modifier le devis ${initial!.number}` : `Nouveau devis — ${client.first_name} ${client.last_name}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button variant="secondary" loading={saving === "save"} disabled={!!saving} onClick={() => save(false)}>Enregistrer</Button>
          <Button loading={saving === "pdf"} disabled={!!saving} onClick={() => save(true)}>
            <FileDown className="h-4 w-4" /> Enregistrer et télécharger le PDF
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Field
          label="Type de devis"
          hint="Une formule remplit tout automatiquement. Pour un devis hors formule, garde « Devis libre » et écris tes propres lignes. Tout reste modifiable."
        >
          <Select value={preset} onChange={(e) => applyPreset(e.target.value)}>
            <option value="">{editingExisting ? "Garder les lignes actuelles" : "Devis libre (hors formule)"}</option>
            <optgroup label="Sur mesure">
              <option value="libre">Devis libre (hors formule) — repartir de zéro</option>
            </optgroup>
            <optgroup label="Séances à l'unité">
              {QUOTE_PRESETS.filter((p) => p.key.startsWith("pack-")).map((p) => (
                <option key={p.key} value={p.key}>{p.label}</option>
              ))}
            </optgroup>
            <optgroup label="Formules mensuelles">
              {QUOTE_PRESETS.filter((p) => !p.key.startsWith("pack-")).map((p) => (
                <option key={p.key} value={p.key}>{p.label} — {eur(quoteTotal(p.items))}</option>
              ))}
            </optgroup>
          </Select>
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="N° du devis">
            <Input value={number} onChange={(e) => setNumber(e.target.value)} maxLength={40} />
          </Field>
          <Field label="Émis le">
            <Input
              type="date"
              value={issued}
              onChange={(e) => {
                setIssued(e.target.value);
                if (e.target.value) setValidUntil(addDays(e.target.value, QUOTE_VALIDITY_DAYS));
              }}
            />
          </Field>
          <Field label="Valable jusqu'au">
            <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
          </Field>
        </div>

        <fieldset className="rounded-xl border border-ink-700 p-4">
          <legend className="px-1.5 text-xs font-semibold uppercase tracking-wider text-ink-400">Le client</legend>
          <p className="mb-3 text-sm text-ink-200">{client.first_name} {client.last_name.toUpperCase()}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Email">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={160} placeholder="Laisser vide = ligne à compléter" />
            </Field>
            <Field label="Téléphone">
              <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} />
            </Field>
            <Field label="Adresse" className="sm:col-span-2">
              <Input value={address} onChange={(e) => setAddress(e.target.value)} maxLength={300} />
            </Field>
          </div>
        </fieldset>

        <Field label="Description de la prestation">
          <Textarea
            value={intro}
            onChange={(e) => setIntro(e.target.value)}
            rows={2}
            maxLength={2000}
            placeholder="Ex. Accompagnement sur mesure : préparation physique pour un trail de 30 km, 8 semaines."
          />
        </Field>

        <div>
          <p className="label">Lignes du devis</p>
          <div className="space-y-2">
            {items.map((it, idx) => (
              <div key={idx} className="rounded-xl border border-ink-700 bg-ink-900/50 p-3">
                <div className="flex gap-2">
                  <Input value={it.label} onChange={(e) => setItem(idx, { label: e.target.value })} placeholder="Désignation" maxLength={160} className="flex-1" />
                  <Button size="icon" variant="ghost" onClick={() => setItems((xs) => xs.filter((_, i) => i !== idx))} aria-label="Retirer la ligne">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <Input value={it.sub ?? ""} onChange={(e) => setItem(idx, { sub: e.target.value })} placeholder="Précision (facultatif)" maxLength={200} className="mt-2 h-9 text-sm" />
                <div className="mt-2 grid grid-cols-[80px_1fr_auto] items-end gap-2 sm:grid-cols-[90px_140px_auto_1fr]">
                  <Field label="Qté">
                    <Input inputMode="decimal" value={String(it.qty).replace(".", ",")} onChange={(e) => setItem(idx, { qty: num(e.target.value) })} className="h-9" />
                  </Field>
                  <Field label="Prix unitaire (€)">
                    <Input
                      inputMode="decimal"
                      value={it.included ? "" : String(it.unit_price).replace(".", ",")}
                      disabled={!!it.included}
                      placeholder={it.included ? "Inclus" : "0"}
                      onChange={(e) => setItem(idx, { unit_price: num(e.target.value) })}
                      className="h-9"
                    />
                  </Field>
                  <label className="flex h-9 items-center gap-2 text-sm text-ink-300">
                    <input type="checkbox" checked={!!it.included} onChange={(e) => setItem(idx, { included: e.target.checked })} className="h-4 w-4 accent-royal-500" />
                    Inclus
                  </label>
                  <p className="col-span-3 text-right text-sm font-semibold tabular-nums text-white sm:col-span-1">{eur(lineTotal(it))}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setItems((xs) => [...xs, { ...EMPTY_ITEM }])}>
              <Plus className="h-4 w-4" /> Ligne vide
            </Button>
            {QUICK_ITEMS.map((q) => (
              <button
                key={q.label}
                type="button"
                onClick={() => setItems((xs) => [...xs.filter((x) => x.label.trim() || x.unit_price), { ...q }])}
                className="rounded-full border border-ink-600 px-3 py-1 text-xs text-ink-300 transition hover:border-royal-500 hover:text-white"
              >
                + {QUICK_LABELS[q.label]}
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between rounded-xl border border-royal-500/30 bg-royal-600/10 px-4 py-3">
            <span className="text-sm text-ink-200">Total à payer <span className="text-xs text-ink-400">(TVA non applicable)</span></span>
            <span className="font-display text-2xl font-bold tabular-nums text-white">{eur(total)}</span>
          </div>
        </div>

        <div>
          <p className="label">Conditions</p>
          <div className="space-y-2">
            {conditions.map((c, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[170px_1fr_auto]">
                <Input
                  value={c.label}
                  onChange={(e) => setConditions((cs) => cs.map((x, i) => (i === idx ? { ...x, label: e.target.value } : x)))}
                  className="h-9 text-sm font-medium"
                  maxLength={60}
                />
                <Input
                  value={c.value}
                  onChange={(e) => setConditions((cs) => cs.map((x, i) => (i === idx ? { ...x, value: e.target.value } : x)))}
                  className={cn("h-9 text-sm", "col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto")}
                  maxLength={300}
                />
                <Button size="icon" variant="ghost" className="h-9 w-9 sm:col-start-3 sm:row-start-auto" onClick={() => setConditions((cs) => cs.filter((_, i) => i !== idx))} aria-label="Retirer la condition">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setConditions((cs) => [...cs, { label: "", value: "" }])}>
              <Plus className="h-4 w-4" /> Ajouter une condition
            </Button>
            {conditions.length === 0 && (
              <Button size="sm" variant="ghost" onClick={() => setConditions(defaultConditions(presetObj, total, validUntil))}>
                Conditions par défaut
              </Button>
            )}
          </div>
          <p className="mt-2 text-xs text-ink-500">Les conditions générales de vente sont ajoutées automatiquement en page 2 du PDF.</p>
        </div>

        {err && <p className="rounded-lg bg-red-500/10 p-3 text-sm text-red-300">{err}</p>}
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Lien de signature en ligne                                           */
/* ------------------------------------------------------------------ */

function SignLinkModal({ quote, client, onClose, onShared }: { quote: Quote; client: Client; onClose: () => void; onShared: () => void }) {
  const toast = useToast();
  const [qr, setQr] = useState<string | null>(null);
  const url = quoteSignLink(typeof window !== "undefined" ? window.location.origin : "", quote.sign_token!);
  const text = `Bonjour ${client.first_name}, voici ton devis ${quote.number} (${eur(Number(quote.total))}). Tu peux le consulter et le signer en ligne ici : ${url}`;

  useEffect(() => {
    QRCode.toDataURL(url, { width: 600, margin: 1, color: { dark: "#0b0e14", light: "#ffffff" } }).then(setQr).catch(() => setQr(null));
  }, [url]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Lien copié.");
      onShared();
    } catch {
      toast.info(url);
    }
  }
  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ title: `Devis ${quote.number}`, text, url });
        onShared();
      } else copy();
    } catch {
      /* partage annulé */
    }
  }

  return (
    <Modal open onClose={onClose} title={`Faire signer le devis ${quote.number}`}>
      <p className="text-sm text-ink-300">
        Envoie ce lien à {client.first_name} : il voit le devis, accepte les conditions et signe au doigt sur son téléphone. Le devis passe tout seul en « Accepté ».
      </p>
      <div className="mt-4 flex items-center gap-2 rounded-xl border border-ink-700 bg-ink-900 p-2.5">
        <p className="min-w-0 flex-1 truncate text-sm text-ink-200">{url}</p>
        <Button size="sm" variant="secondary" onClick={copy}>
          <Copy className="h-4 w-4" /> Copier
        </Button>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Button onClick={share}>
          <Share2 className="h-4 w-4" /> Partager (SMS, mail…)
        </Button>
        {quote.client_phone ? (
          <a
            href={`https://wa.me/${quote.client_phone.replace(/\D/g, "").replace(/^0/, "33")}?text=${encodeURIComponent(text)}`}
            target="_blank"
            rel="noreferrer"
            onClick={onShared}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-emerald-500/40 text-sm font-medium text-emerald-300 hover:bg-emerald-500/10"
          >
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </a>
        ) : (
          <a
            href={`https://wa.me/?text=${encodeURIComponent(text)}`}
            target="_blank"
            rel="noreferrer"
            onClick={onShared}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-emerald-500/40 text-sm font-medium text-emerald-300 hover:bg-emerald-500/10"
          >
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </a>
        )}
      </div>
      <div className="mt-5 flex flex-col items-center gap-2 rounded-xl border border-ink-700 bg-ink-900/60 p-4">
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-400">
          <QrCode className="h-3.5 w-3.5" /> En face à face : fais-lui scanner
        </p>
        <div className="h-44 w-44 overflow-hidden rounded-xl bg-white p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {qr ? <img src={qr} alt="QR code du lien de signature" className="h-full w-full" /> : <div className="h-full w-full animate-pulse bg-ink-200" />}
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Signature du coach                                                   */
/* ------------------------------------------------------------------ */

function CoachSignModal({ quote, onClose, onSigned }: { quote: Quote; onClose: () => void; onSigned: () => void }) {
  const pad = useRef<SignaturePadHandle>(null);
  const [has, setHas] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    const png = pad.current?.toDataURL();
    if (!png) return setErr("Signe dans le cadre.");
    setBusy(true);
    const { error } = await getSupabase()
      .from("quotes")
      .update({ coach_signature: png, coach_signed_at: new Date().toISOString() })
      .eq("id", quote.id);
    setBusy(false);
    if (error) return setErr(errorMessage(error));
    onSigned();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Signer le devis ${quote.number}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button loading={busy} disabled={!has} onClick={save}>
            <PenLine className="h-4 w-4" /> Valider ma signature
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-ink-300">Ta signature sera ajoutée au PDF avec la date du jour et la mention « Bon pour accord ».</p>
      <SignaturePad ref={pad} onChange={(empty) => setHas(!empty)} />
      {err && <p className="mt-3 rounded-lg bg-red-500/10 p-3 text-sm text-red-300">{err}</p>}
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Menu de téléchargement : PDF à remplir, PDF à imprimer, Word          */
/* ------------------------------------------------------------------ */

function DownloadMenu({ loading, onPick }: { loading: boolean; onPick: (f: "pdf" | "print" | "word") => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const items: { f: "pdf" | "print" | "word"; icon: React.ReactNode; title: string; sub: string }[] = [
    { f: "pdf", icon: <FileDown className="h-4 w-4" />, title: "PDF", sub: "Zones à remplir dans un lecteur PDF" },
    { f: "print", icon: <Printer className="h-4 w-4" />, title: "PDF à imprimer", sub: "Lignes vides à remplir au stylo" },
    { f: "word", icon: <FileText className="h-4 w-4" />, title: "Word (.docx)", sub: "Modifiable dans Word, Google Docs, Pages" },
  ];
  return (
    <div ref={ref} className="relative">
      <Button size="sm" variant="secondary" loading={loading} onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
        <FileDown className="h-4 w-4" /> Télécharger <ChevronDown className="h-3.5 w-3.5" />
      </Button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-30 mt-1 w-64 overflow-hidden rounded-xl border border-ink-600 bg-ink-850 shadow-xl">
          {items.map((i) => (
            <button
              key={i.f}
              role="menuitem"
              type="button"
              onClick={() => {
                setOpen(false);
                onPick(i.f);
              }}
              className="flex w-full items-start gap-3 px-3.5 py-2.5 text-left hover:bg-ink-750"
            >
              <span className="mt-0.5 text-royal-300">{i.icon}</span>
              <span>
                <span className="block text-sm font-medium text-white">{i.title}</span>
                <span className="block text-xs text-ink-400">{i.sub}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
