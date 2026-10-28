/**
 * Cross training en petit groupe — éléments partagés (page publique, page coach, serveur).
 */

export const CT_TZ = "Europe/Paris";
export const CT_DEFAULTS = { min: 3, max: 6, duration: 60, price: 15, location: "Basic-Fit Essey-lès-Nancy" };

/** Mentions légales de l'entreprise (affichées sur la page publique). */
export const CT_BUSINESS = {
  name: "Victor Training — Victor Geoffroy (EI)",
  siret: "108 146 432 00019",
  vat: "TVA non applicable, art. 293 B du CGI",
};

export interface PublicSlot {
  id: string;
  title: string;
  starts_at: string;
  duration_min: number;
  location: string | null;
  price: number;
  min_people: number;
  max_people: number;
  count: number;
}

export interface CtSlot extends Omit<PublicSlot, "count"> {
  coach_id: string;
  status: "ouvert" | "annule";
  notes: string | null;
  series_id: string | null;
}

export interface CtRegistration {
  id: string;
  slot_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  token: string;
  status: "inscrit" | "paye" | "annule";
  consents: Record<string, unknown>;
  consent_version: string | null;
  stripe_session_id: string | null;
  amount_paid: number | null;
  paid_at: string | null;
  paid_by: "carte" | "manuel" | null;
  pay_notified_at: string | null;
  created_at: string;
}

/* ------------------------------------------------------------------ */
/* Cases à cocher                                                       */
/* ------------------------------------------------------------------ */

export const CONSENT_VERSION = "2026-10-28";

export interface Consent {
  key: string;
  required: boolean;
  text: (min: number) => string;
}

export const CONSENTS: Consent[] = [
  {
    key: "sante",
    required: true,
    text: () =>
      "Je certifie être en bonne santé et ne présenter aucune contre-indication médicale à la pratique d'une activité physique intense. En cas de doute, j'ai consulté un médecin avant de m'inscrire.",
  },
  {
    key: "risques",
    required: true,
    text: () =>
      "Je reconnais que le cross training comporte des risques de blessure. Je m'engage à respecter les consignes du coach, à adapter mon effort à mon niveau et à signaler, avant ou pendant la séance, toute douleur, blessure ou problème de santé.",
  },
  {
    key: "majeur",
    required: true,
    text: () => "J'ai 18 ans ou plus.",
  },
  {
    key: "assurance",
    required: true,
    text: () =>
      "Je déclare être couvert(e) par une assurance responsabilité civile et j'ai été informé(e) de l'intérêt de souscrire une assurance individuelle accident couvrant ma pratique sportive.",
  },
  {
    key: "conditions",
    required: true,
    text: (min) =>
      `J'accepte les conditions de la séance : le paiement n'est possible qu'à partir de ${min} inscrits ; si ce minimum n'est pas atteint, la séance est annulée et rien n'est dû ; si le coach annule, je suis remboursé(e) ; une annulation de ma part moins de 24 h avant la séance n'est pas remboursée ; un retard n'est pas rattrapé ; une tenue de sport adaptée est requise.`,
  },
  {
    key: "donnees",
    required: true,
    text: () =>
      "J'accepte que Victor Training conserve mon nom, mon email et mon téléphone uniquement pour gérer mon inscription et me contacter. Je peux demander leur modification ou leur suppression à tout moment.",
  },
  {
    key: "image",
    required: false,
    text: () =>
      "Facultatif : j'autorise la prise de photos ou de vidéos pendant la séance et leur diffusion sur les réseaux de Victor Training.",
  },
];

/* ------------------------------------------------------------------ */
/* Formats (toujours à l'heure de Paris)                                */
/* ------------------------------------------------------------------ */

export function fmtSlotDay(iso: string): string {
  const s = new Intl.DateTimeFormat("fr-FR", { timeZone: CT_TZ, weekday: "long", day: "numeric", month: "long" }).format(new Date(iso));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function fmtSlotTime(iso: string, durationMin?: number): string {
  const f = new Intl.DateTimeFormat("fr-FR", { timeZone: CT_TZ, hour: "2-digit", minute: "2-digit" });
  const start = f.format(new Date(iso)).replace(":", "h");
  if (!durationMin) return start;
  return `${start} – ${f.format(new Date(new Date(iso).getTime() + durationMin * 60000)).replace(":", "h")}`;
}

export function fmtSlotFull(iso: string, durationMin?: number): string {
  return `${fmtSlotDay(iso)} · ${fmtSlotTime(iso, durationMin)}`;
}

/** Clé de jour (AAAA-MM-JJ) à l'heure de Paris, pour regrouper les créneaux. */
export function slotDayKey(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: CT_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

export function fmtPrice(v: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: Number.isInteger(Number(v)) ? 0 : 2,
  })
    .format(Number(v))
    .replace(/ /g, " ");
}

/** État d'un créneau selon le nombre d'inscrits. */
export function slotState(count: number, min: number, max: number): "attente" | "confirme" | "complet" {
  if (count >= max) return "complet";
  if (count >= min) return "confirme";
  return "attente";
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Téléphone : chiffres, espaces, +, points, tirets ; au moins 9 chiffres. */
export function validPhone(p: string): boolean {
  return /^[+\d][\d\s.()-]{5,28}$/.test(p.trim()) && p.replace(/\D/g, "").length >= 9;
}

/** Lien WhatsApp à partir d'un numéro français (06… → 336…). */
export function whatsappLink(phone: string, text: string): string {
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  else if (d.startsWith("0")) d = "33" + d.slice(1);
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
}
