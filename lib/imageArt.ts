export type DigitArtResult = {
  grid: string[];
  toneGrid: string[];
  flatDigits: string;
  previewUrl: string;
  width: number;
  height: number;
};

export type DigitMappingMode = "value" | "glyph-density";

export type CropFocus = {
  x: number;
  y: number;
  zoom: number;
};

export const GRID_WIDTH = 80;
export const GRID_HEIGHT = 48;
export const TOTAL_DIGITS = GRID_WIDTH * GRID_HEIGHT;

const TEXT_ASPECT_FIX = 0.6;
const DENSITY_DIGIT_RAMP = ["8", "9", "6", "0", "5", "3", "2", "4", "7", "1"];

export async function imageFileToDigitArt(
  file: File,
  focus: CropFocus = { x: 0.5, y: 0.5, zoom: 1 },
  mappingMode: DigitMappingMode = "glyph-density",
): Promise<DigitArtResult> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = GRID_WIDTH;
  canvas.height = GRID_HEIGHT;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    throw new Error("Canvas context is not available in this browser.");
  }

  const crop = coverCrop(bitmap.width, bitmap.height, 1, focus);
  context.drawImage(bitmap, crop.x, crop.y, crop.width, crop.height, 0, 0, GRID_WIDTH, GRID_HEIGHT);

  const imageData = context.getImageData(0, 0, GRID_WIDTH, GRID_HEIGHT);
  const luminance = new Float64Array(TOTAL_DIGITS);

  for (let i = 0; i < imageData.data.length; i += 4) {
    const r = imageData.data[i] ?? 0;
    const g = imageData.data[i + 1] ?? 0;
    const b = imageData.data[i + 2] ?? 0;
    luminance[i / 4] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  normalizeLuminance(luminance);

  const rows: string[] = [];
  const toneRows: string[] = [];
  const flat: string[] = [];

  for (let y = 0; y < GRID_HEIGHT; y += 1) {
    const rowDigits = new Array<string>(GRID_WIDTH);
    const rowTones = new Array<string>(GRID_WIDTH);
    const leftToRight = y % 2 === 0;
    for (let step = 0; step < GRID_WIDTH; step += 1) {
      const x = leftToRight ? step : GRID_WIDTH - 1 - step;
      const index = y * GRID_WIDTH + x;
      const oldValue = clamp(luminance[index] ?? 0, 0, 255);
      const level = Math.round((oldValue / 255) * 9);
      const quantized = (level / 9) * 255;
      const error = oldValue - quantized;
      rowDigits[x] = digitForLevel(level, mappingMode);
      rowTones[x] = String(level);

      if (leftToRight) {
        distribute(luminance, x + 1, y, error * (7 / 16));
        distribute(luminance, x - 1, y + 1, error * (3 / 16));
        distribute(luminance, x, y + 1, error * (5 / 16));
        distribute(luminance, x + 1, y + 1, error * (1 / 16));
      } else {
        distribute(luminance, x - 1, y, error * (7 / 16));
        distribute(luminance, x + 1, y + 1, error * (3 / 16));
        distribute(luminance, x, y + 1, error * (5 / 16));
        distribute(luminance, x - 1, y + 1, error * (1 / 16));
      }
    }
    const row = rowDigits.join("");
    rows.push(row);
    toneRows.push(rowTones.join(""));
    flat.push(...rowDigits);
  }

  ensureLeadingDigit(rows, flat, mappingMode);

  return {
    grid: rows,
    toneGrid: toneRows,
    flatDigits: flat.join(""),
    previewUrl: canvas.toDataURL("image/png"),
    width: GRID_WIDTH,
    height: GRID_HEIGHT,
  };
}

function digitForLevel(level: number, mappingMode: DigitMappingMode): string {
  const index = clamp(Math.round(level), 0, 9);
  if (mappingMode === "glyph-density") {
    return DENSITY_DIGIT_RAMP[index] ?? "1";
  }
  return String(index);
}

function ensureLeadingDigit(rows: string[], flat: string[], mappingMode: DigitMappingMode): void {
  if (flat[0] !== "0") {
    return;
  }

  const replacement = mappingMode === "glyph-density" ? "8" : "1";
  flat[0] = replacement;
  rows[0] = `${replacement}${(rows[0] ?? "").slice(1)}`;
}

export function renderDigitGridPng(grid: string[], tone = true, toneGrid?: string[]): string {
  const cell = 12;
  const padding = 28;
  const contentWidth = GRID_WIDTH * cell;
  const contentHeight = Math.round(GRID_HEIGHT * cell / TEXT_ASPECT_FIX);
  const width = contentWidth + padding * 2;
  const height = contentHeight + padding * 2;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas context is not available in this browser.");
  }

  context.fillStyle = tone ? "#10131a" : "#f8fafc";
  context.fillRect(0, 0, width, height);
  context.strokeStyle = tone ? "rgba(251, 191, 36, 0.22)" : "rgba(15, 23, 42, 0.16)";
  context.lineWidth = 1;
  context.strokeRect(12.5, 12.5, width - 25, height - 25);
  context.font = "10px SFMono-Regular, Menlo, monospace";
  context.textAlign = "left";
  context.textBaseline = "top";

  const rowHeight = contentHeight / GRID_HEIGHT;
  for (let y = 0; y < grid.length; y += 1) {
    const row = grid[y] ?? "";
    for (let x = 0; x < row.length; x += 1) {
      const digit = row[x] ?? "0";
      const toneDigit = toneGrid?.[y]?.[x];
      context.fillStyle = tone ? digitToneColor(toneDigit ?? digit, Boolean(toneDigit)) : "#0f172a";
      context.fillText(row[x] ?? "0", padding + x * cell, padding + y * rowHeight);
    }
  }

  return canvas.toDataURL("image/png");
}

export function digitToneColor(digit: string | number, isLuminanceLevel = false): string {
  const value = isLuminanceLevel ? Number(digit) : digitInkLevel(digit);
  if (!Number.isFinite(value)) {
    return "#fef3c7";
  }

  const level = clamp(Math.round(value), 0, 9);
  return `hsl(42 72% ${18 + level * 7}%)`;
}

function digitInkLevel(digit: string | number): number {
  const index = DENSITY_DIGIT_RAMP.indexOf(String(digit));
  if (index >= 0) {
    return index;
  }

  return Number(digit);
}

function distribute(values: Float64Array, x: number, y: number, error: number): void {
  if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) {
    return;
  }
  const index = y * GRID_WIDTH + x;
  values[index] = clamp((values[index] ?? 0) + error, 0, 255);
}

function coverCrop(sourceWidth: number, sourceHeight: number, targetAspect: number, focus: CropFocus) {
  const sourceAspect = sourceWidth / sourceHeight;
  const zoom = clamp(focus.zoom, 1, 3);
  let baseWidth: number;
  let baseHeight: number;

  if (sourceAspect > targetAspect) {
    baseWidth = sourceHeight * targetAspect;
    baseHeight = sourceHeight;
  } else {
    baseWidth = sourceWidth;
    baseHeight = sourceWidth / targetAspect;
  }

  const width = baseWidth / zoom;
  const height = baseHeight / zoom;
  const x = (sourceWidth - width) * clamp(focus.x, 0, 1);
  const y = (sourceHeight - height) * clamp(focus.y, 0, 1);

  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
  };
}

function normalizeLuminance(values: Float64Array): void {
  const sorted = Array.from(values).sort((a, b) => a - b);
  const low = sorted[Math.floor(sorted.length * 0.02)] ?? 0;
  const high = sorted[Math.floor(sorted.length * 0.98)] ?? 255;
  const range = Math.max(1, high - low);

  for (let i = 0; i < values.length; i += 1) {
    const normalized = clamp(((values[i] ?? 0) - low) / range, 0, 1);
    values[i] = Math.pow(normalized, 0.92) * 255;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
