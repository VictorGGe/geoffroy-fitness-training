import "server-only";
import nodemailer from "nodemailer";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { clean, SUPABASE_URL } from "@/lib/env";
import { workingServiceRoleKey } from "@/lib/env-server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { fmtPrice, fmtSlotFull, type CtRegistration, type CtSlot } from "@/lib/crossTraining";

/* ------------------------------------------------------------------ */
/* Accès base (clé secrète, côté serveur uniquement)                    */
/* ------------------------------------------------------------------ */

export async function adminClient(): Promise<SupabaseClient | null> {
  const key = await workingServiceRoleKey(SUPABASE_URL);
  if (!key) return null;
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Coach connecté (ou null). */
export async function currentCoach() {
  const sb = await createSupabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user || user.app_metadata?.role === "client") return null;
  return { user, sb };
}

/* ------------------------------------------------------------------ */
/* Stripe (paiement par carte)                                          */
/* ------------------------------------------------------------------ */

const STRIPE_API = (process.env.STRIPE_API_BASE || "https://api.stripe.com").replace(/\/+$/, "");

export function stripeKey(): string {
  const k = clean(process.env.STRIPE_SECRET_KEY, "STRIPE_SECRET_KEY");
  return /^(sk|rk)_(test|live)_\w{10,}$/.test(k) ? k : "";
}

export function stripeMode(): "live" | "test" | null {
  const k = stripeKey();
  return !k ? null : k.includes("_live_") ? "live" : "test";
}

function form(obj: Record<string, string | number | undefined>): string {
  return Object.entries(obj)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
}

async function stripe<T>(method: "GET" | "POST", path: string, body?: Record<string, string | number | undefined>): Promise<T> {
  const res = await fetch(`${STRIPE_API}/v1/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${stripeKey()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body ? form(body) : undefined,
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message || `Stripe : erreur ${res.status}`);
  return json as T;
}

export interface StripeSession {
  id: string;
  url: string | null;
  status: string;
  payment_status: string;
  amount_total: number | null;
  metadata: Record<string, string>;
}

export function createCheckout(p: {
  amountCents: number;
  name: string;
  description: string;
  email: string;
  registrationId: string;
  successUrl: string;
  cancelUrl: string;
}) {
  return stripe<StripeSession>("POST", "checkout/sessions", {
    mode: "payment",
    locale: "fr",
    "payment_method_types[0]": "card",
    customer_email: p.email,
    client_reference_id: p.registrationId,
    "metadata[registration_id]": p.registrationId,
    "payment_intent_data[metadata][registration_id]": p.registrationId,
    "payment_intent_data[description]": p.description,
    "line_items[0][quantity]": 1,
    "line_items[0][price_data][currency]": "eur",
    "line_items[0][price_data][unit_amount]": p.amountCents,
    "line_items[0][price_data][product_data][name]": p.name,
    "line_items[0][price_data][product_data][description]": p.description,
    success_url: p.successUrl,
    cancel_url: p.cancelUrl,
  });
}

export function getCheckout(id: string) {
  return stripe<StripeSession>("GET", `checkout/sessions/${encodeURIComponent(id)}`);
}

/* ------------------------------------------------------------------ */
/* Emails                                                               */
/* ------------------------------------------------------------------ */

function mailConfig() {
  const user = clean(process.env.GMAIL_USER || process.env.SMTP_USER, "GMAIL_USER");
  const pass = clean(process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASSWORD, "GMAIL_APP_PASSWORD").replace(/\s/g, "");
  const host = clean(process.env.SMTP_HOST, "SMTP_HOST") || "smtp.gmail.com";
  const port = Number(clean(process.env.SMTP_PORT, "SMTP_PORT")) || 465;
  return { user, pass, host, port };
}

export function mailConfigured(): boolean {
  if (process.env.MAIL_TRANSPORT === "json") return true;
  const c = mailConfig();
  return !!(c.user && c.pass);
}

export function coachEmail(): string {
  return mailConfig().user;
}

/** Envoie un email ; ne lève jamais d'erreur (renvoie false en cas d'échec). */
export async function sendMail(to: string, subject: string, html: string, text: string): Promise<boolean> {
  if (!mailConfigured() || !to) return false;
  const c = mailConfig();
  try {
    const transport =
      process.env.MAIL_TRANSPORT === "json"
        ? nodemailer.createTransport({ jsonTransport: true })
        : nodemailer.createTransport({ host: c.host, port: c.port, secure: c.port === 465, auth: { user: c.user, pass: c.pass } });
    const info = await transport.sendMail({
      from: { name: "Victor Training", address: c.user || "test@victor-training.local" },
      to,
      subject,
      html,
      text,
    });
    if (process.env.MAIL_TRANSPORT === "json") console.log(`[mail] to=${to} subject=${subject} link=${(text.match(/https?:\S+/) || [""])[0]}`, info.messageId);
    return true;
  } catch (e) {
    console.error("[mail] échec", (e as Error).message);
    return false;
  }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

function layout(title: string, body: string, cta?: { label: string; url: string }): string {
  return `<!doctype html><html lang="fr"><body style="margin:0;background:#f3f5f9;font-family:Arial,Helvetica,sans-serif;color:#1b2230">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f5f9;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:14px;overflow:hidden">
<tr><td style="background:#0b0e14;padding:18px 24px;color:#ffffff;font-weight:bold;letter-spacing:3px;font-size:15px">VICTOR <span style="color:#2884fb">TRAINING</span></td></tr>
<tr><td style="padding:26px 24px 8px"><h1 style="margin:0 0 14px;font-size:21px;color:#0b0e14">${esc(title)}</h1>${body}</td></tr>
${cta ? `<tr><td style="padding:10px 24px 26px"><a href="${esc(cta.url)}" style="display:inline-block;background:#1a6fe6;color:#ffffff;text-decoration:none;font-weight:bold;padding:13px 22px;border-radius:10px">${esc(cta.label)}</a></td></tr>` : ""}
<tr><td style="padding:16px 24px;border-top:1px solid #e6e9ef;color:#7a8394;font-size:12px">Victor Training — coaching sportif. Ceci est un message automatique lié à ton inscription.</td></tr>
</table></td></tr></table></body></html>`;
}

const p = (s: string) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.55">${s}</p>`;

function slotLine(slot: CtSlot) {
  return `<strong>${esc(slot.title)}</strong><br>${esc(fmtSlotFull(slot.starts_at, slot.duration_min))}${slot.location ? `<br>${esc(slot.location)}` : ""}`;
}

export function mailRegistered(reg: CtRegistration, slot: CtSlot, count: number, link: string) {
  const open = count >= slot.min_people;
  const subject = open ? `Inscription confirmée — tu peux régler ta séance` : `Inscription enregistrée — ${slot.title}`;
  const body =
    p(`Bonjour ${esc(reg.first_name)},`) +
    p(`Ton inscription est bien enregistrée :`) +
    p(slotLine(slot)) +
    (open
      ? p(`Le groupe est confirmé (${count} inscrits). Tu peux régler ta place (${esc(fmtPrice(slot.price))}) par carte dès maintenant.`)
      : p(
          `Pour l'instant : <strong>${count} / ${slot.min_people}</strong> inscrits minimum. Le paiement s'ouvrira dès que le groupe atteindra ${slot.min_people} personnes : tu recevras un email à ce moment-là. Rien n'est à payer pour le moment.`,
        )) +
    p(`Tu peux suivre ton inscription à tout moment avec ton lien personnel.`);
  const text = `Bonjour ${reg.first_name}, ton inscription au ${slot.title} du ${fmtSlotFull(slot.starts_at, slot.duration_min)} est enregistrée (${count}/${slot.min_people} minimum). Suivi et paiement : ${link}`;
  return { subject, html: layout(open ? "Ta place est réservée" : "Inscription enregistrée", body, { label: open ? "Payer ma séance" : "Suivre mon inscription", url: link }), text };
}

export function mailPaymentOpen(reg: CtRegistration, slot: CtSlot, count: number, link: string) {
  const body =
    p(`Bonjour ${esc(reg.first_name)},`) +
    p(`Bonne nouvelle : le groupe est confirmé avec <strong>${count} inscrits</strong>.`) +
    p(slotLine(slot)) +
    p(`Tu peux maintenant régler ta place (${esc(fmtPrice(slot.price))}) par carte bancaire, en quelques secondes.`);
  const text = `Bonjour ${reg.first_name}, le ${slot.title} du ${fmtSlotFull(slot.starts_at, slot.duration_min)} est confirmé (${count} inscrits). Paie ta place ici : ${link}`;
  return { subject: `C'est confirmé ! Règle ta séance de ${slot.title}`, html: layout("Ton groupe est confirmé 💪", body, { label: `Payer ${fmtPrice(slot.price)}`, url: link }), text };
}

export function mailCancelled(reg: CtRegistration, slot: CtSlot) {
  const paid = reg.status === "paye";
  const body =
    p(`Bonjour ${esc(reg.first_name)},`) +
    p(`La séance suivante est annulée :`) +
    p(slotLine(slot)) +
    p(paid ? `Ton paiement va t'être intégralement remboursé sur ta carte (délai bancaire de quelques jours).` : `Tu n'as rien à payer.`) +
    p(`Désolé pour ce contretemps, à très vite sur un prochain créneau !`);
  const text = `Bonjour ${reg.first_name}, le ${slot.title} du ${fmtSlotFull(slot.starts_at, slot.duration_min)} est annulé. ${paid ? "Tu seras remboursé(e)." : "Tu n'as rien à payer."}`;
  return { subject: `Séance annulée — ${slot.title}`, html: layout("Séance annulée", body), text };
}

export function mailCoachNew(reg: CtRegistration, slot: CtSlot, count: number, coachLink: string) {
  const body =
    p(`Nouvelle inscription : <strong>${esc(reg.first_name)} ${esc(reg.last_name)}</strong>`) +
    p(`${esc(reg.email)} · ${esc(reg.phone)}`) +
    p(slotLine(slot)) +
    p(`Inscrits : <strong>${count} / ${slot.max_people}</strong> (minimum ${slot.min_people}).`);
  const text = `Nouvelle inscription : ${reg.first_name} ${reg.last_name} (${reg.email}, ${reg.phone}) — ${slot.title} ${fmtSlotFull(slot.starts_at, slot.duration_min)} — ${count}/${slot.max_people}. ${coachLink}`;
  return { subject: `Cross training : ${reg.first_name} ${reg.last_name} inscrit(e) (${count}/${slot.max_people})`, html: layout("Nouvelle inscription", body, { label: "Voir les inscrits", url: coachLink }), text };
}

export function personalLink(origin: string, token: string) {
  return `${origin}/cross-training/inscription?t=${token}`;
}

/* ------------------------------------------------------------------ */
/* Logique                                                              */
/* ------------------------------------------------------------------ */

export async function activeCount(admin: SupabaseClient, slotId: string): Promise<number> {
  const { count } = await admin
    .from("ct_registrations")
    .select("id", { count: "exact", head: true })
    .eq("slot_id", slotId)
    .neq("status", "annule");
  return count ?? 0;
}

/**
 * Prévient (une seule fois) les inscrits non payés quand le groupe atteint le minimum.
 * Renvoie le nombre d'emails envoyés.
 */
export async function notifyPaymentOpen(admin: SupabaseClient, slot: CtSlot, origin: string, exceptId?: string): Promise<number> {
  const count = await activeCount(admin, slot.id);
  if (slot.status !== "ouvert" || count < slot.min_people) return 0;
  const { data } = await admin
    .from("ct_registrations")
    .select("*")
    .eq("slot_id", slot.id)
    .eq("status", "inscrit")
    .is("pay_notified_at", null);
  let sent = 0;
  for (const reg of (data ?? []) as CtRegistration[]) {
    if (reg.id === exceptId) continue;
    const m = mailPaymentOpen(reg, slot, count, personalLink(origin, reg.token));
    if (await sendMail(reg.email, m.subject, m.html, m.text)) {
      sent++;
      await admin.from("ct_registrations").update({ pay_notified_at: new Date().toISOString() }).eq("id", reg.id);
    }
  }
  return sent;
}

/** Marque une inscription payée et ajoute la facture dans « Finances ». */
export async function markPaid(admin: SupabaseClient, reg: CtRegistration, slot: CtSlot, amount: number, by: "carte" | "manuel") {
  if (reg.status === "paye") return;
  const { error } = await admin
    .from("ct_registrations")
    .update({ status: "paye", paid_at: new Date().toISOString(), amount_paid: amount, paid_by: by })
    .eq("id", reg.id)
    .neq("status", "paye");
  if (error) throw error;
  // Facture automatique (ignorée si le module Finances n'est pas encore installé)
  await admin.from("invoices").insert({
    coach_id: slot.coach_id,
    client_name: `${reg.first_name} ${reg.last_name}`.slice(0, 120),
    label: `${slot.title} — ${fmtSlotFull(slot.starts_at)}${by === "carte" ? " (carte)" : ""}`.slice(0, 160),
    amount,
    issued_on: new Date().toISOString().slice(0, 10),
    paid: true,
  });
}

/** Vérifie auprès de Stripe si une session de paiement a été réglée. */
export async function syncStripePayment(admin: SupabaseClient, reg: CtRegistration, slot: CtSlot, sessionId?: string | null): Promise<boolean> {
  const id = sessionId || reg.stripe_session_id;
  if (!id || !stripeKey() || reg.status !== "inscrit") return false;
  try {
    const s = await getCheckout(id);
    if (s.payment_status === "paid" && s.metadata?.registration_id === reg.id) {
      await markPaid(admin, reg, slot, (s.amount_total ?? Math.round(slot.price * 100)) / 100, "carte");
      return true;
    }
  } catch (e) {
    console.error("[stripe] vérification", (e as Error).message);
  }
  return false;
}

export function originOf(req: Request): string {
  const u = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") || u.host;
  const proto = req.headers.get("x-forwarded-proto") || u.protocol.replace(":", "");
  return `${proto}://${host}`;
}
