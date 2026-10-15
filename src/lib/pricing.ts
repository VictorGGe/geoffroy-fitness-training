/**
 * Grille tarifaire Victor Training.
 * Pour modifier un prix ou une formule, il suffit de changer les valeurs ci-dessous.
 */

export interface Formula {
  key: string;
  name: string;
  rhythm: string;
  price: number;
  unit: "séance" | "mois";
  badge?: { label: string; tone: "gold" | "blue" | "premium" };
  features: string[];
  /** Réductions selon la durée d'engagement */
  commitments?: { months: number; discount: number }[];
  highlight?: "popular" | "premium";
}

const COMMITMENTS = [
  { months: 3, discount: 10 },
  { months: 6, discount: 15 },
  { months: 12, discount: 20 },
];

const FULL = [
  "Plan 100 % personnalisé et ajustable",
  "Application de suivi",
  "Retour WhatsApp individualisé",
  "Ajustements en fonction des besoins",
];

export const FORMULAS: Formula[] = [
  {
    key: "decouverte",
    name: "Découverte",
    rhythm: "1 séance, sans engagement",
    price: 42,
    unit: "séance",
    badge: { label: "Séance à l'unité", tone: "gold" },
    features: ["Aucun engagement", "Idéal pour tester le coaching", "Plan adapté à ton niveau", "Application de suivi"],
  },
  { key: "basic", name: "Basic", rhythm: "1 séance / semaine", price: 156, unit: "mois", features: FULL, commitments: COMMITMENTS },
  {
    key: "progression",
    name: "Progression",
    rhythm: "2 séances / semaine",
    price: 312,
    unit: "mois",
    badge: { label: "Populaire", tone: "blue" },
    features: FULL,
    commitments: COMMITMENTS,
    highlight: "popular",
  },
  { key: "performance", name: "Performance", rhythm: "3 séances / semaine", price: 468, unit: "mois", features: FULL, commitments: COMMITMENTS },
  { key: "expert", name: "Expert", rhythm: "4 séances / semaine", price: 625, unit: "mois", features: FULL, commitments: COMMITMENTS },
  {
    key: "ultimate",
    name: "Ultimate",
    rhythm: "5 séances / semaine",
    price: 780,
    unit: "mois",
    badge: { label: "Premium", tone: "premium" },
    features: FULL.slice(0, 3),
    commitments: COMMITMENTS,
    highlight: "premium",
  },
];

export function discounted(price: number, discount: number): number {
  return Math.round(price * (1 - discount / 100) * 100) / 100;
}

export function fmtEuro(v: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: Number.isInteger(v) ? 0 : 2,
    maximumFractionDigits: 2,
  })
    .format(v)
    .replace(/\u202f/g, " ");
}
