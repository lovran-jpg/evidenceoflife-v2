import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (file: string) => readFileSync(path.join(root, file));
const readText = (file: string) => read(file).toString('utf8');

describe('Dnevnik restorana PWA konfiguracija', () => {
  it('koristi V1 identitet i otvara root u standalone načinu', () => {
    const manifest = JSON.parse(readText('public/manifest.webmanifest')) as {
      name: string;
      short_name: string;
      start_url: string;
      scope: string;
      display: string;
      theme_color: string;
      background_color: string;
    };

    expect(manifest).toMatchObject({
      name: 'Dnevnik restorana',
      short_name: 'Dnevnik',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      theme_color: '#d4875f',
      background_color: '#fffaf5',
    });
    expect(readText('public/manifest.webmanifest')).not.toContain('Evidence of Life');
  });

  it('navodi standardne, maskable i Apple ikone stvarnih dimenzija', () => {
    const manifest = JSON.parse(readText('public/manifest.webmanifest')) as {
      icons: Array<{ src: string; sizes: string; purpose: string }>;
    };
    expect(manifest.icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ src: '/icons/dnevnik-192.png', sizes: '192x192', purpose: 'any' }),
      expect.objectContaining({ src: '/icons/dnevnik-512.png', sizes: '512x512', purpose: 'any' }),
      expect.objectContaining({ src: '/icons/dnevnik-maskable-512.png', sizes: '512x512', purpose: 'maskable' }),
    ]));

    const pngSize = (file: string) => {
      const png = read(file);
      return [png.readUInt32BE(16), png.readUInt32BE(20)];
    };
    expect(pngSize('public/icons/dnevnik-192.png')).toEqual([192, 192]);
    expect(pngSize('public/icons/dnevnik-512.png')).toEqual([512, 512]);
    expect(pngSize('public/icons/dnevnik-maskable-512.png')).toEqual([512, 512]);
    expect(pngSize('public/icons/apple-touch-icon.png')).toEqual([180, 180]);
  });

  it('izlaže manifest, Apple standalone metadata i novi touch icon', () => {
    const html = readText('index.html');
    expect(html).toContain('rel="manifest" href="/manifest.webmanifest"');
    expect(html).toContain('name="apple-mobile-web-app-capable" content="yes"');
    expect(html).toContain('name="apple-mobile-web-app-title" content="Dnevnik"');
    expect(html).toContain('rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png"');
    expect(html).not.toContain('Evidence of Life');
  });

  it('cacheira samo same-origin app shell i statičke assete', () => {
    const worker = readText('public/sw.js');
    expect(worker).toContain("if (url.origin !== self.location.origin) return;");
    expect(worker).toContain("url.pathname.startsWith('/assets/') || APP_SHELL.includes(url.pathname)");
    expect(worker).toContain("if (request.mode === 'navigate')");
    expect(worker).not.toMatch(/supabase\.co|googleapis\.com|google\.com\/maps|indexedDB/i);
    expect(worker).not.toContain('signedUrl');
  });
});
