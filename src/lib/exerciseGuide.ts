/**
 * Fiches techniques détaillées des exercices de la bibliothèque de base.
 * Chaque fiche : description, exécution pas à pas, erreurs fréquentes, variantes.
 * Texte en clair (retours à la ligne et puces « • »), lisible dans l'application et dans les PDF.
 */
import { normalize } from "./format";

export interface ExerciseGuide {
  description: string;
  execution_cues: string;
  common_mistakes: string;
  variations: string;
  /** Autres noms courants, pour reconnaître les exercices déjà créés */
  aliases?: string[];
}

const b = (...lines: string[]) => lines.map((l) => `• ${l}`).join("\n");

export const EXERCISE_GUIDE: Record<string, ExerciseGuide> = {
  /* ------------------------------ Pectoraux ------------------------------ */
  "Développé couché à la barre": {
    aliases: ["Développé couché", "Développé couché barre", "Bench press"],
    description:
      "Exercice de base du haut du corps. Il travaille principalement les pectoraux, ainsi que l'avant des épaules et les triceps. C'est l'un des meilleurs mouvements pour gagner en force et en masse sur la poitrine.",
    execution_cues: b(
      "Allongé sur le banc, les yeux à l'aplomb de la barre, pieds bien ancrés au sol.",
      "Serrer et abaisser les omoplates (« poitrine fière »), garder une légère cambrure naturelle.",
      "Mains un peu plus larges que les épaules, poignets droits au-dessus des coudes.",
      "Inspirer et descendre la barre de façon contrôlée jusqu'au bas des pectoraux, coudes à environ 45° du buste.",
      "Toucher la poitrine sans rebond, puis pousser en soufflant, la barre remonte légèrement vers les yeux.",
      "Garder les fessiers et les épaules en contact avec le banc pendant toute la série.",
    ),
    common_mistakes: b(
      "Fesses qui décollent du banc pour soulever plus lourd.",
      "Coudes ouverts à 90° : stress inutile sur les épaules.",
      "Rebond de la barre sur la poitrine.",
      "Omoplates relâchées et épaules qui avancent en fin de poussée.",
      "Poignets cassés vers l'arrière.",
    ),
    variations: b(
      "Développé couché aux haltères (plus d'amplitude, travail de chaque côté).",
      "Développé incliné (haut des pectoraux).",
      "Prise serrée (plus de triceps).",
      "Pompes lestées si pas de banc.",
    ),
  },
  "Développé incliné aux haltères": {
    aliases: ["Développé incliné haltères", "Développé incliné"],
    description:
      "Variante inclinée qui cible davantage le haut des pectoraux et l'avant des épaules. Les haltères permettent une grande amplitude et corrigent les déséquilibres entre le côté droit et le côté gauche.",
    execution_cues: b(
      "Régler le banc entre 30 et 45°.",
      "Monter les haltères en les posant sur les cuisses, puis s'allonger en les ramenant au-dessus de la poitrine.",
      "Omoplates serrées, pieds au sol, poignets alignés avec les avant-bras.",
      "Descendre en inspirant jusqu'à sentir l'étirement des pectoraux, coudes à 45° du buste.",
      "Pousser en soufflant en rapprochant légèrement les haltères en haut, sans les cogner.",
    ),
    common_mistakes: b(
      "Banc trop incliné : l'exercice devient un développé épaules.",
      "Amplitude trop courte.",
      "Haltères qui s'entrechoquent en haut et relâchement de la tension.",
      "Bas du dos très cambré.",
    ),
    variations: b("Développé incliné à la barre.", "Développé incliné à la machine guidée.", "Prise neutre (paumes face à face), plus douce pour les épaules."),
  },
  "Développé couché aux haltères": {
    aliases: ["Développé couché haltères"],
    description:
      "Alternative au développé couché à la barre. Les haltères offrent plus d'amplitude et obligent chaque bras à travailler seul : excellent pour l'équilibre musculaire et la stabilité des épaules.",
    execution_cues: b(
      "S'allonger avec les haltères posés sur les cuisses, les monter au-dessus de la poitrine en s'allongeant.",
      "Omoplates serrées, pieds ancrés, légère cambrure naturelle.",
      "Descendre lentement en inspirant, coudes à 45°, jusqu'à ce que les haltères arrivent au niveau de la poitrine.",
      "Pousser en soufflant en suivant un léger arc de cercle vers le haut.",
    ),
    common_mistakes: b("Descendre trop vite sans contrôle.", "Coudes trop ouverts.", "Lâcher les haltères au sol en fin de série au lieu de les ramener sur les cuisses."),
    variations: b("Prise neutre.", "Développé alterné (un bras après l'autre).", "Sur banc incliné ou décliné."),
  },
  "Écarté à la poulie vis-à-vis": {
    aliases: ["Écarté poulie", "Écartés à la poulie", "Pec fly poulie"],
    description:
      "Exercice d'isolation des pectoraux. La poulie garde une tension constante sur toute l'amplitude, idéal en fin de séance pour bien sentir le muscle.",
    execution_cues: b(
      "Poulies réglées à hauteur des épaules, un pas en avant, buste légèrement penché.",
      "Coudes légèrement fléchis et fixes pendant tout le mouvement.",
      "Ouvrir les bras en inspirant jusqu'à sentir l'étirement de la poitrine.",
      "Ramener les mains devant le sternum en soufflant, comme pour serrer un gros arbre.",
      "Marquer une seconde de contraction, puis revenir lentement.",
    ),
    common_mistakes: b("Plier et tendre les coudes : l'exercice devient un développé.", "Charge trop lourde qui tire les épaules vers l'avant.", "Revenir trop vite et perdre la tension."),
    variations: b("Poulies basses (haut des pectoraux).", "Poulies hautes (bas des pectoraux).", "Écarté aux haltères sur banc.", "Pec deck (machine)."),
  },
  Pompes: {
    aliases: ["Pompe", "Push-up"],
    description:
      "Exercice au poids du corps pour les pectoraux, les triceps et l'avant des épaules, avec un gros travail de gainage. Faisable partout, il s'adapte à tous les niveaux.",
    execution_cues: b(
      "Mains un peu plus larges que les épaules, doigts vers l'avant.",
      "Corps aligné de la tête aux talons : fessiers et abdos serrés.",
      "Descendre en inspirant, coudes à environ 45° du corps, jusqu'à ce que la poitrine frôle le sol.",
      "Pousser le sol en soufflant jusqu'à bras tendus, sans casser l'alignement.",
    ),
    common_mistakes: b("Bassin qui s'affaisse ou fesses trop hautes.", "Amplitude partielle.", "Coudes ouverts à 90°.", "Tête qui part vers le sol."),
    variations: b(
      "Débutant : pompes sur les genoux ou mains surélevées sur un banc.",
      "Avancé : pieds surélevés, pompes lestées, pompes claquées.",
      "Pompes prise serrée (triceps).",
    ),
  },
  Dips: {
    aliases: ["Dips barres parallèles"],
    description:
      "Exercice au poids du corps très complet pour les triceps, le bas des pectoraux et l'avant des épaules. Buste droit : plus de triceps ; buste penché : plus de pectoraux.",
    execution_cues: b(
      "En appui bras tendus sur les barres parallèles, épaules basses (loin des oreilles).",
      "Pencher légèrement le buste, jambes fléchies ou tendues sous le corps.",
      "Descendre en inspirant jusqu'à ce que les bras soient à peu près parallèles au sol.",
      "Remonter en soufflant en poussant fort dans les barres, sans verrouiller brutalement les coudes.",
    ),
    common_mistakes: b("Descendre trop bas avec les épaules qui partent en avant.", "Hausser les épaules.", "Se balancer pour remonter."),
    variations: b("Dips assistés (machine ou élastique).", "Dips sur banc (plus facile).", "Dips lestés avec une ceinture."),
  },

  /* --------------------------------- Dos --------------------------------- */
  "Tractions pronation": {
    aliases: ["Tractions", "Traction", "Pull-up"],
    description:
      "Exercice roi du dos au poids du corps. Il développe la largeur du dos (grands dorsaux), les biceps et la force de préhension.",
    execution_cues: b(
      "Mains en pronation (paumes vers l'avant), un peu plus larges que les épaules.",
      "Départ bras tendus, épaules engagées : descendre les omoplates avant de tirer.",
      "Tirer les coudes vers les hanches en soufflant, poitrine vers la barre.",
      "Monter jusqu'à ce que le menton dépasse la barre.",
      "Redescendre lentement en inspirant jusqu'à bras tendus.",
    ),
    common_mistakes: b("Élan avec les jambes (kipping).", "Amplitude partielle (ne pas tendre les bras en bas).", "Épaules qui montent vers les oreilles.", "Tendre le cou vers la barre au lieu de monter la poitrine."),
    variations: b(
      "Tractions assistées (élastique ou machine).",
      "Tractions négatives : sauter en haut et descendre en 3-5 secondes.",
      "Tractions supination (plus de biceps).",
      "Tractions lestées.",
    ),
  },
  "Tirage vertical prise large": {
    aliases: ["Tirage vertical", "Lat pulldown", "Tirage poitrine"],
    description:
      "Alternative guidée aux tractions, réglable à tous les niveaux. Il cible la largeur du dos (grands dorsaux) et les biceps.",
    execution_cues: b(
      "Régler le boudin pour bloquer les cuisses, mains plus larges que les épaules.",
      "Buste légèrement incliné vers l'arrière, poitrine sortie.",
      "Abaisser les omoplates puis tirer la barre vers le haut de la poitrine en soufflant, coudes vers le bas.",
      "Remonter lentement en inspirant jusqu'à bras presque tendus.",
    ),
    common_mistakes: b("Tirer derrière la nuque.", "Se pencher très en arrière et tirer avec le poids du corps.", "Bras qui font tout le travail, coudes qui reculent au lieu de descendre."),
    variations: b("Prise serrée en triangle.", "Prise supination.", "Tirage unilatéral à la poulie haute."),
  },
  "Rowing barre buste penché": {
    aliases: ["Rowing barre", "Rowing buste penché"],
    description:
      "Exercice de base pour l'épaisseur du dos : grands dorsaux, trapèzes, rhomboïdes et arrière des épaules. Il renforce aussi les lombaires qui maintiennent la position.",
    execution_cues: b(
      "Pieds largeur de hanches, genoux légèrement fléchis, barre en main en pronation.",
      "Pousser les hanches vers l'arrière pour pencher le buste à environ 45°, dos plat.",
      "Tirer la barre vers le nombril en soufflant, coudes près du corps.",
      "Serrer les omoplates en haut, puis redescendre lentement en inspirant.",
    ),
    common_mistakes: b("Dos arrondi.", "Buste qui se redresse à chaque répétition.", "Élan des hanches pour remonter la barre.", "Tirer vers la poitrine avec les coudes ouverts."),
    variations: b("Rowing prise supination.", "Rowing Yates (buste plus redressé).", "Rowing T-bar.", "Rowing haltère unilatéral."),
  },
  "Rowing haltère unilatéral": {
    aliases: ["Rowing haltère", "Rowing un bras"],
    description:
      "Tirage horizontal un bras à la fois. Il développe l'épaisseur du dos tout en soulageant les lombaires grâce à l'appui sur le banc.",
    execution_cues: b(
      "Un genou et une main en appui sur le banc, dos plat parallèle au sol.",
      "Haltère bras tendu sous l'épaule.",
      "Tirer le coude vers la hanche en soufflant, l'haltère remonte le long du corps.",
      "Marquer un temps en haut, omoplate serrée, puis redescendre en contrôlant.",
    ),
    common_mistakes: b("Tourner le buste pour monter la charge.", "Tirer avec le biceps vers l'épaule.", "Dos arrondi ou tête relevée."),
    variations: b("Rowing debout appui sur un banc incliné.", "Rowing Kroc (charges lourdes, plus de répétitions).", "Rowing à la poulie basse un bras."),
  },
  "Tirage horizontal à la poulie": {
    aliases: ["Tirage horizontal", "Rowing poulie basse", "Seated row"],
    description:
      "Tirage horizontal guidé pour l'épaisseur du dos et le milieu du dos. Très sûr pour apprendre à serrer les omoplates.",
    execution_cues: b(
      "Assis, pieds sur les cale-pieds, genoux légèrement fléchis, dos droit.",
      "Saisir la poignée bras tendus, épaules basses.",
      "Tirer vers le bas du ventre en soufflant, coudes près du corps, poitrine sortie.",
      "Serrer les omoplates une seconde puis revenir lentement en inspirant.",
    ),
    common_mistakes: b("Se balancer d'avant en arrière.", "Dos qui s'arrondit en allant chercher la charge.", "Épaules qui montent."),
    variations: b("Prise large (haut du dos et arrière des épaules).", "Unilatéral.", "Rowing machine avec appui pectoral."),
  },
  "Soulevé de terre": {
    aliases: ["Deadlift", "Soulevé de terre classique"],
    description:
      "Mouvement complet qui sollicite toute la chaîne arrière : fessiers, ischio-jambiers, lombaires et dos, ainsi que les quadriceps et la préhension. Excellent pour la force générale.",
    execution_cues: b(
      "Pieds largeur de hanches, barre au-dessus du milieu des pieds.",
      "Saisir la barre juste à l'extérieur des jambes, tibias contre la barre.",
      "Poitrine sortie, dos plat, épaules légèrement devant la barre ; inspirer et gainer fort.",
      "Pousser le sol avec les jambes, la barre remonte en frôlant les jambes.",
      "Verrouiller en serrant les fessiers, debout bien droit, puis redescendre en gardant le dos plat.",
    ),
    common_mistakes: b("Dos arrondi.", "Barre qui s'éloigne du corps.", "Hanches qui montent avant les épaules.", "Hyperextension (se pencher en arrière) en fin de mouvement."),
    variations: b("Soulevé de terre roumain.", "Soulevé de terre sumo (pieds écartés).", "Soulevé de terre à la trap bar (plus facile).", "Rack pull (départ surélevé)."),
  },
  "Face pull": {
    aliases: ["Face pull poulie"],
    description:
      "Exercice de santé des épaules : il renforce l'arrière des épaules, les rotateurs externes et le haut du dos. Idéal en échauffement ou en fin de séance, notamment pour compenser les mouvements de poussée.",
    execution_cues: b(
      "Corde fixée à la poulie haute, à hauteur des yeux.",
      "Prise avec les pouces vers soi, reculer jusqu'à bras tendus.",
      "Tirer la corde vers le visage en soufflant en écartant les mains, coudes hauts.",
      "Finir comme un « double biceps », marquer une pause puis revenir lentement.",
    ),
    common_mistakes: b("Charge trop lourde : on tire avec le dos et le poids du corps.", "Coudes trop bas.", "Se pencher en arrière."),
    variations: b("Face pull à l'élastique.", "Face pull assis.", "Oiseau à la poulie."),
  },

  /* ------------------------------- Épaules ------------------------------- */
  "Développé militaire à la barre": {
    aliases: ["Développé militaire", "Overhead press", "Military press"],
    description:
      "Exercice de base pour les épaules (surtout l'avant), avec un travail des triceps et un gros gainage. Développe la force de poussée au-dessus de la tête.",
    execution_cues: b(
      "Debout, pieds largeur de hanches, barre posée sur le haut de la poitrine, mains juste plus larges que les épaules.",
      "Serrer fessiers et abdos pour bloquer le bassin.",
      "Pousser la barre droit vers le haut en soufflant, reculer légèrement la tête pour la laisser passer.",
      "En haut, la tête repasse sous la barre, bras tendus au-dessus des oreilles.",
      "Redescendre en contrôlant jusqu'au haut de la poitrine.",
    ),
    common_mistakes: b("Cambrure lombaire excessive.", "Pousser la barre vers l'avant au lieu de droit.", "Utiliser les jambes (sauf push press volontaire).", "Coudes trop écartés vers l'arrière."),
    variations: b("Développé haltères assis.", "Push press (avec impulsion des jambes).", "Développé à la machine guidée.", "Landmine press."),
  },
  "Développé haltères assis": {
    aliases: ["Développé épaules haltères", "Développé assis haltères", "Shoulder press haltères"],
    description:
      "Développé épaules assis avec dossier : plus stable que debout, il permet de se concentrer sur les épaules et les triceps.",
    execution_cues: b(
      "Banc presque vertical (75-90°), dos collé au dossier, pieds au sol.",
      "Haltères à hauteur des oreilles, coudes légèrement devant le corps.",
      "Pousser vers le haut en soufflant jusqu'à bras presque tendus, sans cogner les haltères.",
      "Redescendre lentement jusqu'à hauteur du menton.",
    ),
    common_mistakes: b("Dos qui se décolle et cambre.", "Amplitude trop courte.", "Charges trop lourdes, coudes qui partent en arrière."),
    variations: b("Arnold press (rotation des poignets).", "Prise neutre.", "Développé un bras."),
  },
  "Élévations latérales": {
    aliases: ["Élévation latérale", "Elevations laterales haltères"],
    description:
      "Isolation de la partie latérale des épaules, celle qui donne la largeur. Se travaille plutôt léger avec beaucoup de contrôle.",
    execution_cues: b(
      "Debout, haltères le long du corps, buste très légèrement penché, coudes un peu fléchis.",
      "Monter les bras sur les côtés en soufflant jusqu'à l'horizontale, coudes légèrement plus hauts que les mains.",
      "Penser à « écarter » plutôt qu'à « monter ».",
      "Redescendre lentement en 2-3 secondes.",
    ),
    common_mistakes: b("Élan du buste.", "Hausser les épaules (les trapèzes prennent le relais).", "Monter au-dessus de l'horizontale.", "Charge trop lourde."),
    variations: b("À la poulie basse (tension constante).", "Assis.", "Buste penché sur un banc incliné.", "À la machine."),
  },
  "Oiseau aux haltères": {
    aliases: ["Oiseau", "Élévations arrière", "Reverse fly"],
    description:
      "Isolation de l'arrière des épaules et du haut du dos. Améliore la posture et équilibre les épaules souvent dominées par l'avant.",
    execution_cues: b(
      "Buste penché presque à l'horizontale (debout ou assis), dos plat.",
      "Haltères sous les épaules, coudes légèrement fléchis.",
      "Écarter les bras sur les côtés en soufflant jusqu'à l'horizontale.",
      "Redescendre en contrôlant.",
    ),
    common_mistakes: b("Se redresser pour monter les haltères.", "Serrer les omoplates à fond : le travail passe dans le dos au lieu de l'arrière des épaules.", "Charge trop lourde."),
    variations: b("Oiseau à la poulie.", "Reverse pec deck (machine).", "Allongé sur banc incliné."),
  },

  /* --------------------------------- Bras --------------------------------- */
  "Curl barre EZ": {
    aliases: ["Curl barre", "Curl EZ"],
    description:
      "Exercice de base des biceps. La barre EZ, coudée, soulage les poignets tout en permettant des charges assez lourdes.",
    execution_cues: b(
      "Debout, prise en supination sur les parties coudées, coudes collés aux côtes.",
      "Monter la barre en soufflant en ne bougeant que les avant-bras.",
      "Contracter les biceps en haut sans avancer les coudes.",
      "Redescendre lentement jusqu'à bras presque tendus.",
    ),
    common_mistakes: b("Balancer le buste pour monter la charge.", "Coudes qui avancent en haut.", "Descente trop rapide."),
    variations: b("Curl barre droite.", "Curl pupitre (Larry Scott).", "Curl à la poulie basse."),
  },
  "Curl haltères incliné": {
    aliases: ["Curl incliné"],
    description:
      "Curl réalisé allongé sur un banc incliné : les bras partent en arrière du corps, ce qui étire fortement les biceps. Excellent pour l'amplitude et le développement du biceps.",
    execution_cues: b(
      "Banc à 45-60°, dos collé, bras pendants à la verticale.",
      "Paumes vers l'avant, monter les haltères en soufflant sans avancer les coudes.",
      "Contracter en haut puis redescendre lentement jusqu'à l'étirement complet.",
    ),
    common_mistakes: b("Coudes qui avancent.", "Amplitude incomplète en bas.", "Décoller les épaules du banc."),
    variations: b("Curl alterné.", "Curl marteau incliné.", "Curl à la poulie dans le dos."),
  },
  "Curl marteau": {
    aliases: ["Hammer curl"],
    description:
      "Curl en prise neutre (pouces vers le haut). Il travaille le biceps, mais surtout le brachial et les avant-bras, pour des bras plus épais.",
    execution_cues: b(
      "Debout, haltères le long du corps, paumes face à face.",
      "Monter les haltères en soufflant, coudes fixes, poignets alignés.",
      "Redescendre en contrôlant.",
    ),
    common_mistakes: b("Élan du buste.", "Poignets qui tournent.", "Coudes qui s'écartent."),
    variations: b("Curl marteau croisé (vers l'épaule opposée).", "À la corde à la poulie.", "Alterné."),
  },
  "Extension triceps à la poulie": {
    aliases: ["Extension triceps poulie", "Pushdown", "Triceps poulie haute"],
    description:
      "Isolation des triceps à la poulie haute, simple et efficace. La tension reste constante tout au long du mouvement.",
    execution_cues: b(
      "Face à la poulie haute, barre ou corde en main, buste légèrement penché.",
      "Coudes collés au buste et fixes.",
      "Pousser vers le bas en soufflant jusqu'à l'extension complète des bras.",
      "Remonter lentement jusqu'à ce que les avant-bras soient à l'horizontale.",
    ),
    common_mistakes: b("Coudes qui bougent ou s'écartent.", "Se pencher sur la charge pour la pousser avec le poids du corps.", "Amplitude incomplète."),
    variations: b("À la corde (écarter les mains en bas).", "Prise inversée.", "Extension au-dessus de la tête à la poulie."),
  },
  "Barre au front": {
    aliases: ["Skull crusher", "Extension triceps allongé"],
    description:
      "Exercice de masse pour les triceps, réalisé allongé. Il travaille particulièrement la longue portion du triceps.",
    execution_cues: b(
      "Allongé sur un banc, barre EZ bras tendus au-dessus des épaules.",
      "Bras légèrement inclinés vers la tête.",
      "Fléchir les coudes en inspirant pour descendre la barre vers le front ou juste derrière la tête.",
      "Remonter en soufflant en tendant les bras, coudes fixes et serrés.",
    ),
    common_mistakes: b("Coudes qui s'écartent.", "Bras qui bougent (l'exercice devient un pull-over).", "Charge trop lourde pour les coudes."),
    variations: b("Aux haltères.", "Sur banc incliné.", "À la poulie basse."),
  },

  /* -------------------------------- Jambes -------------------------------- */
  "Squat barre": {
    aliases: ["Squat", "Back squat", "Squat arrière"],
    description:
      "Exercice roi du bas du corps : quadriceps, fessiers, adducteurs, avec un gros travail de gainage. Il développe la force et la masse des jambes.",
    execution_cues: b(
      "Barre posée sur le haut du dos (trapèzes), pas sur la nuque ; mains serrées sur la barre.",
      "Pieds largeur d'épaules, pointes légèrement ouvertes.",
      "Inspirer, gainer le ventre, puis descendre en poussant les hanches en arrière et les genoux vers l'extérieur.",
      "Descendre au moins jusqu'à ce que les cuisses soient parallèles au sol, dos neutre, talons au sol.",
      "Remonter en poussant fort dans le sol, en soufflant, poitrine haute.",
    ),
    common_mistakes: b("Genoux qui rentrent vers l'intérieur.", "Talons qui décollent.", "Dos qui s'arrondit en bas (bascule du bassin).", "Remonter les fesses avant les épaules."),
    variations: b("Goblet squat (débutant).", "Squat avant (front squat).", "Squat box (assis sur un banc).", "Squat à la machine guidée ou Hack squat."),
  },
  "Squat avant (front squat)": {
    aliases: ["Front squat", "Squat avant"],
    description:
      "Squat avec la barre posée à l'avant des épaules. Le buste reste plus droit, ce qui met l'accent sur les quadriceps et le gainage, avec moins de contrainte sur le bas du dos.",
    execution_cues: b(
      "Barre posée sur l'avant des épaules, coudes hauts vers l'avant.",
      "Prise du bout des doigts (ou bras croisés si manque de souplesse).",
      "Descendre en gardant le buste très droit et les coudes hauts.",
      "Remonter en poussant dans le sol, en soufflant.",
    ),
    common_mistakes: b("Coudes qui tombent : la barre glisse vers l'avant.", "Buste qui se penche.", "Talons qui décollent."),
    variations: b("Goblet squat.", "Front squat avec cales sous les talons.", "Zercher squat."),
  },
  "Presse à cuisses": {
    aliases: ["Presse", "Leg press", "Presse inclinée"],
    description:
      "Exercice guidé pour les quadriceps et les fessiers. Il permet de charger lourd les jambes sans contrainte sur le dos, idéal pour débuter ou compléter le squat.",
    execution_cues: b(
      "Dos et bassin bien plaqués au dossier.",
      "Pieds au milieu du plateau, largeur des hanches.",
      "Déverrouiller et descendre en inspirant jusqu'à environ 90° de flexion des genoux, sans décoller le bassin.",
      "Pousser en soufflant avec tout le pied, sans verrouiller brutalement les genoux.",
    ),
    common_mistakes: b("Bassin qui décolle du dossier en bas.", "Genoux qui rentrent.", "Verrouiller les genoux en haut.", "Amplitude ridicule avec trop de charge."),
    variations: b("Pieds hauts (plus de fessiers et ischios).", "Pieds bas (plus de quadriceps).", "Presse unilatérale."),
  },
  "Fentes marchées aux haltères": {
    aliases: ["Fentes", "Fentes marchées", "Walking lunges"],
    description:
      "Exercice unilatéral pour les quadriceps et les fessiers, qui travaille aussi l'équilibre et la coordination.",
    execution_cues: b(
      "Debout, haltères le long du corps, buste droit.",
      "Faire un grand pas en avant et descendre jusqu'à ce que le genou arrière frôle le sol.",
      "Genou avant au-dessus du pied, poids sur le talon avant.",
      "Pousser sur la jambe avant pour ramener l'autre jambe et enchaîner le pas suivant.",
    ),
    common_mistakes: b("Pas trop court : le genou part loin devant.", "Genou avant qui rentre.", "Buste qui se penche."),
    variations: b("Fentes sur place.", "Fentes arrière (plus douces pour les genoux).", "Fentes avec barre.", "Fentes latérales."),
  },
  "Squat bulgare": {
    aliases: ["Split squat bulgare", "Bulgarian split squat"],
    description:
      "Fente avec le pied arrière surélevé sur un banc. Très efficace pour les quadriceps et les fessiers, et pour corriger les différences entre les jambes.",
    execution_cues: b(
      "Pied arrière posé sur un banc, pied avant assez loin devant.",
      "Haltères le long du corps, buste légèrement penché.",
      "Descendre en inspirant jusqu'à ce que la cuisse avant soit parallèle au sol.",
      "Remonter en soufflant en poussant dans le talon avant.",
    ),
    common_mistakes: b("Pied avant trop près du banc.", "Genou avant qui rentre.", "Pousser avec la jambe arrière."),
    variations: b("Sans charge pour débuter.", "Avec barre.", "Buste plus penché pour cibler les fessiers."),
  },
  "Leg extension": {
    aliases: ["Extension des jambes", "Leg extension machine"],
    description:
      "Isolation des quadriceps à la machine. Utile pour finir une séance jambes ou en échauffement des genoux.",
    execution_cues: b(
      "Dos contre le dossier, genoux alignés avec l'axe de la machine.",
      "Boudin posé juste au-dessus des chevilles.",
      "Tendre les jambes en soufflant, marquer une seconde de contraction en haut.",
      "Redescendre lentement.",
    ),
    common_mistakes: b("Lancer la charge.", "Décoller les fesses du siège.", "Descente non contrôlée."),
    variations: b("Unilatéral.", "Avec pause en haut.", "Séries longues pour finir la séance."),
  },
  "Soulevé de terre roumain": {
    aliases: ["SDT roumain", "Romanian deadlift", "RDL"],
    description:
      "Variante du soulevé de terre centrée sur les ischio-jambiers et les fessiers. Le mouvement part du haut et se fait en poussant les hanches vers l'arrière.",
    execution_cues: b(
      "Debout, barre en main, genoux légèrement fléchis et fixes.",
      "Pousser les hanches vers l'arrière en inspirant, la barre glisse le long des cuisses.",
      "Dos plat, descendre jusqu'à sentir l'étirement des ischio-jambiers (souvent sous les genoux).",
      "Remonter en soufflant en ramenant les hanches vers l'avant et en serrant les fessiers.",
    ),
    common_mistakes: b("Dos arrondi.", "Fléchir les genoux comme un squat.", "Descendre au-delà de sa souplesse.", "Barre qui s'éloigne des jambes."),
    variations: b("Aux haltères.", "Unilatéral (une jambe).", "Good morning."),
  },
  "Leg curl allongé": {
    aliases: ["Leg curl", "Leg curl couché"],
    description:
      "Isolation des ischio-jambiers à la machine. Complète bien le soulevé de terre roumain pour des cuisses équilibrées et des genoux protégés.",
    execution_cues: b(
      "Allongé sur le ventre, genoux juste au bord du banc, boudin au-dessus des talons.",
      "Hanches plaquées sur le banc.",
      "Ramener les talons vers les fesses en soufflant.",
      "Redescendre lentement sans laisser tomber la charge.",
    ),
    common_mistakes: b("Hanches qui décollent.", "Mouvement trop rapide.", "Amplitude incomplète."),
    variations: b("Leg curl assis.", "Unilatéral.", "Leg curl au swiss ball ou Nordic curl."),
  },
  "Hip thrust": {
    aliases: ["Hip thrust barre", "Relevé de bassin"],
    description:
      "Exercice numéro un pour les fessiers. Il permet de les charger lourd en toute sécurité et améliore la puissance de la hanche.",
    execution_cues: b(
      "Haut du dos appuyé sur un banc, barre (avec protection) posée sur le pli de la hanche.",
      "Pieds à plat, largeur des hanches ; en haut, les tibias doivent être verticaux.",
      "Menton rentré, regard vers l'avant.",
      "Pousser le bassin vers le haut en soufflant jusqu'à l'alignement épaules-hanches-genoux.",
      "Serrer fort les fessiers 1 seconde, puis redescendre en contrôlant.",
    ),
    common_mistakes: b("Cambrer le bas du dos au lieu de monter avec les fessiers.", "Pieds trop loin ou trop près.", "Tête renversée en arrière."),
    variations: b("Pont fessier au sol.", "Hip thrust unilatéral.", "À la machine ou avec élastique."),
  },
  "Mollets debout": {
    aliases: ["Mollets", "Extension mollets debout", "Calf raise"],
    description:
      "Isolation des mollets (surtout les gastrocnémiens). Les mollets aiment l'amplitude complète et un rythme contrôlé.",
    execution_cues: b(
      "Avant des pieds sur la marche, talons dans le vide, genoux tendus mais pas verrouillés.",
      "Descendre les talons au maximum et marquer une pause en étirement.",
      "Monter le plus haut possible sur la pointe des pieds en soufflant.",
      "Tenir 1 seconde en haut, puis redescendre lentement.",
    ),
    common_mistakes: b("Rebondir en bas.", "Amplitude trop courte.", "Plier les genoux pour s'aider."),
    variations: b("Mollets assis (soléaire).", "À la presse.", "Unilatéral avec haltère."),
  },

  /* -------------------------------- Gainage -------------------------------- */
  "Gainage planche": {
    aliases: ["Planche", "Gainage", "Plank"],
    description:
      "Exercice statique de gainage qui renforce toute la ceinture abdominale et protège le bas du dos.",
    execution_cues: b(
      "Appui sur les avant-bras (coudes sous les épaules) et sur la pointe des pieds.",
      "Corps aligné de la tête aux talons.",
      "Serrer les fessiers, rentrer légèrement le nombril, respirer calmement.",
      "Tenir le temps prévu sans perdre la position.",
    ),
    common_mistakes: b("Bassin qui s'affaisse (douleur au bas du dos).", "Fesses trop hautes.", "Bloquer la respiration."),
    variations: b("Sur les genoux (débutant).", "Planche latérale.", "Planche avec levée de bras ou de jambe.", "Planche dynamique (passer sur les mains)."),
  },
  "Relevés de jambes suspendu": {
    aliases: ["Relevés de jambes", "Hanging leg raise"],
    description:
      "Exercice avancé pour les abdominaux, surtout la partie basse, et les fléchisseurs de hanche. Demande aussi de la force de préhension.",
    execution_cues: b(
      "Suspendu à la barre, bras tendus, épaules engagées.",
      "Monter les jambes (fléchies ou tendues) en soufflant en enroulant le bassin vers le haut.",
      "Redescendre lentement sans se balancer.",
    ),
    common_mistakes: b("Se balancer pour prendre de l'élan.", "Monter juste les jambes sans enrouler le bassin.", "Descente non contrôlée."),
    variations: b("Genoux fléchis (plus facile).", "À la chaise romaine (appui sur les avant-bras).", "Relevés de jambes allongé au sol."),
  },
  "Crunch à la poulie": {
    aliases: ["Crunch poulie", "Cable crunch"],
    description:
      "Exercice chargé pour les abdominaux (grand droit). La poulie permet d'augmenter progressivement la difficulté.",
    execution_cues: b(
      "À genoux face à la poulie haute, corde tenue de chaque côté de la tête.",
      "Hanches fixes.",
      "Enrouler le buste vers le bas en soufflant, coudes vers les genoux.",
      "Revenir lentement en inspirant.",
    ),
    common_mistakes: b("Tirer avec les bras.", "S'asseoir sur les talons (les hanches bougent).", "Charge trop lourde."),
    variations: b("Crunch au sol.", "Crunch à la machine.", "Crunch sur swiss ball."),
  },

  /* ----------------------------- Haltérophilie ----------------------------- */
  "Arraché (snatch)": {
    aliases: ["Arraché", "Snatch"],
    description:
      "Mouvement olympique : la barre passe du sol au-dessus de la tête en un seul geste. Développe l'explosivité, la vitesse, la coordination et la mobilité.",
    execution_cues: b(
      "Prise très large, départ comme un soulevé de terre, dos plat.",
      "Premier tirage : décoller la barre du sol en gardant le dos et les bras fixes.",
      "Au niveau des hanches, extension explosive (chevilles, genoux, hanches).",
      "Tirer les coudes hauts et passer rapidement sous la barre.",
      "Réceptionner en squat bras tendus au-dessus de la tête, puis se relever.",
    ),
    common_mistakes: b("Barre qui s'éloigne du corps.", "Tirer avec les bras trop tôt.", "Extension incomplète.", "Réception bras fléchis."),
    variations: b("Arraché en suspension.", "Arraché debout (power snatch).", "Squat arraché.", "Tirage d'arraché."),
  },
  "Épaulé-jeté (clean & jerk)": {
    aliases: ["Épaulé-jeté", "Clean and jerk", "Epaule jete"],
    description:
      "Mouvement olympique en deux temps : l'épaulé amène la barre du sol aux épaules, le jeté l'envoie au-dessus de la tête. Très complet pour la puissance et la coordination.",
    execution_cues: b(
      "Épaulé : prise largeur d'épaules, tirage du sol en gardant le dos plat, extension explosive des hanches.",
      "Passer rapidement sous la barre et la recevoir sur l'avant des épaules, coudes hauts, en squat avant.",
      "Se relever.",
      "Jeté : légère flexion des jambes, impulsion explosive, puis passer sous la barre en fente, bras tendus.",
      "Ramener les pieds et stabiliser.",
    ),
    common_mistakes: b("Tirer avec les bras.", "Coudes bas à la réception.", "Jeté poussé avec les bras au lieu des jambes."),
    variations: b("Épaulé en suspension.", "Power clean.", "Push jerk."),
  },
  "Épaulé en suspension (hang clean)": {
    aliases: ["Hang clean", "Épaulé suspension"],
    description:
      "Épaulé démarré au-dessus des genoux. Il met l'accent sur l'extension explosive des hanches et la réception, idéal pour apprendre et développer la puissance.",
    execution_cues: b(
      "Debout barre en main, descendre la barre au-dessus des genoux en poussant les hanches en arrière.",
      "Extension explosive des hanches et des jambes.",
      "Hausser les épaules, tirer les coudes et passer sous la barre.",
      "Recevoir la barre sur l'avant des épaules, coudes hauts.",
    ),
    common_mistakes: b("Fléchir les bras trop tôt.", "Barre qui part en avant.", "Réception sur les poignets, coudes bas."),
    variations: b("Hang power clean (réception haute).", "Épaulé depuis le sol."),
  },
  "Arraché en suspension (hang snatch)": {
    aliases: ["Hang snatch", "Arraché suspension"],
    description:
      "Arraché démarré au-dessus des genoux, pour travailler l'explosivité et la vitesse de passage sous la barre.",
    execution_cues: b(
      "Prise large, barre descendue au-dessus des genoux, dos plat.",
      "Extension explosive des hanches.",
      "Tirer les coudes hauts et passer sous la barre.",
      "Réceptionner bras tendus au-dessus de la tête.",
    ),
    common_mistakes: b("Barre loin du corps.", "Extension incomplète.", "Réception bras fléchis."),
    variations: b("Hang power snatch.", "Arraché depuis le sol."),
  },
  "Squat arraché (overhead squat)": {
    aliases: ["Overhead squat", "Squat bras tendus"],
    description:
      "Squat avec la barre tenue bras tendus au-dessus de la tête. Excellent pour la mobilité, la stabilité des épaules et le gainage.",
    execution_cues: b(
      "Barre au-dessus de la tête, prise large, bras verrouillés.",
      "Pousser activement la barre vers le plafond.",
      "Descendre en squat, buste le plus droit possible.",
      "Remonter en gardant la barre à l'aplomb du milieu des pieds.",
    ),
    common_mistakes: b("Barre qui part vers l'avant.", "Bras qui plient.", "Talons qui décollent."),
    variations: b("Avec un bâton pour apprendre.", "Avec un haltère (un bras)."),
  },
  "Tirage d'arraché": {
    aliases: ["Snatch pull"],
    description:
      "Éducatif de l'arraché : le tirage complet sans passer sous la barre. Il renforce la position et l'explosivité du tirage.",
    execution_cues: b(
      "Position de départ de l'arraché, prise large.",
      "Décoller la barre et garder la position jusqu'aux genoux.",
      "Extension explosive avec haussement d'épaules, bras tendus.",
    ),
    common_mistakes: b("Tirer avec les bras.", "Dos qui s'arrondit.", "Extension incomplète."),
    variations: b("Tirage d'épaulé.", "Tirage haut (high pull)."),
  },

  /* ------------------------ Cardio / conditionnement ------------------------ */
  "Kettlebell swing": {
    aliases: ["Swing kettlebell", "KB swing"],
    description:
      "Mouvement de balancier explosif qui renforce les fessiers, les ischio-jambiers et le dos, tout en faisant monter le cardio. Excellent pour la puissance et la dépense calorique.",
    execution_cues: b(
      "Pieds un peu plus larges que les hanches, kettlebell devant soi.",
      "Pousser les hanches en arrière, dos plat, et lancer la kettlebell entre les jambes.",
      "Projeter les hanches vers l'avant de façon explosive en serrant les fessiers.",
      "Les bras guident sans tirer ; la kettlebell monte à hauteur de poitrine.",
      "Laisser redescendre et enchaîner, en soufflant à chaque projection.",
    ),
    common_mistakes: b("Faire un squat au lieu d'une charnière de hanche.", "Lever avec les bras.", "Dos arrondi en bas.", "Se pencher en arrière en haut."),
    variations: b("Swing à une main.", "Swing américain (au-dessus de la tête).", "Swing aux haltères."),
  },
  Rameur: {
    aliases: ["Rameur concept2", "Rowing machine", "Aviron"],
    description:
      "Cardio complet qui sollicite environ 85 % des muscles : jambes, dos, bras et gainage. Faible impact sur les articulations.",
    execution_cues: b(
      "Pieds sanglés, résistance (damper) entre 4 et 6.",
      "Ordre de la poussée : jambes, puis bascule du buste vers l'arrière, puis tirage des bras sous la poitrine.",
      "Retour dans l'ordre inverse : bras, buste, puis jambes.",
      "Garder le dos droit, poignets alignés, respiration régulière.",
    ),
    common_mistakes: b("Tirer avec les bras avant de pousser avec les jambes.", "Dos arrondi.", "Damper à 10 (trop lourd, moins efficace).", "Cadence trop élevée sans puissance."),
    variations: b("Endurance : 20-40 min à allure confortable.", "Fractionné : 250 m rapide / 1 min de récupération.", "Pyramides de distance."),
  },
  "Course à pied": {
    aliases: ["Course", "Running", "Footing"],
    description:
      "Activité cardio de base pour l'endurance, la santé cardiovasculaire et la dépense calorique. S'adapte du footing tranquille au fractionné.",
    execution_cues: b(
      "Échauffement de 5 à 10 minutes à allure très facile.",
      "Foulée courte et souple, pied qui atterrit sous le corps.",
      "Buste droit légèrement penché vers l'avant, épaules relâchées.",
      "Respiration régulière : en endurance, on doit pouvoir parler.",
    ),
    common_mistakes: b("Partir trop vite.", "Grandes foulées qui attaquent du talon loin devant.", "Augmenter le volume trop vite (risque de blessure)."),
    variations: b("Footing en endurance fondamentale.", "Fractionné court (30 s / 30 s).", "Côtes.", "Sortie longue."),
  },
  "Tapis de course": {
    aliases: ["Tapis", "Treadmill"],
    description:
      "Course ou marche en salle avec une vitesse et une pente contrôlées. Pratique pour le fractionné et pour suivre précisément l'intensité.",
    execution_cues: b(
      "Monter sur les côtés, démarrer à vitesse lente, puis augmenter progressivement.",
      "Courir au centre du tapis, sans se tenir aux barres.",
      "Mettre 1 % de pente pour se rapprocher de la course en extérieur.",
      "Clipser la sécurité.",
    ),
    common_mistakes: b("Se tenir aux barres.", "Regarder ses pieds.", "Vitesse trop élevée qui dégrade la foulée."),
    variations: b("Fractionné vitesse.", "Marche inclinée.", "Progressif (augmenter la vitesse toutes les 2 min)."),
  },
  "Marche inclinée sur tapis": {
    aliases: ["Marche inclinée", "Incline walk"],
    description:
      "Cardio à faible impact mais très efficace pour la dépense calorique et les fessiers. Idéal en perte de poids ou en récupération active.",
    execution_cues: b(
      "Pente entre 8 et 15 %, vitesse de 4 à 6 km/h.",
      "Ne pas se tenir aux barres : bras libres, buste droit.",
      "Pas réguliers, pousser avec les fessiers.",
      "Respiration soutenue mais on doit pouvoir parler.",
    ),
    common_mistakes: b("Se tenir aux barres (réduit fortement l'effort).", "Se pencher vers l'avant.", "Pente trop forte pour son niveau."),
    variations: b("Pente progressive.", "Intervalles de pente.", "Avec gilet lesté (avancé)."),
  },
  "Vélo d'appartement": {
    aliases: ["Vélo", "Vélo stationnaire", "Bike"],
    description: "Cardio sans impact, idéal pour l'endurance, la récupération active ou le fractionné. Sollicite surtout les quadriceps et les fessiers.",
    execution_cues: b(
      "Régler la selle : jambe presque tendue quand la pédale est en bas.",
      "Dos droit, épaules relâchées, mains légères sur le guidon.",
      "Cadence de 80 à 95 tours par minute en endurance.",
      "Ajuster la résistance pour rester dans la zone d'intensité prévue.",
    ),
    common_mistakes: b("Selle trop basse (genoux) ou trop haute (bassin qui bascule).", "Résistance trop faible.", "S'appuyer de tout son poids sur le guidon."),
    variations: b("Endurance 30-45 min.", "Fractionné : 30 s intense / 30 s facile.", "Danseuse (debout)."),
  },
  "Vélo elliptique": {
    aliases: ["Elliptique", "Cross trainer"],
    description: "Cardio complet bras et jambes, sans impact. Bon choix pour les débutants, en perte de poids ou en cas de douleurs articulaires.",
    execution_cues: b(
      "Pieds bien à plat sur les pédales, buste droit.",
      "Pousser et tirer les poignées pour faire travailler le haut du corps.",
      "Mouvement fluide, résistance suffisante pour ne pas « flotter ».",
    ),
    common_mistakes: b("Résistance trop faible.", "Se pencher en avant.", "Décoller les talons."),
    variations: b("Pédalage arrière.", "Fractionné.", "Sans les bras pour cibler les jambes."),
  },
  "Assault bike": {
    aliases: ["Air bike", "Airbike"],
    description: "Vélo à air avec bras : plus on pousse fort, plus la résistance augmente. Très intense, idéal pour le fractionné et le conditionnement.",
    execution_cues: b(
      "Régler la selle comme un vélo classique.",
      "Pousser et tirer les poignées en même temps que le pédalage.",
      "Sur les sprints, tout donner bras et jambes, buste stable.",
    ),
    common_mistakes: b("Partir trop fort sur un effort long.", "Oublier les bras.", "Récupération trop courte entre les sprints."),
    variations: b("Tabata (20 s / 10 s).", "Sprints de 10 à 15 s.", "Calories en un temps donné."),
  },
  SkiErg: {
    aliases: ["Ski erg"],
    description: "Machine qui reproduit la poussée du ski de fond : gros travail du dos, des triceps et des abdominaux avec un effort cardio intense.",
    execution_cues: b(
      "Debout face à la machine, bras tendus en haut.",
      "Tirer les poignées vers le bas en fléchissant légèrement les hanches et les genoux.",
      "Finir les mains près des cuisses, puis remonter en se grandissant.",
    ),
    common_mistakes: b("Tirer uniquement avec les bras.", "Flexion des jambes trop importante (squat).", "Dos arrondi."),
    variations: b("Endurance.", "Fractionné court.", "Bras alternés."),
  },
  "Stepper / escalier": {
    aliases: ["Stepper", "Escalier", "Stairmaster"],
    description: "Montée de marches en continu : très bon pour les fessiers, les cuisses et le cardio, avec peu d'impact.",
    execution_cues: b(
      "Buste droit, regard devant.",
      "Poser tout le pied sur la marche et pousser avec le talon.",
      "Se tenir le moins possible aux barres.",
    ),
    common_mistakes: b("S'appuyer sur les barres.", "Rester sur la pointe des pieds.", "Vitesse trop élevée qui fait perdre la posture."),
    variations: b("Une marche sur deux.", "Montée latérale.", "Fractionné de vitesse."),
  },
  "Corde à sauter": {
    aliases: ["Corde", "Jump rope"],
    description: "Cardio intense et peu coûteux qui améliore la coordination, la vitesse de pied et le travail des mollets.",
    execution_cues: b(
      "Corde réglée : les poignées arrivent aux aisselles quand on marche au milieu.",
      "Coudes près du corps, rotation avec les poignets.",
      "Petits sauts sur l'avant des pieds, genoux souples.",
    ),
    common_mistakes: b("Sauter trop haut.", "Tourner avec les bras entiers.", "Atterrir sur les talons."),
    variations: b("Pieds alternés (footing).", "Double sauts (double unders).", "Intervalles 30 s / 30 s."),
  },
  Natation: {
    aliases: ["Piscine", "Nage"],
    description: "Sport complet et sans impact qui travaille tout le corps, l'endurance et la respiration. Idéal en récupération ou en cas de douleurs articulaires.",
    execution_cues: b(
      "Échauffement de 200 à 400 m à allure tranquille.",
      "Corps allongé et gainé à la surface, tête dans l'axe.",
      "Expirer sous l'eau, inspirer sur le côté (crawl) de façon régulière.",
      "Alterner les nages pour équilibrer le travail.",
    ),
    common_mistakes: b("Lever la tête pour respirer (les jambes coulent).", "Bloquer la respiration.", "Nager trop vite dès le départ."),
    variations: b("Crawl, brasse, dos.", "Fractionné (ex. 10 × 50 m).", "Pull-buoy (bras) ou planche (jambes)."),
  },
};

const INDEX: Map<string, { name: string; guide: ExerciseGuide }> = new Map();
for (const [name, guide] of Object.entries(EXERCISE_GUIDE)) {
  INDEX.set(normalize(name).replace(/œ/g, "oe"), { name, guide });
  guide.aliases?.forEach((a) => INDEX.set(normalize(a).replace(/œ/g, "oe"), { name, guide }));
}

/** Retrouve la fiche d'un exercice par son nom (ou un nom approchant connu). */
export function guideFor(name: string): ExerciseGuide | null {
  return INDEX.get(normalize(name).replace(/œ/g, "oe"))?.guide ?? null;
}
