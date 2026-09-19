export const MAX_PHOTO_DIMENSION = 2000;
export const TARGET_PHOTO_BYTES = 2 * 1024 * 1024;
const MAX_SOURCE_BYTES = 40 * 1024 * 1024;
const MIN_QUALITY = 0.62;
const QUALITY_STEPS = [0.82, 0.76, 0.70, MIN_QUALITY];
const INPUT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

function sourceType(file: File): string {
  if (file.type) return file.type;
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension === 'heic' || extension === 'heif') return `image/${extension}`;
  return '';
}

export class PhotoOptimizationError extends Error {
  constructor(public readonly filename: string, reason: string, public readonly cause?: unknown) {
    super(`Fotografija „${filename}” nije pripremljena: ${reason}`);
    this.name = 'PhotoOptimizationError';
  }
}

export interface DecodedPhoto {
  width: number;
  height: number;
  draw: (context: CanvasRenderingContext2D, width: number, height: number) => void;
  close: () => void;
}

export interface PhotoAdapter {
  decode: (file: File) => Promise<DecodedPhoto>;
  encode: (canvas: HTMLCanvasElement, type: 'image/webp' | 'image/jpeg', quality: number) => Promise<Blob | null>;
  canvas: () => HTMLCanvasElement;
}

async function browserDecode(file: File): Promise<DecodedPhoto> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return {
        width: bitmap.width, height: bitmap.height,
        draw: (context, width, height) => context.drawImage(bitmap, 0, 0, width, height),
        close: () => bitmap.close(),
      };
    } catch { /* Safari may decode a file through Image even when ImageBitmap rejects it. */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return {
      width: image.naturalWidth, height: image.naturalHeight,
      draw: (context, width, height) => context.drawImage(image, 0, 0, width, height),
      close: () => URL.revokeObjectURL(url),
    };
  } catch (cause) {
    URL.revokeObjectURL(url);
    throw cause;
  }
}

const browserAdapter: PhotoAdapter = {
  decode: browserDecode,
  canvas: () => document.createElement('canvas'),
  encode: (canvas, type, quality) => new Promise(resolve => canvas.toBlob(resolve, type, quality)),
};

export interface OptimizedPhoto {
  file: File;
  width: number;
  height: number;
  originalBytes: number;
  optimizedBytes: number;
  quality: number | null;
}

function outputName(filename: string, type: 'image/webp' | 'image/jpeg'): string {
  const base = filename.replace(/\.[^.]+$/, '') || 'photo';
  return `${base}.${type === 'image/webp' ? 'webp' : 'jpg'}`;
}

export async function optimizeRestaurantPhoto(file: File, adapter: PhotoAdapter = browserAdapter): Promise<OptimizedPhoto> {
  const inputType = sourceType(file);
  if (!INPUT_TYPES.has(inputType) || file.size === 0 || file.size > MAX_SOURCE_BYTES) {
    throw new PhotoOptimizationError(file.name, 'odaberite JPEG, PNG, WebP ili HEIC/HEIF do 40 MB.');
  }
  let decoded: DecodedPhoto;
  try { decoded = await adapter.decode(file); }
  catch (cause) { throw new PhotoOptimizationError(file.name, 'preglednik ne može dekodirati ovu sliku. Na iPhoneu pokušajte je izvesti kao JPEG.', cause); }
  try {
    if (!Number.isFinite(decoded.width) || !Number.isFinite(decoded.height) || decoded.width <= 0 || decoded.height <= 0) {
      throw new PhotoOptimizationError(file.name, 'slika nema valjane dimenzije.');
    }
    const scale = Math.min(1, MAX_PHOTO_DIMENSION / Math.max(decoded.width, decoded.height));
    const width = Math.max(1, Math.round(decoded.width * scale));
    const height = Math.max(1, Math.round(decoded.height * scale));
    const canvas = adapter.canvas();
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new PhotoOptimizationError(file.name, 'obrada slike nije dostupna u pregledniku.');
    // White background keeps transparent PNG pixels predictable in JPEG fallback.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    decoded.draw(context, width, height);

    let best: { blob: Blob; type: 'image/webp' | 'image/jpeg'; quality: number } | null = null;
    for (const type of ['image/webp', 'image/jpeg'] as const) {
      for (const quality of QUALITY_STEPS) {
        let blob: Blob | null;
        try { blob = await adapter.encode(canvas, type, quality); }
        catch { blob = null; }
        if (!blob?.size || blob.type !== type) break;
        if (!best || blob.size < best.blob.size) best = { blob, type, quality };
        if (blob.size <= TARGET_PHOTO_BYTES) {
          best = { blob, type, quality };
          break;
        }
      }
      if (best?.blob.size && best.blob.size <= TARGET_PHOTO_BYTES) break;
    }
    if (!best) throw new PhotoOptimizationError(file.name, 'preglednik ne može izvesti WebP ili JPEG.');

    const noResize = scale === 1;
    const alreadySmall = file.size <= TARGET_PHOTO_BYTES &&
      (inputType === 'image/jpeg' || inputType === 'image/png' || inputType === 'image/webp');
    const output = noResize && alreadySmall && best.blob.size >= file.size ? file
      : new File([best.blob], outputName(file.name, best.type), { type: best.type, lastModified: Date.now() });
    if (output.size > 5 * 1024 * 1024) throw new PhotoOptimizationError(file.name, 'optimizirana slika je i dalje veća od 5 MB. Odaberite manju datoteku.');
    return { file: output, width, height, originalBytes: file.size, optimizedBytes: output.size, quality: output === file ? null : best.quality };
  } catch (cause) {
    if (cause instanceof PhotoOptimizationError) throw cause;
    throw new PhotoOptimizationError(file.name, 'obrada slike nije uspjela.', cause);
  } finally {
    decoded.close();
  }
}

export async function optimizeRestaurantPhotos(files: File[], adapter: PhotoAdapter = browserAdapter): Promise<OptimizedPhoto[]> {
  const prepared: OptimizedPhoto[] = [];
  for (const file of files) prepared.push(await optimizeRestaurantPhoto(file, adapter));
  return prepared;
}
