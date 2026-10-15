/** Bilan de départ : questions et réponses (stockées en JSON). */

export type YesNo = "oui" | "non" | "";

export interface IntakeAnswers {
  age?: string;
  sex?: "homme" | "femme" | "";
  // 1. Objectifs
  main_goal?: string;
  goals?: string[];
  goal_other?: string;
  // 2. État physique général
  height_cm?: string;
  weight_kg?: string;
  // 3. Antécédents et santé
  pathologies?: YesNo;
  pathologies_details?: string;
  injuries?: YesNo;
  injuries_details?: string;
  treatment?: YesNo;
  treatment_details?: string;
  restrictions?: string;
  medical_certificate?: YesNo;
  // 4. Habitudes sportives
  practice_level?: "aucune" | "occasionnelle" | "reguliere" | "intensive" | "";
  activities?: string;
  weekly_frequency?: string;
  coach_experience?: YesNo;
  past_activities?: string;
  // 5. Disponibilités et organisation
  days?: string[];
  slots?: string[];
  session_duration?: string;
  wished_frequency?: string;
  // 6. Conclusion
  conclusion?: string;
}

export interface Intake {
  id: string;
  client_id: string;
  assessed_on: string;
  answers: IntakeAnswers;
  updated_at: string;
}

export const GOAL_OPTIONS = [
  "Perte de poids",
  "Prise de masse musculaire",
  "Renforcement musculaire",
  "Amélioration de l'endurance",
  "Gain de souplesse",
  "Santé générale / bien-être",
  "Préparation physique spécifique",
];

export const PRACTICE_LEVELS: { key: NonNullable<IntakeAnswers["practice_level"]>; label: string }[] = [
  { key: "aucune", label: "Aucune" },
  { key: "occasionnelle", label: "Occasionnelle" },
  { key: "reguliere", label: "Régulière" },
  { key: "intensive", label: "Intensive" },
];

export const DAY_OPTIONS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche", "Peu importe"];
export const SLOT_OPTIONS = ["Matin", "Midi", "Après-midi", "Soir", "Peu importe"];

export function yesNoLabel(v: YesNo | undefined): string {
  return v === "oui" ? "Oui" : v === "non" ? "Non" : "—";
}

/** IMC calculé à partir de la taille et du poids saisis (aucune valeur inventée). */
export function bmi(a: IntakeAnswers): number | null {
  const h = Number(String(a.height_cm ?? "").replace(",", "."));
  const w = Number(String(a.weight_kg ?? "").replace(",", "."));
  if (!h || !w || h < 100 || h > 250 || w < 20 || w > 400) return null;
  return Math.round((w / ((h / 100) * (h / 100))) * 10) / 10;
}

/** Sections lisibles (vue et PDF). */
export function intakeSections(a: IntakeAnswers): { title: string; rows: [string, string][] }[] {
  const join = (xs?: string[]) => (xs && xs.length ? xs.join(", ") : "—");
  const txt = (v?: string) => (v && v.trim() ? v.trim() : "—");
  const yn = (v: YesNo | undefined, d?: string) => `${yesNoLabel(v)}${v === "oui" && d?.trim() ? ` — ${d.trim()}` : ""}`;
  const imc = bmi(a);
  return [
    {
      title: "Informations",
      rows: [
        ["Âge", a.age ? `${a.age} ans` : "—"],
        ["Sexe", a.sex === "homme" ? "Homme" : a.sex === "femme" ? "Femme" : "—"],
      ],
    },
    {
      title: "1. Objectifs",
      rows: [
        ["Objectif principal", txt(a.main_goal)],
        ["Objectifs", join([...(a.goals ?? []), ...(a.goal_other?.trim() ? [`Autre : ${a.goal_other.trim()}`] : [])])],
      ],
    },
    {
      title: "2. État physique général",
      rows: [
        ["Taille", a.height_cm ? `${a.height_cm} cm` : "—"],
        ["Poids", a.weight_kg ? `${a.weight_kg} kg` : "—"],
        ["IMC (calculé)", imc !== null ? String(imc).replace(".", ",") : "—"],
      ],
    },
    {
      title: "3. Antécédents et santé",
      rows: [
        ["Pathologies / problèmes de santé", yn(a.pathologies, a.pathologies_details)],
        ["Blessures récentes ou anciennes", yn(a.injuries, a.injuries_details)],
        ["Traitement médical en cours", yn(a.treatment, a.treatment_details)],
        ["Restrictions / précautions médicales", txt(a.restrictions)],
        ["Certificat médical fourni", yesNoLabel(a.medical_certificate)],
      ],
    },
    {
      title: "4. Habitudes sportives",
      rows: [
        ["Niveau de pratique actuel", PRACTICE_LEVELS.find((l) => l.key === a.practice_level)?.label ?? "—"],
        ["Activités pratiquées", txt(a.activities)],
        ["Fréquence hebdomadaire", txt(a.weekly_frequency)],
        ["Expérience en salle / avec un coach", yesNoLabel(a.coach_experience)],
        ["Activités passées (si arrêt)", txt(a.past_activities)],
      ],
    },
    {
      title: "5. Disponibilités et organisation",
      rows: [
        ["Jours disponibles", join(a.days)],
        ["Créneaux préférés", join(a.slots)],
        ["Durée souhaitée par séance", txt(a.session_duration)],
        ["Fréquence souhaitée", a.wished_frequency ? `${a.wished_frequency} séance(s) / semaine` : "—"],
      ],
    },
    { title: "6. Conclusion du bilan", rows: [["Conclusion", txt(a.conclusion)]] },
  ];
}

/** Niveau sportif déduit du niveau de pratique déclaré (modifiable ensuite dans la fiche). */
export function levelFromPractice(p: IntakeAnswers["practice_level"]): "debutant" | "intermediaire" | "avance" | null {
  if (p === "aucune" || p === "occasionnelle") return "debutant";
  if (p === "reguliere") return "intermediaire";
  if (p === "intensive") return "avance";
  return null;
}

/** Résumé santé pour le champ « Contraintes d'entraînement » de la fiche client. */
export function constraintsFromIntake(a: IntakeAnswers): string | null {
  const lines: string[] = [];
  if (a.pathologies === "oui") lines.push(`Pathologies : ${a.pathologies_details?.trim() || "oui (à préciser)"}`);
  if (a.injuries === "oui") lines.push(`Blessures : ${a.injuries_details?.trim() || "oui (à préciser)"}`);
  if (a.treatment === "oui") lines.push(`Traitement en cours : ${a.treatment_details?.trim() || "oui (à préciser)"}`);
  if (a.restrictions?.trim()) lines.push(`Restrictions : ${a.restrictions.trim()}`);
  const dispo = [a.days?.length ? `jours : ${a.days.join(", ")}` : null, a.slots?.length ? `créneaux : ${a.slots.join(", ")}` : null, a.session_duration?.trim() ? `durée : ${a.session_duration.trim()}` : null].filter(Boolean);
  if (dispo.length) lines.push(`Disponibilités — ${dispo.join(" ; ")}`);
  return lines.length ? lines.join("\n") : null;
}

/** Objectif principal pour la fiche client. */
export function goalFromIntake(a: IntakeAnswers): string | null {
  return a.main_goal?.trim() || a.goals?.[0] || a.goal_other?.trim() || null;
}
