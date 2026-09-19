import { describe, expect, it, vi } from 'vitest';
import { optimizeRestaurantPhoto, optimizeRestaurantPhotos, PhotoOptimizationError, TARGET_PHOTO_BYTES } from '@/lib/optimizeRestaurantPhoto';
import type { PhotoAdapter } from '@/lib/optimizeRestaurantPhoto';

function setup(width: number, height: number, options: { webp?: boolean; bytes?: number; fail?: boolean } = {}) {
  const draw = vi.fn();
  const close = vi.fn();
  const context = { fillRect: vi.fn(), drawImage: vi.fn(), fillStyle: '' };
  const canvas = { width: 0, height: 0, getContext: () => context } as unknown as HTMLCanvasElement;
  const decode = vi.fn(async (file: File) => {
    if (options.fail && file.name === 'bad.heic') throw new Error('decoder failed');
    return { width, height, draw, close };
  });
  const encode = vi.fn(async (_canvas: HTMLCanvasElement, type: 'image/webp' | 'image/jpeg', quality: number) => {
    if (type === 'image/webp' && options.webp === false) return new Blob(['jpeg'], { type: 'image/jpeg' });
    const size = options.bytes ?? (quality > 0.76 ? TARGET_PHOTO_BYTES + 100 : TARGET_PHOTO_BYTES - 100);
    return new Blob([new Uint8Array(size)], { type });
  });
  return { adapter: { decode, encode, canvas: () => canvas } satisfies PhotoAdapter, canvas, draw, close, encode };
}

const photo = (name: string, type = 'image/jpeg', bytes = 10) => new File([new Uint8Array(bytes)], name, { type });

describe('browser photo optimization', () => {
  it('limits a large landscape image to 2000 pixels and keeps its aspect ratio', async () => {
    const f = setup(4032, 3024);
    const result = await optimizeRestaurantPhoto(photo('landscape.png', 'image/png'), f.adapter);
    expect([result.width, result.height]).toEqual([2000, 1500]);
    expect(f.canvas.width).toBe(2000);
    expect(f.canvas.height).toBe(1500);
    expect(f.draw).toHaveBeenCalledWith(expect.anything(), 2000, 1500);
    expect(result.file.type).toBe('image/webp');
    expect(result.file.name).toBe('landscape.webp');
    expect(result.quality).toBe(0.76);
    expect(result.optimizedBytes).toBeLessThan(TARGET_PHOTO_BYTES);
    expect(f.close).toHaveBeenCalled();
  });

  it('keeps portrait orientation and never upscales a small image', async () => {
    const portrait = setup(3024, 4032);
    const result = await optimizeRestaurantPhoto(photo('portrait.heic', 'image/heic'), portrait.adapter);
    expect([result.width, result.height]).toEqual([1500, 2000]);
    const small = setup(800, 600);
    const resized = await optimizeRestaurantPhoto(photo('small.png', 'image/png'), small.adapter);
    expect([resized.width, resized.height]).toEqual([800, 600]);
    expect(resized.file.name).toBe('small.png');
  });

  it('uses JPEG if WebP encoding is unsupported and matches MIME and filename', async () => {
    const f = setup(3000, 2000, { webp: false, bytes: TARGET_PHOTO_BYTES - 1 });
    const result = await optimizeRestaurantPhoto(photo('iphone.HEIC', 'image/heic'), f.adapter);
    expect(result.file.type).toBe('image/jpeg');
    expect(result.file.name).toBe('iphone.jpg');
    expect(result.file.size).toBeLessThan(TARGET_PHOTO_BYTES);
  });

  it('does not make an already small JPEG larger just to re-encode', async () => {
    const f = setup(900, 700, { bytes: 3000 });
    const original = photo('small.jpg', 'image/jpeg', 1000);
    const result = await optimizeRestaurantPhoto(original, f.adapter);
    expect(result.file).toBe(original);
    expect(result.quality).toBeNull();
  });

  it('reduces quality to 0.62 at most and rejects output above upload limit', async () => {
    const f = setup(4000, 3000, { bytes: 6 * 1024 * 1024 });
    await expect(optimizeRestaurantPhoto(photo('huge.png', 'image/png'), f.adapter)).rejects.toThrow('veća od 5 MB');
    expect(f.encode).toHaveBeenCalledWith(expect.anything(), 'image/webp', 0.62);
  });

  it('returns a batch only when every photo decodes, without sending anything to Storage', async () => {
    const f = setup(1200, 800, { fail: true });
    const good = photo('good.jpg');
    const bad = photo('bad.heic', 'image/heic');
    await expect(optimizeRestaurantPhotos([good, bad], f.adapter)).rejects.toMatchObject({ filename: 'bad.heic' });
    expect(f.adapter.decode).toHaveBeenCalledTimes(2);
    expect(await optimizeRestaurantPhotos([good, good], f.adapter)).toHaveLength(2);
  });

  it('rejects undecodable HEIC with a named, actionable error', async () => {
    const f = setup(1000, 1000, { fail: true });
    await expect(optimizeRestaurantPhoto(photo('bad.heic', 'image/heic'), f.adapter)).rejects.toBeInstanceOf(PhotoOptimizationError);
    await expect(optimizeRestaurantPhoto(photo('bad.heic', 'image/heic'), f.adapter)).rejects.toThrow('JPEG');
  });
});
