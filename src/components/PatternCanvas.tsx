import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { applyRect, floodFill } from '../core/pattern/pattern';
import { renderPatternToCanvas, type RenderMode } from '../renderers/patternRenderer';
import { TRANSPARENT_CELL, type PatternGrid } from '../types';

export type EditorTool = 'brush' | 'eraser' | 'fill' | 'picker' | 'rect' | 'pan';

interface PatternCanvasProps {
  grid: PatternGrid;
  mode: RenderMode;
  zoom: number;
  boardWidth: number;
  boardHeight: number;
  tool?: EditorTool;
  selectedPaletteIndex?: number;
  lockedPaletteIndices?: number[];
  onCommit?: (cells: Uint16Array) => void;
  onPick?: (paletteIndex: number) => void;
  ariaLabel?: string;
}

export function PatternCanvas({
  grid, mode, zoom, boardWidth, boardHeight, tool = 'pan', selectedPaletteIndex = 0,
  lockedPaletteIndices = [], onCommit, onPick, ariaLabel = '拼豆图案画布'
}: PatternCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [draftCells, setDraftCells] = useState(grid.cells);
  const drawing = useRef(false);
  const rectStart = useRef<number | undefined>(undefined);
  const locked = useMemo(() => new Set(lockedPaletteIndices), [lockedPaletteIndices]);
  const cellSize = Math.max(mode === 'blueprint' ? 18 : 10, (mode === 'blueprint' ? 22 : 14) * zoom);
  const displayGrid = useMemo(() => ({ ...grid, cells: draftCells }), [grid, draftCells]);

  useEffect(() => {
    if (!drawing.current) setDraftCells(grid.cells);
  }, [grid.cells]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    renderPatternToCanvas(canvas, displayGrid, mode, { cellSize, boardWidth, boardHeight, showCodes: mode === 'blueprint' });
  }, [displayGrid, mode, cellSize, boardWidth, boardHeight]);

  const indexAt = (event: ReactPointerEvent<HTMLCanvasElement>): number => {
    const canvas = canvasRef.current;
    if (!canvas) return -1;
    const rect = canvas.getBoundingClientRect();
    const margin = mode === 'blueprint' ? Math.max(24, cellSize) : 0;
    const logicalWidth = grid.width * cellSize + margin;
    const logicalHeight = grid.height * cellSize + margin;
    const x = ((event.clientX - rect.left) * logicalWidth / rect.width - margin) / cellSize;
    const y = ((event.clientY - rect.top) * logicalHeight / rect.height - margin) / cellSize;
    const gx = Math.floor(x);
    const gy = Math.floor(y);
    return gx < 0 || gy < 0 || gx >= grid.width || gy >= grid.height ? -1 : gy * grid.width + gx;
  };

  const paint = (index: number) => {
    if (index < 0) return;
    const current = draftCells[index]!;
    if (locked.has(current)) return;
    const replacement = tool === 'eraser' ? TRANSPARENT_CELL : selectedPaletteIndex;
    if (current === replacement) return;
    setDraftCells((previous) => {
      const next = previous.slice();
      next[index] = replacement;
      return next;
    });
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const index = indexAt(event);
    if (index < 0 || tool === 'pan') return;
    event.currentTarget.setPointerCapture(event.pointerId);
    if (tool === 'picker') {
      const color = draftCells[index]!;
      if (color !== TRANSPARENT_CELL) onPick?.(color);
      return;
    }
    if (tool === 'fill') {
      const next = floodFill({ ...grid, cells: draftCells }, index, selectedPaletteIndex);
      setDraftCells(next);
      onCommit?.(next);
      return;
    }
    drawing.current = true;
    if (tool === 'rect') rectStart.current = index;
    else paint(index);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || (tool !== 'brush' && tool !== 'eraser')) return;
    paint(indexAt(event));
  };

  const finishDrawing = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    drawing.current = false;
    let next = draftCells;
    if (tool === 'rect' && rectStart.current !== undefined) {
      const end = indexAt(event);
      if (end >= 0) next = applyRect({ ...grid, cells: draftCells }, rectStart.current, end, selectedPaletteIndex);
      rectStart.current = undefined;
      setDraftCells(next);
    }
    onCommit?.(next);
  };

  return (
    <canvas
      ref={canvasRef}
      className={`pattern-canvas tool-${tool}`}
      aria-label={ariaLabel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrawing}
      onPointerCancel={finishDrawing}
    />
  );
}
