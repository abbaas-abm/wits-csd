import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import QRCode from "qrcode";
import { sanitizeDataForPdf } from "@/lib/pdf/sanitize";

export interface AttendeeBadgeData {
  eventTitle: string;
  firstName: string;
  lastName: string;
  positionLabel: string;
  attendeeId: string;
  dateText: string;
  venue: string | null;
  personNumber: string | null;
}

const PAGE_W = 420;
const PAGE_H = 640;

const DEEP_BLUE = rgb(0, 0.2, 0.4); // #003366
const GOLD_ACCENT = rgb(197 / 255, 155 / 255, 39 / 255); // #C59B27
const DARK_GOLD = rgb(0.722, 0.525, 0.043); // #B8860B
const WHITE = rgb(1, 1, 1);
const SLATE = rgb(0.32, 0.36, 0.42);

function fitText(
  text: string,
  font: PDFFont,
  maxWidth: number,
  startSize: number,
  minSize = 8,
) {
  let size = startSize;
  while (size > minSize && font.widthOfTextAtSize(text, size) > maxWidth) {
    size -= 0.5;
  }
  return size;
}

function wrapText(
  text: string,
  font: PDFFont,
  maxWidth: number,
  size: number,
  maxLines: number,
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
      if (lines.length === maxLines) break;
    }
  }
  if (lines.length < maxLines && current) lines.push(current);
  return lines.length > 0 ? lines : [text];
}

function drawCentered(
  page: ReturnType<PDFDocument["addPage"]>,
  text: string,
  font: PDFFont,
  y: number,
  size: number,
  color = WHITE,
) {
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, {
    x: (PAGE_W - width) / 2,
    y,
    size,
    font,
    color,
  });
}

export async function generateAttendeeBadge(
  data: AttendeeBadgeData,
): Promise<Uint8Array> {
  // Strip characters the standard font can't encode (emoji, etc.).
  data = sanitizeDataForPdf(data);
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([PAGE_W, PAGE_H]);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);

  // Top section: a downward-pointing banner. Flat top edge, vertical side
  // edges, and a bottom edge that angles inward/downward to a central point
  // (inverted-V). A gold layer sits behind the blue header, following the
  // same V-profile but extending slightly lower to trace the tip.
  page.drawSvgPath("M 0 0 L 420 0 L 420 130 L 210 200 L 0 130 Z", {
    x: 0,
    y: PAGE_H,
    color: GOLD_ACCENT,
  });
  page.drawSvgPath("M 0 0 L 420 0 L 420 120 L 210 190 L 0 120 Z", {
    x: 0,
    y: PAGE_H,
    color: DEEP_BLUE,
  });

  drawCentered(page, "ATTENDEE TAG", bold, PAGE_H - 44, 18, WHITE);

  const titleLines = wrapText(data.eventTitle, bold, 320, 15, 2);
  let titleY = PAGE_H - 74;
  for (const line of titleLines) {
    drawCentered(page, line, bold, titleY, 15, WHITE);
    titleY -= 19;
  }

  // Attendee name
  const name = `${data.firstName} ${data.lastName}`.trim() || "Attendee";
  const nameSize = fitText(name, bold, PAGE_W - 48, 32, 16);
  drawCentered(page, name, bold, 388, nameSize, DEEP_BLUE);

  // Position: a swallowtail ribbon (notched on both ends) with white text
  const ribbonText = data.positionLabel.toUpperCase();
  const ribbonTextWidth = bold.widthOfTextAtSize(ribbonText, 13);
  const ribbonWidth = ribbonTextWidth + 120;
  const ribbonHeight = 30;
  const notch = 12;
  const cy = 360;
  const half = ribbonWidth / 2;
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
    x: PAGE_W / 2,
    y: cy,
    color: DARK_GOLD,
  });
  drawCentered(page, ribbonText, bold, cy - 20, 13, WHITE);

  // QR code containing the attendee id
  const qrPng = await QRCode.toBuffer(data.attendeeId, {
    type: "png",
    width: 512,
    margin: 1,
    color: { dark: "#003366", light: "#ffffff" },
  });
  const qrImage = await pdf.embedPng(qrPng);
  const qrSize = 150;
  page.drawImage(qrImage, {
    x: (PAGE_W - qrSize) / 2,
    y: 160,
    width: qrSize,
    height: qrSize,
  });

  // Event details (label/value lines, no table)
  const details: [string, string][] = [
    ["Event", data.eventTitle],
    ["Date & Time", data.dateText],
    ["Venue", data.venue || "To be confirmed"],
    ["Student/Staff Number", data.personNumber || "N/A"],
  ];
  let detailY = 138;
  for (const [label, value] of details) {
    page.drawText(`${label}:`, {
      x: 34,
      y: detailY,
      size: 9.5,
      font: bold,
      color: DEEP_BLUE,
    });
    const labelWidth = bold.widthOfTextAtSize(`${label}: `, 9.5);
    const maxValueWidth = PAGE_W - 34 - (34 + labelWidth);
    const valueSize = fitText(value, regular, maxValueWidth, 9.5, 6.5);
    page.drawText(value, {
      x: 34 + labelWidth,
      y: detailY,
      size: valueSize,
      font: regular,
      color: SLATE,
    });
    detailY -= 22;
  }

  // Bottom bar with logo and gold top border
  const barHeight = 44;
  page.drawRectangle({
    x: 0,
    y: 0,
    width: PAGE_W,
    height: barHeight,
    color: DEEP_BLUE,
  });
  page.drawLine({
    start: { x: 0, y: barHeight },
    end: { x: PAGE_W, y: barHeight },
    thickness: 3,
    color: DARK_GOLD,
  });

  try {
    const logoBytes = await readFile(
      path.join(process.cwd(), "public", "wits-logo-light.png"),
    );
    const logo = await pdf.embedPng(logoBytes);
    const logoHeight = 32;
    const logoWidth = (logo.width / logo.height) * logoHeight;
    page.drawImage(logo, {
      x: (PAGE_W - logoWidth) / 2,
      y: (barHeight - logoHeight) / 2,
      width: logoWidth,
      height: logoHeight,
    });
  } catch (error) {
    console.error("Could not embed Wits logo:", error);
  }

  return pdf.save();
}
