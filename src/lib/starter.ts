import type { SetType } from "./types";

/** Bibliothèque de base, importable en un clic (modifiable ensuite). */
export interface StarterExercise {
  name: string;
  muscle_group: string;
  equipment: string;
  movement_type: string;
  execution_cues?: string;
  common_mistakes?: string;
}

export const STARTER_EXERCISES: StarterExercise[] = [
  // Pectoraux
  { name: "Développé couché à la barre", muscle_group: "Pectoraux", equipment: "Barre", movement_type: "Poussée horizontale", execution_cues: "Omoplates serrées et abaissées, pieds ancrés au sol, descente contrôlée jusqu'au bas des pectoraux.", common_mistakes: "Fesses qui décollent, coudes trop ouverts, rebond de la barre sur la poitrine." },
  { name: "Développé incliné aux haltères", muscle_group: "Pectoraux", equipment: "Haltères", movement_type: "Poussée horizontale", execution_cues: "Banc à 30°, coudes à 45° du buste, amplitude complète.", common_mistakes: "Inclinaison trop forte, haltères qui s'entrechoquent en haut." },
  { name: "Développé couché aux haltères", muscle_group: "Pectoraux", equipment: "Haltères", movement_type: "Poussée horizontale" },
  { name: "Écarté à la poulie vis-à-vis", muscle_group: "Pectoraux", equipment: "Poulie", movement_type: "Isolation", execution_cues: "Coudes légèrement fléchis et fixes, rapprocher les mains devant le sternum." },
  { name: "Pompes", muscle_group: "Pectoraux", equipment: "Poids du corps", movement_type: "Poussée horizontale", execution_cues: "Corps gainé, poitrine jusqu'au sol." },
  { name: "Dips", muscle_group: "Triceps", equipment: "Poids du corps", movement_type: "Poussée verticale", execution_cues: "Buste légèrement penché, épaules basses.", common_mistakes: "Descendre trop bas avec les épaules en avant." },
  // Dos
  { name: "Tractions pronation", muscle_group: "Dos", equipment: "Poids du corps", movement_type: "Tirage vertical", execution_cues: "Départ bras tendus, tirer les coudes vers les hanches, menton au-dessus de la barre.", common_mistakes: "Élan avec les jambes, amplitude partielle." },
  { name: "Tirage vertical prise large", muscle_group: "Dos", equipment: "Poulie", movement_type: "Tirage vertical" },
  { name: "Rowing barre buste penché", muscle_group: "Dos", equipment: "Barre", movement_type: "Tirage horizontal", execution_cues: "Dos neutre, buste à 45°, tirer la barre vers le nombril.", common_mistakes: "Dos arrondi, buste qui se redresse à chaque répétition." },
  { name: "Rowing haltère unilatéral", muscle_group: "Dos", equipment: "Haltères", movement_type: "Tirage horizontal" },
  { name: "Tirage horizontal à la poulie", muscle_group: "Dos", equipment: "Poulie", movement_type: "Tirage horizontal" },
  { name: "Soulevé de terre", muscle_group: "Ischio-jambiers", equipment: "Barre", movement_type: "Charnière de hanche", execution_cues: "Barre contre les tibias, dos neutre, pousser le sol avec les jambes puis verrouiller les hanches.", common_mistakes: "Dos arrondi, barre qui s'éloigne du corps, hyperextension en fin de mouvement." },
  { name: "Face pull", muscle_group: "Épaules", equipment: "Poulie", movement_type: "Tirage horizontal", execution_cues: "Corde à hauteur des yeux, écarter les mains en tirant vers le visage." },
  // Épaules
  { name: "Développé militaire à la barre", muscle_group: "Épaules", equipment: "Barre", movement_type: "Poussée verticale", execution_cues: "Fessiers et abdos contractés, la tête passe sous la barre en fin de mouvement.", common_mistakes: "Cambrure lombaire excessive." },
  { name: "Développé haltères assis", muscle_group: "Épaules", equipment: "Haltères", movement_type: "Poussée verticale" },
  { name: "Élévations latérales", muscle_group: "Épaules", equipment: "Haltères", movement_type: "Isolation", execution_cues: "Monter jusqu'à l'horizontale, coudes légèrement fléchis, contrôle à la descente.", common_mistakes: "Élan du buste, haussement des épaules." },
  { name: "Oiseau aux haltères", muscle_group: "Épaules", equipment: "Haltères", movement_type: "Isolation" },
  // Bras
  { name: "Curl barre EZ", muscle_group: "Biceps", equipment: "Barre EZ", movement_type: "Isolation", common_mistakes: "Balancer le buste, coudes qui avancent." },
  { name: "Curl haltères incliné", muscle_group: "Biceps", equipment: "Haltères", movement_type: "Isolation" },
  { name: "Curl marteau", muscle_group: "Biceps", equipment: "Haltères", movement_type: "Isolation" },
  { name: "Extension triceps à la poulie", muscle_group: "Triceps", equipment: "Poulie", movement_type: "Isolation", execution_cues: "Coudes collés au buste, extension complète." },
  { name: "Barre au front", muscle_group: "Triceps", equipment: "Barre EZ", movement_type: "Isolation" },
  // Jambes
  { name: "Squat barre", muscle_group: "Quadriceps", equipment: "Barre", movement_type: "Flexion de genou", execution_cues: "Pieds largeur d'épaules, genoux dans l'axe des pieds, descendre au moins à la parallèle, dos neutre.", common_mistakes: "Genoux qui rentrent, talons qui décollent, dos qui s'arrondit en bas." },
  { name: "Squat avant (front squat)", muscle_group: "Quadriceps", equipment: "Barre", movement_type: "Flexion de genou" },
  { name: "Presse à cuisses", muscle_group: "Quadriceps", equipment: "Machine", movement_type: "Flexion de genou", common_mistakes: "Bassin qui décolle du dossier en bas du mouvement." },
  { name: "Fentes marchées aux haltères", muscle_group: "Quadriceps", equipment: "Haltères", movement_type: "Flexion de genou" },
  { name: "Squat bulgare", muscle_group: "Quadriceps", equipment: "Haltères", movement_type: "Flexion de genou" },
  { name: "Leg extension", muscle_group: "Quadriceps", equipment: "Machine", movement_type: "Isolation" },
  { name: "Soulevé de terre roumain", muscle_group: "Ischio-jambiers", equipment: "Barre", movement_type: "Charnière de hanche", execution_cues: "Genoux légèrement fléchis, pousser les hanches vers l'arrière, barre le long des cuisses.", common_mistakes: "Dos arrondi, descente au-delà de la souplesse." },
  { name: "Leg curl allongé", muscle_group: "Ischio-jambiers", equipment: "Machine", movement_type: "Isolation" },
  { name: "Hip thrust", muscle_group: "Fessiers", equipment: "Barre", movement_type: "Charnière de hanche", execution_cues: "Menton rentré, verrouiller les fessiers en haut, tibias verticaux." },
  { name: "Mollets debout", muscle_group: "Mollets", equipment: "Machine", movement_type: "Isolation", execution_cues: "Pause en étirement, amplitude complète." },
  // Gainage
  { name: "Gainage planche", muscle_group: "Abdominaux", equipment: "Poids du corps", movement_type: "Gainage" },
  { name: "Relevés de jambes suspendu", muscle_group: "Abdominaux", equipment: "Poids du corps", movement_type: "Gainage" },
  { name: "Crunch à la poulie", muscle_group: "Abdominaux", equipment: "Poulie", movement_type: "Isolation" },
  // Haltérophilie
  { name: "Arraché (snatch)", muscle_group: "Corps entier", equipment: "Barre", movement_type: "Haltérophilie", execution_cues: "Barre proche du corps, extension complète avant de passer sous la barre." },
  { name: "Épaulé-jeté (clean & jerk)", muscle_group: "Corps entier", equipment: "Barre", movement_type: "Haltérophilie" },
  { name: "Épaulé en suspension (hang clean)", muscle_group: "Corps entier", equipment: "Barre", movement_type: "Haltérophilie" },
  { name: "Arraché en suspension (hang snatch)", muscle_group: "Corps entier", equipment: "Barre", movement_type: "Haltérophilie" },
  { name: "Squat arraché (overhead squat)", muscle_group: "Corps entier", equipment: "Barre", movement_type: "Haltérophilie" },
  { name: "Tirage d'arraché", muscle_group: "Dos", equipment: "Barre", movement_type: "Haltérophilie" },
  // Cardio / conditionnement
  { name: "Kettlebell swing", muscle_group: "Fessiers", equipment: "Kettlebell", movement_type: "Charnière de hanche" },
  { name: "Rameur", muscle_group: "Cardio", equipment: "Machine", movement_type: "Cardio" },
];

export interface TemplateExercise {
  name: string;
  sets: number;
  reps: string;
  rpe?: number;
  rir?: number;
  rest?: number; // secondes
  set_type?: SetType;
}

export interface StarterTemplate {
  key: string;
  label: string;
  description: string;
  sessions: { name: string; exercises: TemplateExercise[] }[];
}

const T = (name: string, sets: number, reps: string, rest: number, rpe?: number, rir?: number): TemplateExercise => ({
  name,
  sets,
  reps,
  rest,
  rpe,
  rir,
  set_type: "travail",
});

/** Modèles de départ : simples points de départ, entièrement modifiables après création. */
export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    key: "custom",
    label: "Programme personnalisé",
    description: "Partir d'une page blanche.",
    sessions: [{ name: "Séance A", exercises: [] }],
  },
  {
    key: "full_body",
    label: "Full Body",
    description: "3 séances corps entier par semaine.",
    sessions: [
      { name: "Séance A", exercises: [T("Squat barre", 3, "6-8", 150, 8, 2), T("Développé couché à la barre", 3, "6-8", 150, 8, 2), T("Rowing barre buste penché", 3, "8-10", 120, 8, 2), T("Élévations latérales", 3, "12-15", 60, 9, 1), T("Gainage planche", 3, "30-45 s", 60)] },
      { name: "Séance B", exercises: [T("Soulevé de terre roumain", 3, "8-10", 150, 8, 2), T("Développé militaire à la barre", 3, "6-8", 150, 8, 2), T("Tractions pronation", 3, "6-10", 120, 8, 2), T("Fentes marchées aux haltères", 3, "10-12", 90, 8, 2), T("Curl haltères incliné", 2, "10-12", 60, 9, 1)] },
      { name: "Séance C", exercises: [T("Presse à cuisses", 3, "10-12", 120, 8, 2), T("Développé incliné aux haltères", 3, "8-10", 120, 8, 2), T("Tirage horizontal à la poulie", 3, "10-12", 90, 8, 2), T("Hip thrust", 3, "8-10", 120, 8, 2), T("Extension triceps à la poulie", 2, "12-15", 60, 9, 1)] },
    ],
  },
  {
    key: "upper_lower",
    label: "Upper / Lower",
    description: "4 séances : haut / bas du corps en alternance.",
    sessions: [
      { name: "Haut du corps 1", exercises: [T("Développé couché à la barre", 4, "5-7", 180, 8, 2), T("Rowing barre buste penché", 4, "6-8", 150, 8, 2), T("Développé haltères assis", 3, "8-10", 120, 8, 2), T("Tirage vertical prise large", 3, "8-10", 90, 8, 2), T("Curl barre EZ", 3, "10-12", 60, 9, 1), T("Extension triceps à la poulie", 3, "10-12", 60, 9, 1)] },
      { name: "Bas du corps 1", exercises: [T("Squat barre", 4, "5-7", 180, 8, 2), T("Soulevé de terre roumain", 3, "8-10", 150, 8, 2), T("Presse à cuisses", 3, "10-12", 120, 8, 2), T("Leg curl allongé", 3, "10-12", 90, 9, 1), T("Mollets debout", 4, "10-15", 60, 9, 1)] },
      { name: "Haut du corps 2", exercises: [T("Développé militaire à la barre", 4, "6-8", 150, 8, 2), T("Tractions pronation", 4, "6-10", 150, 8, 2), T("Développé incliné aux haltères", 3, "8-10", 120, 8, 2), T("Rowing haltère unilatéral", 3, "10-12", 90, 8, 2), T("Élévations latérales", 3, "12-15", 60, 9, 1), T("Face pull", 3, "15", 60, 9, 1)] },
      { name: "Bas du corps 2", exercises: [T("Soulevé de terre", 3, "4-6", 180, 8, 2), T("Squat bulgare", 3, "8-10", 120, 8, 2), T("Hip thrust", 3, "8-10", 120, 8, 2), T("Leg extension", 3, "12-15", 60, 9, 1), T("Relevés de jambes suspendu", 3, "10-15", 60)] },
    ],
  },
  {
    key: "ppl",
    label: "Push / Pull / Legs",
    description: "Poussée, tirage, jambes (3 ou 6 séances par semaine).",
    sessions: [
      { name: "Push", exercises: [T("Développé couché à la barre", 4, "6-8", 150, 8, 2), T("Développé haltères assis", 3, "8-10", 120, 8, 2), T("Développé incliné aux haltères", 3, "10-12", 90, 8, 2), T("Élévations latérales", 4, "12-15", 60, 9, 1), T("Extension triceps à la poulie", 3, "10-12", 60, 9, 1)] },
      { name: "Pull", exercises: [T("Tractions pronation", 4, "6-10", 150, 8, 2), T("Rowing barre buste penché", 4, "8-10", 120, 8, 2), T("Tirage horizontal à la poulie", 3, "10-12", 90, 8, 2), T("Face pull", 3, "15", 60, 9, 1), T("Curl barre EZ", 3, "10-12", 60, 9, 1), T("Curl marteau", 2, "12", 60, 9, 1)] },
      { name: "Legs", exercises: [T("Squat barre", 4, "6-8", 180, 8, 2), T("Soulevé de terre roumain", 3, "8-10", 150, 8, 2), T("Presse à cuisses", 3, "10-12", 120, 8, 2), T("Leg curl allongé", 3, "10-12", 90, 9, 1), T("Mollets debout", 4, "10-15", 60, 9, 1)] },
    ],
  },
  {
    key: "half_body",
    label: "Half Body",
    description: "Alternance de demi-corps avec dominante.",
    sessions: [
      { name: "Haut dominante poussée", exercises: [T("Développé couché à la barre", 4, "6-8", 150, 8, 2), T("Tractions pronation", 3, "8-10", 120, 8, 2), T("Développé haltères assis", 3, "10-12", 90, 8, 2), T("Dips", 3, "8-12", 90, 8, 2)] },
      { name: "Bas dominante quadriceps", exercises: [T("Squat barre", 4, "6-8", 180, 8, 2), T("Presse à cuisses", 3, "10-12", 120, 8, 2), T("Leg extension", 3, "12-15", 60, 9, 1), T("Gainage planche", 3, "45 s", 60)] },
      { name: "Haut dominante tirage", exercises: [T("Rowing barre buste penché", 4, "6-8", 150, 8, 2), T("Développé incliné aux haltères", 3, "8-10", 120, 8, 2), T("Tirage vertical prise large", 3, "10-12", 90, 8, 2), T("Curl barre EZ", 3, "10-12", 60, 9, 1)] },
      { name: "Bas dominante ischios / fessiers", exercises: [T("Soulevé de terre roumain", 4, "6-8", 150, 8, 2), T("Hip thrust", 3, "8-10", 120, 8, 2), T("Leg curl allongé", 3, "10-12", 90, 9, 1), T("Mollets debout", 4, "12-15", 60, 9, 1)] },
    ],
  },
  {
    key: "split",
    label: "Split musculaire",
    description: "Un groupe musculaire principal par séance.",
    sessions: [
      { name: "Pectoraux", exercises: [T("Développé couché à la barre", 4, "6-8", 150, 8, 2), T("Développé incliné aux haltères", 4, "8-10", 120, 8, 2), T("Écarté à la poulie vis-à-vis", 3, "12-15", 60, 9, 1), T("Dips", 3, "8-12", 90, 8, 2)] },
      { name: "Dos", exercises: [T("Tractions pronation", 4, "6-10", 150, 8, 2), T("Rowing barre buste penché", 4, "8-10", 120, 8, 2), T("Tirage horizontal à la poulie", 3, "10-12", 90, 8, 2), T("Rowing haltère unilatéral", 3, "10-12", 90, 8, 2)] },
      { name: "Jambes", exercises: [T("Squat barre", 4, "6-8", 180, 8, 2), T("Presse à cuisses", 4, "10-12", 120, 8, 2), T("Soulevé de terre roumain", 3, "8-10", 150, 8, 2), T("Leg curl allongé", 3, "10-12", 90, 9, 1), T("Mollets debout", 4, "12-15", 60, 9, 1)] },
      { name: "Épaules", exercises: [T("Développé militaire à la barre", 4, "6-8", 150, 8, 2), T("Élévations latérales", 4, "12-15", 60, 9, 1), T("Oiseau aux haltères", 3, "12-15", 60, 9, 1), T("Face pull", 3, "15", 60, 9, 1)] },
      { name: "Bras", exercises: [T("Curl barre EZ", 4, "8-10", 90, 8, 2), T("Barre au front", 4, "8-10", 90, 8, 2), T("Curl marteau", 3, "10-12", 60, 9, 1), T("Extension triceps à la poulie", 3, "12-15", 60, 9, 1)] },
    ],
  },
  {
    key: "strength",
    label: "Programme force",
    description: "Priorité aux mouvements de base, faibles répétitions.",
    sessions: [
      { name: "Jour 1 — Squat", exercises: [T("Squat barre", 5, "3-5", 240, 8, 2), T("Développé couché à la barre", 4, "4-6", 180, 8, 2), T("Rowing barre buste penché", 3, "6-8", 150, 8, 2), T("Gainage planche", 3, "45 s", 60)] },
      { name: "Jour 2 — Développé", exercises: [T("Développé couché à la barre", 5, "3-5", 240, 8, 2), T("Développé militaire à la barre", 4, "4-6", 180, 8, 2), T("Tractions pronation", 4, "5-8", 150, 8, 2), T("Barre au front", 3, "8-10", 90, 8, 2)] },
      { name: "Jour 3 — Soulevé de terre", exercises: [T("Soulevé de terre", 5, "2-4", 240, 8, 2), T("Squat avant (front squat)", 3, "4-6", 180, 8, 2), T("Hip thrust", 3, "6-8", 150, 8, 2), T("Relevés de jambes suspendu", 3, "10", 60)] },
    ],
  },
  {
    key: "hypertrophy",
    label: "Programme hypertrophie",
    description: "Volume modéré à élevé, séries proches de l'échec.",
    sessions: [
      { name: "Séance A — Haut", exercises: [T("Développé incliné aux haltères", 4, "8-12", 120, 9, 1), T("Tirage vertical prise large", 4, "10-12", 90, 9, 1), T("Développé couché aux haltères", 3, "10-12", 90, 9, 1), T("Rowing haltère unilatéral", 3, "10-12", 90, 9, 1), T("Élévations latérales", 4, "15-20", 45, 9, 1), T("Curl haltères incliné", 3, "10-12", 60, 9, 1)] },
      { name: "Séance B — Bas", exercises: [T("Presse à cuisses", 4, "10-12", 120, 9, 1), T("Soulevé de terre roumain", 4, "8-10", 120, 8, 2), T("Squat bulgare", 3, "10-12", 90, 9, 1), T("Leg extension", 3, "12-15", 60, 9, 1), T("Leg curl allongé", 3, "12-15", 60, 9, 1), T("Mollets debout", 4, "12-15", 45, 9, 1)] },
    ],
  },
  {
    key: "weightlifting",
    label: "Haltérophilie",
    description: "Technique et puissance sur les mouvements olympiques.",
    sessions: [
      { name: "Jour 1 — Arraché", exercises: [T("Arraché en suspension (hang snatch)", 5, "2", 120, 7), T("Arraché (snatch)", 5, "1-2", 150, 8), T("Tirage d'arraché", 4, "3", 120, 8), T("Squat arraché (overhead squat)", 3, "3", 120, 7)] },
      { name: "Jour 2 — Épaulé-jeté", exercises: [T("Épaulé en suspension (hang clean)", 5, "2", 120, 7), T("Épaulé-jeté (clean & jerk)", 5, "1+1", 150, 8), T("Squat avant (front squat)", 4, "3", 150, 8), T("Développé militaire à la barre", 3, "5", 120, 8)] },
      { name: "Jour 3 — Force", exercises: [T("Squat barre", 5, "3", 180, 8, 2), T("Soulevé de terre", 4, "3", 180, 8, 2), T("Tractions pronation", 3, "6-8", 120, 8, 2), T("Gainage planche", 3, "45 s", 60)] },
    ],
  },
];

export const STARTER_SPLIT_LABELS = STARTER_TEMPLATES.map((t) => t.label);
