import { adjustRgb, ciede2000, hexToRgb, linearRgbToRgb, rgbToLab, rgbToLinearRgb, type RGB } from '../color/color';
import { TRANSPARENT_CELL, type BeadColor, type ConversionSettings, type ImagePixels, type PatternGrid } from '../../types';

interface Sample {
  rgb: RGB;
  lab: [number, number, number];
  transparent: boolean;
}

export interface ConversionDiagnostics {
  durationMs: number;
  opaqueCells: number;
  selectedColors: number;
  paletteCandidates: number;
}

export interface ConversionResult {
  grid: PatternGrid;
  diagnostics: ConversionDiagnostics;
}

type Progress = (stage: 'sampling' | 'palette' | 'matching' | 'postprocess', ratio: number) => void;

function pixelIsBackground(rgb: RGB, settings: ConversionSettings): boolean {
  if (!settings.backgroundEnabled) return false;
  const background = hexToRgb(settings.backgroundHex);
  return Math.hypot(rgb[0] - background[0], rgb[1] - background[1], rgb[2] - background[2]) <= settings.backgroundTolerance;
}

function sampleCells(image: ImagePixels, settings: ConversionSettings, progress?: Progress): Sample[] {
  const samples: Sample[] = [];
  const cropX = Math.floor(settings.crop.x * image.width);
  const cropY = Math.floor(settings.crop.y * image.height);
  const cropWidth = Math.max(1, Math.floor(settings.crop.width * image.width));
  const cropHeight = Math.max(1, Math.floor(settings.crop.height * image.height));
  for (let gy = 0; gy < settings.gridHeight; gy += 1) {
    const y0 = Math.max(0, cropY + Math.floor((gy * cropHeight) / settings.gridHeight));
    const y1 = Math.min(image.height, cropY + Math.max(Math.floor(((gy + 1) * cropHeight) / settings.gridHeight), 1));
    for (let gx = 0; gx < settings.gridWidth; gx += 1) {
      const x0 = Math.max(0, cropX + Math.floor((gx * cropWidth) / settings.gridWidth));
      const x1 = Math.min(image.width, cropX + Math.max(Math.floor(((gx + 1) * cropWidth) / settings.gridWidth), 1));
      let red = 0;
      let green = 0;
      let blue = 0;
      let alphaWeight = 0;
      let pixels = 0;
      for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
          const index = (y * image.width + x) * 4;
          const alpha = (image.data[index + 3] ?? 0) / 255;
          pixels += 1;
          if (alpha === 0) continue;
          const linear = rgbToLinearRgb([image.data[index] ?? 0, image.data[index + 1] ?? 0, image.data[index + 2] ?? 0]);
          red += linear[0] * alpha;
          green += linear[1] * alpha;
          blue += linear[2] * alpha;
          alphaWeight += alpha;
        }
      }
      const meanAlpha = pixels === 0 ? 0 : alphaWeight / pixels;
      if (meanAlpha * 255 < settings.alphaThreshold || alphaWeight === 0) {
        samples.push({ rgb: [0, 0, 0], lab: [0, 0, 0], transparent: true });
      } else {
        const rgb = adjustRgb(linearRgbToRgb([red / alphaWeight, green / alphaWeight, blue / alphaWeight]), settings.brightness, settings.contrast, settings.saturation);
        const transparent = pixelIsBackground(rgb, settings);
        samples.push({ rgb, lab: rgbToLab(rgb), transparent });
      }
    }
    progress?.('sampling', (gy + 1) / settings.gridHeight);
  }
  return samples;
}

function nearestIndex(lab: [number, number, number], palette: BeadColor[], indices?: number[]): number {
  const candidates = indices ?? palette.map((_, index) => index);
  let bestIndex = -1;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const index of candidates) {
    const color = palette[index];
    if (!color?.active) continue;
    const distance = ciede2000(lab, color.lab);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }
  if (bestIndex < 0) throw new Error('当前色卡没有可用颜色');
  return bestIndex;
}

function cacheKey(rgb: RGB): number {
  return (Math.round(rgb[0] / 6) << 12) | (Math.round(rgb[1] / 6) << 6) | Math.round(rgb[2] / 6);
}

function choosePaletteIndices(samples: Sample[], palette: BeadColor[], maxColors: number, progress?: Progress): number[] {
  const counts = new Uint32Array(palette.length);
  const cache = new Map<number, number>();
  let processed = 0;
  const opaque = samples.filter((sample) => !sample.transparent);
  for (const sample of opaque) {
    const key = cacheKey(sample.rgb);
    let index = cache.get(key);
    if (index === undefined) {
      index = nearestIndex(sample.lab, palette);
      cache.set(key, index);
    }
    counts[index] = (counts[index] ?? 0) + 1;
    processed += 1;
    if (processed % 256 === 0) progress?.('palette', processed / Math.max(1, opaque.length));
  }
  const selected = Array.from(counts.entries())
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1] || palette[a[0]]!.code.localeCompare(palette[b[0]]!.code, undefined, { numeric: true }))
    .slice(0, Math.min(maxColors, palette.length))
    .map(([index]) => index);
  progress?.('palette', 1);
  if (selected.length === 0 && opaque.length > 0) throw new Error('无法从图片中选择有效颜色');
  return selected;
}

function mapSamples(samples: Sample[], palette: BeadColor[], selected: number[], settings: ConversionSettings, progress?: Progress): Uint16Array {
  const cells = new Uint16Array(samples.length);
  cells.fill(TRANSPARENT_CELL);
  const cache = new Map<number, number>();
  const errors = new Float32Array(samples.length * 3);
  const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const addError = (index: number, rgb: RGB, weight: number) => {
    if (index < 0 || index >= samples.length || samples[index]!.transparent) return;
    errors[index * 3] = (errors[index * 3] ?? 0) + rgb[0] * weight;
    errors[index * 3 + 1] = (errors[index * 3 + 1] ?? 0) + rgb[1] * weight;
    errors[index * 3 + 2] = (errors[index * 3 + 2] ?? 0) + rgb[2] * weight;
  };
  for (let y = 0; y < settings.gridHeight; y += 1) {
    const reverse = settings.dither === 'floyd-steinberg' && y % 2 === 1;
    for (let step = 0; step < settings.gridWidth; step += 1) {
      const x = reverse ? settings.gridWidth - 1 - step : step;
      const index = y * settings.gridWidth + x;
      const sample = samples[index]!;
      if (sample.transparent) continue;
      let rgb: RGB = [...sample.rgb];
      if (settings.dither === 'bayer4') {
        const offset = ((bayer[(y % 4) * 4 + (x % 4)]! / 15) - 0.5) * 48 * settings.ditherStrength;
        rgb = rgb.map((channel) => Math.max(0, Math.min(255, channel + offset))) as RGB;
      } else if (settings.dither === 'floyd-steinberg') {
        rgb = rgb.map((channel, channelIndex) => Math.max(0, Math.min(255, channel + (errors[index * 3 + channelIndex] ?? 0) * settings.ditherStrength))) as RGB;
      }
      const key = cacheKey(rgb);
      let paletteIndex = cache.get(key);
      if (paletteIndex === undefined) {
        paletteIndex = nearestIndex(rgbToLab(rgb), palette, selected);
        cache.set(key, paletteIndex);
      }
      cells[index] = paletteIndex;
      if (settings.dither === 'floyd-steinberg') {
        const mapped = palette[paletteIndex]!.rgb;
        const error: RGB = [rgb[0] - mapped[0], rgb[1] - mapped[1], rgb[2] - mapped[2]];
        const direction = reverse ? -1 : 1;
        addError(index + direction, error, 7 / 16);
        addError(index + settings.gridWidth - direction, error, 3 / 16);
        addError(index + settings.gridWidth, error, 5 / 16);
        addError(index + settings.gridWidth + direction, error, 1 / 16);
      }
    }
    progress?.('matching', (y + 1) / settings.gridHeight);
  }
  return cells;
}

function removeIsolated(cells: Uint16Array, width: number, height: number): Uint16Array {
  const next = cells.slice();
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const current = cells[index]!;
      if (current === TRANSPARENT_CELL) continue;
      const counts = new Map<number, number>();
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const neighbor = cells[ny * width + nx]!;
          if (neighbor !== TRANSPARENT_CELL) counts.set(neighbor, (counts.get(neighbor) ?? 0) + 1);
        }
      }
      const same = counts.get(current) ?? 0;
      const majority = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];
      if (same <= 1 && majority && majority[1] >= 4) next[index] = majority[0];
    }
  }
  return next;
}

export function convertImageToPattern(image: ImagePixels, settings: ConversionSettings, palette: BeadColor[], progress?: Progress): ConversionResult {
  const started = performance.now();
  if (settings.gridWidth * settings.gridHeight > 40_000) throw new Error('网格超过 200×200 上限');
  if (settings.maxColors < 2 || settings.maxColors > 80) throw new Error('颜色数量必须在 2–80 之间');
  const activePalette = palette.filter((color) => color.active);
  if (activePalette.length === 0) throw new Error('当前色卡没有可用颜色');
  const samples = sampleCells(image, settings, progress);
  const selected = choosePaletteIndices(samples, activePalette, settings.maxColors, progress);
  let cells = mapSamples(samples, activePalette, selected, settings, progress);
  if (settings.removeIsolated) cells = removeIsolated(cells, settings.gridWidth, settings.gridHeight);
  progress?.('postprocess', 1);
  const opaqueCells = cells.reduce((count, cell) => count + (cell === TRANSPARENT_CELL ? 0 : 1), 0);
  return {
    grid: { width: settings.gridWidth, height: settings.gridHeight, cells, paletteSnapshot: activePalette },
    diagnostics: { durationMs: performance.now() - started, opaqueCells, selectedColors: selected.length, paletteCandidates: activePalette.length }
  };
}
