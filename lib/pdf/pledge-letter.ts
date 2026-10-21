import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import { sanitizeDataForPdf } from "@/lib/pdf/sanitize";

export interface PledgeLetterData {
  eventTitle: string;
  eventDescription: string | null;
  firstName: string;
  lastName: string;
  pledgeText: string;
  signedAt: string;
}

const W = 595.28;
const H = 841.89;
const MARGIN = 48;
const HEADER_H = 252;
const FOOTER_H = 58;

const NAVY = rgb(0, 0.2, 0.4); // #003366
const GOLD = rgb(197 / 255, 155 / 255, 39 / 255); // #C59B27
const WHITE = rgb(1, 1, 1);
const SLATE = rgb(0.42, 0.45, 0.5);

function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
  maxLines = Infinity,
) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
      if (lines.length >= maxLines) break;
    }
  }
  if (lines.length < maxLines && current) lines.push(current);
  return lines;
}

function drawCentered(
  page: PDFPage,
  text: string,
  font: PDFFont,
  y: number,
  size: number,
  color = WHITE,
) {
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: (W - width) / 2, y, size, font, color });
}

export async function generatePledgeLetter(
  data: PledgeLetterData,
): Promise<Uint8Array> {
  // Strip characters the standard font can't encode (emoji, etc.).
  data = sanitizeDataForPdf(data);
  const pdf = await PDFDocument.create();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const page = pdf.addPage([W, H]);

  let logo = null;
  try {
    const bytes = await readFile(
      path.join(process.cwd(), "public", "wits-logo-light.png"),
    );
    logo = await pdf.embedPng(bytes);
  } catch (error) {
    console.error("Could not embed Wits logo:", error);
  }

  const fullName =
    [data.firstName, data.lastName].filter(Boolean).join(" ") || "Attendee";

  // Header (navy)
  page.drawRectangle({
    x: 0,
    y: H - HEADER_H,
    width: W,
    height: HEADER_H,
    color: NAVY,
  });

  let cursor = H - 44;
  if (logo) {
    const lh = 44;
    const lw = (logo.width / logo.height) * lh;
    page.drawImage(logo, { x: (W - lw) / 2, y: cursor - lh, width: lw, height: lh });
    cursor -= lh + 18;
  }

  const titleLines = wrapText(data.eventTitle, bold, 20, W - 2 * MARGIN, 2);
  for (const line of titleLines) {
    drawCentered(page, line, bold, cursor - 20, 20, WHITE);
    cursor -= 24;
  }
  cursor -= 4;

  if (data.eventDescription) {
    for (const line of wrapText(
      data.eventDescription,
      regular,
      10.5,
      W - 2 * MARGIN,
      3,
    )) {
      drawCentered(page, line, regular, cursor - 12, 10.5, rgb(0.85, 0.89, 0.95));
      cursor -= 15;
    }
  }

  // Callout ribbon: [Name]'s Pledge (swallowtail ribbon, gold with white text)
  const bannerText = `${fullName}'s Pledge`;
  const ribbonHeight = 34;
  const notch = 12;
  const ribbonWidth = bold.widthOfTextAtSize(bannerText, 14) + 120;
  const half = ribbonWidth / 2;
  const ribbonTop = H - HEADER_H + 68;
  const ribbonPath = [
    `M ${-half} 0`,
    `L ${half} 0`,
    `L ${half - notch} ${ribbonHeight / 2}`,
    `L ${half} ${ribbonHeight}`,
    `L ${-half} ${ribbonHeight}`,
    `L ${-half + notch} ${ribbonHeight / 2}`,
    "Z",
  ].join(" ");
  page.drawSvgPath(ribbonPath, {
    x: W / 2,
    y: ribbonTop,
    color: GOLD,
  });
  drawCentered(
    page,
    bannerText,
    bold,
    ribbonTop - ribbonHeight + 12,
    14,
    WHITE,
  );

  // Gold accent stripe under header
  page.drawRectangle({
    x: 0,
    y: H - HEADER_H - 6,
    width: W,
    height: 6,
    color: GOLD,
  });

  // Body
  let bodyY = H - HEADER_H - 60;
  drawCentered(page, "OFFICIAL PLEDGE", bold, bodyY, 13, NAVY);
  bodyY -= 44;

  const statement = `I, ${fullName}, solemnly pledge that ${data.pledgeText}`;
  const bodyLines = wrapText(statement, italic, 15, W - 2 * MARGIN - 20);
  for (const line of bodyLines) {
    drawCentered(page, line, italic, bodyY, 15, rgb(0.12, 0.16, 0.22));
    bodyY -= 24;
  }

  // Signature timestamp
  drawCentered(
    page,
    `Signed at: ${data.signedAt}`,
    regular,
    FOOTER_H + 48,
    11,
    SLATE,
  );

  // Footer (navy with gold top border + white logo)
  page.drawRectangle({
    x: 0,
    y: 0,
    width: W,
    height: FOOTER_H,
    color: NAVY,
  });
  page.drawLine({
    start: { x: 0, y: FOOTER_H },
    end: { x: W, y: FOOTER_H },
    thickness: 3,
    color: GOLD,
  });
  if (logo) {
    const lh = 38;
    const lw = (logo.width / logo.height) * lh;
    page.drawImage(logo, {
      x: (W - lw) / 2,
      y: (FOOTER_H - lh) / 2,
      width: lw,
      height: lh,
    });
  }

  return pdf.save();
}
