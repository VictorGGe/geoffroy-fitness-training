"use client";

/** PDF du devis (page 1 : devis, page 2 : conditions générales de vente). */
import { jsPDF } from "jspdf";
import { CGV, CGV_PREAMBLE, COACH, DEFAULT_PLACE, eur, fmtDateFr, lineTotal, type Quote, type QuoteCondition } from "./quotes";

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
      blank(doc, x + 6, yy - 3.1, w - 12, 5);
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
/* Zones à remplir au stylo (devis prêt à imprimer)                    */
/* ------------------------------------------------------------------ */

/** Grand cadre (signature) ou ligne pointillée (date, mention, coordonnées). */
function blank(doc: jsPDF, x: number, y: number, w: number, h: number) {
  doc.setDrawColor(...GREY);
  doc.setLineWidth(0.3);
  if (h > 7) {
    doc.setFillColor(255, 255, 255);
    doc.rect(x, y, w, h, "FD");
  } else {
    doc.setLineDashPattern([0.5, 0.8], 0);
    doc.line(x, y + h - 0.6, x + w, y + h - 0.6);
    doc.setLineDashPattern([], 0);
  }
}

function emptyBox(doc: jsPDF, x: number, y: number, size = 3.4) {
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...GREY);
  doc.setLineWidth(0.3);
  doc.rect(x, y, size, size, "FD");
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

/** Texte imprimé à la place d'une ligne à remplir. */
function printed(doc: jsPDF, x: number, y: number, text: string) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...TEXT);
  doc.text(t(text), x, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.3);
  doc.setTextColor(...GREY);
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
export async function buildQuotePdf(
  quote: Quote,
  client: { first_name: string; last_name: string },
): Promise<{ bytes: Uint8Array; fileName: string }> {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const clientName = `${client.first_name} ${client.last_name.toUpperCase()}`;
  const total = quote.items.reduce((s, i) => s + lineTotal(i), 0);
  const marks: PageMark[] = [];
  const LIMIT = H - FOOTER_H - 2.5;
  const dd = quote.details ?? {};
  const condCount =
    quote.conditions.filter((c) => c.label.trim() || c.value.trim()).length +
    (dd.start_date ? 1 : 0) +
    (dd.payment_methods?.length ? 1 : 0) +
    (dd.deposit ? 1 : 0) +
    (dd.notes?.trim() ? 1 : 0);
  const compact = condCount > 6 || quote.items.length > 3;
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
  y = numberedTitle(doc, cardY + cardH + (compact ? 9 : 11), 1, "Détail de la prestation");
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
    const rowH = (compact ? 4 : 5) + labelLines.length * 4.2 + subLines.length * 3.6 + (compact ? 1.6 : 2.5);
    room(rowH);
    let ry = y + (compact ? 5.8 : 6.5);
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
  y += compact ? 13 : 17;

  // 2. Conditions
  room(30);
  y = numberedTitle(doc, y, 2, "Conditions");
  doc.setFontSize(7.8);
  const d = quote.details ?? {};
  const extra: QuoteCondition[] = [
    ...(d.start_date ? [{ label: "Début de l'accompagnement", value: fmtDateFr(d.start_date) }] : []),
    ...(d.payment_methods?.length ? [{ label: "Moyens de paiement", value: d.payment_methods.join(", ") }] : []),
    ...(d.deposit && d.deposit > 0 ? [{ label: "Acompte", value: `${eur(d.deposit)} à verser à la signature, déduit du total` }] : []),
  ];
  const conds = quote.conditions.filter((c) => c.label.trim() || c.value.trim());
  const payIdx = conds.findIndex((c) => c.label === "Paiement");
  const allConds = payIdx >= 0 ? [...conds.slice(0, payIdx + 1), ...extra, ...conds.slice(payIdx + 1)] : [...conds, ...extra];
  if (d.notes?.trim()) allConds.push({ label: "Notes", value: d.notes.trim() });
  // Beaucoup de lignes : présentation compacte pour garder le devis sur 2 pages

  const lh = compact ? 3.3 : 3.7;
  doc.setFontSize(compact ? 7.3 : 7.8);
  for (const c of allConds) {
    const vLines = doc.splitTextToSize(t(c.value), W - 2 * M - 44) as string[];
    room(vLines.length * lh + 4);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...TEXT);
    doc.text(t(c.label), M, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 64, 72);
    doc.text(vLines, M + 44, y);
    y += Math.max(1, vLines.length) * lh + (compact ? 0.8 : 1.1);
    dotted(doc, M, W - M, y - (compact ? 2 : 2.2));
    y += compact ? 1.3 : 1.9;
  }
  doc.setFontSize(6.8);
  doc.setTextColor(...GREY);
  doc.text("La prestation est soumise au contrat de Personal Training et à ses conditions générales de vente (annexe, page 2).", M, y + 1);
  y += compact ? 6.2 : 7.5;

  // Bon pour accord : à remplir au stylo (ou signé en ligne)
  room(30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...TEXT);
  doc.text("Bon pour accord", M, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.4);
  doc.setTextColor(...BLUE);
  doc.setTextColor(60, 64, 72);
  doc.setFontSize(7.4);
  doc.text(t(`Fait à ${d.place?.trim() || DEFAULT_PLACE}, en deux exemplaires.`), M + 31, y);
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
  const signDate = d.sign_date ? fmtShort(`${d.sign_date}T12:00:00`) : null;
  // Client : signée en ligne → image de la signature ; sinon champs à remplir
  if (quote.client_signature && clientDate) {
    signatureBox(doc, quote.client_signature, M, y + 1.5, sigW, 11);
    filledLine(doc, M, fy, clientDate);
    tick(doc, M, fy + 7.2);
  } else {
    blank(doc, M, y + 1.5, sigW, 11);
    doc.setFontSize(6.3);
    doc.setTextColor(...GREY);
    doc.text("Le", M, fy + 3.4);
    if (signDate) printed(doc, M + 4, fy + 3.4, signDate);
    else blank(doc, M + 4, fy, 24, 5);
    doc.text("Mention", M + 31, fy + 3.4);
    blank(doc, M + 41, fy, sigW - 41, 5);
    emptyBox(doc, M, fy + 7.2, 3.4);
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
  } else if (d.coach_prefill) {
    // Date et mention imprimées, signature à la main
    blank(doc, sigX2, y + 1.5, sigW, 11);
    filledLine(doc, sigX2, fy, signDate ?? fmtShort(`${quote.issued_on}T12:00:00`));
  } else {
    blank(doc, sigX2, y + 1.5, sigW, 11);
    doc.setFontSize(6.3);
    doc.setTextColor(...GREY);
    doc.text("Le", sigX2, fy + 3.4);
    if (signDate) printed(doc, sigX2 + 4, fy + 3.4, signDate);
    else blank(doc, sigX2 + 4, fy, 24, 5);
    doc.text("Mention", sigX2 + 31, fy + 3.4);
    blank(doc, sigX2 + 41, fy, sigW - 41, 5);
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
    else emptyBox(doc, x0, y + 2, 3.4);
    doc.setFontSize(6.6);
    doc.setTextColor(60, 64, 72);
    doc.text("Lu et approuvé", x0 + 5, y + 4.6);
    if (signedBy && date) {
      doc.setFont("helvetica", "bold");
      doc.text(t(`${signedBy} · signé le ${date}`), x0 + 26, y + 4.6);
      doc.setFont("helvetica", "normal");
    } else blank(doc, x0 + 26, y + 1.4, sigW - 26, 5);
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
  return { bytes: new Uint8Array(doc.output("arraybuffer")), fileName: `Devis_${safe(client.first_name)}_${safe(client.last_name)}_${quote.number}.pdf` };
}

export function downloadBytes(bytes: Uint8Array, fileName: string, type: string) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/** Télécharge le devis (PDF remplissable et signable, ou version à imprimer). */
export async function exportQuotePdf(quote: Quote, client: { first_name: string; last_name: string }) {
  const { bytes, fileName } = await buildQuotePdf(quote, client);
  downloadBytes(bytes, fileName, "application/pdf");
}
