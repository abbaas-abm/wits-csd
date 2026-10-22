/**
 * Wristband colours handed out at check-in. Any text is accepted; these are
 * offered as suggestions and given a matching swatch.
 */
export const WRISTBAND_COLORS: Record<string, string> = {
  Red: "#dc2626",
  Orange: "#f97316",
  Yellow: "#facc15",
  Green: "#16a34a",
  "Lime Green": "#84cc16",
  Blue: "#2563eb",
  "Light Blue": "#38bdf8",
  "Navy Blue": "#1e3a8a",
  Purple: "#9333ea",
  Pink: "#ec4899",
  Gold: "#d4a017",
  Silver: "#a8a9ad",
  Black: "#111827",
  White: "#ffffff",
  Brown: "#92400e",
  Grey: "#6b7280",
};

/** "  light BLUE " -> "Light Blue", so the same colour always groups together. */
export function normalizeWristband(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** CSS colour for a swatch: known palette first, then the name itself. */
export function wristbandSwatch(color: string): string {
  return (
    WRISTBAND_COLORS[normalizeWristband(color)] ??
    color.toLowerCase().replace(/\s+/g, "")
  );
}
