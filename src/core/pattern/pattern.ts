import { ciede2000 } from '../color/color';
import { TRANSPARENT_CELL, type BeadColor, type PatternGrid } from '../../types';

export interface ColorStat {
  paletteIndex: number;
  color: BeadColor;
  count: number;
  ratio: number;
}

export function createPatternGrid(width: number, height: number, paletteSnapshot: BeadColor[], fill = TRANSPARENT_CELL): PatternGrid {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 200 || height > 200) {
    throw new Error('网格尺寸必须是 1–200 的整数');
  }
  const cells = new Uint16Array(width * height);
  cells.fill(fill);
  return { width, height, cells, paletteSnapshot };
}

export function patternStats(grid: PatternGrid): { total: number; colors: ColorStat[] } {
  const counts = new Uint32Array(grid.paletteSnapshot.length);
  let total = 0;
  for (const cell of grid.cells) {
    if (cell === TRANSPARENT_CELL) continue;
    if (cell >= grid.paletteSnapshot.length) throw new Error(`网格包含越界色卡索引：${cell}`);
    counts[cell] = (counts[cell] ?? 0) + 1;
    total += 1;
  }
  const colors = Array.from(counts.entries())
    .filter(([, count]) => count > 0)
    .map(([paletteIndex, count]) => ({ paletteIndex, color: grid.paletteSnapshot[paletteIndex]!, count, ratio: count / total }))
    .sort((a, b) => b.count - a.count || a.color.code.localeCompare(b.color.code, undefined, { numeric: true }));
  return { total, colors };
}

export function replaceColor(cells: Uint16Array, fromIndex: number, toIndex: number): Uint16Array {
  const next = cells.slice();
  for (let index = 0; index < next.length; index += 1) if (next[index] === fromIndex) next[index] = toIndex;
  return next;
}

export function remapDisabledColor(grid: PatternGrid, disabledIndex: number): Uint16Array {
  const disabled = grid.paletteSnapshot[disabledIndex];
  if (!disabled) throw new Error('待停用色号不存在');
  let replacement = -1;
  let distance = Number.POSITIVE_INFINITY;
  grid.paletteSnapshot.forEach((color, index) => {
    if (index === disabledIndex || !color.active) return;
    const candidate = ciede2000(disabled.lab, color.lab);
    if (candidate < distance) {
      distance = candidate;
      replacement = index;
    }
  });
  if (replacement < 0) throw new Error('没有可用于重映射的候选颜色');
  return replaceColor(grid.cells, disabledIndex, replacement);
}

export function floodFill(grid: PatternGrid, startIndex: number, replacement: number): Uint16Array {
  if (startIndex < 0 || startIndex >= grid.cells.length) return grid.cells.slice();
  const target = grid.cells[startIndex];
  if (target === replacement) return grid.cells.slice();
  const cells = grid.cells.slice();
  const queue = [startIndex];
  cells[startIndex] = replacement;
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const index = queue[cursor]!;
    const x = index % grid.width;
    const y = Math.floor(index / grid.width);
    const neighbors = [x > 0 ? index - 1 : -1, x + 1 < grid.width ? index + 1 : -1, y > 0 ? index - grid.width : -1, y + 1 < grid.height ? index + grid.width : -1];
    for (const neighbor of neighbors) {
      if (neighbor >= 0 && cells[neighbor] === target) {
        cells[neighbor] = replacement;
        queue.push(neighbor);
      }
    }
  }
  return cells;
}

export function applyRect(grid: PatternGrid, start: number, end: number, replacement: number): Uint16Array {
  const cells = grid.cells.slice();
  const sx = start % grid.width;
  const sy = Math.floor(start / grid.width);
  const ex = end % grid.width;
  const ey = Math.floor(end / grid.width);
  for (let y = Math.min(sy, ey); y <= Math.max(sy, ey); y += 1) {
    for (let x = Math.min(sx, ex); x <= Math.max(sx, ex); x += 1) cells[y * grid.width + x] = replacement;
  }
  return cells;
}

export function boardLayout(grid: Pick<PatternGrid, 'width' | 'height'>, boardWidth: number, boardHeight: number) {
  const columns = Math.ceil(grid.width / boardWidth);
  const rows = Math.ceil(grid.height / boardHeight);
  return { columns, rows, count: columns * rows };
}
