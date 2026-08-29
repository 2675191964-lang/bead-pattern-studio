import { describe, expect, it } from 'vitest';
import { convertImageToPattern } from '../src/core/quantize/convert';
import { patternStats } from '../src/core/pattern/pattern';
import { rgbToHex, rgbToLab, type RGB } from '../src/core/color/color';
import type { BeadColor, ConversionSettings, ImagePixels } from '../src/types';

function bead(code: string, rgb: RGB): BeadColor {
  return { id: code, brandId: 'test', paletteId: 'test', code, nameZh: code, hex: rgbToHex(rgb), rgb, lab: rgbToLab(rgb), series: 'test', finish: 'solid', active: true, source: 'test', sourceDate: '2026-08-30' };
}

const palette = [bead('RED', [220, 30, 30]), bead('BLUE', [20, 40, 220]), bead('WHITE', [245, 245, 245])];
const settings: ConversionSettings = {
  paletteId: 'test', gridWidth: 29, gridHeight: 29, lockAspect: true, maxColors: 18,
  boardWidth: 29, boardHeight: 29, beadSizeMm: 5, dither: 'none', ditherStrength: .75,
  alphaThreshold: 24, backgroundEnabled: false, backgroundHex: '#ffffff', backgroundTolerance: 20,
  brightness: 0, contrast: 0, saturation: 0, crop: { x: 0, y: 0, width: 1, height: 1 }, removeIsolated: false
};

function solidImage(width: number, height: number, rgb: RGB, alpha = 255): ImagePixels {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < width * height; index += 1) data.set([...rgb, alpha], index * 4);
  return { width, height, data };
}

describe('确定性图片转换', () => {
  it('100×100 单色红图输出 29×29、单色、841 颗', () => {
    const result = convertImageToPattern(solidImage(100, 100, [255, 0, 0]), settings, palette);
    const stats = patternStats(result.grid);
    expect(result.grid.width).toBe(29);
    expect(result.grid.height).toBe(29);
    expect(stats.total).toBe(841);
    expect(stats.colors).toHaveLength(1);
    expect(stats.colors[0]!.color.code).toBe('RED');
  });

  it('全透明图不统计，并且同输入得到字节级相同结果', () => {
    const first = convertImageToPattern(solidImage(8, 8, [255, 0, 0], 0), { ...settings, gridWidth: 4, gridHeight: 4 }, palette);
    const second = convertImageToPattern(solidImage(8, 8, [255, 0, 0], 0), { ...settings, gridWidth: 4, gridHeight: 4 }, palette);
    expect(patternStats(first.grid).total).toBe(0);
    expect(Array.from(first.grid.cells)).toEqual(Array.from(second.grid.cells));
  });

  it('没有候选色时返回可理解错误', () => {
    expect(() => convertImageToPattern(solidImage(2, 2, [255, 0, 0]), settings, palette.map((item) => ({ ...item, active: false })))).toThrow('没有可用颜色');
  });
});
