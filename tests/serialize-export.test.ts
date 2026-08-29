import { describe, expect, it } from 'vitest';
import { createMaterialsCsv } from '../src/features/export/exporters';
import { parseProjectFile, serializeProject } from '../src/core/pattern/serialize';
import { rgbToLab } from '../src/core/color/color';
import type { BeadProject } from '../src/types';

const project: BeadProject = {
  schemaVersion: 1,
  id: 'p1', name: '测试', createdAt: '2026-08-30T00:00:00Z', updatedAt: '2026-08-30T00:00:00Z',
  settings: { paletteId: 'test', gridWidth: 2, gridHeight: 2, lockAspect: true, maxColors: 2, boardWidth: 29, boardHeight: 29, beadSizeMm: 5, dither: 'none', ditherStrength: .75, alphaThreshold: 24, backgroundEnabled: false, backgroundHex: '#ffffff', backgroundTolerance: 20, brightness: 0, contrast: 0, saturation: 0, crop: { x: 0, y: 0, width: 1, height: 1 }, removeIsolated: false },
  grid: {
    width: 2, height: 2, cells: new Uint16Array([0, 0, 0, 0]),
    paletteSnapshot: [{ id: 'red', brandId: 'test', paletteId: 'test', code: 'R1', nameZh: '红', hex: '#ff0000', rgb: [255, 0, 0], lab: rgbToLab([255, 0, 0]), series: 'test', finish: 'solid', active: true, source: 'test', sourceDate: '2026-08-30' }]
  },
  ui: { viewMode: 'flat', zoom: 1, selectedPaletteIndex: 0, lockedPaletteIndices: [] }
};

describe('项目与采购导出', () => {
  it('项目 JSON 往返后网格字节一致', () => {
    const parsed = parseProjectFile(JSON.parse(JSON.stringify(serializeProject(project))));
    expect(Array.from(parsed.grid!.cells)).toEqual([0, 0, 0, 0]);
    expect(parsed.grid!.paletteSnapshot[0]!.code).toBe('R1');
  });

  it('CSV 按损耗率和包装规格向上取整', () => {
    const row = createMaterialsCsv(project, 0.1, 3).split('\r\n')[1]!.split(',').map((value) => value.replaceAll('"', ''));
    expect(row[5]).toBe('4');
    expect(row[7]).toBe('5');
    expect(row[9]).toBe('2');
  });
});
