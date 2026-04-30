export type DigitArtResult = {
  grid: string[];
  flatDigits: string;
  previewUrl: string;
  width: number;
  height: number;
};

export type CropFocus = {
  x: number;
  y: number;
};

export const GRID_WIDTH = 80;
export const GRID_HEIGHT = 48;
export const TOTAL_DIGITS = GRID_WIDTH * GRID_HEIGHT;

const TEXT_ASPECT_FIX = 0.6;

export async function imageFileToDigitArt(file: File, focus: CropFocus = { x: 0.5, y: 0.5 }): Promise<DigitArtResult> {
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
  const flat: string[] = [];

  for (let y = 0; y < GRID_HEIGHT; y += 1) {
    const rowDigits = new Array<string>(GRID_WIDTH);
    const leftToRight = y % 2 === 0;
    for (let step = 0; step < GRID_WIDTH; step += 1) {
      const x = leftToRight ? step : GRID_WIDTH - 1 - step;
      const index = y * GRID_WIDTH + x;
      const oldValue = clamp(luminance[index] ?? 0, 0, 255);
      const digit = Math.round((oldValue / 255) * 9);
      const quantized = (digit / 9) * 255;
      const error = oldValue - quantized;
      rowDigits[x] = String(digit);

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
    flat.push(...rowDigits);
  }

  if (flat[0] === "0") {
    flat[0] = "1";
    rows[0] = `1${(rows[0] ?? "").slice(1)}`;
  }

  return {
    grid: rows,
    flatDigits: flat.join(""),
    previewUrl: canvas.toDataURL("image/png"),
    width: GRID_WIDTH,
    height: GRID_HEIGHT,
  };
}

export function renderDigitGridPng(grid: string[], tone = true): string {
  const cell = 12;
  const width = GRID_WIDTH * cell;
  const height = Math.round(GRID_HEIGHT * cell / TEXT_ASPECT_FIX);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas context is not available in this browser.");
  }

  context.fillStyle = "#10131a";
  context.fillRect(0, 0, width, height);
  context.font = "10px SFMono-Regular, Menlo, monospace";
  context.textAlign = "left";
  context.textBaseline = "top";

  const rowHeight = height / GRID_HEIGHT;
  for (let y = 0; y < grid.length; y += 1) {
    const row = grid[y] ?? "";
    for (let x = 0; x < row.length; x += 1) {
      const digit = Number(row[x] ?? "0");
      context.fillStyle = tone ? `hsl(42 64% ${18 + digit * 8}%)` : "#fef3c7";
      context.fillText(row[x] ?? "0", x * cell, y * rowHeight);
    }
  }

  return canvas.toDataURL("image/png");
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
  if (sourceAspect > targetAspect) {
    const width = Math.round(sourceHeight * targetAspect);
    const x = Math.round((sourceWidth - width) * clamp(focus.x, 0, 1));
    return {
      x,
      y: 0,
      width,
      height: sourceHeight,
    };
  }

  const height = Math.round(sourceWidth / targetAspect);
  const y = Math.round((sourceHeight - height) * clamp(focus.y, 0, 1));
  return {
    x: 0,
    y,
    width: sourceWidth,
    height,
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
