import type { ImagePixels } from '../../types';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_WORK_EDGE = 3000;

export interface DecodedImage {
  pixels: ImagePixels;
  originalWidth: number;
  originalHeight: number;
  thumbnail: string;
}

export function validateImageFile(file: Blob & { name?: string }): void {
  if (!ALLOWED_TYPES.has(file.type)) throw new Error('请选择 JPG、PNG 或 WebP 图片');
  if (file.size > MAX_FILE_BYTES) throw new Error('图片超过 25 MB，请先压缩后再导入');
}

export async function decodeImage(blob: Blob): Promise<DecodedImage> {
  validateImageFile(blob);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('浏览器无法解码这张图片，文件可能损坏或格式不受支持');
  }
  const originalWidth = bitmap.width;
  const originalHeight = bitmap.height;
  const scale = Math.min(1, MAX_WORK_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('浏览器无法创建图片处理画布');
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const pixels = context.getImageData(0, 0, width, height);
  const thumbCanvas = document.createElement('canvas');
  const thumbScale = Math.min(1, 320 / Math.max(width, height));
  thumbCanvas.width = Math.max(1, Math.round(width * thumbScale));
  thumbCanvas.height = Math.max(1, Math.round(height * thumbScale));
  thumbCanvas.getContext('2d')?.drawImage(canvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
  return {
    pixels: { width, height, data: pixels.data },
    originalWidth,
    originalHeight,
    thumbnail: thumbCanvas.toDataURL('image/jpeg', 0.78)
  };
}
