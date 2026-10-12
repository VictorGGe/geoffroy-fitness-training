"use client";

import { jsPDF } from "jspdf";
import autoTable, { type CellInput, type RowInput } from "jspdf-autotable";
import { measurementEvolution, round1, sortWeighIns, weightSummary } from "./calc";
import {
  fmtDate,
  fmtDateLong,
  fmtKg,
  fmtNum,
  fmtRest,
  fmtSigned,
  fmtSignedKg,
  fullName,
  GOAL_LABELS,
  LEVEL_LABELS,
  num,
  SET_TYPE_LABELS,
} from "./format";
import type { Program, ProgramSession } from "./types";
import type { WeightData } from "@/components/WeightTracker";

type RGB = [number, number, number];
const ROYAL: RGB = [47, 85, 228];
const ROYAL_DARK: RGB = [29, 53, 145];
const INK: RGB = [11, 13, 18];
const INK_SOFT: RGB = [34, 40, 53];
const GREY: RGB = [107, 116, 135];
const LIGHT: RGB = [243, 245, 249];
const LINE: RGB = [222, 226, 234];
const GREEN: RGB = [22, 163, 74];
const AMBER: RGB = [217, 119, 6];

type Format = "a4" | "mobile";

/** Les polices standard PDF ne couvrent que WinAnsi : on remplace les caractères non couverts. */
function t(s: string | null | undefined): string {
  return (s ?? "")
    .replace(/[   ]/g, " ")
    .replace(/[−–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”«»]/g, '"')
    .replace(/★/g, "*")
    .replace(/✓/g, "OK")
    .replace(/→/g, "->")
    .replace(/[^\x00-\xFFŒœ€…•]/g, "");
}

interface Layout {
  doc: jsPDF;
  W: number;
  H: number;
  M: number; // marge
  mobile: boolean;
  fs: (n: number) => number; // taille de police adaptée
}

function createDoc(format: Format): Layout {
  const mobile = format === "mobile";
  const doc = mobile
    ? new jsPDF({ unit: "mm", format: [100, 210], orientation: "portrait" })
    : new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  return { doc, W, H, M: mobile ? 7 : 16, mobile, fs: (n) => (mobile ? Math.max(7, n * 0.9) : n) };
}

function header(L: Layout, subtitle: string) {
  const { doc, W, M, mobile } = L;
  const h = mobile ? 20 : 26;
  doc.setFillColor(...INK);
  doc.rect(0, 0, W, h, "F");
  doc.setFillColor(...ROYAL);
  doc.rect(0, h, W, 1.6, "F");

  // Monogramme
  const s = mobile ? 10 : 13;
  doc.setFillColor(...ROYAL);
  doc.roundedRect(M, (h - s) / 2, s, s, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(mobile ? 9 : 12);
  doc.text("GF", M + s / 2, h / 2 + (mobile ? 1.2 : 1.6), { align: "center" });

  doc.setFontSize(mobile ? 9.5 : 13);
  doc.text("GEOFFROY FITNESS TRAINING", M + s + 4, h / 2 - (mobile ? 0.8 : 1));
  doc.setFont("helvetica", "normal");
  doc.setFontSize(mobile ? 7 : 8.5);
  doc.setTextColor(157, 180, 255);
  doc.text(t(subtitle).toUpperCase(), M + s + 4, h / 2 + (mobile ? 3.2 : 4.2), { charSpace: 0.4 });
  return h + (mobile ? 7 : 10);
}

function footers(L: Layout) {
  const { doc, W, H, M } = L;
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.2);
    doc.line(M, H - 10, W - M, H - 10);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(L.fs(7.5));
    doc.setTextColor(...GREY);
    doc.text(t(`Geoffroy Fitness Training - document personnel - ${fmtDate(new Date().toISOString())}`), M, H - 6);
    doc.text(`${i} / ${n}`, W - M, H - 6, { align: "right" });
  }
}

/** Vérifie la place restante ; ajoute une page si besoin. */
function ensure(L: Layout, y: number, needed: number): number {
  if (y + needed > L.H - 16) {
    L.doc.addPage();
    return L.mobile ? 10 : 16;
  }
  return y;
}

function sectionTitle(L: Layout, y: number, title: string): number {
  const { doc, M, W } = L;
  y = ensure(L, y, 14);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(L.fs(11));
  doc.setTextColor(...INK);
  doc.text(t(title).toUpperCase(), M, y, { charSpace: 0.3 });
  doc.setDrawColor(...ROYAL);
  doc.setLineWidth(0.8);
  doc.line(M, y + 1.8, M + 14, y + 1.8);
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.2);
  doc.line(M + 14, y + 1.8, W - M, y + 1.8);
  return y + 7;
}

function paragraph(L: Layout, y: number, label: string | null, text: string, boxed = false): number {
  const { doc, M, W } = L;
  const width = W - 2 * M - (boxed ? 8 : 0);
  doc.setFontSize(L.fs(9.5));
  doc.setFont("helvetica", "normal");
  const lines = doc.splitTextToSize(t(text), width) as string[];
  const lh = L.fs(9.5) * 0.42;
  const blockH = lines.length * lh + (label ? 5 : 0) + (boxed ? 6 : 0);
  y = ensure(L, y, Math.min(blockH, 60));
  if (boxed) {
    doc.setFillColor(...LIGHT);
    doc.roundedRect(M, y - 1, W - 2 * M, blockH, 2, 2, "F");
    doc.setFillColor(...ROYAL);
    doc.rect(M, y - 1, 1, blockH, "F");
  }
  const x = M + (boxed ? 4 : 0);
  let cy = y + (boxed ? 3.5 : 0);
  if (label) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(L.fs(8));
    doc.setTextColor(...ROYAL_DARK);
    doc.text(t(label).toUpperCase(), x, cy + 1, { charSpace: 0.3 });
    cy += 5;
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(L.fs(9.5));
  doc.setTextColor(...INK_SOFT);
  for (const line of lines) {
    cy = ensure(L, cy, lh);
    doc.text(line, x, cy);
    cy += lh;
  }
  return cy + (boxed ? 4 : 2);
}

function fileName(...parts: string[]) {
  return (
    parts
      .join("_")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 90) + ".pdf"
  );
}

/* ================================================================== */
/* PROGRAMME                                                          */
/* ================================================================== */

export async function exportProgramPdf(program: Program, sessions: ProgramSession[], format: Format) {
  const L = createDoc(format);
  const { doc, M, W, mobile } = L;
  let y = header(L, "Programme d'entraînement");

  // Titre
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...INK);
  doc.setFontSize(mobile ? 15 : 22);
  const titleLines = doc.splitTextToSize(t(program.name), W - 2 * M) as string[];
  doc.text(titleLines, M, y + 2);
  y += titleLines.length * (mobile ? 6 : 8.5) + 1;

  if (program.clients) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(L.fs(11));
    doc.setTextColor(...ROYAL);
    doc.text(t(`Client : ${fullName(program.clients)}`), M, y);
    y += 6;
  }

  // Fiche d'identité du programme
  const facts: [string, string][] = [
    ["Objectif", program.goal ? GOAL_LABELS[program.goal] : "-"],
    ["Niveau", program.level ? LEVEL_LABELS[program.level] : "-"],
    ["Durée", program.duration_weeks ? `${program.duration_weeks} semaines` : "-"],
    ["Fréquence", program.sessions_per_week != null ? `${program.sessions_per_week} séances / semaine` : `${sessions.length} séance(s)`],
  ];
  const cols = mobile ? 2 : 4;
  const boxW = (W - 2 * M - (cols - 1) * 3) / cols;
  const boxH = mobile ? 11 : 13;
  facts.forEach(([k, v], i) => {
    const cx = M + (i % cols) * (boxW + 3);
    const cy = y + Math.floor(i / cols) * (boxH + 3);
    doc.setFillColor(...LIGHT);
    doc.roundedRect(cx, cy, boxW, boxH, 1.8, 1.8, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(L.fs(7));
    doc.setTextColor(...GREY);
    doc.text(t(k).toUpperCase(), cx + 3, cy + 4.3, { charSpace: 0.3 });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(L.fs(9.5));
    doc.setTextColor(...INK);
    doc.text(t(v), cx + 3, cy + (mobile ? 8.6 : 9.8), { maxWidth: boxW - 5 });
  });
  y += Math.ceil(facts.length / cols) * (boxH + 3) + 4;

  if (program.description) y = paragraph(L, y, "Description", program.description, true) + 2;
  if (program.instructions) y = paragraph(L, y, "Consignes particulières", program.instructions, true) + 2;

  // Séances
  sessions.forEach((s, si) => {
    const exs = s.program_exercises ?? [];
    y = ensure(L, y + 2, 30);
    // Bandeau de séance
    doc.setFillColor(...ROYAL);
    doc.roundedRect(M, y, W - 2 * M, mobile ? 8 : 9, 1.5, 1.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(L.fs(11));
    doc.setTextColor(255, 255, 255);
    doc.text(t(`${si + 1}. ${s.name}`).toUpperCase(), M + 3, y + (mobile ? 5.4 : 6), { charSpace: 0.3 });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(L.fs(8));
    doc.text(`${exs.length} exercice(s)`, W - M - 3, y + (mobile ? 5.4 : 6), { align: "right" });
    y += mobile ? 10 : 11;

    if (s.notes) y = paragraph(L, y + 2, null, s.notes) + 1;

    if (!exs.length) {
      doc.setFontSize(L.fs(9));
      doc.setTextColor(...GREY);
      doc.text("Aucun exercice.", M, y + 3);
      y += 8;
      return;
    }

    const body: RowInput[] = [];
    exs.forEach((pe, i) => {
      const name = t(pe.exercises?.name ?? "Exercice");
      const type = pe.set_type && pe.set_type !== "travail" ? ` (${t(SET_TYPE_LABELS[pe.set_type])})` : "";
      const load = num(pe.load_kg) !== null ? t(`${fmtNum(pe.load_kg, 2)} kg`) : "-";
      const rpe = num(pe.rpe) !== null ? t(fmtNum(pe.rpe)) : "-";
      const rir = pe.rir != null ? String(pe.rir) : "-";
      const rest = pe.rest_seconds != null ? t(fmtRest(pe.rest_seconds)) : "-";
      if (mobile) {
        body.push([
          { content: `${i + 1}. ${name}${type}\n${pe.sets ?? "-"} x ${t(pe.reps) || "-"}${pe.tempo ? `  - tempo ${t(pe.tempo)}` : ""}`, styles: { fontStyle: "bold" } },
          load,
          `${rpe} / ${rir}`,
          rest,
        ]);
      } else {
        body.push([
          { content: String(i + 1), styles: { textColor: GREY } },
          { content: `${name}${type}`, styles: { fontStyle: "bold" } },
          pe.sets != null ? String(pe.sets) : "-",
          t(pe.reps) || "-",
          load,
          rpe,
          rir,
          rest,
          t(pe.tempo) || "-",
        ]);
      }
      const notes = [pe.technical_cues && `Consignes : ${pe.technical_cues}`, pe.comments && `Note : ${pe.comments}`].filter(Boolean).join("\n");
      if (notes) {
        body.push([
          {
            content: t(notes),
            colSpan: mobile ? 4 : 9,
            styles: { fontStyle: "italic", textColor: [70, 78, 95], fillColor: [248, 249, 252], fontSize: L.fs(8), cellPadding: { top: 1.2, bottom: 2.2, left: mobile ? 2 : 10, right: 2 } },
          } as CellInput,
        ]);
      }
    });

    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M, bottom: 16 },
      head: [mobile ? ["Exercice", "Charge", "RPE/RIR", "Repos"] : ["#", "Exercice", "Séries", "Reps", "Charge", "RPE", "RIR", "Repos", "Tempo"].map(t)],
      body,
      theme: "plain",
      styles: { font: "helvetica", fontSize: L.fs(9), textColor: INK_SOFT, cellPadding: mobile ? 1.6 : 2.2, lineColor: LINE, valign: "middle", overflow: "linebreak" },
      headStyles: { fillColor: INK, textColor: [255, 255, 255], fontStyle: "bold", fontSize: L.fs(7.5) },
      bodyStyles: { lineWidth: { bottom: 0.15 } },
      columnStyles: mobile
        ? { 0: { cellWidth: "auto" }, 1: { cellWidth: 16, halign: "center" }, 2: { cellWidth: 14, halign: "center" }, 3: { cellWidth: 14, halign: "center" } }
        : {
            0: { cellWidth: 7, halign: "center" },
            1: { cellWidth: "auto" },
            2: { cellWidth: 14, halign: "center" },
            3: { cellWidth: 16, halign: "center" },
            4: { cellWidth: 19, halign: "center" },
            5: { cellWidth: 11, halign: "center" },
            6: { cellWidth: 11, halign: "center" },
            7: { cellWidth: 17, halign: "center" },
            8: { cellWidth: 16, halign: "center" },
          },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  });

  // Légende
  y = ensure(L, y, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(L.fs(7.5));
  doc.setTextColor(...GREY);
  const legend =
    "RPE : effort perçu sur 10. RIR : répétitions en réserve en fin de série. Charges indicatives : à ajuster selon la forme du jour et la qualité d'exécution.";
  doc.text(doc.splitTextToSize(t(legend), W - 2 * M), M, y);

  footers(L);
  doc.save(fileName("Programme", program.clients ? fullName(program.clients) : "modele", program.name, mobile ? "mobile" : "A4"));
}

/* ================================================================== */
/* BILAN DE PERTE DE POIDS                                            */
/* ================================================================== */

function drawWeightChart(L: Layout, y: number, data: WeightData, height: number): number {
  const { doc, M, W, mobile } = L;
  const sorted = sortWeighIns(data.weighIns);
  const summary = weightSummary(data.weighIns, data.goal);
  const x0 = M + (mobile ? 9 : 12);
  const x1 = W - M - 2;
  const y0 = y;
  const y1 = y + height;

  const values = sorted.map((w) => num(w.weight_kg)!);
  const refs = [summary.targetWeight, summary.startFromGoal ? summary.startWeight : null].filter((v): v is number => v !== null);
  let min = Math.min(...values, ...refs);
  let max = Math.max(...values, ...refs);
  if (max - min < 2) {
    min -= 1;
    max += 1;
  }
  // Graduations "rondes" (pas de 1, 2, 5, 10… kg)
  const raw = (max - min) / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 5, 10].map((k) => k * mag).find((v) => v >= raw) ?? 10 * mag;
  min = Math.floor((min - step * 0.3) / step) * step;
  max = Math.ceil((max + step * 0.3) / step) * step;
  const steps = Math.round((max - min) / step);

  const times = sorted.map((w) => new Date(w.measured_on + "T12:00:00").getTime());
  const tMin = times[0];
  const tMax = times[times.length - 1];
  const px = (tm: number) => (tMax === tMin ? (x0 + x1) / 2 : x0 + ((tm - tMin) / (tMax - tMin)) * (x1 - x0));
  const py = (v: number) => y1 - ((v - min) / (max - min)) * (y1 - y0);

  // Fond + grille
  doc.setFillColor(...LIGHT);
  doc.roundedRect(M, y0 - 4, W - 2 * M, height + 12, 2, 2, "F");
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.15);
  doc.setFontSize(L.fs(7));
  doc.setTextColor(...GREY);
  for (let i = 0; i <= steps; i++) {
    const v = min + step * i;
    const yy = py(v);
    doc.line(x0, yy, x1, yy);
    doc.text(t(fmtNum(v)), x0 - 1.5, yy + 1, { align: "right" });
  }

  // Objectif (ligne pointillée verte)
  if (summary.targetWeight !== null) {
    doc.setDrawColor(...GREEN);
    doc.setLineWidth(0.4);
    doc.setLineDashPattern([1.5, 1.2], 0);
    doc.line(x0, py(summary.targetWeight), x1, py(summary.targetWeight));
    doc.setLineDashPattern([], 0);
    doc.setTextColor(...GREEN);
    doc.text(t(`Objectif ${fmtKg(summary.targetWeight)}`), x1, py(summary.targetWeight) - 1.2, { align: "right" });
  }

  // Courbe des pesées réelles
  doc.setDrawColor(...ROYAL);
  doc.setLineWidth(0.7);
  for (let i = 1; i < sorted.length; i++) {
    doc.line(px(times[i - 1]), py(values[i - 1]), px(times[i]), py(values[i]));
  }
  doc.setFillColor(...ROYAL);
  sorted.forEach((_, i) => doc.circle(px(times[i]), py(values[i]), mobile ? 0.7 : 0.9, "F"));

  // Dates
  doc.setTextColor(...GREY);
  doc.setFontSize(L.fs(7));
  const labelIdx = sorted.length <= 2 ? sorted.map((_, i) => i) : [0, Math.floor((sorted.length - 1) / 2), sorted.length - 1];
  [...new Set(labelIdx)].forEach((i) => {
    const align = i === 0 ? "left" : i === sorted.length - 1 ? "right" : "center";
    doc.text(t(fmtDate(sorted[i].measured_on)), px(times[i]), y1 + 4.5, { align: sorted.length === 1 ? "center" : align });
  });
  return y1 + 12;
}

export async function exportWeightPdf(data: WeightData, format: Format) {
  const L = createDoc(format);
  const { doc, M, W, mobile } = L;
  const summary = weightSummary(data.weighIns, data.goal);
  const sorted = sortWeighIns(data.weighIns);
  let y = header(L, "Bilan de suivi du poids");

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...INK);
  doc.setFontSize(mobile ? 15 : 22);
  doc.text(t(fullName(data.client)), M, y + 2);
  y += mobile ? 7 : 9;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(L.fs(10));
  doc.setTextColor(...GREY);
  doc.text(t(`Période de suivi : du ${fmtDateLong(summary.startDate)} au ${fmtDateLong(summary.lastDate)}`), M, y, { maxWidth: W - 2 * M });
  y += mobile ? 9 : 8;

  // Indicateurs
  const kpis: [string, string, RGB?][] = [
    ["Poids de départ", fmtKg(summary.startWeight)],
    ["Poids actuel", fmtKg(summary.currentWeight), ROYAL],
    ["Objectif", fmtKg(summary.targetWeight)],
    ["Évolution totale", fmtSignedKg(summary.totalChange)],
  ];
  const cols = mobile ? 2 : 4;
  const bw = (W - 2 * M - (cols - 1) * 3) / cols;
  const bh = mobile ? 14 : 17;
  kpis.forEach(([k, v, accent], i) => {
    const cx = M + (i % cols) * (bw + 3);
    const cy = y + Math.floor(i / cols) * (bh + 3);
    if (accent) doc.setFillColor(...ROYAL);
    else doc.setFillColor(...LIGHT);
    doc.roundedRect(cx, cy, bw, bh, 2, 2, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(L.fs(7));
    doc.setTextColor(...(accent ? ([210, 222, 255] as RGB) : GREY));
    doc.text(t(k).toUpperCase(), cx + 3, cy + 4.8, { charSpace: 0.3 });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(mobile ? 12 : 15);
    doc.setTextColor(...(accent ? ([255, 255, 255] as RGB) : INK));
    doc.text(t(v), cx + 3, cy + (mobile ? 11 : 13));
  });
  y += Math.ceil(kpis.length / cols) * (bh + 3) + 3;

  // Progression
  if (summary.progressRaw !== null) {
    y = ensure(L, y, 16);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(L.fs(9));
    doc.setTextColor(...INK);
    doc.text(t(`Progression vers l'objectif : ${summary.progressRaw} %`), M, y + 3);
    const statusLabel =
      summary.status === "reached"
        ? "Objectif atteint"
        : summary.status === "opposite"
          ? "Évolution inverse à l'objectif"
          : `Reste ${fmtKg(summary.remaining)}`;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...(summary.status === "reached" ? GREEN : summary.status === "opposite" ? AMBER : GREY));
    doc.text(t(statusLabel), W - M, y + 3, { align: "right" });
    y += 6;
    doc.setFillColor(...LINE);
    doc.roundedRect(M, y, W - 2 * M, 3, 1.5, 1.5, "F");
    const pw = ((W - 2 * M) * (summary.progressBar ?? 0)) / 100;
    if (pw > 0) {
      doc.setFillColor(...(summary.status === "reached" ? GREEN : ROYAL));
      doc.roundedRect(M, y, Math.max(pw, 3), 3, 1.5, 1.5, "F");
    }
    y += 9;
  }

  // Objectifs intermédiaires
  if (data.milestones.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(L.fs(8.5));
    doc.setTextColor(...INK_SOFT);
    const txt = "Objectifs intermédiaires : " + data.milestones.map((m) => `${m.label ? m.label + " " : ""}${fmtKg(m.weight)}${m.target_date ? ` (${fmtDate(m.target_date)})` : ""}`).join(" ; ");
    const lines = doc.splitTextToSize(t(txt), W - 2 * M) as string[];
    y = ensure(L, y, lines.length * 4);
    doc.text(lines, M, y);
    y += lines.length * 4 + 3;
  }

  // Graphique
  if (sorted.length) {
    y = sectionTitle(L, y + 2, "Évolution du poids");
    const ch = mobile ? 45 : 62;
    y = ensure(L, y, ch + 16);
    y = drawWeightChart(L, y + 4, data, ch);
    doc.setFontSize(L.fs(7));
    doc.setTextColor(...GREY);
    doc.text(t("Points : pesées réellement enregistrées. Ligne pointillée : objectif (non une mesure)."), M, y);
    y += 6;
  }

  // Mensurations
  const evo = measurementEvolution(data.measurements).filter((e) => e.count > 0);
  if (evo.length) {
    y = sectionTitle(L, y + 2, "Mensurations");
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M, bottom: 16 },
      head: [["Mesure", "Première", "Dernière", "Écart"].map(t)],
      body: evo.map((e) => [
        t(e.label),
        t(`${fmtNum(e.first)} cm${mobile ? "" : ` (${fmtDate(e.firstDate)})`}`),
        t(`${fmtNum(e.last)} cm${mobile ? "" : ` (${fmtDate(e.lastDate)})`}`),
        t(e.change !== null ? fmtSigned(e.change, "cm") : "-"),
      ]),
      theme: "plain",
      styles: { font: "helvetica", fontSize: L.fs(8.8), textColor: INK_SOFT, cellPadding: mobile ? 1.5 : 2.2, lineColor: LINE },
      headStyles: { fillColor: INK, textColor: [255, 255, 255], fontStyle: "bold", fontSize: L.fs(7.5) },
      bodyStyles: { lineWidth: { bottom: 0.15 } },
      columnStyles: { 0: { fontStyle: "bold" }, 3: { halign: "right", fontStyle: "bold" } },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  }

  // Historique des pesées
  if (sorted.length) {
    y = sectionTitle(L, y + 2, "Historique des pesées");
    const rows = sorted.map((w, i) => {
      const v = num(w.weight_kg)!;
      const prev = i > 0 ? num(sorted[i - 1].weight_kg)! : null;
      return [
        t(fmtDate(w.measured_on)),
        t(fmtKg(v)),
        t(prev !== null ? fmtSignedKg(round1(v - prev)) : "-"),
        ...(mobile ? [] : [t(w.comment ?? "")]),
      ];
    });
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M, bottom: 16 },
      head: [(mobile ? ["Date", "Poids", "Écart"] : ["Date", "Poids", "Écart précédent", "Commentaire"]).map(t)],
      body: rows.reverse(),
      theme: "plain",
      styles: { font: "helvetica", fontSize: L.fs(8.5), textColor: INK_SOFT, cellPadding: mobile ? 1.4 : 1.9, lineColor: LINE },
      headStyles: { fillColor: INK, textColor: [255, 255, 255], fontStyle: "bold", fontSize: L.fs(7.5) },
      bodyStyles: { lineWidth: { bottom: 0.15 } },
      columnStyles: { 1: { fontStyle: "bold" } },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  }

  // Commentaires du coach (dernier bilan)
  const last = data.reviews[0];
  if (last) {
    y = sectionTitle(L, y + 2, `Commentaires du coach - bilan du ${fmtDate(last.review_date)}`);
    if (last.coach_comments) y = paragraph(L, y, "Commentaires", last.coach_comments, true) + 1;
    if (last.positives) y = paragraph(L, y, "Points positifs", last.positives, true) + 1;
    if (last.difficulties) y = paragraph(L, y, "Difficultés rencontrées", last.difficulties, true) + 1;
    if (last.next_goals) y = paragraph(L, y, "Objectifs pour la période suivante", last.next_goals, true) + 1;
  }

  y = ensure(L, y + 2, 12);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(L.fs(7.5));
  doc.setTextColor(...GREY);
  doc.text(
    doc.splitTextToSize(
      t("Ce document reflète uniquement les mesures réellement enregistrées. Il ne constitue pas une prévision : l'évolution future du poids n'est pas garantie."),
      W - 2 * M,
    ),
    M,
    y,
  );

  footers(L);
  doc.save(fileName("Bilan-poids", fullName(data.client), summary.lastDate ?? "", mobile ? "mobile" : "A4"));
}

