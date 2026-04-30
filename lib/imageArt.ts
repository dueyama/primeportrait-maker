export type DigitArtResult = {
  grid: string[];
  flatDigits: string;
  previewUrl: string;
};

const GRID_SIZE = 100;
const ASCII_ASPECT_FIX = 0.55;

export async function imageFileToDigitArt(file: File): Promise<DigitArtResult> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = GRID_SIZE;
  canvas.height = GRID_SIZE;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    throw new Error("Canvas context is not available in this browser.");
  }

  const side = Math.min(bitmap.width, bitmap.height);
  const sx = Math.floor((bitmap.width - side) / 2);
  const sy = Math.floor((bitmap.height - side) / 2);
  context.drawImage(bitmap, sx, sy, side, side, 0, 0, GRID_SIZE, GRID_SIZE);

  const imageData = context.getImageData(0, 0, GRID_SIZE, GRID_SIZE);
  const luminance = new Float64Array(GRID_SIZE * GRID_SIZE);

  for (let i = 0; i < imageData.data.length; i += 4) {
    const r = imageData.data[i] ?? 0;
    const g = imageData.data[i + 1] ?? 0;
    const b = imageData.data[i + 2] ?? 0;
    luminance[i / 4] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  const rows: string[] = [];
  const flat: string[] = [];

  for (let y = 0; y < GRID_SIZE; y += 1) {
    let row = "";
    for (let x = 0; x < GRID_SIZE; x += 1) {
      const index = y * GRID_SIZE + x;
      const oldValue = clamp(luminance[index] ?? 0, 0, 255);
      const digit = Math.round((oldValue / 255) * 9);
      const quantized = (digit / 9) * 255;
      const error = oldValue - quantized;
      row += String(digit);
      flat.push(String(digit));

      distribute(luminance, x + 1, y, error * (7 / 16));
      distribute(luminance, x - 1, y + 1, error * (3 / 16));
      distribute(luminance, x, y + 1, error * (5 / 16));
      distribute(luminance, x + 1, y + 1, error * (1 / 16));
    }
    rows.push(row);
  }

  return {
    grid: rows,
    flatDigits: flat.join(""),
    previewUrl: canvas.toDataURL("image/png"),
  };
}

export function renderDigitGridPng(grid: string[]): string {
  const cell = 10;
  const width = GRID_SIZE * cell;
  const height = Math.round(GRID_SIZE * cell * ASCII_ASPECT_FIX);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas context is not available in this browser.");
  }

  context.fillStyle = "#10131a";
  context.fillRect(0, 0, width, height);
  context.font = "8px SFMono-Regular, Menlo, monospace";
  context.textBaseline = "top";

  const rowHeight = height / GRID_SIZE;
  for (let y = 0; y < grid.length; y += 1) {
    const row = grid[y] ?? "";
    for (let x = 0; x < row.length; x += 1) {
      const digit = Number(row[x] ?? "0");
      const lightness = 18 + digit * 8;
      context.fillStyle = `hsl(42 64% ${lightness}%)`;
      context.fillText(row[x] ?? "0", x * cell, y * rowHeight);
    }
  }

  return canvas.toDataURL("image/png");
}

function distribute(values: Float64Array, x: number, y: number, error: number): void {
  if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) {
    return;
  }
  const index = y * GRID_SIZE + x;
  values[index] = clamp((values[index] ?? 0) + error, 0, 255);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
