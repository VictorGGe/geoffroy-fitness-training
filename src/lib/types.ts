export type Level = "debutant" | "intermediaire" | "avance";
export type ProgramGoal =
  | "hypertrophie"
  | "force"
  | "perte_de_poids"
  | "remise_en_forme"
  | "preparation_physique"
  | "autre";
export type SetType = "echauffement" | "travail" | "degressive" | "rest_pause" | "autre";

export interface Client {
  id: string;
  first_name: string;
  last_name: string;
  goal: string | null;
  level: Level | null;
  sessions_per_week: number | null;
  constraints: string | null;
  notes: string | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface Exercise {
  id: string;
  name: string;
  muscle_group: string | null;
  equipment: string | null;
  movement_type: string | null;
  description: string | null;
  execution_cues: string | null;
  common_mistakes: string | null;
  variations: string | null;
  video_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Program {
  id: string;
  client_id: string | null;
  name: string;
  goal: ProgramGoal | null;
  level: Level | null;
  split_type: string | null;
  duration_weeks: number | null;
  sessions_per_week: number | null;
  description: string | null;
  instructions: string | null;
  is_template: boolean;
  archived: boolean;
  created_at: string;
  updated_at: string;
  clients?: Pick<Client, "id" | "first_name" | "last_name"> | null;
}

export interface ProgramSession {
  id: string;
  program_id: string;
  name: string;
  notes: string | null;
  position: number;
  program_exercises?: ProgramExercise[];
}

export interface ProgramExercise {
  id: string;
  session_id: string;
  exercise_id: string;
  position: number;
  sets: number | null;
  reps: string | null;
  load_kg: number | null;
  rpe: number | null;
  rir: number | null;
  rest_seconds: number | null;
  tempo: string | null;
  set_type: SetType | null;
  technical_cues: string | null;
  comments: string | null;
  exercises?: Pick<Exercise, "id" | "name" | "muscle_group" | "equipment"> | null;
}

export interface WorkoutLog {
  id: string;
  client_id: string;
  program_id: string | null;
  program_session_id: string | null;
  program_name: string | null;
  session_name: string | null;
  performed_on: string;
  coach_comments: string | null;
  created_at: string;
  workout_sets?: WorkoutSet[];
}

export interface WorkoutSet {
  id: string;
  workout_log_id: string;
  exercise_id: string | null;
  exercise_name: string;
  exercise_order: number;
  set_number: number;
  set_type: SetType | null;
  planned_reps: string | null;
  planned_load_kg: number | null;
  planned_rpe: number | null;
  planned_rir: number | null;
  load_kg: number | null;
  reps: number | null;
  rpe: number | null;
  rir: number | null;
  rest_seconds: number | null;
  comment: string | null;
}

export interface WeightGoal {
  id: string;
  client_id: string;
  start_weight: number | null;
  start_date: string | null;
  target_weight: number | null;
  target_date: string | null;
}

export interface WeightMilestone {
  id: string;
  client_id: string;
  label: string | null;
  weight: number;
  target_date: string | null;
}

export interface WeighIn {
  id: string;
  client_id: string;
  measured_on: string;
  weight_kg: number;
  comment: string | null;
}

export interface Measurement {
  id: string;
  client_id: string;
  measured_on: string;
  waist_cm: number | null;
  hips_cm: number | null;
  chest_cm: number | null;
  thigh_cm: number | null;
  arm_cm: number | null;
  comment: string | null;
}

export interface Review {
  id: string;
  client_id: string;
  review_date: string;
  weight_kg: number | null;
  difficulties: string | null;
  positives: string | null;
  coach_comments: string | null;
  next_goals: string | null;
  created_at: string;
}
