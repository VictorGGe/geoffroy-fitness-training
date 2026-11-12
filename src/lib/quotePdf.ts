"use client";

/** PDF du devis (page 1 : devis, page 2 : conditions générales de vente). */
import { jsPDF } from "jspdf";
import { CGV, CGV_PREAMBLE, COACH, eur, fmtDateFr, lineTotal, type Quote } from "./quotes";

type RGB = [number, number, number];
const BLACK: RGB = [12, 12, 14];
const BLUE: RGB = [77, 157, 224];
const BLUE_SOFT: RGB = [232, 241, 251];
const TEXT: RGB = [20, 22, 28];
const GREY: RGB = [120, 126, 138];
const LINE: RGB = [214, 218, 226];

/** Polices PDF standard : on remplace les caractères hors WinAnsi. */
function t(s: string | null | undefined): string {
  return (s ?? "")
    .replace(/[   ]/g, " ")
    .replace(/[−–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x00-\xFFŒœ€…•]/g, "");
}

const W = 210;
const H = 297;
const M = 16;
const FOOTER_H = 14;

/** Position du numéro de page de chaque page (écrit à la fin, quand on connaît le total). */
type PageMark = { y: number; dark: boolean };

function band(doc: jsPDF, kicker: string, title: string, right: string[], marks: PageMark[]) {
  doc.setFillColor(...BLACK);
  doc.rect(0, 0, W, 36, "F");
  doc.setFillColor(...BLUE);
  doc.rect(0, 36, W, 1.3, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text(t(kicker), M, 14, { charSpace: 1.25 });
  doc.setFontSize(24);
  doc.text(t(title), M, 27);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(205, 208, 214);
  right.forEach((line, i) => doc.text(t(line), W - M, 13 + i * 4.6, { align: "right" }));
  marks.push({ y: 13 + right.length * 4.6 + 1.5, dark: true });
}

/** En-tête réduit des pages de suite. */
function miniBand(doc: jsPDF, label: string, marks: PageMark[]) {
  doc.setFillColor(...BLACK);
  doc.rect(0, 0, W, 14, "F");
  doc.setFillColor(...BLUE);
  doc.rect(0, 14, W, 1, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(t(label), M, 9);
  marks.push({ y: 9, dark: true });
}

function footer(doc: jsPDF) {
  doc.setFillColor(...BLUE);
  doc.rect(0, H - FOOTER_H - 1.3, W, 1.3, "F");
  doc.setFillColor(...BLACK);
  doc.rect(0, H - FOOTER_H, W, FOOTER_H, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(220, 222, 228);
  doc.text(t(COACH.footer), W / 2, H - FOOTER_H / 2 + 1.2, { align: "center" });
}

function numberedTitle(doc: jsPDF, y: number, n: number, title: string): number {
  doc.setFillColor(...BLACK);
  doc.circle(M + 3, y - 1.4, 3, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(String(n), M + 3, y - 0.2, { align: "center" });
  doc.setTextColor(...TEXT);
  doc.setFontSize(12.5);
  doc.text(t(title), M + 9, y);
  return y + 7;
}

function partyCard(doc: jsPDF, x: number, y: number, w: number, h: number, title: string, rows: { label: string; lines: string[]; empty?: boolean }[]) {
  doc.setFillColor(...BLUE_SOFT);
  doc.rect(x, y, w, h, "F");
  doc.setFillColor(...BLACK);
  doc.rect(x, y, w, 1.1, "F");
  doc.setTextColor(...TEXT);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(t(title), x + 6, y + 9);
  let yy = y + 15;
  for (const r of rows) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.3);
    doc.setTextColor(...GREY);
    doc.text(t(r.label.toUpperCase()), x + 6, yy);
    yy += 3.8;
    if (r.empty) {
      // Champ à remplir par le client
      textField(doc, `client_${r.label.normalize("NFD").replace(/[^\w]/g, "").toLowerCase()}`, x + 6, yy - 3.1, w - 12, 5, { fontSize: 8 });
      yy += 5.6;
      continue;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.6);
    doc.setTextColor(...TEXT);
    for (const l of r.lines) {
      const parts = doc.splitTextToSize(t(l), w - 12) as string[];
      for (const p of parts) {
        doc.text(p, x + 6, yy);
        yy += 4.2;
      }
    }
    yy += 1.6;
  }
}

/* ------------------------------------------------------------------ */
/* Champs à remplir par le client (PDF formulaire)                      */
/* ------------------------------------------------------------------ */

/**
 * Les champs sont dessinés ici puis ajoutés à la fin avec pdf-lib, qui crée des champs
 * de formulaire complets (police, apparence) lisibles par Acrobat, Aperçu, iPhone et Android.
 */
type FieldSpec = { kind: "text" | "check"; name: string; page: number; x: number; y: number; w: number; h: number; fontSize?: number; multiline?: boolean };
let FIELDS: FieldSpec[] = [];

/** Zone de saisie : fond bleu clair + champ texte remplissable. */
function textField(doc: jsPDF, name: string, x: number, y: number, w: number, h: number, opts: { fontSize?: number; multiline?: boolean } = {}) {
  doc.setFillColor(246, 249, 254);
  doc.setDrawColor(190, 205, 226);
  doc.setLineWidth(0.25);
  doc.rect(x, y, w, h, "FD");
  FIELDS.push({ kind: "text", name, page: doc.getCurrentPageInfo().pageNumber, x, y, w, h, fontSize: opts.fontSize ?? 9, multiline: opts.multiline });
}

function checkBox(doc: jsPDF, name: string, x: number, y: number, size = 3.6) {
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...GREY);
  doc.setLineWidth(0.3);
  doc.rect(x, y, size, size, "FD");
  FIELDS.push({ kind: "check", name, page: doc.getCurrentPageInfo().pageNumber, x, y, w: size, h: size });
}

async function addFormFields(base: ArrayBuffer): Promise<Uint8Array> {
  const { PDFDocument, PDFName, PDFString, StandardFonts, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.load(base);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const form = pdf.getForm();
  const k = 72 / 25.4;
  for (const f of FIELDS) {
    const page = pdf.getPage(f.page - 1);
    const box = { x: f.x * k, y: (H - f.y - f.h) * k, width: f.w * k, height: f.h * k, borderWidth: 0.7 };
    if (f.kind === "text") {
      const tf = form.createTextField(f.name);
      if (f.multiline) tf.enableMultiline();
      tf.addToPage(page, { ...box, font, textColor: rgb(0.08, 0.09, 0.11), backgroundColor: rgb(0.965, 0.976, 0.996), borderColor: rgb(0.745, 0.804, 0.886) });
      tf.setFontSize(f.fontSize ?? 9);
    } else {
      const cb = form.createCheckBox(f.name);
      cb.addToPage(page, { ...box, textColor: rgb(0.1, 0.43, 0.9), backgroundColor: rgb(1, 1, 1), borderColor: rgb(0.47, 0.49, 0.54) });
    }
  }
  form.updateFieldAppearances(font);
  // Police par défaut du formulaire (exigée par certains lecteurs pour afficher le texte saisi)
  const acro = form.acroForm.dict;
  acro.set(PDFName.of("DR"), pdf.context.obj({ Font: { Helvetica: font.ref } }));
  acro.set(PDFName.of("DA"), PDFString.of("/Helvetica 0 Tf 0 g"));
  return pdf.save();
}

/** Date courte « 12/11/2026 » (heure de Paris). */
function fmtShort(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));
}

/** Signature (image PNG) dans son cadre. */
function signatureBox(doc: jsPDF, png: string, x: number, y: number, w: number, h: number) {
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(190, 205, 226);
  doc.setLineWidth(0.25);
  doc.rect(x, y, w, h, "FD");
  try {
    const p = doc.getImageProperties(png);
    const ratio = p.width / p.height;
    let ih = h - 1;
    let iw = ih * ratio;
    if (iw > w - 2) {
      iw = w - 2;
      ih = iw / ratio;
    }
    doc.addImage(png, "PNG", x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
  } catch {
    /* image illisible : cadre laissé vide */
  }
}

/** Ligne « Le 12/11/2026 · Mention : Bon pour accord » une fois signé. */
function filledLine(doc: jsPDF, x: number, y: number, date: string) {
  doc.setFontSize(6.3);
  doc.setTextColor(...GREY);
  doc.text("Le", x, y + 3.4);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...TEXT);
  doc.text(date, x + 4, y + 3.4);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.3);
  doc.setTextColor(...GREY);
  doc.text("Mention", x + 31, y + 3.4);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...TEXT);
  doc.text(t("Bon pour accord"), x + 41, y + 3.4);
  doc.setFont("helvetica", "normal");
}

/** Case cochée (dessinée). */
function tick(doc: jsPDF, x: number, y: number, size = 3.4) {
  doc.setFillColor(26, 111, 230);
  doc.rect(x, y, size, size, "F");
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.5);
  doc.line(x + 0.7, y + size * 0.55, x + size * 0.42, y + size - 0.7);
  doc.line(x + size * 0.42, y + size - 0.7, x + size - 0.6, y + 0.7);
}

function dotted(doc: jsPDF, x1: number, x2: number, y: number) {
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.3);
  doc.setLineDashPattern([0.4, 0.9], 0);
  doc.line(x1, y, x2, y);
  doc.setLineDashPattern([], 0);
}

/** Construit le PDF (avec ses champs à remplir) et renvoie son contenu. */
export async function buildQuotePdf(quote: Quote, client: { first_name: string; last_name: string }): Promise<{ bytes: Uint8Array; fileName: string }> {
  FIELDS = [];
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const clientName = `${client.first_name} ${client.last_name.toUpperCase()}`;
  const total = quote.items.reduce((s, i) => s + lineTotal(i), 0);
  const marks: PageMark[] = [];
  const LIMIT = H - FOOTER_H - 4;
  /** Passe sur une page de suite si la place manque (le devis reste lisible même très long). */
  const room = (needed: number) => {
    if (y + needed <= LIMIT) return;
    footer(doc);
    doc.addPage();
    miniBand(doc, `Devis ${quote.number} (suite)`, marks);
    y = 26;
  };

  /* ---------------- Page 1 : devis ---------------- */
  band(doc, "PERSONAL  TRAINING", "Devis", [`N° ${quote.number}`, `Émis le ${fmtDateFr(quote.issued_on)}`, `Valable jusqu'au ${fmtDateFr(quote.valid_until)}`], marks);

  // Coach / Client
  const cardY = 46;
  const cardW = (W - 2 * M - 6) / 2;
  const cardH = 51;
  partyCard(doc, M, cardY, cardW, cardH, "Le Coach", [
    { label: "Nom", lines: [COACH.name] },
    { label: "Lieu des séances", lines: [COACH.placeLine1, COACH.placeLine2] },
    { label: "SIRET", lines: [COACH.siret] },
  ]);
  partyCard(doc, M + cardW + 6, cardY, cardW, cardH, "Le Client", [
    { label: "Nom", lines: [clientName] },
    { label: "Email", lines: [quote.client_email ?? ""], empty: !quote.client_email },
    { label: "Adresse", lines: [quote.client_address ?? ""], empty: !quote.client_address },
    { label: "Téléphone", lines: [quote.client_phone ?? ""], empty: !quote.client_phone },
  ]);

  // 1. Détail
  let y = 0;
  y = numberedTitle(doc, cardY + cardH + 11, 1, "Détail de la prestation");
  if (quote.intro?.trim()) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.4);
    doc.setTextColor(60, 64, 72);
    const lines = doc.splitTextToSize(t(quote.intro.trim()), W - 2 * M) as string[];
    doc.text(lines, M, y);
    y += lines.length * 4 + 3;
  }

  // Tableau
  const cols = { qty: M + 118, unit: M + 152, total: W - M - 4 };
  doc.setFillColor(...BLACK);
  doc.rect(M, y, W - 2 * M, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.8);
  doc.setTextColor(255, 255, 255);
  doc.text("DÉSIGNATION", M + 5, y + 5.2);
  doc.text("QTÉ", cols.qty, y + 5.2, { align: "center" });
  doc.text("PRIX UNITAIRE", cols.unit, y + 5.2, { align: "right" });
  doc.text("TOTAL", cols.total, y + 5.2, { align: "right" });
  y += 8;
  for (const item of quote.items) {
    const labelLines = doc.splitTextToSize(t(item.label), 100) as string[];
    const subLines = item.sub ? (doc.splitTextToSize(t(item.sub), 100) as string[]) : [];
    const rowH = 5 + labelLines.length * 4.2 + subLines.length * 3.6 + 2.5;
    room(rowH);
    let ry = y + 6.5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.6);
    doc.setTextColor(...TEXT);
    doc.text(labelLines, M + 5, ry);
    doc.setFont("helvetica", "normal");
    doc.text(String(item.qty).replace(".", ","), cols.qty, ry, { align: "center" });
    doc.text(item.included ? "Inclus" : t(eur(item.unit_price)), cols.unit, ry, { align: "right" });
    doc.text(t(eur(lineTotal(item))), cols.total, ry, { align: "right" });
    ry += labelLines.length * 4.2 - 0.6;
    if (subLines.length) {
      doc.setFontSize(6.8);
      doc.setTextColor(...GREY);
      doc.text(subLines, M + 5, ry);
    }
    y += rowH;
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.3);
    doc.line(M, y, W - M, y);
  }

  // Totaux
  y += 5;
  room(26);
  const tx = M + 112;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(80, 84, 92);
  doc.text("Total HT", tx, y);
  doc.text(t(eur(total)), cols.total, y, { align: "right" });
  y += 5;
  doc.text("TVA", tx, y);
  doc.text("Non applicable", cols.total, y, { align: "right" });
  y += 4;
  doc.setFillColor(...BLUE_SOFT);
  doc.rect(tx - 4, y, W - M - (tx - 4), 11, "F");
  doc.setFillColor(...BLUE);
  doc.rect(tx - 4, y, 1, 11, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...TEXT);
  doc.text("Total à payer", tx, y + 7.2);
  doc.setFontSize(14);
  doc.text(t(eur(total)), cols.total, y + 7.6, { align: "right" });
  doc.setFont("helvetica", "italic");
  doc.setFontSize(6.8);
  doc.setTextColor(...GREY);
  doc.text(t(COACH.vat), M, y + 7);
  y += 17;

  // 2. Conditions
  room(30);
  y = numberedTitle(doc, y, 2, "Conditions");
  doc.setFontSize(7.8);
  for (const c of quote.conditions.filter((c) => c.label.trim() || c.value.trim())) {
    const vLines = doc.splitTextToSize(t(c.value), W - 2 * M - 44) as string[];
    room(vLines.length * 3.8 + 4);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...TEXT);
    doc.text(t(c.label), M, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 64, 72);
    doc.text(vLines, M + 44, y);
    y += Math.max(1, vLines.length) * 3.7 + 1.1;
    dotted(doc, M, W - M, y - 2.2);
    y += 1.9;
  }
  doc.setFontSize(6.8);
  doc.setTextColor(...GREY);
  doc.text("La prestation est soumise au contrat de Personal Training et à ses conditions générales de vente (annexe, page 2).", M, y + 1);
  y += 7.5;

  // Bon pour accord (champs remplissables par le client)
  room(30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...TEXT);
  doc.text("Bon pour accord", M, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.4);
  doc.setTextColor(...BLUE);
  if (!quote.client_signed_at || !quote.coach_signed_at) {
    doc.text(t(quote.client_signed_at ? "Signé en ligne par le client." : "Signature en ligne via le lien reçu, ou directement dans les zones bleues de ce PDF."), M + 31, y);
  }
  y += 5;
  const sigW = (W - 2 * M - 16) / 2;
  const sigX2 = M + sigW + 16;
  doc.setFontSize(6.3);
  doc.setTextColor(...GREY);
  doc.text("SIGNATURE DU CLIENT", M, y);
  doc.text("SIGNATURE DU COACH", sigX2, y);
  const fy = y + 14.5;
  const clientDate = quote.client_signed_at ? fmtShort(quote.client_signed_at) : null;
  const coachDate = quote.coach_signed_at ? fmtShort(quote.coach_signed_at) : null;
  // Client : signée en ligne → image de la signature ; sinon champs à remplir
  if (quote.client_signature && clientDate) {
    signatureBox(doc, quote.client_signature, M, y + 1.5, sigW, 11);
    filledLine(doc, M, fy, clientDate);
    tick(doc, M, fy + 7.2);
  } else {
    textField(doc, "client_signature", M, y + 1.5, sigW, 11, { fontSize: 12 });
    doc.setFontSize(6.3);
    doc.setTextColor(...GREY);
    doc.text("Le", M, fy + 3.4);
    textField(doc, "client_date", M + 4, fy, 24, 5, { fontSize: 8 });
    doc.text("Mention", M + 31, fy + 3.4);
    textField(doc, "client_mention", M + 41, fy, sigW - 41, 5, { fontSize: 8 });
    checkBox(doc, "client_accepte_cgv", M, fy + 7.2, 3.4);
  }
  doc.setFontSize(6.6);
  doc.setTextColor(60, 64, 72);
  doc.text(t("J'ai lu et j'accepte les conditions générales de vente (page 2)"), M + 5, fy + 9.8);
  if (clientDate) {
    doc.setFontSize(5.8);
    doc.setTextColor(...GREY);
    doc.text(t(`Signé électroniquement par ${quote.client_signed_name ?? clientName} le ${clientDate}.`), M, fy + 13.4);
  }
  // Coach
  if (quote.coach_signature && coachDate) {
    signatureBox(doc, quote.coach_signature, sigX2, y + 1.5, sigW, 11);
    filledLine(doc, sigX2, fy, coachDate);
  } else {
    textField(doc, "coach_signature", sigX2, y + 1.5, sigW, 11, { fontSize: 12 });
    doc.setFontSize(6.3);
    doc.setTextColor(...GREY);
    doc.text("Le", sigX2, fy + 3.4);
    textField(doc, "coach_date", sigX2 + 4, fy, 24, 5, { fontSize: 8 });
    doc.text("Mention", sigX2 + 31, fy + 3.4);
    textField(doc, "coach_mention", sigX2 + 41, fy, sigW - 41, 5, { fontSize: 8 });
  }
  doc.setFontSize(6.2);
  doc.setTextColor(...GREY);
  doc.text(t(COACH.name), sigX2, fy + 9.8);
  footer(doc);

  /* ---------------- Page 2 : CGV ---------------- */
  doc.addPage();
  band(doc, "ANNEXE  AU  DEVIS", "Conditions générales de vente", [], marks);
  y = 46;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.4);
  const preLines = doc.splitTextToSize(t(`Préambule — ${CGV_PREAMBLE}`), W - 2 * M - 14) as string[];
  const preH = preLines.length * 3.6 + 8;
  doc.setFillColor(...BLUE_SOFT);
  doc.rect(M, y, W - 2 * M, preH, "F");
  doc.setFillColor(...BLUE);
  doc.rect(M, y, 1, preH, "F");
  doc.setTextColor(40, 44, 52);
  doc.text(preLines, M + 7, y + 6);
  y += preH + 7;

  CGV.forEach((sec, i) => {
    y = numberedTitle(doc, y, i + 1, sec.title) - 1.5;
    for (const b of sec.blocks) {
      if (b.sub) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.4);
        doc.setTextColor(...TEXT);
        doc.text(t(b.sub), M, y);
        y += 3.6;
      }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.2);
      doc.setTextColor(60, 64, 72);
      const lines = doc.splitTextToSize(t(b.text), W - 2 * M) as string[];
      doc.text(lines, M, y, { maxWidth: W - 2 * M, align: "justify" });
      y += lines.length * 3.35 + 1.2;
    }
    y += 2.6;
  });

  y = Math.min(y + 2, H - FOOTER_H - 20);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.3);
  doc.setTextColor(...GREY);
  doc.text(t("SIGNATURE DU CLIENT · précédée de « Lu et approuvé »"), M, y);
  doc.text(t("SIGNATURE DU COACH · précédée de « Lu et approuvé »"), sigX2, y);
  const cgvSide = (x0: number, signedBy: string | null, date: string | null, prefix: string) => {
    if (signedBy && date) tick(doc, x0, y + 2);
    else checkBox(doc, `${prefix}cgv_lu_et_approuve`, x0, y + 2, 3.4);
    doc.setFontSize(6.6);
    doc.setTextColor(60, 64, 72);
    doc.text("Lu et approuvé", x0 + 5, y + 4.6);
    if (signedBy && date) {
      doc.setFont("helvetica", "bold");
      doc.text(t(`${signedBy} · signé le ${date}`), x0 + 26, y + 4.6);
      doc.setFont("helvetica", "normal");
    } else textField(doc, `${prefix}cgv_signature`, x0 + 26, y + 1.4, sigW - 26, 5, { fontSize: 8 });
  };
  cgvSide(M, quote.client_signed_name ?? (quote.client_signed_at ? clientName : null), quote.client_signed_at ? fmtShort(quote.client_signed_at) : null, "");
  cgvSide(sigX2, quote.coach_signed_at ? COACH.name : null, quote.coach_signed_at ? fmtShort(quote.coach_signed_at) : null, "coach_");
  footer(doc);

  // Numéros de page « 1/2 » (total connu maintenant)
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(150, 154, 162);
    doc.text(`${i}/${n}`, W - M, marks[i - 1]?.y ?? 9, { align: "right" });
  }

  const safe = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w-]+/g, "_");
  const bytes = await addFormFields(doc.output("arraybuffer"));
  return { bytes, fileName: `Devis_${safe(client.first_name)}_${safe(client.last_name)}_${quote.number}.pdf` };
}

/** Télécharge le devis (PDF remplissable et signable par le client). */
export async function exportQuotePdf(quote: Quote, client: { first_name: string; last_name: string }) {
  const { bytes, fileName } = await buildQuotePdf(quote, client);
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
