import { boardLayout, patternStats } from '../../core/pattern/pattern';
import { serializeProject } from '../../core/pattern/serialize';
import { makeBoardGrid, renderPatternToCanvas, type RenderMode } from '../../renderers/patternRenderer';
import { TRANSPARENT_CELL, type BeadProject, type PatternGrid } from '../../types';

export function safeFileName(value: string): string {
  const withoutControls = Array.from(value, (character) => character.charCodeAt(0) < 32 ? '_' : character).join('');
  return withoutControls.trim().replace(/[<>:"/\\|?*]/g, '_').replace(/[. ]+$/g, '').slice(0, 80) || 'bead-pattern';
}

function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function canvasBlob(canvas: HTMLCanvasElement, type = 'image/png'): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('画布导出失败')), type));
}

export async function exportPng(project: BeadProject, mode: RenderMode, scale: number): Promise<void> {
  if (!project.grid) throw new Error('请先生成图案');
  const canvas = document.createElement('canvas');
  const cellSize = Math.max(mode === 'blueprint' ? 24 : 10, (mode === 'blueprint' ? 24 : 10) * scale);
  renderPatternToCanvas(canvas, project.grid, mode, {
    cellSize,
    boardWidth: project.settings.boardWidth,
    boardHeight: project.settings.boardHeight,
    transparentBackground: mode !== 'blueprint',
    showCodes: mode === 'blueprint'
  });
  download(await canvasBlob(canvas), `${safeFileName(project.name)}_${project.grid.width}x${project.grid.height}_${mode}.png`);
}

export function createMaterialsCsv(project: BeadProject, wasteRate = 0.08, packageSize = 1000): string {
  if (!project.grid) throw new Error('请先生成图案');
  const stats = patternStats(project.grid);
  const rows = stats.colors.map(({ color, count }) => {
    const recommended = Math.ceil(count * (1 + wasteRate));
    const packages = Math.ceil(recommended / packageSize);
    return [color.brandId, color.paletteId, color.code, color.nameZh, color.hex, count, wasteRate, recommended, packageSize, packages]
      .map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',');
  });
  return ['brand_id,palette_id,color_code,color_name_zh,hex,required_count,waste_rate,recommended_count,package_size,packages_needed', ...rows].join('\r\n');
}

export function exportCsv(project: BeadProject, wasteRate: number, packageSize: number): void {
  download(new Blob(['\ufeff', createMaterialsCsv(project, wasteRate, packageSize)], { type: 'text/csv;charset=utf-8' }), `${safeFileName(project.name)}_materials.csv`);
}

export function createSvg(grid: PatternGrid, cellSize = 24, boardWidth = 29, boardHeight = 29): string {
  const width = grid.width * cellSize;
  const height = grid.height * cellSize;
  const items: string[] = [`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`, '<rect width="100%" height="100%" fill="white"/>'];
  for (let y = 0; y < grid.height; y += 1) {
    for (let x = 0; x < grid.width; x += 1) {
      const index = grid.cells[y * grid.width + x]!;
      if (index === TRANSPARENT_CELL) continue;
      const color = grid.paletteSnapshot[index]!;
      items.push(`<rect x="${x * cellSize}" y="${y * cellSize}" width="${cellSize}" height="${cellSize}" fill="${color.hex}" stroke="#28312d" stroke-width=".5"/>`);
      if (cellSize >= 18) items.push(`<text x="${x * cellSize + cellSize / 2}" y="${y * cellSize + cellSize * 0.63}" text-anchor="middle" font-family="monospace" font-size="${Math.max(6, cellSize * 0.28)}" fill="#111">${color.code}</text>`);
    }
  }
  for (let x = boardWidth; x < grid.width; x += boardWidth) items.push(`<line x1="${x * cellSize}" y1="0" x2="${x * cellSize}" y2="${height}" stroke="#e45445" stroke-width="3" stroke-dasharray="8 5"/>`);
  for (let y = boardHeight; y < grid.height; y += boardHeight) items.push(`<line x1="0" y1="${y * cellSize}" x2="${width}" y2="${y * cellSize}" stroke="#e45445" stroke-width="3" stroke-dasharray="8 5"/>`);
  items.push('</svg>');
  return items.join('');
}

export function exportSvg(project: BeadProject): void {
  if (!project.grid) throw new Error('请先生成图案');
  download(new Blob([createSvg(project.grid, 24, project.settings.boardWidth, project.settings.boardHeight)], { type: 'image/svg+xml;charset=utf-8' }), `${safeFileName(project.name)}_blueprint.svg`);
}

export function exportProjectJson(project: BeadProject): void {
  download(new Blob([JSON.stringify(serializeProject(project), null, 2)], { type: 'application/json' }), `${safeFileName(project.name)}.bead.json`);
}

function asciiTitle(value: string): string {
  const ascii = value.replace(/[^\x20-\x7e]/g, '').trim();
  return ascii || 'Bead Pattern';
}

export async function exportPdf(project: BeadProject, wasteRate = 0.08, packageSize = 1000): Promise<void> {
  if (!project.grid) throw new Error('请先生成图案');
  const { jsPDF } = await import('jspdf');
  const grid = project.grid;
  const stats = patternStats(grid);
  const boards = boardLayout(grid, project.settings.boardWidth, project.settings.boardHeight);
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(20);
  pdf.text(asciiTitle(project.name), 16, 20);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.text(`Grid: ${grid.width} x ${grid.height}`, 16, 30);
  pdf.text(`Beads: ${stats.total}    Colors: ${stats.colors.length}    Boards: ${boards.columns} x ${boards.rows} = ${boards.count}`, 16, 36);
  pdf.text(`Physical size: ${(grid.width * project.settings.beadSizeMm / 10).toFixed(1)} x ${(grid.height * project.settings.beadSizeMm / 10).toFixed(1)} cm`, 16, 42);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Materials', 16, 52);
  pdf.setFont('helvetica', 'normal');
  let y = 59;
  for (const item of stats.colors) {
    const recommended = Math.ceil(item.count * (1 + wasteRate));
    const packages = Math.ceil(recommended / packageSize);
    pdf.setFillColor(item.color.rgb[0], item.color.rgb[1], item.color.rgb[2]);
    pdf.rect(16, y - 3.5, 4, 4, 'F');
    pdf.text(`${item.color.code}  ${item.count} pcs  buy ${recommended}  (${packages} x ${packageSize})`, 23, y);
    y += 6;
    if (y > 282) {
      pdf.addPage();
      y = 18;
    }
  }
  for (let boardY = 0; boardY < boards.rows; boardY += 1) {
    for (let boardX = 0; boardX < boards.columns; boardX += 1) {
      pdf.addPage('a4', 'portrait');
      const board = makeBoardGrid(grid, boardX, boardY, project.settings.boardWidth, project.settings.boardHeight);
      const canvas = document.createElement('canvas');
      renderPatternToCanvas(canvas, board, 'blueprint', { cellSize: 28, boardWidth: project.settings.boardWidth, boardHeight: project.settings.boardHeight, showCodes: true });
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(13);
      pdf.text(`Board ${boardY * boards.columns + boardX + 1} / ${boards.count}  [row ${boardY + 1}, col ${boardX + 1}]`, 14, 14);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.text('Print at 100% / Actual size. Verify the 50 mm calibration line before construction.', 14, 20);
      pdf.line(14, 25, 64, 25);
      pdf.text('50 mm', 34, 29);
      const ratio = Math.min(180 / canvas.width, 245 / canvas.height);
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 14, 34, canvas.width * ratio, canvas.height * ratio, undefined, 'FAST');
    }
  }
  download(pdf.output('blob'), `${safeFileName(project.name)}_construction.pdf`);
}
