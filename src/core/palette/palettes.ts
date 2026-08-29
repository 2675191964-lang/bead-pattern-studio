import mardCsv from '../../data/palettes/mard.csv?raw';
import perlerCsv from '../../data/palettes/perler.csv?raw';
import { rgbToHex, rgbToLab, type RGB } from '../color/color';
import type { BeadColor, Palette } from '../../types';

const SOURCE = 'https://github.com/maxcleme/beadcolors/tree/f97ff4283d03cef5cd7e1071a86f5892e0c0c61b/gen/v3';

function naturalCodeSort(a: BeadColor, b: BeadColor): number {
  return a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: 'base' });
}

function parsePalette(csv: string, id: string, brandId: string, name: string, series: string, beadSizeMm: number): Palette {
  const lines = csv.trim().split(/\r?\n/).slice(1);
  const colors = lines.map((line): BeadColor => {
    const [code, colorName, rText, gText, bText, contributor] = line.split(',');
    if (!code || !colorName || !rText || !gText || !bText) throw new Error(`${name} 色卡存在不完整记录`);
    const rgb: RGB = [Number(rText), Number(gText), Number(bText)];
    if (rgb.some((channel) => !Number.isInteger(channel) || channel < 0 || channel > 255)) {
      throw new Error(`${name} ${code} 的 RGB 无效`);
    }
    return {
      id: `${id}:${code}`,
      brandId,
      paletteId: id,
      code,
      nameZh: colorName,
      nameEn: colorName,
      hex: rgbToHex(rgb),
      rgb,
      lab: rgbToLab(rgb),
      series,
      finish: 'solid',
      active: true,
      source: SOURCE,
      sourceDate: '2026-08-29',
      notes: `Community contributor: ${contributor ?? 'unknown'}; screen approximation only.`
    };
  });
  const codes = new Set(colors.map((color) => color.code));
  if (codes.size !== colors.length) throw new Error(`${name} 色卡存在重复色号`);
  return { id, brandId, name, series, beadSizeMm, version: 'beadcolors-f97ff42', source: SOURCE, colors: colors.sort(naturalCodeSort) };
}

export const PALETTES: Palette[] = [
  parsePalette(mardCsv, 'mard-291', 'mard', 'MARD 291 色', '2.6 mm Mini', 2.6),
  parsePalette(perlerCsv, 'perler-103', 'perler', 'Perler 103 色', '5 mm Midi', 5)
];

export function getPalette(id: string): Palette {
  const palette = PALETTES.find((candidate) => candidate.id === id);
  if (!palette) throw new Error(`找不到色卡：${id}`);
  return palette;
}
