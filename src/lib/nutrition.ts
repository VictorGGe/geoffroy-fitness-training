/** Suivi alimentaire : types, totaux et calcul des objectifs de macros. */

export type Meal = "petit_dejeuner" | "dejeuner" | "collation" | "diner";
export type FoodUnit = "g" | "ml" | "portion";
export type FoodSource = "base" | "off" | "manuel";

export const MEALS: { key: Meal; label: string }[] = [
  { key: "petit_dejeuner", label: "Petit-déjeuner" },
  { key: "dejeuner", label: "Déjeuner" },
  { key: "collation", label: "Collation" },
  { key: "diner", label: "Dîner" },
];

export interface FoodEntry {
  id: string;
  client_id: string;
  eaten_on: string;
  meal: Meal;
  name: string;
  brand: string | null;
  barcode: string | null;
  source: FoodSource;
  unit: FoodUnit;
  quantity: number;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  created_at: string;
}

export interface NutritionTarget {
  client_id: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  inputs: TargetInputs | Record<string, never>;
  note: string | null;
  updated_at: string;
}

/** Valeurs nutritionnelles pour 100 g / 100 ml (ou pour 1 portion si unit = portion). */
export interface FoodValues {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

/** Aliment choisi (base intégrée, produit du commerce ou saisie manuelle), avant la quantité. */
export interface FoodItem {
  name: string;
  brand?: string | null;
  barcode?: string | null;
  source: FoodSource;
  unit: FoodUnit;
  per: FoodValues;
  portions?: { label: string; qty: number }[];
  image?: string | null;
}

export interface Macros {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export const ZERO: Macros = { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Valeurs réelles pour la quantité saisie. */
export function macrosFor(item: Pick<FoodItem, "unit" | "per">, quantity: number): Macros {
  const f = item.unit === "portion" ? quantity : quantity / 100;
  return {
    kcal: r1(item.per.kcal * f),
    protein_g: r1(item.per.protein * f),
    carbs_g: r1(item.per.carbs * f),
    fat_g: r1(item.per.fat * f),
  };
}

/** Retrouve les valeurs de référence d'une entrée déjà enregistrée (pour la modifier). */
export function itemFromEntry(e: FoodEntry): FoodItem {
  const base = e.unit === "portion" ? e.quantity : e.quantity / 100;
  const per = (v: number) => (base > 0 ? r1(Number(v) / base) : 0);
  return {
    name: e.name,
    brand: e.brand,
    barcode: e.barcode,
    source: e.source,
    unit: e.unit,
    per: { kcal: per(e.kcal), protein: per(e.protein_g), carbs: per(e.carbs_g), fat: per(e.fat_g) },
  };
}

export function sumMacros(list: Pick<FoodEntry, "kcal" | "protein_g" | "carbs_g" | "fat_g">[]): Macros {
  return list.reduce<Macros>(
    (a, e) => ({
      kcal: r1(a.kcal + Number(e.kcal)),
      protein_g: r1(a.protein_g + Number(e.protein_g)),
      carbs_g: r1(a.carbs_g + Number(e.carbs_g)),
      fat_g: r1(a.fat_g + Number(e.fat_g)),
    }),
    ZERO,
  );
}

export function fmtQty(unit: FoodUnit, q: number): string {
  const n = String(Math.round(Number(q) * 100) / 100).replace(".", ",");
  return unit === "portion" ? `${n} portion${Number(q) > 1 ? "s" : ""}` : `${n} ${unit}`;
}

export function fmtG(v: number): string {
  return `${String(Math.round(Number(v))).replace(".", ",")} g`;
}

export function fmtKcal(v: number): string {
  return `${Math.round(Number(v)).toLocaleString("fr-FR")} kcal`;
}

/* ------------------------------------------------------------------ */
/* Calcul des objectifs                                                */
/* ------------------------------------------------------------------ */

export type Activity = "sedentaire" | "leger" | "modere" | "actif" | "tres_actif";
export type NutritionGoal = "perte" | "maintien" | "prise";

export const ACTIVITIES: { key: Activity; label: string; hint: string; factor: number }[] = [
  { key: "sedentaire", label: "Sédentaire", hint: "Travail assis, pas de sport", factor: 1.2 },
  { key: "leger", label: "Légèrement actif", hint: "1 à 2 séances / semaine", factor: 1.375 },
  { key: "modere", label: "Modérément actif", hint: "3 à 4 séances / semaine", factor: 1.55 },
  { key: "actif", label: "Très actif", hint: "5 à 6 séances / semaine", factor: 1.725 },
  { key: "tres_actif", label: "Extrêmement actif", hint: "Sport quotidien + travail physique", factor: 1.9 },
];

export const NUTRITION_GOALS: { key: NutritionGoal; label: string; hint: string }[] = [
  { key: "perte", label: "Perte de poids", hint: "Déficit d'environ 20 %" },
  { key: "maintien", label: "Maintien", hint: "Calories d'entretien" },
  { key: "prise", label: "Prise de masse", hint: "Surplus d'environ 10 %" },
];

export interface TargetInputs {
  sex: "homme" | "femme";
  age: number;
  height_cm: number;
  weight_kg: number;
  activity: Activity;
  goal: NutritionGoal;
}

export interface TargetResult extends Macros {
  bmr: number;
  tdee: number;
  floored: boolean;
}

/**
 * Métabolisme de base : formule de Mifflin-St Jeor.
 * Dépense totale = métabolisme × coefficient d'activité.
 * Protéines : 2 g/kg en perte de poids, 1,8 g/kg sinon.
 * Lipides   : 0,8 à 1 g/kg (au moins 20 % des calories).
 * Glucides  : le reste des calories.
 */
export function calcTargets(i: TargetInputs): TargetResult {
  const bmr = 10 * i.weight_kg + 6.25 * i.height_cm - 5 * i.age + (i.sex === "homme" ? 5 : -161);
  const factor = ACTIVITIES.find((a) => a.key === i.activity)?.factor ?? 1.55;
  const tdee = bmr * factor;
  let kcal = i.goal === "perte" ? tdee * 0.8 : i.goal === "prise" ? tdee * 1.1 : tdee;
  // Jamais en dessous du métabolisme de base
  const floored = kcal < bmr;
  if (floored) kcal = bmr;
  kcal = Math.round(kcal / 10) * 10;

  const protein = Math.round((i.goal === "perte" ? 2 : 1.8) * i.weight_kg);
  let fat = Math.round((i.goal === "perte" ? 0.8 : i.goal === "prise" ? 1 : 0.9) * i.weight_kg);
  fat = Math.max(fat, Math.round((kcal * 0.2) / 9));
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { kcal, protein_g: protein, carbs_g: carbs, fat_g: fat, bmr: Math.round(bmr), tdee: Math.round(tdee), floored };
}

export function activityFromSessions(n: number | null | undefined): Activity {
  if (!n) return "sedentaire";
  if (n <= 2) return "leger";
  if (n <= 4) return "modere";
  return "actif";
}

export function goalFromText(goal: string | null | undefined): NutritionGoal {
  const g = (goal ?? "").toLowerCase();
  if (/perte|maigr|perdre|sèche|seche/.test(g)) return "perte";
  if (/masse|prise|grossir|volume/.test(g)) return "prise";
  return "maintien";
}

/** Calories issues des macros (contrôle de cohérence affiché au coach). */
export function kcalFromMacros(p: number, c: number, f: number): number {
  return Math.round(p * 4 + c * 4 + f * 9);
}
