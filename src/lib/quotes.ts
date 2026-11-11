/** Devis par client : modèle, formules prêtes à l'emploi, conditions générales. */
import { discounted, FORMULAS } from "./pricing";

export interface QuoteItem {
  label: string;
  sub?: string;
  qty: number;
  unit_price: number;
  /** « Inclus » à la place du prix */
  included?: boolean;
}

export interface QuoteCondition {
  label: string;
  value: string;
}

export interface Quote {
  id: string;
  client_id: string;
  number: string;
  issued_on: string;
  valid_until: string;
  intro: string | null;
  client_email: string | null;
  client_phone: string | null;
  client_address: string | null;
  items: QuoteItem[];
  conditions: QuoteCondition[];
  total: number;
  status: "brouillon" | "envoye" | "accepte" | "refuse";
  invoice_id: string | null;
  created_at: string;
}

export const QUOTE_STATUS: Record<Quote["status"], { label: string; tone: "neutral" | "blue" | "green" | "red" }> = {
  brouillon: { label: "Brouillon", tone: "neutral" },
  envoye: { label: "Envoyé", tone: "blue" },
  accepte: { label: "Accepté", tone: "green" },
  refuse: { label: "Refusé", tone: "red" },
};

/** Coordonnées du coach (en-tête du devis). */
export const COACH = {
  name: "Victor GEOFFROY",
  placeLine1: "Club Basic-Fit · 1 Av. de Saulxures",
  placeLine2: "54270 Essey-lès-Nancy",
  place: "Club Basic-Fit d'Essey-lès-Nancy",
  siret: "108 146 432 00019",
  footer: "Victor Geoffroy · Coach sportif · SIRET 108 146 432 00019 · Club Basic-Fit, 1 Av. de Saulxures, 54270 Essey-lès-Nancy",
  vat: "TVA non applicable, art. 293 B du CGI.",
};

export const SESSION_PRICE = 40;
export const QUOTE_VALIDITY_DAYS = 30;

export function lineTotal(i: QuoteItem): number {
  return i.included ? 0 : Math.round(i.qty * i.unit_price * 100) / 100;
}

export function quoteTotal(items: QuoteItem[]): number {
  return Math.round(items.reduce((s, i) => s + lineTotal(i), 0) * 100) / 100;
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function fmtDateFr(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${iso}T12:00:00`));
}

export function eur(v: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .format(v)
    .replace(/ /g, " ");
}

/** Numéro suivant : DEV-2026-001, DEV-2026-002… (par année). */
export function nextQuoteNumber(existing: string[], year: number): string {
  const prefix = `DEV-${year}-`;
  const max = existing
    .filter((n) => n.startsWith(prefix))
    .map((n) => Number(n.slice(prefix.length)))
    .filter((n) => Number.isFinite(n))
    .reduce((m, n) => Math.max(m, n), 0);
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

/* ------------------------------------------------------------------ */
/* Formules prêtes à l'emploi                                           */
/* ------------------------------------------------------------------ */

export interface QuotePreset {
  key: string;
  label: string;
  intro: string;
  items: QuoteItem[];
  /** Durée de validité des séances / de l'engagement */
  validity: string;
  payment: (total: number) => string;
}

const PROGRAM_LINE: QuoteItem = { label: "Programme d'entraînement personnalisé", sub: "Conçu selon les objectifs du Client", qty: 1, unit_price: 0, included: true };
const FOLLOW_LINE: QuoteItem = {
  label: "Programme personnalisé, bilan et suivi",
  sub: "Bilan initial, programme sur mesure et suivi des progrès sur l'application",
  qty: 1,
  unit_price: 0,
  included: true,
};

/** Pack de N séances à l'unité (comme le devis de départ). */
export function sessionPackPreset(n: number, price = SESSION_PRICE): QuotePreset {
  return {
    key: `pack-${n}`,
    label: `${n} séance${n > 1 ? "s" : ""} à l'unité (${price} € / séance)`,
    intro: `Formule personnalisée : ${n} séance${n > 1 ? "s" : ""} de Personal Training individuelle${n > 1 ? "s" : ""} au club, avec un programme d'entraînement conçu sur mesure.`,
    items: [{ label: "Séance de Personal Training individuelle", sub: "Durée et horaires définis avec le Client", qty: n, unit_price: price }, PROGRAM_LINE],
    validity: n <= 4 ? "1 mois à compter de la signature du contrat" : `${Math.ceil(n / 4)} mois à compter de la signature du contrat`,
    payment: (t) => `${eur(t)} réglés à la signature du contrat`,
  };
}

export const QUOTE_PRESETS: QuotePreset[] = [
  sessionPackPreset(1, 42),
  sessionPackPreset(3),
  sessionPackPreset(5),
  sessionPackPreset(10),
  ...FORMULAS.filter((f) => f.unit === "mois").flatMap((f) =>
    [{ months: 1, discount: 0 }, ...(f.commitments ?? [])].map(({ months, discount }) => {
      const monthly = discount ? discounted(f.price, discount) : f.price;
      return {
        key: `${f.key}-${months}`,
        label: `${f.name} (${f.rhythm}) — ${months === 1 ? "sans engagement" : `${months} mois (−${discount} %)`}`,
        intro: `Formule ${f.name} : ${f.rhythm.replace("/", "par")} de Personal Training individuel au club${months > 1 ? `, avec un engagement de ${months} mois` : ""}, programme d'entraînement personnalisé et suivi sur l'application.`,
        items: [
          {
            label: `Formule ${f.name} — ${f.rhythm}`,
            sub: months === 1 ? "Abonnement mensuel, sans engagement" : `Engagement ${months} mois · tarif remisé de ${discount} %`,
            qty: months,
            unit_price: monthly,
          },
          FOLLOW_LINE,
        ],
        validity: months === 1 ? "1 mois à compter de la signature du contrat" : `${months} mois à compter de la signature du contrat`,
        payment: (t: number) =>
          months === 1 ? `${eur(t)} réglés à la signature du contrat` : `${eur(monthly)} / mois pendant ${months} mois, 1er règlement à la signature`,
      };
    }),
  ),
];

export function defaultConditions(preset: QuotePreset | null, total: number, validUntil: string): QuoteCondition[] {
  return [
    { label: "Validité des séances", value: preset?.validity ?? "1 mois à compter de la signature du contrat" },
    { label: "Lieu", value: COACH.place },
    { label: "Paiement", value: preset ? preset.payment(total) : `${eur(total)} réglés à la signature du contrat` },
    { label: "Annulation", value: "Toute absence non prévenue au moins 24 h avant est comptée comme réalisée" },
    { label: "Validité du devis", value: `${QUOTE_VALIDITY_DAYS} jours, soit jusqu'au ${fmtDateFr(validUntil)}` },
  ];
}

/* ------------------------------------------------------------------ */
/* Conditions générales de vente (page 2 du devis)                      */
/* ------------------------------------------------------------------ */

export const CGV_PREAMBLE =
  "Le Coach fournit un service individualisé de contenu d'entraînement sportif et, le cas échéant, d'accompagnement nutritionnel. L'utilisation de ce service implique l'adhésion totale aux présentes conditions générales de vente : le Client déclare en avoir pris connaissance et les avoir acceptées, expressément et sans réserve, au jour de son inscription.";

export const CGV: { title: string; blocks: { sub?: string; text: string }[] }[] = [
  {
    title: "Objet",
    blocks: [
      {
        text: "Les présentes conditions générales de vente définissent les conditions dans lesquelles le Client peut accéder et utiliser les prestations proposées par le Coach. Aucune dérogation aux présentes ne pourra être admise. Elles constituent l'intégralité des engagements entre les parties et annulent tout accord oral ou écrit antérieur relatif à leur objet. Le Client reconnaît qu'aucune signature manuscrite n'est requise pour leur acceptation, et engage sa responsabilité dès la signature du contrat.",
      },
    ],
  },
  {
    title: "Condition de souscription à une formule",
    blocks: [
      {
        text: "Lors de la souscription d'une formule, le Client s'engage à prendre connaissance des présentes conditions et à fournir des informations exactes et conformes à la réalité. La souscription n'est effective qu'à la signature du présent contrat par les deux parties. Un mineur ne peut souscrire qu'avec l'autorisation écrite préalable de son représentant légal, que le Coach peut demander à tout moment et vérifier.",
      },
    ],
  },
  {
    title: "Avertissement médical",
    blocks: [
      {
        text: "Il appartient au Client de s'assurer qu'il est en bonne santé et physiquement apte à pratiquer les entraînements proposés, au besoin en consultant un médecin avant de débuter le programme. Le Client reconnaît avoir passé une visite médicale préalable à son inscription, l'autorisant à pratiquer les exercices proposés par le Coach dans le cadre du programme souscrit.",
      },
    ],
  },
  {
    title: "Contenu des services, fonctionnalités et tarifs",
    blocks: [
      {
        sub: "Contenu des services",
        text: "Le Coach propose plusieurs formules, avec un engagement possible sur 1, 3, 6 ou 12 mois — le nombre de séances par semaine est défini avec le Client. Le suivi comprend un coaching individualisé et, selon la formule, un bilan initial et un accompagnement diététique.",
      },
      { sub: "Fonctionnalités", text: "Les séances se déroulent au sein du club." },
      {
        sub: "Tarif des programmes",
        text: "Les tarifs sont indiqués en euros, toutes taxes comprises (TTC). TVA non applicable, article 293 B et/ou 261-4-4b du Code général des impôts.",
      },
    ],
  },
  {
    title: "Résiliation et remboursement",
    blocks: [
      {
        sub: "Résiliation pour inaptitude sportive définitive",
        text: "Si, pour des raisons de santé, le Client est définitivement empêché de poursuivre le programme souscrit, cette inaptitude entraîne la résiliation du contrat. La résiliation prend effet à réception par le Coach d'un courrier recommandé avec accusé de réception, accompagné de deux justificatifs attestant de cette inaptitude. Le remboursement au prorata de la durée restante intervient sous 30 jours, par chèque ou virement.",
      },
      {
        sub: "Résiliation pour convenance personnelle",
        text: "Le Client est informé qu'il ne pourra prétendre, dans ce cadre, à aucun remboursement pour la période restant à courir.",
      },
    ],
  },
  {
    title: "Assiduité et discipline",
    blocks: [
      {
        text: "Le Client s'engage à être ponctuel. Toute absence non prévenue au moins 24h avant le début d'une séance sera comptabilisée comme réalisée. L'horaire convenu correspond au début du cours : un retard du Client ne pourra être rattrapé. En cas de retard du Coach, la séance sera prolongée d'autant ou rattrapée sur la séance suivante, selon la disponibilité du Client. Une tenue adaptée à la pratique sportive est requise.",
      },
    ],
  },
  {
    title: "Droit à l'image",
    blocks: [{ text: "Les conditions d'utilisation du droit à l'image, ainsi que leur acceptation ou leur refus par le Client, sont précisées dans le contrat." }],
  },
  {
    title: "Responsabilité",
    blocks: [
      {
        text: "Le Client garantit le Coach contre toute action ou réclamation engagée à son encontre du fait de l'utilisation des formules dans des conditions non conformes aux présentes conditions générales de vente.",
      },
    ],
  },
  {
    title: "Vie privée",
    blocks: [
      {
        text: "Le Coach s'engage à protéger la vie privée de ses clients conformément à la réglementation en vigueur et au secret professionnel. Conformément au RGPD, le Client dispose d'un droit de consultation, de modification et d'effacement de ses données personnelles auprès du Coach, responsable de leur traitement.",
      },
    ],
  },
];
