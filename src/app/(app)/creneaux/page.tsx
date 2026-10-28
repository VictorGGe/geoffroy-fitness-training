"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import {
  AlertTriangle,
  Ban,
  CalendarPlus,
  Check,
  ChevronDown,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  Mail,
  MessageCircle,
  Phone,
  QrCode,
  Send,
  Trash2,
  UserMinus,
  Users,
} from "lucide-react";
import { Badge, Button, Card, ConfirmDialog, EmptyState, ErrorBlock, Field, Input, LoadingBlock, Modal, PageHeader, Select } from "@/components/ui";
import { useToast } from "@/components/toast";
import { cn } from "@/lib/cn";
import { getSupabase } from "@/lib/supabase/client";
import { unwrap, useAsync } from "@/lib/hooks";
import { errorMessage } from "@/lib/format";
import {
  CT_DEFAULTS,
  fmtPrice,
  fmtSlotDay,
  fmtSlotFull,
  fmtSlotTime,
  slotState,
  whatsappLink,
  type CtRegistration,
  type CtSlot,
} from "@/lib/crossTraining";

interface Config {
  coachId: string;
  stripe: "live" | "test" | null;
  email: boolean;
  server: boolean;
}

async function coachAction(body: Record<string, unknown>) {
  const res = await fetch("/api/ct/coach/action", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || `Erreur ${res.status}`);
  return j;
}

export default function CreneauxPage() {
  const toast = useToast();
  const [showPast, setShowPast] = useState(false);
  const [creating, setCreating] = useState(false);
  const [config, setConfig] = useState<Config | null>(null);
  const [cancelSlot, setCancelSlot] = useState<CtSlot | null>(null);
  const [busy, setBusy] = useState(false);

  const { data, loading, error, reload } = useAsync(async () => {
    const sb = getSupabase();
    const since = new Date(Date.now() - 45 * 86400000).toISOString();
    const [slots, regs] = await Promise.all([
      sb.from("ct_slots").select("*").gte("starts_at", since).order("starts_at"),
      sb.from("ct_registrations").select("*").order("created_at"),
    ]);
    return { slots: unwrap(slots) as CtSlot[], regs: unwrap(regs) as CtRegistration[] };
  });

  useEffect(() => {
    fetch("/api/ct/coach/config", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((c) => c && setConfig(c))
      .catch(() => {});
    // Paiements par carte commencés mais pas encore confirmés : vérification auprès de Stripe
    fetch("/api/ct/coach/sync", { method: "POST" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.updated > 0) reload();
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const now = Date.now();
  const upcoming = useMemo(() => (data?.slots ?? []).filter((s) => new Date(s.starts_at).getTime() + s.duration_min * 60000 >= now), [data, now]);
  const past = useMemo(() => (data?.slots ?? []).filter((s) => new Date(s.starts_at).getTime() + s.duration_min * 60000 < now).reverse(), [data, now]);
  const regsOf = (id: string) => (data?.regs ?? []).filter((r) => r.slot_id === id);

  async function doCancelSlot() {
    if (!cancelSlot) return;
    setBusy(true);
    try {
      const j = await coachAction({ action: "cancel-slot", slotId: cancelSlot.id });
      toast.success(
        j.total ? `Créneau annulé. ${j.notified}/${j.total} inscrit(s) prévenu(s) par email.` : "Créneau annulé.",
      );
      if (j.paid) toast.info(`${j.paid} personne(s) avaient déjà payé : rembourse-les depuis ton tableau de bord Stripe.`);
      setCancelSlot(null);
      reload();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const header = (
    <PageHeader
      title="Cross training"
      subtitle="Tes créneaux en petit groupe, les inscrits et les paiements."
      actions={
        <Button onClick={() => setCreating(true)} disabled={!data}>
          <CalendarPlus className="h-4 w-4" /> Nouveau créneau
        </Button>
      }
    />
  );

  if (loading && !data) return (<>{header}<LoadingBlock /></>);
  if (error) {
    return (
      <>
        {header}
        {/ct_slots|ct_registrations|schema cache|does not exist/i.test(error) ? (
          <Card>
            <EmptyState
              icon={<Users className="h-6 w-6" />}
              title="Une dernière étape dans Supabase"
              text="Exécute le fichier cross-training.sql dans Supabase → SQL Editor, puis recharge cette page."
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

  return (
    <>
      {header}
      <SetupStatus config={config} />

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-4">
          {upcoming.length === 0 ? (
            <Card>
              <EmptyState
                icon={<CalendarPlus className="h-6 w-6" />}
                title="Aucun créneau à venir"
                text="Crée tes créneaux de la semaine : ils apparaîtront aussitôt sur la page d'inscription."
                action={<Button onClick={() => setCreating(true)}><CalendarPlus className="h-4 w-4" /> Nouveau créneau</Button>}
              />
            </Card>
          ) : (
            upcoming.map((s) => (
              <SlotPanel key={s.id} slot={s} regs={regsOf(s.id)} onChanged={reload} onCancel={() => setCancelSlot(s)} />
            ))
          )}

          {past.length > 0 && (
            <div>
              <button className="inline-flex items-center gap-1.5 text-sm text-ink-400 hover:text-ink-100" onClick={() => setShowPast(!showPast)}>
                <ChevronDown className={cn("h-4 w-4 transition", showPast && "rotate-180")} /> Créneaux passés ({past.length})
              </button>
              {showPast && (
                <div className="mt-3 space-y-4 opacity-80">
                  {past.map((s) => (
                    <SlotPanel key={s.id} slot={s} regs={regsOf(s.id)} onChanged={reload} isPast />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <ShareCard coachId={config?.coachId ?? null} />
      </div>

      {creating && (
        <SlotModal
          onClose={() => setCreating(false)}
          onSaved={(n) => {
            setCreating(false);
            toast.success(n > 1 ? `${n} créneaux créés.` : "Créneau créé.");
            reload();
          }}
        />
      )}
      <ConfirmDialog
        open={!!cancelSlot}
        title="Annuler ce créneau ?"
        message={
          cancelSlot && (
            <>
              {fmtSlotFull(cancelSlot.starts_at, cancelSlot.duration_min)}.
              <br />
              Les {regsOf(cancelSlot.id).filter((r) => r.status !== "annule").length} inscrit(s) seront prévenus par email.
            </>
          )
        }
        confirmLabel="Annuler le créneau"
        loading={busy}
        onConfirm={doCancelSlot}
        onCancel={() => setCancelSlot(null)}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */

function SetupStatus({ config }: { config: Config | null }) {
  if (!config) return null;
  const items = [
    { ok: config.server, label: "Inscriptions en ligne", off: "clé SUPABASE_SERVICE_ROLE_KEY manquante dans Vercel" },
    { ok: !!config.stripe, label: config.stripe === "test" ? "Paiement carte (mode test)" : "Paiement par carte", off: "Stripe pas encore connecté" },
    { ok: config.email, label: "Emails automatiques", off: "Gmail pas encore connecté" },
  ];
  return (
    <div className="mb-5 flex flex-wrap gap-2">
      {items.map((i) => (
        <span
          key={i.label}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs",
            i.ok ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300" : "border-amber-500/30 bg-amber-500/10 text-amber-300",
          )}
        >
          {i.ok ? <Check className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
          {i.label}
          {!i.ok && <span className="text-amber-200/70">— {i.off}</span>}
        </span>
      ))}
    </div>
  );
}

function ShareCard({ coachId }: { coachId: string | null }) {
  const toast = useToast();
  const [qr, setQr] = useState<string | null>(null);
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (!coachId) return;
    const u = `${window.location.origin}/cross-training?c=${coachId}`;
    setUrl(u);
    QRCode.toDataURL(u, { width: 1024, margin: 2, errorCorrectionLevel: "M", color: { dark: "#0b0e14", light: "#ffffff" } })
      .then(setQr)
      .catch(() => setQr(null));
  }, [coachId]);

  return (
    <Card title={<span className="inline-flex items-center gap-2"><QrCode className="h-4 w-4 text-royal-400" /> Page d&apos;inscription</span>} className="h-fit lg:sticky lg:top-6">
      <p className="text-sm text-ink-400">À afficher en salle ou à partager : les gens s&apos;inscrivent sans compte ni mot de passe.</p>
      <div className="mx-auto mt-4 aspect-square w-full max-w-[220px] overflow-hidden rounded-2xl bg-white p-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {qr ? <img src={qr} alt="QR code de la page d'inscription" className="h-full w-full" /> : <div className="h-full w-full animate-pulse bg-ink-200" />}
      </div>
      <div className="mt-4 grid gap-2">
        <Button
          variant="secondary"
          disabled={!url}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              toast.success("Lien copié.");
            } catch {
              toast.info(url);
            }
          }}
        >
          <Copy className="h-4 w-4" /> Copier le lien
        </Button>
        {qr && (
          <a href={qr} download="qr-cross-training.png" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-ink-600 text-sm font-medium text-ink-200 hover:border-royal-500 hover:text-white">
            <Download className="h-4 w-4" /> Télécharger le QR code
          </a>
        )}
        {url && (
          <a href={url} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl text-sm font-medium text-ink-300 hover:bg-ink-750 hover:text-white">
            <ExternalLink className="h-4 w-4" /> Voir la page
          </a>
        )}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

function SlotPanel({
  slot,
  regs,
  onChanged,
  onCancel,
  isPast,
}: {
  slot: CtSlot;
  regs: CtRegistration[];
  onChanged: () => void;
  onCancel?: () => void;
  isPast?: boolean;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(!isPast);
  const [busy, setBusy] = useState<string | null>(null);
  const [remove, setRemove] = useState<CtRegistration | null>(null);
  const [del, setDel] = useState(false);

  const active = regs.filter((r) => r.status !== "annule");
  const paid = active.filter((r) => r.status === "paye");
  const unpaid = active.filter((r) => r.status === "inscrit");
  const collected = paid.reduce((s, r) => s + Number(r.amount_paid ?? slot.price), 0);
  const cancelled = slot.status === "annule";
  const state = slotState(active.length, slot.min_people, slot.max_people);

  async function run(key: string, fn: () => Promise<unknown>, success?: string) {
    setBusy(key);
    try {
      await fn();
      if (success) toast.success(success);
      onChanged();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  const badge = cancelled ? (
    <Badge tone="red">Annulé</Badge>
  ) : state === "attente" ? (
    <Badge tone="amber">En attente · {active.length}/{slot.min_people} min.</Badge>
  ) : state === "complet" ? (
    <Badge tone="blue">Complet · paiement ouvert</Badge>
  ) : (
    <Badge tone="green">Confirmé · paiement ouvert</Badge>
  );

  return (
    <section className={cn("card overflow-hidden animate-fade-in", cancelled && "opacity-60")}>
      <button className="flex w-full items-start gap-4 p-4 text-left sm:p-5" onClick={() => setOpen(!open)}>
        <div className="flex w-14 shrink-0 flex-col items-center rounded-xl bg-ink-900 py-2">
          <span className="text-[10px] font-bold uppercase text-royal-400">
            {new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", weekday: "short" }).format(new Date(slot.starts_at))}
          </span>
          <span className="font-display text-2xl font-bold leading-none text-white">
            {new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "numeric" }).format(new Date(slot.starts_at))}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-white">{fmtSlotTime(slot.starts_at, slot.duration_min)}</p>
            {badge}
          </div>
          <p className="mt-0.5 truncate text-sm text-ink-400">
            {slot.title} · {fmtSlotDay(slot.starts_at)}
            {slot.location ? ` · ${slot.location}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-300">
            <span><Users className="mr-1 inline h-3.5 w-3.5 text-ink-500" />{active.length}/{slot.max_people} inscrits</span>
            <span><CreditCard className="mr-1 inline h-3.5 w-3.5 text-ink-500" />{paid.length} payé{paid.length > 1 ? "s" : ""} · {fmtPrice(collected)} encaissés</span>
            <span className="text-ink-500">{fmtPrice(slot.price)} / pers.</span>
          </div>
        </div>
        <ChevronDown className={cn("mt-1 h-5 w-5 shrink-0 text-ink-500 transition", open && "rotate-180")} />
      </button>

      {open && (
        <div className="border-t border-ink-700/60">
          {active.length === 0 ? (
            <p className="px-5 py-4 text-sm text-ink-400">Personne n&apos;est encore inscrit.</p>
          ) : (
            <ul className="divide-y divide-ink-700/50">
              {active.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-5">
                  <div className="min-w-0 flex-1 basis-48">
                    <p className="font-medium text-ink-100">
                      {r.first_name} {r.last_name}
                      {r.consents?.image === true && <span className="ml-2 text-[10px] font-normal text-ink-500">photos OK</span>}
                    </p>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-ink-400">
                      <a href={`tel:${r.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1 hover:text-white"><Phone className="h-3 w-3" />{r.phone}</a>
                      <a href={`mailto:${r.email}`} className="inline-flex items-center gap-1 truncate hover:text-white"><Mail className="h-3 w-3" />{r.email}</a>
                    </div>
                  </div>
                  {r.status === "paye" ? (
                    <Badge tone="green"><Check className="h-3 w-3" /> Payé {r.paid_by === "carte" ? "par carte" : "(manuel)"}</Badge>
                  ) : (
                    <Badge tone="amber">Pas encore payé</Badge>
                  )}
                  <div className="flex items-center">
                    <a
                      href={whatsappLink(
                        r.phone,
                        state === "attente"
                          ? `Salut ${r.first_name}, c'est Victor ! Merci pour ton inscription au cross training du ${fmtSlotFull(slot.starts_at)}.`
                          : `Salut ${r.first_name}, c'est Victor ! Le cross training du ${fmtSlotFull(slot.starts_at)} est confirmé 💪 Tu peux régler ta place avec le lien reçu par email.`,
                      )}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-emerald-400 hover:bg-ink-750"
                      aria-label="WhatsApp"
                      title="Envoyer un WhatsApp"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </a>
                    {r.status === "inscrit" && !cancelled && (
                      <Button
                        variant="ghost"
                        size="sm"
                        loading={busy === `paid-${r.id}`}
                        onClick={() => run(`paid-${r.id}`, () => coachAction({ action: "mark-paid", registrationId: r.id }), "Marqué payé (facture ajoutée dans Finances).")}
                        title="Paiement reçu en espèces ou par virement"
                      >
                        <Check className="h-4 w-4" /> Payé
                      </Button>
                    )}
                    {r.status === "inscrit" && (
                      <Button variant="ghost" size="icon" onClick={() => setRemove(r)} aria-label="Retirer" title="Retirer du créneau">
                        <UserMinus className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {!cancelled && !isPast && (
            <div className="flex flex-wrap gap-2 border-t border-ink-700/60 bg-ink-900/40 px-4 py-3 sm:px-5">
              {state !== "attente" && unpaid.length > 0 && (
                <Button
                  size="sm"
                  variant="secondary"
                  loading={busy === "remind"}
                  onClick={() =>
                    run("remind", async () => {
                      const j = await coachAction({ action: "remind", slotId: slot.id });
                      toast.success(j.notified ? `Lien de paiement renvoyé à ${j.notified} personne(s).` : "Aucun email envoyé (emails pas encore activés).");
                    })
                  }
                >
                  <Send className="h-4 w-4" /> Relancer le paiement ({unpaid.length})
                </Button>
              )}
              {active.length === 0 ? (
                <Button size="sm" variant="ghost" onClick={() => setDel(true)}>
                  <Trash2 className="h-4 w-4" /> Supprimer
                </Button>
              ) : (
                <Button size="sm" variant="ghost" onClick={onCancel}>
                  <Ban className="h-4 w-4" /> Annuler le créneau
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!remove}
        title="Retirer cette personne ?"
        message={remove && `${remove.first_name} ${remove.last_name} sera retiré(e) du créneau et sa place libérée.`}
        confirmLabel="Retirer"
        loading={busy === "remove"}
        onConfirm={() =>
          remove &&
          run("remove", async () => {
            const { error } = await getSupabase().from("ct_registrations").update({ status: "annule" }).eq("id", remove.id);
            if (error) throw error;
            setRemove(null);
          }, "Inscription retirée.")
        }
        onCancel={() => setRemove(null)}
      />
      <ConfirmDialog
        open={del}
        title="Supprimer ce créneau ?"
        message={fmtSlotFull(slot.starts_at, slot.duration_min)}
        loading={busy === "del"}
        onConfirm={() =>
          run("del", async () => {
            const { error } = await getSupabase().from("ct_slots").delete().eq("id", slot.id);
            if (error) throw error;
            setDel(false);
          }, "Créneau supprimé.")
        }
        onCancel={() => setDel(false)}
      />
    </section>
  );
}

/* ------------------------------------------------------------------ */

const LAST_KEY = "vt-ct-last-slot";

function SlotModal({ onClose, onSaved }: { onClose: () => void; onSaved: (n: number) => void }) {
  const last = (() => {
    try {
      return JSON.parse(localStorage.getItem(LAST_KEY) || "{}");
    } catch {
      return {};
    }
  })();
  const [f, setF] = useState({
    title: last.title ?? "Cross training",
    date: "",
    time: last.time ?? "18:30",
    duration: String(last.duration ?? CT_DEFAULTS.duration),
    location: last.location ?? CT_DEFAULTS.location,
    price: String(last.price ?? CT_DEFAULTS.price).replace(".", ","),
    min: String(last.min ?? CT_DEFAULTS.min),
    max: String(last.max ?? CT_DEFAULTS.max),
    weeks: "1",
  });
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  async function save() {
    const price = Number(f.price.replace(",", "."));
    const min = Number(f.min);
    const max = Number(f.max);
    const duration = Number(f.duration);
    const weeks = Number(f.weeks);
    if (!f.date || !f.time) return setErr("Indique la date et l'heure.");
    const start = new Date(`${f.date}T${f.time}`);
    if (Number.isNaN(start.getTime())) return setErr("Date invalide.");
    if (start.getTime() < Date.now()) return setErr("Ce créneau est dans le passé.");
    if (!(price >= 1)) return setErr("Prix invalide.");
    if (!(min >= 1 && max >= min && max <= 50)) return setErr("Le minimum doit être inférieur ou égal au maximum.");
    if (!(duration >= 15 && duration <= 240)) return setErr("Durée invalide (15 à 240 min).");
    setErr(null);
    setSaving(true);
    const series = weeks > 1 ? crypto.randomUUID() : null;
    const rows = Array.from({ length: weeks }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + 7 * i);
      return {
        title: f.title.trim() || "Cross training",
        starts_at: d.toISOString(),
        duration_min: duration,
        location: f.location.trim() || null,
        price,
        min_people: min,
        max_people: max,
        series_id: series,
      };
    });
    const { error } = await getSupabase().from("ct_slots").insert(rows);
    setSaving(false);
    if (error) return setErr(errorMessage(error));
    try {
      localStorage.setItem(LAST_KEY, JSON.stringify({ title: f.title, time: f.time, duration, location: f.location, price, min, max }));
    } catch {
      /* sans conséquence */
    }
    onSaved(rows.length);
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Nouveau créneau"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button loading={saving} onClick={save}>Créer</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Nom de la séance">
          <Input value={f.title} onChange={set("title")} maxLength={80} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Date" required>
            <Input type="date" value={f.date} onChange={set("date")} />
          </Field>
          <Field label="Heure" required>
            <Input type="time" value={f.time} onChange={set("time")} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Durée (min)">
            <Input inputMode="numeric" value={f.duration} onChange={set("duration")} />
          </Field>
          <Field label="Prix par personne (€)">
            <Input inputMode="decimal" value={f.price} onChange={set("price")} />
          </Field>
        </div>
        <Field label="Lieu">
          <Input value={f.location} onChange={set("location")} maxLength={160} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Minimum de personnes" hint="Le paiement s'ouvre à ce nombre.">
            <Input inputMode="numeric" value={f.min} onChange={set("min")} />
          </Field>
          <Field label="Maximum">
            <Input inputMode="numeric" value={f.max} onChange={set("max")} />
          </Field>
        </div>
        <Field label="Répéter">
          <Select value={f.weeks} onChange={set("weeks")}>
            <option value="1">Une seule fois</option>
            {[2, 3, 4, 6, 8, 12].map((n) => (
              <option key={n} value={n}>Chaque semaine pendant {n} semaines</option>
            ))}
          </Select>
        </Field>
        {err && <p className="text-sm text-red-400">{err}</p>}
      </div>
    </Modal>
  );
}
