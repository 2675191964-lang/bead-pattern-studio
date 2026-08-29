import { describe, expect, it } from 'vitest';
import { MAX_CANVAS_BITMAP_PIXELS, canvasRenderScale, cellSizeForView, fitZoomForGrid } from '../src/renderers/patternRenderer';

describe('大型网格预览安全边界', () => {
  it('200×200 高分屏画布不超过像素预算', () => {
    const logicalEdge = 200 * 14;
    const scale = canvasRenderScale(logicalEdge, logicalEdge, 2);
    const bitmapPixels = Math.ceil(logicalEdge * scale) ** 2;
    expect(bitmapPixels).toBeLessThanOrEqual(MAX_CANVAS_BITMAP_PIXELS + 6_000);
    expect(scale).toBeLessThan(2);
  });

  it('200×200 自动缩至可浏览范围，普通 29×29 保持原尺寸', () => {
    const largeZoom = fitZoomForGrid(200, 200, 'flat');
    expect(200 * cellSizeForView('flat', largeZoom)).toBeLessThanOrEqual(761);
    expect(largeZoom).toBeGreaterThanOrEqual(0.1);
    expect(fitZoomForGrid(29, 29, 'flat')).toBe(1);
    expect(cellSizeForView('flat', 1)).toBe(14);
  });
});
