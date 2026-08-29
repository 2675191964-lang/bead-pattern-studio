import type { ConversionResult } from '../core/quantize/convert';
import type { ConversionSettings, ImagePixels } from '../types';

type ProgressHandler = (stage: string, ratio: number) => void;

export class ConversionClient {
  private worker?: Worker;
  private jobId = 0;

  cancel(): void {
    this.worker?.terminate();
    this.worker = undefined;
    this.jobId += 1;
  }

  convert(image: ImagePixels, settings: ConversionSettings, onProgress?: ProgressHandler): Promise<ConversionResult> {
    this.cancel();
    const jobId = this.jobId;
    const worker = new Worker(new URL('./conversion.worker.ts', import.meta.url), { type: 'module' });
    this.worker = worker;
    return new Promise((resolve, reject) => {
      worker.onmessage = (event: MessageEvent<{ type: string; jobId: number; stage?: string; ratio?: number; result?: ConversionResult; message?: string }>) => {
        if (event.data.jobId !== jobId || worker !== this.worker) return;
        if (event.data.type === 'progress') onProgress?.(event.data.stage ?? '', event.data.ratio ?? 0);
        if (event.data.type === 'result' && event.data.result) {
          worker.terminate();
          this.worker = undefined;
          resolve(event.data.result);
        }
        if (event.data.type === 'error') {
          worker.terminate();
          this.worker = undefined;
          reject(new Error(event.data.message ?? '转换失败'));
        }
      };
      worker.onerror = (event) => {
        if (worker !== this.worker) return;
        worker.terminate();
        this.worker = undefined;
        reject(new Error(event.message || '转换 Worker 意外停止'));
      };
      worker.postMessage({ type: 'convert', jobId, image, settings }, [image.data.buffer]);
    });
  }
}
