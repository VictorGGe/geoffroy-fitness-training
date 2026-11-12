"use client";

/**
 * Devis au format Word (.docx) : même contenu que le PDF, modifiable dans Word,
 * Google Docs ou Pages. Les zones bleues sont à compléter par le client.
 */
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  ImageRun,
  Packer,
  PageBreak,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
  type ParagraphChild,
} from "docx";
import { CGV, CGV_PREAMBLE, COACH, eur, fmtDateFr, lineTotal, type Quote } from "./quotes";

const BLACK = "0C0C0E";
const BLUE = "4D9DE0";
const BLUE_SOFT = "E8F1FB";
const FIELD = "F2F7FE";
const GREY = "787E8A";
const TEXT = "14161C";
const FONT = "Arial";
const PAGE_W = 11906; // A4 en twips
const MARGIN = 900;
const CONTENT_W = PAGE_W - 2 * MARGIN;

const NONE = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const NO_BORDERS = { top: NONE, bottom: NONE, left: NONE, right: NONE, insideHorizontal: NONE, insideVertical: NONE };

function run(text: string, o: { size?: number; bold?: boolean; color?: string; italics?: boolean; spacing?: number; caps?: boolean } = {}) {
  return new TextRun({ text, font: FONT, size: o.size ?? 18, bold: o.bold, color: o.color ?? TEXT, italics: o.italics, characterSpacing: o.spacing, allCaps: o.caps });
}

function p(children: ParagraphChild[], o: { align?: (typeof AlignmentType)[keyof typeof AlignmentType]; before?: number; after?: number } = {}) {
  return new Paragraph({ children, alignment: o.align, spacing: { before: o.before ?? 0, after: o.after ?? 60 } });
}

function cell(children: (Paragraph | Table)[], o: { width: number; fill?: string; borders?: Record<string, unknown>; margins?: number; vAlign?: "center" | "top" | "bottom" }) {
  const m = o.margins ?? 120;
  return new TableCell({
    children,
    width: { size: o.width, type: WidthType.DXA },
    shading: o.fill ? { type: ShadingType.CLEAR, color: "auto", fill: o.fill } : undefined,
    borders: (o.borders as never) ?? NO_BORDERS,
    margins: { top: m, bottom: m, left: m + 40, right: m + 40 },
    verticalAlign: o.vAlign as never,
  });
}

function table(rows: TableRow[], widths: number[], borders: Record<string, unknown> = NO_BORDERS) {
  return new Table({ rows, width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: widths, layout: TableLayoutType.FIXED, borders: borders as never });
}

/** Zone à compléter (fond bleu clair). */
function field(width: number, height = 360, content: Paragraph[] = [p([run("")], { after: 0 })]) {
  return new Table({
    width: { size: width, type: WidthType.DXA },
    columnWidths: [width],
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({
        height: { value: height, rule: "atLeast" as never },
        children: [
          cell(content, {
            width,
            fill: FIELD,
            margins: 60,
            borders: {
              top: { style: BorderStyle.SINGLE, size: 4, color: "BECDE2" },
              bottom: { style: BorderStyle.SINGLE, size: 4, color: "BECDE2" },
              left: { style: BorderStyle.SINGLE, size: 4, color: "BECDE2" },
              right: { style: BorderStyle.SINGLE, size: 4, color: "BECDE2" },
            },
          }),
        ],
      }),
    ],
  });
}

function sectionTitle(n: number, title: string) {
  return p([run(`${n}  `, { bold: true, size: 26, color: BLUE }), run(title, { bold: true, size: 26 })], { before: 280, after: 120 });
}

function band(kicker: string, title: string, right: string[]) {
  const lw = Math.round(CONTENT_W * 0.6);
  return table(
    [
      new TableRow({
        children: [
          cell([p([run(kicker, { bold: true, size: 14, color: "FFFFFF", spacing: 60 })], { after: 80 }), p([run(title, { bold: true, size: 48, color: "FFFFFF" })], { after: 0 })], {
            width: lw,
            fill: BLACK,
            margins: 220,
            vAlign: VerticalAlign.CENTER,
          }),
          cell(
            right.map((r) => p([run(r, { size: 16, color: "CDD0D6" })], { align: AlignmentType.RIGHT, after: 20 })),
            { width: CONTENT_W - lw, fill: BLACK, margins: 220, vAlign: VerticalAlign.CENTER },
          ),
        ],
      }),
    ],
    [lw, CONTENT_W - lw],
    { ...NO_BORDERS, bottom: { style: BorderStyle.SINGLE, size: 18, color: BLUE } },
  );
}

function b64ToBytes(dataUrl: string): Uint8Array {
  const bin = atob(dataUrl.split(",")[1] ?? "");
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function imageSize(dataUrl: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth || 300, h: img.naturalHeight || 100 });
    img.onerror = () => resolve({ w: 300, h: 100 });
    img.src = dataUrl;
  });
}

async function signatureContent(png: string | null | undefined, maxW: number): Promise<Paragraph[]> {
  if (!png) return [p([run("")], { after: 0 })];
  const { w, h } = await imageSize(png);
  const height = 48;
  const width = Math.min(maxW, Math.round((w / h) * height));
  return [p([new ImageRun({ type: "png", data: b64ToBytes(png), transformation: { width, height: Math.round((width / w) * h) } })], { align: AlignmentType.CENTER, after: 0 })];
}

function fmtShort(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));
}

export async function buildQuoteDocx(quote: Quote, client: { first_name: string; last_name: string }): Promise<{ blob: Blob; fileName: string }> {
  const clientName = `${client.first_name} ${client.last_name.toUpperCase()}`;
  const total = quote.items.reduce((s, i) => s + lineTotal(i), 0);
  const half = Math.round((CONTENT_W - 240) / 2);

  /* ---------- Coach / Client ---------- */
  const label = (s: string) => p([run(s, { size: 12, color: GREY, caps: true })], { before: 80, after: 20 });
  const value = (s: string) => p([run(s, { bold: true, size: 17 })], { after: 20 });
  const partyBorders = { ...NO_BORDERS, top: { style: BorderStyle.SINGLE, size: 18, color: BLACK } };
  const coachCell = cell(
    [
      p([run("Le Coach", { bold: true, size: 22 })], { after: 60 }),
      label("Nom"),
      value(COACH.name),
      label("Lieu des séances"),
      value(COACH.placeLine1),
      value(COACH.placeLine2),
      label("SIRET"),
      value(COACH.siret),
    ],
    { width: half, fill: BLUE_SOFT, borders: partyBorders, margins: 160 },
  );
  const clientRow = (lab: string, v: string | null | undefined) =>
    v ? [label(lab), value(v)] : [label(lab), p([run("Cliquez ici pour compléter", { size: 15, color: "9AA8BC", italics: true })], { after: 20 })];
  const clientCell = cell(
    [
      p([run("Le Client", { bold: true, size: 22 })], { after: 60 }),
      label("Nom"),
      value(clientName),
      ...clientRow("Email", quote.client_email),
      ...clientRow("Adresse", quote.client_address),
      ...clientRow("Téléphone", quote.client_phone),
    ],
    { width: half, fill: BLUE_SOFT, borders: partyBorders, margins: 160 },
  );
  const parties = table([new TableRow({ children: [coachCell, cell([p([run("")])], { width: 240 }), clientCell] })], [half, 240, half]);

  /* ---------- Lignes ---------- */
  const cw = [Math.round(CONTENT_W * 0.52), Math.round(CONTENT_W * 0.12), Math.round(CONTENT_W * 0.18)];
  cw.push(CONTENT_W - cw[0] - cw[1] - cw[2]);
  const head = (s: string, align: (typeof AlignmentType)[keyof typeof AlignmentType]) =>
    cell([p([run(s, { bold: true, size: 14, color: "FFFFFF", caps: true })], { align, after: 0 })], { width: 0, fill: BLACK, margins: 100 });
  const rowBorder = { ...NO_BORDERS, bottom: { style: BorderStyle.SINGLE, size: 4, color: "D6DAE2" } };
  const itemRows = quote.items.map(
    (i) =>
      new TableRow({
        children: [
          cell(
            [p([run(i.label, { bold: true, size: 17 })], { after: 20 }), ...(i.sub ? [p([run(i.sub, { size: 14, color: GREY })], { after: 0 })] : [])],
            { width: cw[0], borders: rowBorder, margins: 110 },
          ),
          cell([p([run(String(i.qty).replace(".", ","), { size: 17 })], { align: AlignmentType.CENTER, after: 0 })], { width: cw[1], borders: rowBorder, margins: 110 }),
          cell([p([run(i.included ? "Inclus" : eur(i.unit_price), { size: 17 })], { align: AlignmentType.RIGHT, after: 0 })], { width: cw[2], borders: rowBorder, margins: 110 }),
          cell([p([run(eur(lineTotal(i)), { size: 17 })], { align: AlignmentType.RIGHT, after: 0 })], { width: cw[3], borders: rowBorder, margins: 110 }),
        ],
      }),
  );
  const items = table(
    [
      new TableRow({
        tableHeader: true,
        children: [head("Désignation", AlignmentType.LEFT), head("Qté", AlignmentType.CENTER), head("Prix unitaire", AlignmentType.RIGHT), head("Total", AlignmentType.RIGHT)],
      }),
      ...itemRows,
    ],
    cw,
  );

  /* ---------- Totaux ---------- */
  const tw = [CONTENT_W - 4200, 2200, 2000];
  const totals = table(
    [
      new TableRow({
        children: [
          cell([p([run("")])], { width: tw[0] }),
          cell([p([run("Total HT", { size: 16, color: "50545C" })], { after: 0 })], { width: tw[1], margins: 60 }),
          cell([p([run(eur(total), { size: 16, color: "50545C" })], { align: AlignmentType.RIGHT, after: 0 })], { width: tw[2], margins: 60 }),
        ],
      }),
      new TableRow({
        children: [
          cell([p([run(COACH.vat, { size: 14, color: GREY, italics: true })], { after: 0 })], { width: tw[0], margins: 60 }),
          cell([p([run("TVA", { size: 16, color: "50545C" })], { after: 0 })], { width: tw[1], margins: 60 }),
          cell([p([run("Non applicable", { size: 16, color: "50545C" })], { align: AlignmentType.RIGHT, after: 0 })], { width: tw[2], margins: 60 }),
        ],
      }),
      new TableRow({
        children: [
          cell([p([run("")])], { width: tw[0] }),
          cell([p([run("Total à payer", { bold: true, size: 19 })], { after: 0 })], {
            width: tw[1],
            fill: BLUE_SOFT,
            margins: 120,
            borders: { ...NO_BORDERS, left: { style: BorderStyle.SINGLE, size: 24, color: BLUE } },
            vAlign: VerticalAlign.CENTER,
          }),
          cell([p([run(eur(total), { bold: true, size: 28 })], { align: AlignmentType.RIGHT, after: 0 })], { width: tw[2], fill: BLUE_SOFT, margins: 120, vAlign: VerticalAlign.CENTER }),
        ],
      }),
    ],
    tw,
  );

  /* ---------- Conditions ---------- */
  const dot = { ...NO_BORDERS, bottom: { style: BorderStyle.DOTTED, size: 4, color: "D6DAE2" } };
  const conds = table(
    quote.conditions
      .filter((c) => c.label.trim() || c.value.trim())
      .map(
        (c) =>
          new TableRow({
            children: [
              cell([p([run(c.label, { bold: true, size: 16 })], { after: 0 })], { width: 2600, borders: dot, margins: 70 }),
              cell([p([run(c.value, { size: 16, color: "3C4048" })], { after: 0 })], { width: CONTENT_W - 2600, borders: dot, margins: 70 }),
            ],
          }),
      ),
    [2600, CONTENT_W - 2600],
  );

  /* ---------- Bon pour accord ---------- */
  const sigCol = async (who: string, name: string, png: string | null | undefined, signedAt: string | null | undefined, withCgv: boolean) => {
    const done = !!(png && signedAt);
    return [
      p([run(`Signature ${who}`, { size: 13, color: GREY, caps: true })], { after: 60 }),
      field(half, 900, await signatureContent(png, 220)),
      p(
        [
          run("Le  ", { size: 13, color: GREY }),
          run(done ? fmtShort(signedAt!) : "____ / ____ / ________", { size: 16, bold: done }),
          run("     Mention  ", { size: 13, color: GREY }),
          run(done ? "Bon pour accord" : "_______________________", { size: 16, bold: done }),
        ],
        { before: 100, after: 60 },
      ),
      ...(withCgv
        ? [p([run(done ? "☑ " : "☐ ", { size: 20 }), run("J'ai lu et j'accepte les conditions générales de vente (page 2)", { size: 14, color: "3C4048" })], { after: 0 })]
        : [p([run(name, { size: 13, color: GREY })], { after: 0 })]),
    ];
  };
  const signatures = table(
    [
      new TableRow({
        children: [
          cell(await sigCol("du client", clientName, quote.client_signature, quote.client_signed_at, true), { width: half, margins: 0 }),
          cell([p([run("")])], { width: 240 }),
          cell(await sigCol("du coach", COACH.name, quote.coach_signature, quote.coach_signed_at, false), { width: half, margins: 0 }),
        ],
      }),
    ],
    [half, 240, half],
  );

  /* ---------- Page 2 : CGV ---------- */
  const cgv: (Paragraph | Table)[] = [
    band("ANNEXE AU DEVIS", "Conditions générales de vente", []),
    p([run("")], { after: 120 }),
    table(
      [
        new TableRow({
          children: [
            cell([p([run("Préambule — ", { bold: true, size: 15 }), run(CGV_PREAMBLE, { size: 15, color: "282C34" })], { after: 0 })], {
              width: CONTENT_W,
              fill: BLUE_SOFT,
              margins: 140,
              borders: { ...NO_BORDERS, left: { style: BorderStyle.SINGLE, size: 24, color: BLUE } },
            }),
          ],
        }),
      ],
      [CONTENT_W],
    ),
  ];
  CGV.forEach((sec, i) => {
    cgv.push(p([run(`${i + 1}  `, { bold: true, size: 20, color: BLUE }), run(sec.title, { bold: true, size: 20 })], { before: 160, after: 60 }));
    for (const b of sec.blocks) {
      if (b.sub) cgv.push(p([run(b.sub, { bold: true, size: 15 })], { after: 30 }));
      cgv.push(new Paragraph({ children: [run(b.text, { size: 14, color: "3C4048" })], alignment: AlignmentType.JUSTIFIED, spacing: { after: 60 } }));
    }
  });
  const approved = (who: string, name: string | null, at: string | null | undefined) =>
    cell(
      [
        p([run(`Signature ${who} · précédée de « Lu et approuvé »`, { size: 13, color: GREY, caps: true })], { after: 60 }),
        name && at
          ? p([run("☑ Lu et approuvé — ", { size: 15 }), run(`${name} · signé le ${fmtShort(at)}`, { size: 15, bold: true })], { after: 0 })
          : p([run("☐ Lu et approuvé     ", { size: 15 }), run("_______________________________", { size: 15 })], { after: 0 }),
      ],
      { width: half, margins: 0 },
    );
  cgv.push(p([run("")], { after: 160 }));
  cgv.push(
    table(
      [
        new TableRow({
          children: [
            approved("du client", quote.client_signed_name ?? (quote.client_signed_at ? clientName : null), quote.client_signed_at),
            cell([p([run("")])], { width: 240 }),
            approved("du coach", quote.coach_signed_at ? COACH.name : null, quote.coach_signed_at),
          ],
        }),
      ],
      [half, 240, half],
    ),
  );

  const doc = new Document({
    creator: COACH.name,
    title: `Devis ${quote.number}`,
    styles: { default: { document: { run: { font: FONT, size: 18, color: TEXT } } } },
    sections: [
      {
        properties: { page: { size: { width: PAGE_W, height: 16838 }, margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN, footer: 360 } } },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                border: { top: { style: BorderStyle.SINGLE, size: 12, color: BLUE, space: 6 } },
                children: [run(COACH.footer, { size: 13, color: GREY })],
              }),
            ],
          }),
        },
        children: [
          band("PERSONAL TRAINING", "Devis", [`N° ${quote.number}`, `Émis le ${fmtDateFr(quote.issued_on)}`, `Valable jusqu'au ${fmtDateFr(quote.valid_until)}`]),
          p([run("")], { after: 120 }),
          parties,
          sectionTitle(1, "Détail de la prestation"),
          ...(quote.intro?.trim() ? [p([run(quote.intro.trim(), { size: 16, color: "3C4048" })], { after: 120 })] : []),
          items,
          p([run("")], { after: 60 }),
          totals,
          sectionTitle(2, "Conditions"),
          conds,
          p([run("La prestation est soumise au contrat de Personal Training et à ses conditions générales de vente (annexe, page 2).", { size: 14, color: GREY })], { before: 80, after: 160 }),
          p([run("Bon pour accord", { bold: true, size: 22 }), run("    Complétez les zones bleues, écrivez « Bon pour accord » et signez.", { size: 14, color: BLUE })], { after: 100 }),
          signatures,
          new Paragraph({ children: [new PageBreak()] }),
          ...cgv,
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const safe = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w-]+/g, "_");
  return { blob, fileName: `Devis_${safe(client.first_name)}_${safe(client.last_name)}_${quote.number}.docx` };
}

export async function exportQuoteDocx(quote: Quote, client: { first_name: string; last_name: string }) {
  const { blob, fileName } = await buildQuoteDocx(quote, client);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
