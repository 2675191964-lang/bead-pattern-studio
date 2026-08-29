import type { BeadProject, ProjectFileV1, SerializedPatternGrid } from '../../types';

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 32_768;
  for (let index = 0; index < bytes.length; index += chunk) binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export function serializeGrid(grid: NonNullable<BeadProject['grid']>): SerializedPatternGrid {
  return {
    width: grid.width,
    height: grid.height,
    cellsBase64: bytesToBase64(new Uint8Array(grid.cells.buffer, grid.cells.byteOffset, grid.cells.byteLength)),
    paletteSnapshot: grid.paletteSnapshot
  };
}

export function serializeProject(project: BeadProject): ProjectFileV1 {
  return { ...project, grid: project.grid ? serializeGrid(project.grid) : undefined };
}

export function parseProjectFile(value: unknown): BeadProject {
  if (!value || typeof value !== 'object') throw new Error('项目文件不是有效对象');
  const file = value as Partial<ProjectFileV1>;
  if (file.schemaVersion !== 1) throw new Error(`不支持的项目版本：${String(file.schemaVersion)}`);
  if (!file.id || !file.name || !file.settings || !file.ui) throw new Error('项目文件缺少必填字段');
  let grid;
  if (file.grid) {
    const { width, height, cellsBase64, paletteSnapshot } = file.grid;
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 200 || height > 200) throw new Error('项目网格尺寸无效');
    const bytes = base64ToBytes(cellsBase64);
    if (bytes.byteLength !== width * height * Uint16Array.BYTES_PER_ELEMENT) throw new Error('项目网格字节长度不匹配');
    const aligned = bytes.slice().buffer;
    const cells = new Uint16Array(aligned);
    for (const cell of cells) if (cell !== 65_535 && cell >= paletteSnapshot.length) throw new Error('项目网格包含越界色卡索引');
    grid = { width, height, cells, paletteSnapshot };
  }
  return { ...(file as ProjectFileV1), grid };
}
