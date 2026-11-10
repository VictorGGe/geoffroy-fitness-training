/** Bilan de départ : questions et réponses (stockées en JSON). */

export type YesNo = "oui" | "non" | "";

export interface IntakeAnswers {
  age?: string;
  sex?: "homme" | "femme" | "";
  // 1. Objectifs
  main_goal?: string;
  goals?: string[];
  goal_other?: string;
  goal_target?: string;
  goal_deadline?: string;
  motivation_why?: string;
  motivation_level?: string;
  past_obstacles?: string;
  // 2. État physique général
  height_cm?: string;
  weight_kg?: string;
  waist_cm?: string;
  // 3. Antécédents et santé
  pathologies?: YesNo;
  pathologies_details?: string;
  injuries?: YesNo;
  injuries_details?: string;
  treatment?: YesNo;
  treatment_details?: string;
  restrictions?: string;
  medical_certificate?: YesNo;
  cardio_symptoms?: YesNo;
  cardio_symptoms_details?: string;
  cardio_history?: YesNo;
  cardio_history_details?: string;
  pain_zones?: string[];
  pain_details?: string;
  surgeries?: YesNo;
  surgeries_details?: string;
  pregnancy?: YesNo;
  // 4. Habitudes sportives
  practice_level?: "aucune" | "occasionnelle" | "reguliere" | "intensive" | "";
  activities?: string;
  weekly_frequency?: string;
  coach_experience?: YesNo;
  past_activities?: string;
  liked_activities?: string;
  disliked_activities?: string;
  training_places?: string[];
  home_equipment?: string;
  // Mode de vie
  job_activity?: string;
  daily_steps?: string;
  sleep_hours?: string;
  sleep_quality?: string;
  stress_level?: string;
  smoker?: YesNo;
  alcohol?: string;
  // Alimentation
  meals_per_day?: string;
  diet?: string[];
  allergies?: string;
  water_liters?: string;
  snacking?: YesNo;
  typical_day?: string;
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

export const PAIN_ZONES = ["Aucune", "Cervicales", "Dos / lombaires", "Épaules", "Coudes / poignets", "Hanches", "Genoux", "Chevilles / pieds"];
export const PLACE_OPTIONS = ["Salle de sport", "Domicile", "Extérieur"];
export const JOB_OPTIONS = ["Assis (bureau)", "Debout", "Physique / manuel", "Variable"];
export const STEPS_OPTIONS = ["Moins de 5 000", "5 000 à 8 000", "8 000 à 10 000", "Plus de 10 000", "Je ne sais pas"];
export const SLEEP_QUALITY = ["Bonne", "Moyenne", "Mauvaise"];
export const STRESS_OPTIONS = ["Faible", "Modéré", "Élevé", "Très élevé"];
export const ALCOHOL_OPTIONS = ["Jamais", "Occasionnel", "Chaque semaine", "Quotidien"];
export const DIET_OPTIONS = ["Aucun régime particulier", "Végétarien", "Végan", "Sans gluten", "Sans lactose", "Halal", "Autre"];
export const MOTIVATION_LEVELS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

/** Signal d'alerte : un avis médical est recommandé avant de reprendre une activité intense. */
export function needsMedicalAdvice(a: IntakeAnswers): boolean {
  return a.cardio_symptoms === "oui" || a.pregnancy === "oui";
}

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

/**
 * Sections lisibles (vue et PDF). Les questions sans réponse sont masquées
 * (les anciens bilans restent lisibles malgré les nouvelles questions).
 */
export function intakeSections(a: IntakeAnswers): { title: string; rows: [string, string][] }[] {
  return allIntakeSections(a)
    .map((s) => ({ ...s, rows: s.rows.filter(([, v]) => v !== "—") }))
    .filter((s) => s.rows.length > 0);
}

function allIntakeSections(a: IntakeAnswers): { title: string; rows: [string, string][] }[] {
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
        ["Objectif chiffré", txt(a.goal_target)],
        ["Échéance", txt(a.goal_deadline)],
        ["Pourquoi maintenant", txt(a.motivation_why)],
        ["Motivation", a.motivation_level ? `${a.motivation_level} / 10` : "—"],
        ["Freins rencontrés jusqu'ici", txt(a.past_obstacles)],
      ],
    },
    {
      title: "2. État physique général",
      rows: [
        ["Taille", a.height_cm ? `${a.height_cm} cm` : "—"],
        ["Poids", a.weight_kg ? `${a.weight_kg} kg` : "—"],
        ["IMC (calculé)", imc !== null ? String(imc).replace(".", ",") : "—"],
        ["Tour de taille", a.waist_cm ? `${a.waist_cm} cm` : "—"],
      ],
    },
    {
      title: "3. Antécédents et santé",
      rows: [
        ["Signes d'alerte à l'effort (douleur thoracique, essoufflement anormal, malaise)", yn(a.cardio_symptoms, a.cardio_symptoms_details)],
        ["Antécédents cardiaques, tension, diabète (soi ou famille)", yn(a.cardio_history, a.cardio_history_details)],
        ["Pathologies / problèmes de santé", yn(a.pathologies, a.pathologies_details)],
        ["Blessures récentes ou anciennes", yn(a.injuries, a.injuries_details)],
        ["Douleurs actuelles", join((a.pain_zones ?? []).concat(a.pain_details?.trim() ? [a.pain_details.trim()] : []))],
        ["Opérations chirurgicales", yn(a.surgeries, a.surgeries_details)],
        ...(a.sex === "femme" ? ([["Grossesse ou accouchement de moins d'un an", yesNoLabel(a.pregnancy)]] as [string, string][]) : []),
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
        ["Ce qu'il/elle aime", txt(a.liked_activities)],
        ["Ce qu'il/elle n'aime pas", txt(a.disliked_activities)],
        ["Lieux d'entraînement", join(a.training_places)],
        ["Matériel à la maison", txt(a.home_equipment)],
      ],
    },
    {
      title: "5. Mode de vie",
      rows: [
        ["Activité professionnelle", txt(a.job_activity)],
        ["Pas par jour (environ)", txt(a.daily_steps)],
        ["Sommeil", [a.sleep_hours?.trim() ? `${a.sleep_hours.trim()} h / nuit` : null, a.sleep_quality ? `qualité ${a.sleep_quality.toLowerCase()}` : null].filter(Boolean).join(", ") || "—"],
        ["Niveau de stress", txt(a.stress_level)],
        ["Fumeur", yesNoLabel(a.smoker)],
        ["Alcool", txt(a.alcohol)],
      ],
    },
    {
      title: "6. Alimentation",
      rows: [
        ["Repas par jour", txt(a.meals_per_day)],
        ["Régime alimentaire", join(a.diet)],
        ["Allergies / intolérances", txt(a.allergies)],
        ["Eau par jour", a.water_liters?.trim() ? `${a.water_liters.trim()} L` : "—"],
        ["Grignotage", yesNoLabel(a.snacking)],
        ["Journée alimentaire type", txt(a.typical_day)],
      ],
    },
    {
      title: "7. Disponibilités et organisation",
      rows: [
        ["Jours disponibles", join(a.days)],
        ["Créneaux préférés", join(a.slots)],
        ["Durée souhaitée par séance", txt(a.session_duration)],
        ["Fréquence souhaitée", a.wished_frequency ? `${a.wished_frequency} séance(s) / semaine` : "—"],
      ],
    },
    { title: "8. Conclusion du bilan", rows: [["Conclusion", txt(a.conclusion)]] },
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
  if (a.cardio_symptoms === "oui") lines.push(`⚠️ Signes d'alerte à l'effort : ${a.cardio_symptoms_details?.trim() || "oui"} — avis médical avant tout effort intense`);
  if (a.pregnancy === "oui") lines.push("⚠️ Grossesse ou post-partum (< 1 an) : adapter, avis médical / sage-femme");
  if (a.cardio_history === "oui") lines.push(`Antécédents cardio / tension / diabète : ${a.cardio_history_details?.trim() || "oui (à préciser)"}`);
  if (a.pathologies === "oui") lines.push(`Pathologies : ${a.pathologies_details?.trim() || "oui (à préciser)"}`);
  if (a.injuries === "oui") lines.push(`Blessures : ${a.injuries_details?.trim() || "oui (à préciser)"}`);
  const pains = (a.pain_zones ?? []).filter((z) => z !== "Aucune");
  if (pains.length || a.pain_details?.trim()) lines.push(`Douleurs : ${[pains.join(", "), a.pain_details?.trim()].filter(Boolean).join(" — ")}`);
  if (a.surgeries === "oui") lines.push(`Opérations : ${a.surgeries_details?.trim() || "oui (à préciser)"}`);
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
