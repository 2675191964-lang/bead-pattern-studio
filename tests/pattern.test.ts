import { describe, expect, it } from 'vitest';
import { boardLayout, createPatternGrid, floodFill, patternStats, remapDisabledColor, replaceColor } from '../src/core/pattern/pattern';
import { rgbToHex, rgbToLab, type RGB } from '../src/core/color/color';
import { TRANSPARENT_CELL, type BeadColor } from '../src/types';

function color(code: string, rgb: RGB): BeadColor {
  return { id: `test:${code}`, brandId: 'test', paletteId: 'test', code, nameZh: code, hex: rgbToHex(rgb), rgb, lab: rgbToLab(rgb), series: 'test', finish: 'solid', active: true, source: 'test', sourceDate: '2026-08-30' };
}

const palette = [color('R', [255, 0, 0]), color('B', [0, 0, 255]), color('K', [0, 0, 0])];

describe('PatternGrid 不变量与编辑', () => {
  it('总数等于非透明格数和分色合计', () => {
    const grid = createPatternGrid(3, 2, palette);
    grid.cells.set([0, 0, 1, TRANSPARENT_CELL, 1, 2]);
    const stats = patternStats(grid);
    expect(stats.total).toBe(5);
    expect(stats.colors.reduce((sum, item) => sum + item.count, 0)).toBe(5);
  });

  it('替换、填充与停用重映射保持索引有效', () => {
    const grid = createPatternGrid(3, 3, palette, 0);
    grid.cells[4] = 1;
    const filled = floodFill(grid, 0, 2);
    expect(Array.from(filled).filter((cell) => cell === 2)).toHaveLength(8);
    const replaced = replaceColor(filled, 2, 0);
    expect(Array.from(replaced).filter((cell) => cell === 2)).toHaveLength(0);
    const remapped = remapDisabledColor({ ...grid, cells: new Uint16Array([0, 1, 0, 1, 0, 1, 0, 1, 0]) }, 0);
    expect(Array.from(remapped).filter((cell) => cell === 0)).toHaveLength(0);
  });

  it('58×58 在 29×29 底板上是 2×2 共 4 板', () => {
    expect(boardLayout({ width: 58, height: 58 }, 29, 29)).toEqual({ columns: 2, rows: 2, count: 4 });
  });
});
