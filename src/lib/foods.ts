/**
 * Aliments de base (valeurs moyennes pour 100 g ou 100 ml, ordre de grandeur
 * des tables de composition type Ciqual). Pour les produits emballés,
 * la recherche Open Food Facts ou le scan du code-barres donne les valeurs exactes.
 */
import { normalize } from "./format";
import type { FoodItem } from "./nutrition";

const norm = (s: string) => normalize(s).replace(/œ/g, "oe").replace(/æ/g, "ae");

type Row = [name: string, category: string, kcal: number, protein: number, carbs: number, fat: number, portions?: [string, number][], unit?: "g" | "ml"];

const ROWS: Row[] = [
  // Féculents et céréales
  ["Riz blanc cuit", "Féculents", 130, 2.7, 28, 0.3],
  ["Riz blanc cru", "Féculents", 350, 7, 78, 0.6],
  ["Riz complet cuit", "Féculents", 123, 2.7, 25.6, 1],
  ["Pâtes cuites", "Féculents", 140, 5, 28, 0.9],
  ["Pâtes crues", "Féculents", 355, 12.5, 71, 1.5],
  ["Pâtes complètes cuites", "Féculents", 135, 5.5, 25, 1.2],
  ["Pomme de terre cuite à l'eau", "Féculents", 80, 2, 17, 0.1, [["1 pomme de terre moyenne", 150]]],
  ["Patate douce cuite", "Féculents", 86, 1.6, 20, 0.1],
  ["Frites (au four)", "Féculents", 160, 2.5, 25, 5],
  ["Quinoa cuit", "Féculents", 120, 4.4, 21.3, 1.9],
  ["Semoule / couscous cuit", "Féculents", 112, 3.8, 23.2, 0.2],
  ["Boulgour cuit", "Féculents", 83, 3.1, 18.6, 0.2],
  ["Flocons d'avoine", "Féculents", 370, 13.5, 58.7, 7, [["1 portion (40 g)", 40]]],
  ["Pain blanc (baguette)", "Féculents", 270, 9, 55, 1.2, [["1 tranche (30 g)", 30], ["1/4 de baguette", 60]]],
  ["Pain complet", "Féculents", 245, 9, 44, 3, [["1 tranche (35 g)", 35]]],
  ["Pain de mie", "Féculents", 265, 8, 49, 4, [["1 tranche (25 g)", 25]]],
  ["Galette de riz soufflé", "Féculents", 387, 8, 81, 3, [["1 galette (8 g)", 8]]],
  ["Corn flakes", "Féculents", 378, 7, 84, 0.9, [["1 bol (30 g)", 30]]],
  ["Lentilles cuites", "Légumineuses", 116, 9, 20, 0.4],
  ["Pois chiches cuits", "Légumineuses", 164, 8.9, 27.4, 2.6],
  ["Haricots rouges cuits", "Légumineuses", 127, 8.7, 22.8, 0.5],

  // Viandes, poissons, œufs
  ["Blanc de poulet cuit", "Protéines", 165, 31, 0, 3.6],
  ["Blanc de poulet cru", "Protéines", 110, 23, 0, 1.6],
  ["Escalope de dinde cuite", "Protéines", 135, 29, 0, 1.7],
  ["Steak haché 5 % MG (cru)", "Protéines", 125, 21, 0, 5, [["1 steak (100 g)", 100]]],
  ["Steak haché 15 % MG (cru)", "Protéines", 213, 17.6, 0, 15, [["1 steak (100 g)", 100]]],
  ["Bœuf rumsteak grillé", "Protéines", 165, 28, 0, 6],
  ["Filet de porc cuit", "Protéines", 150, 27, 0, 4.5],
  ["Jambon blanc", "Protéines", 115, 20, 1, 3.5, [["1 tranche (40 g)", 40]]],
  ["Saumon cru", "Protéines", 200, 20, 0, 13],
  ["Cabillaud cuit", "Protéines", 105, 23, 0, 0.9],
  ["Thon au naturel (égoutté)", "Protéines", 116, 26, 0, 1, [["1 petite boîte (80 g)", 80]]],
  ["Sardines à l'huile (égouttées)", "Protéines", 210, 24, 0, 12.5],
  ["Crevettes cuites", "Protéines", 99, 24, 0.2, 0.3],
  ["Œuf entier", "Protéines", 140, 12.6, 0.7, 9.5, [["1 œuf (55 g)", 55], ["2 œufs", 110], ["3 œufs", 165]]],
  ["Blanc d'œuf", "Protéines", 48, 10.5, 0.7, 0.2, [["1 blanc (33 g)", 33]]],
  ["Tofu nature", "Protéines", 120, 13, 1.5, 7],
  ["Whey protéine (poudre)", "Protéines", 380, 78, 6, 5, [["1 dose (30 g)", 30]]],

  // Produits laitiers
  ["Lait demi-écrémé", "Laitiers", 46, 3.3, 4.8, 1.6, [["1 verre (200 ml)", 200], ["1 bol (300 ml)", 300]], "ml"],
  ["Lait écrémé", "Laitiers", 34, 3.4, 4.9, 0.1, [["1 verre (200 ml)", 200]], "ml"],
  ["Boisson végétale amande (sans sucre)", "Laitiers", 14, 0.5, 0.3, 1.1, [["1 verre (200 ml)", 200]], "ml"],
  ["Yaourt nature", "Laitiers", 56, 4.3, 5, 1.8, [["1 pot (125 g)", 125]]],
  ["Fromage blanc 0 %", "Laitiers", 46, 7.5, 4, 0.1, [["1 pot (100 g)", 100]]],
  ["Fromage blanc 3 %", "Laitiers", 75, 7, 4, 3.2, [["1 pot (100 g)", 100]]],
  ["Skyr nature", "Laitiers", 63, 11, 4, 0.2, [["1 pot (150 g)", 150]]],
  ["Emmental", "Laitiers", 380, 28, 0, 29, [["1 portion (30 g)", 30]]],
  ["Mozzarella", "Laitiers", 250, 18, 1, 19, [["1 boule (125 g)", 125]]],
  ["Camembert", "Laitiers", 290, 20, 0.5, 23, [["1 portion (30 g)", 30]]],

  // Fruits
  ["Banane", "Fruits", 90, 1.1, 20, 0.3, [["1 banane (120 g)", 120]]],
  ["Pomme", "Fruits", 53, 0.3, 11.6, 0.2, [["1 pomme (150 g)", 150]]],
  ["Orange", "Fruits", 46, 0.9, 9.2, 0.2, [["1 orange (150 g)", 150]]],
  ["Fraises", "Fruits", 32, 0.7, 6, 0.3],
  ["Myrtilles", "Fruits", 57, 0.7, 14.5, 0.3],
  ["Kiwi", "Fruits", 61, 1.1, 14.7, 0.5, [["1 kiwi (75 g)", 75]]],
  ["Raisin", "Fruits", 69, 0.7, 17, 0.2],
  ["Dattes sèches", "Fruits", 280, 2.5, 66, 0.4, [["1 datte (8 g)", 8]]],
  ["Jus d'orange", "Fruits", 45, 0.7, 10, 0.2, [["1 verre (200 ml)", 200]], "ml"],

  // Légumes
  ["Brocoli cuit", "Légumes", 35, 2.4, 4.4, 0.4],
  ["Haricots verts cuits", "Légumes", 30, 1.8, 4.4, 0.2],
  ["Courgette", "Légumes", 17, 1.2, 2, 0.3],
  ["Tomate", "Légumes", 18, 0.9, 2.6, 0.2, [["1 tomate (120 g)", 120]]],
  ["Carotte", "Légumes", 36, 0.8, 6.6, 0.3, [["1 carotte (80 g)", 80]]],
  ["Épinards", "Légumes", 23, 2.9, 1.4, 0.4],
  ["Salade verte", "Légumes", 15, 1.3, 1.7, 0.2],
  ["Poivron", "Légumes", 26, 1, 4.6, 0.3],
  ["Champignons de Paris", "Légumes", 22, 3, 0.5, 0.3],
  ["Avocat", "Légumes", 160, 2, 1.9, 14.7, [["1/2 avocat (70 g)", 70]]],

  // Matières grasses, oléagineux, sucres
  ["Huile d'olive", "Matières grasses", 900, 0, 0, 100, [["1 c. à soupe (10 g)", 10], ["1 c. à café (5 g)", 5]]],
  ["Beurre", "Matières grasses", 745, 0.7, 0.6, 82, [["1 noisette (10 g)", 10]]],
  ["Beurre de cacahuète", "Matières grasses", 595, 25, 16, 50, [["1 c. à soupe (15 g)", 15]]],
  ["Amandes", "Matières grasses", 610, 21, 8, 53, [["1 poignée (25 g)", 25]]],
  ["Noix", "Matières grasses", 680, 15, 7, 65, [["1 poignée (25 g)", 25]]],
  ["Chocolat noir 70 %", "Sucres", 580, 9, 30, 42, [["1 carré (10 g)", 10]]],
  ["Miel", "Sucres", 320, 0.4, 80, 0, [["1 c. à café (8 g)", 8]]],
  ["Confiture", "Sucres", 240, 0.4, 60, 0.1, [["1 c. à soupe (20 g)", 20]]],
  ["Sucre", "Sucres", 400, 0, 100, 0, [["1 morceau (5 g)", 5]]],
  ["Soda sucré", "Sucres", 42, 0, 10.6, 0, [["1 canette (330 ml)", 330]], "ml"],
];

export const BASE_FOODS: (FoodItem & { category: string; key: string })[] = ROWS.map(
  ([name, category, kcal, protein, carbs, fat, portions, unit]) => ({
    key: norm(name),
    name,
    category,
    source: "base",
    unit: unit ?? "g",
    per: { kcal, protein, carbs, fat },
    portions: portions?.map(([label, qty]) => ({ label, qty })),
  }),
);

/** Recherche tolérante (accents, majuscules, ordre des mots). */
export function searchBaseFoods(q: string, limit = 12) {
  const words = norm(q).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return BASE_FOODS.map((f) => {
    const hay = `${f.key} ${norm(f.category)}`;
    if (!words.every((w) => hay.includes(w))) return null;
    const score = f.key.startsWith(words[0]) ? 0 : 1;
    return { f, score };
  })
    .filter((x): x is { f: (typeof BASE_FOODS)[number]; score: number } => !!x)
    .sort((a, b) => a.score - b.score || a.f.name.localeCompare(b.f.name, "fr"))
    .slice(0, limit)
    .map((x) => x.f);
}
