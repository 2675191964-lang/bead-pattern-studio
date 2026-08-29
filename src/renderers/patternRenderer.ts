import { TRANSPARENT_CELL, type PatternGrid } from '../types';

export type RenderMode = 'flat' | 'blueprint' | 'bead' | 'boards';

export interface RenderOptions {
  cellSize: number;
  boardWidth: number;
  boardHeight: number;
  transparentBackground?: boolean;
  showCodes?: boolean;
}

function textColor(hex: string): string {
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 145 ? '#202521' : '#ffffff';
}

export function renderPatternToCanvas(canvas: HTMLCanvasElement, grid: PatternGrid, mode: RenderMode, options: RenderOptions): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const margin = mode === 'blueprint' ? Math.max(24, options.cellSize) : 0;
  const logicalWidth = grid.width * options.cellSize + margin;
  const logicalHeight = grid.height * options.cellSize + margin;
  canvas.width = Math.ceil(logicalWidth * dpr);
  canvas.height = Math.ceil(logicalHeight * dpr);
  canvas.style.width = `${logicalWidth}px`;
  canvas.style.height = `${logicalHeight}px`;
  canvas.style.aspectRatio = `${logicalWidth} / ${logicalHeight}`;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('浏览器无法创建渲染画布');
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, logicalWidth, logicalHeight);
  if (!options.transparentBackground) {
    context.fillStyle = mode === 'bead' ? '#e8e2d8' : '#ffffff';
    context.fillRect(0, 0, logicalWidth, logicalHeight);
  }
  if (margin) {
    context.fillStyle = '#59635d';
    context.font = `${Math.max(9, options.cellSize * 0.34)}px ui-monospace, monospace`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    for (let x = 0; x < grid.width; x += 1) context.fillText(String(x + 1), margin + (x + 0.5) * options.cellSize, margin / 2);
    for (let y = 0; y < grid.height; y += 1) context.fillText(String(y + 1), margin / 2, margin + (y + 0.5) * options.cellSize);
  }
  for (let y = 0; y < grid.height; y += 1) {
    for (let x = 0; x < grid.width; x += 1) {
      const index = y * grid.width + x;
      const paletteIndex = grid.cells[index]!;
      if (paletteIndex === TRANSPARENT_CELL) continue;
      const color = grid.paletteSnapshot[paletteIndex];
      if (!color) continue;
      const left = margin + x * options.cellSize;
      const top = margin + y * options.cellSize;
      if (mode === 'bead') {
        const radius = options.cellSize * 0.43;
        const gradient = context.createRadialGradient(left + options.cellSize * 0.36, top + options.cellSize * 0.31, radius * 0.08, left + options.cellSize / 2, top + options.cellSize / 2, radius);
        gradient.addColorStop(0, '#ffffff');
        gradient.addColorStop(0.18, color.hex);
        gradient.addColorStop(1, color.hex);
        context.fillStyle = 'rgba(0,0,0,.14)';
        context.beginPath();
        context.arc(left + options.cellSize * 0.53, top + options.cellSize * 0.56, radius, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = gradient;
        context.beginPath();
        context.arc(left + options.cellSize / 2, top + options.cellSize / 2, radius, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = mode === 'bead' ? '#e8e2d8' : '#ffffff';
        context.beginPath();
        context.arc(left + options.cellSize / 2, top + options.cellSize / 2, radius * 0.2, 0, Math.PI * 2);
        context.fill();
      } else {
        context.fillStyle = color.hex;
        context.fillRect(left, top, options.cellSize, options.cellSize);
        if ((mode === 'blueprint' || options.showCodes) && options.cellSize >= 14) {
          context.fillStyle = textColor(color.hex);
          context.font = `600 ${Math.max(7, options.cellSize * 0.3)}px ui-monospace, monospace`;
          context.textAlign = 'center';
          context.textBaseline = 'middle';
          context.fillText(color.code, left + options.cellSize / 2, top + options.cellSize / 2, options.cellSize * 0.9);
        }
      }
    }
  }
  if (mode === 'blueprint' || mode === 'boards') {
    for (let x = 0; x <= grid.width; x += 1) {
      context.strokeStyle = x % 10 === 0 ? '#17201c' : x % 5 === 0 ? '#59635d' : 'rgba(31,41,37,.32)';
      context.lineWidth = x % 10 === 0 ? 1.8 : x % 5 === 0 ? 1.2 : 0.5;
      context.beginPath();
      context.moveTo(margin + x * options.cellSize, margin);
      context.lineTo(margin + x * options.cellSize, margin + grid.height * options.cellSize);
      context.stroke();
    }
    for (let y = 0; y <= grid.height; y += 1) {
      context.strokeStyle = y % 10 === 0 ? '#17201c' : y % 5 === 0 ? '#59635d' : 'rgba(31,41,37,.32)';
      context.lineWidth = y % 10 === 0 ? 1.8 : y % 5 === 0 ? 1.2 : 0.5;
      context.beginPath();
      context.moveTo(margin, margin + y * options.cellSize);
      context.lineTo(margin + grid.width * options.cellSize, margin + y * options.cellSize);
      context.stroke();
    }
  }
  if (mode === 'boards') {
    context.strokeStyle = '#ed594a';
    context.lineWidth = Math.max(2, options.cellSize * 0.12);
    context.setLineDash([Math.max(4, options.cellSize * 0.4), Math.max(3, options.cellSize * 0.25)]);
    for (let x = options.boardWidth; x < grid.width; x += options.boardWidth) {
      context.beginPath();
      context.moveTo(x * options.cellSize, 0);
      context.lineTo(x * options.cellSize, grid.height * options.cellSize);
      context.stroke();
    }
    for (let y = options.boardHeight; y < grid.height; y += options.boardHeight) {
      context.beginPath();
      context.moveTo(0, y * options.cellSize);
      context.lineTo(grid.width * options.cellSize, y * options.cellSize);
      context.stroke();
    }
    context.setLineDash([]);
  }
}

export function makeBoardGrid(grid: PatternGrid, boardX: number, boardY: number, boardWidth: number, boardHeight: number): PatternGrid {
  const width = Math.min(boardWidth, grid.width - boardX * boardWidth);
  const height = Math.min(boardHeight, grid.height - boardY * boardHeight);
  const cells = new Uint16Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) cells[y * width + x] = grid.cells[(boardY * boardHeight + y) * grid.width + boardX * boardWidth + x]!;
  }
  return { width, height, cells, paletteSnapshot: grid.paletteSnapshot };
}
