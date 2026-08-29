import { describe, expect, it } from 'vitest';
import { rgbToHex, rgbToLab, type RGB } from '../src/core/color/color';
import { patternStats } from '../src/core/pattern/pattern';
import { convertImageToPattern } from '../src/core/quantize/convert';
import type { BeadColor, ConversionSettings, ImagePixels } from '../src/types';

function bead(code: string, rgb: RGB): BeadColor {
  return { id: code, brandId: 'fixture', paletteId: 'fixture', code, nameZh: code, hex: rgbToHex(rgb), rgb, lab: rgbToLab(rgb), series: 'test', finish: 'solid', active: true, source: 'generated-test', sourceDate: '2026-08-30' };
}

const palette = [
  bead('BLACK', [16, 18, 24]), bead('WHITE', [245, 245, 240]), bead('RED', [220, 36, 44]),
  bead('GREEN', [44, 166, 92]), bead('BLUE', [39, 91, 205]), bead('YELLOW', [241, 202, 58]),
  bead('PURPLE', [136, 72, 180]), bead('ORANGE', [231, 113, 41])
];

const baseSettings: ConversionSettings = {
  paletteId: 'fixture', gridWidth: 17, gridHeight: 17, lockAspect: true, maxColors: 8,
  boardWidth: 29, boardHeight: 29, beadSizeMm: 5, dither: 'none', ditherStrength: 0.75,
  alphaThreshold: 24, backgroundEnabled: false, backgroundHex: '#ffffff', backgroundTolerance: 20,
  brightness: 0, contrast: 0, saturation: 0, crop: { x: 0, y: 0, width: 1, height: 1 }, removeIsolated: false
};

function generatedFixture(seed: number): ImagePixels {
  const width = 43 + seed;
  const height = 37 + (seed % 7);
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const checker = ((x >> 3) + (y >> 3) + seed) % 2;
      data[offset] = (x * 5 + seed * 29 + checker * 47) % 256;
      data[offset + 1] = (y * 7 + seed * 17 + checker * 31) % 256;
      data[offset + 2] = ((x + y) * 3 + seed * 41) % 256;
      data[offset + 3] = seed % 4 === 0 && (x + y) % 11 === 0 ? 0 : 255;
    }
  }
  return { width, height, data };
}

describe('20 组可重复合成边界样本', () => {
  it('每组都确定、守恒且颜色数不越界', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const settings: ConversionSettings = { ...baseSettings, dither: (['none', 'floyd-steinberg', 'bayer4'] as const)[seed % 3]! };
      const first = convertImageToPattern(generatedFixture(seed), settings, palette);
      const second = convertImageToPattern(generatedFixture(seed), settings, palette);
      const stats = patternStats(first.grid);
      expect(Array.from(first.grid.cells), `fixture ${seed} must be deterministic`).toEqual(Array.from(second.grid.cells));
      expect(stats.total, `fixture ${seed} count invariant`).toBe(stats.colors.reduce((sum, item) => sum + item.count, 0));
      expect(stats.colors.length, `fixture ${seed} max colors`).toBeLessThanOrEqual(settings.maxColors);
      expect(first.grid.cells).toHaveLength(settings.gridWidth * settings.gridHeight);
    }
  });
});
