/// <reference lib="webworker" />
import { convertImageToPattern } from '../core/quantize/convert';
import { getPalette } from '../core/palette/palettes';
import type { ConversionSettings, ImagePixels } from '../types';

interface ConvertMessage {
  type: 'convert';
  jobId: number;
  image: ImagePixels;
  settings: ConversionSettings;
}

self.onmessage = (event: MessageEvent<ConvertMessage>) => {
  const { jobId, image, settings } = event.data;
  try {
    const palette = getPalette(settings.paletteId);
    const result = convertImageToPattern(image, settings, palette.colors, (stage, ratio) => {
      self.postMessage({ type: 'progress', jobId, stage, ratio });
    });
    self.postMessage({ type: 'result', jobId, result }, [result.grid.cells.buffer]);
  } catch (error) {
    self.postMessage({ type: 'error', jobId, message: error instanceof Error ? error.message : '转换失败' });
  }
};
