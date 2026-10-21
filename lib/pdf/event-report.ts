import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";
import { sanitizeDataForPdf } from "@/lib/pdf/sanitize";

export interface EventReportData {
  eventTitle: string;
  description: string | null;
  dateText: string;
  venue: string | null;
  totalRegistrations: number;
  totalAttendees: number;
  averageRating: number | null;
  registrations: { name: string; detail: string; dateText: string }[];
  attendees: { name: string; detail: string; dateText: string }[];
  feedback: {
    name: string;
    rating: number;
    comment: string | null;
    dateText: string;
  }[];
}

const W = 595.28;
const H = 841.89;
const MARGIN = 40;
const HEADER_H = 232;
const FOOTER_H = 44;
const CONTENT_BOTTOM = FOOTER_H + 28;

const DEEP_BLUE = rgb(0, 0.2, 0.4); // #003366
const DARK_GOLD = rgb(0.722, 0.525, 0.043); // #B8860B
const GOLD = rgb(0.851, 0.706, 0.357); // #d9b45b
const WHITE = rgb(1, 1, 1);
const SLATE = rgb(0.42, 0.45, 0.5);
const LIGHT = rgb(0.945, 0.961, 0.976);

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

export async function generateEventReport(
  data: EventReportData,
): Promise<Uint8Array> {
  // Strip characters the standard font can't encode (emoji, etc.).
  data = sanitizeDataForPdf(data);
  const pdf = await PDFDocument.create();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);

  let logo: PDFImage | null = null;
  try {
    const bytes = await readFile(
      path.join(process.cwd(), "public", "wits-logo-light.png"),
    );
    logo = await pdf.embedPng(bytes);
  } catch (error) {
    console.error("Could not embed Wits logo:", error);
  }

  function drawFooter(page: PDFPage) {
    page.drawRectangle({
      x: 0,
      y: 0,
      width: W,
      height: FOOTER_H,
      color: DEEP_BLUE,
    });
    page.drawLine({
      start: { x: 0, y: FOOTER_H },
      end: { x: W, y: FOOTER_H },
      thickness: 2.5,
      color: DARK_GOLD,
    });
    if (logo) {
      const h = 32;
      const w = (logo.width / logo.height) * h;
      page.drawImage(logo, {
        x: (W - w) / 2,
        y: (FOOTER_H - h) / 2,
        width: w,
        height: h,
      });
    }
  }

  function drawHeader(page: PDFPage) {
    page.drawRectangle({
      x: 0,
      y: H - HEADER_H,
      width: W,
      height: HEADER_H,
      color: DEEP_BLUE,
    });
    page.drawRectangle({
      x: 0,
      y: H - HEADER_H - 4,
      width: W,
      height: 4,
      color: DARK_GOLD,
    });

    let cursor = H - 46;
    if (logo) {
      const lh = 40;
      const lw = (logo.width / logo.height) * lh;
      page.drawImage(logo, { x: MARGIN, y: cursor - lh, width: lw, height: lh });
      cursor -= lh + 14;
    }

    page.drawText("Report", {
      x: MARGIN,
      y: cursor - 20,
      size: 20,
      font: bold,
      color: GOLD,
    });
    cursor -= 40;

    const titleLines = wrapText(data.eventTitle, bold, 18, W - 2 * MARGIN, 2);
    for (const line of titleLines) {
      page.drawText(line, {
        x: MARGIN,
        y: cursor,
        size: 18,
        font: bold,
        color: WHITE,
      });
      cursor -= 22;
    }
    cursor -= 4;

    page.drawText(data.dateText, {
      x: MARGIN,
      y: cursor,
      size: 10.5,
      font: regular,
      color: rgb(0.8, 0.85, 0.92),
    });
    cursor -= 18;

    if (data.description) {
      const lines = wrapText(
        data.description,
        regular,
        10,
        W - 2 * MARGIN,
        3,
      );
      for (const line of lines) {
        page.drawText(line, {
          x: MARGIN,
          y: cursor,
          size: 10,
          font: regular,
          color: rgb(0.85, 0.89, 0.94),
        });
        cursor -= 14;
      }
      cursor -= 2;
    }

    page.drawText(`Venue: ${data.venue || "To be confirmed"}`, {
      x: MARGIN,
      y: cursor,
      size: 10.5,
      font: regular,
      color: rgb(0.85, 0.89, 0.94),
    });
  }

  let page = pdf.addPage([W, H]);
  drawFooter(page);
  drawHeader(page);
  let y = H - HEADER_H - 40;

  function ensure(space: number) {
    if (y - space < CONTENT_BOTTOM) {
      page = pdf.addPage([W, H]);
      drawFooter(page);
      y = H - MARGIN;
    }
  }

  // Bento summary grid
  function statCard(
    x: number,
    cardY: number,
    w: number,
    h: number,
    label: string,
    value: string,
  ) {
    page.drawRectangle({
      x,
      y: cardY,
      width: w,
      height: h,
      color: LIGHT,
      borderColor: DEEP_BLUE,
      borderWidth: 1,
    });
    page.drawText(label.toUpperCase(), {
      x: x + 16,
      y: cardY + h - 24,
      size: 9,
      font: bold,
      color: SLATE,
    });
    page.drawText(value, {
      x: x + 16,
      y: cardY + 20,
      size: 30,
      font: bold,
      color: DEEP_BLUE,
    });
  }

  const gap = 18;
  const cardW = (W - 2 * MARGIN - gap) / 2;
  const cardH = 96;
  statCard(
    MARGIN,
    y - cardH,
    cardW,
    cardH,
    "Total registrations",
    String(data.totalRegistrations),
  );
  statCard(
    MARGIN + cardW + gap,
    y - cardH,
    cardW,
    cardH,
    "Total attendees",
    String(data.totalAttendees),
  );
  y -= cardH + gap;
  statCard(
    MARGIN,
    y - cardH,
    W - 2 * MARGIN,
    cardH,
    "Average feedback rating",
    data.averageRating === null
      ? "N/A"
      : `${data.averageRating.toFixed(1)} / 5`,
  );
  y -= cardH + 40;

  function section(
    title: string,
    rows: { name: string; detail: string; dateText: string }[],
    highlight?: (row: { name: string; detail: string; dateText: string }) => void,
  ) {
    ensure(44);
    page.drawRectangle({
      x: MARGIN,
      y: y - 4,
      width: 4,
      height: 20,
      color: GOLD,
    });
    page.drawText(title, {
      x: MARGIN + 14,
      y,
      size: 16,
      font: bold,
      color: DEEP_BLUE,
    });
    y -= 30;

    if (rows.length === 0) {
      page.drawText("000 — no data available", {
        x: MARGIN,
        y,
        size: 11,
        font: regular,
        color: SLATE,
      });
      y -= 32;
      return;
    }

    for (const row of rows) {
      ensure(40);
      page.drawText(row.name || "Unknown", {
        x: MARGIN,
        y,
        size: 11,
        font: bold,
        color: rgb(0.12, 0.16, 0.22),
      });
      const dateWidth = regular.widthOfTextAtSize(row.dateText, 9);
      page.drawText(row.dateText, {
        x: W - MARGIN - dateWidth,
        y: y + 1,
        size: 9,
        font: regular,
        color: SLATE,
      });
      y -= 14;
      if (row.detail) {
        page.drawText(row.detail, {
          x: MARGIN,
          y,
          size: 9.5,
          font: regular,
          color: SLATE,
        });
        y -= 14;
      }
      highlight?.(row);
      page.drawLine({
        start: { x: MARGIN, y: y - 2 },
        end: { x: W - MARGIN, y: y - 2 },
        thickness: 0.5,
        color: rgb(0.88, 0.9, 0.93),
      });
      y -= 12;
    }
    y -= 16;
  }

  section("Registrations", data.registrations);
  section("Attendees", data.attendees);

  // Feedback (custom rows with rating + comment)
  ensure(44);
  page.drawRectangle({ x: MARGIN, y: y - 4, width: 4, height: 20, color: GOLD });
  page.drawText("Feedback", {
    x: MARGIN + 14,
    y,
    size: 16,
    font: bold,
    color: DEEP_BLUE,
  });
  y -= 30;
  if (data.feedback.length === 0) {
    page.drawText("000 — no feedback available", {
      x: MARGIN,
      y,
      size: 11,
      font: regular,
      color: SLATE,
    });
    y -= 32;
  } else {
    for (const item of data.feedback) {
      ensure(48);
      page.drawText(item.name || "Anonymous", {
        x: MARGIN,
        y,
        size: 11,
        font: bold,
        color: rgb(0.12, 0.16, 0.22),
      });
      const ratingText = `Rating: ${item.rating}/5`;
      const ratingWidth = bold.widthOfTextAtSize(ratingText, 10);
      page.drawText(ratingText, {
        x: W - MARGIN - ratingWidth,
        y: y + 1,
        size: 10,
        font: bold,
        color: DARK_GOLD,
      });
      y -= 15;
      if (item.comment) {
        for (const line of wrapText(
          item.comment,
          regular,
          9.5,
          W - 2 * MARGIN,
          2,
        )) {
          page.drawText(line, {
            x: MARGIN,
            y,
            size: 9.5,
            font: regular,
            color: SLATE,
          });
          y -= 13;
        }
      }
      const dateWidth = regular.widthOfTextAtSize(item.dateText, 9);
      page.drawText(item.dateText, {
        x: W - MARGIN - dateWidth,
        y: y - 1,
        size: 9,
        font: regular,
        color: rgb(0.6, 0.63, 0.68),
      });
      y -= 20;
    }
  }

  return pdf.save();
}
