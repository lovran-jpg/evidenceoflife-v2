const STATIC_CACHE = 'dnevnik-restorana-static-v1';
const STATIC_CACHE_PREFIX = 'dnevnik-restorana-static-';
const APP_SHELL = [
  '/',
  '/manifest.webmanifest',
  '/icons/dnevnik-192.png',
  '/icons/dnevnik-512.png',
  '/icons/dnevnik-maskable-512.png',
  '/icons/apple-touch-icon.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys
        .filter(key => key.startsWith(STATIC_CACHE_PREFIX) && key !== STATIC_CACHE)
        .map(key => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Supabase, signed photos, Google Maps/Places and every other third-party
  // request stay entirely outside this service worker and its caches.
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            void caches.open(STATIC_CACHE).then(cache => cache.put('/', copy));
          }
          return response;
        })
        .catch(() => caches.match('/')),
    );
    return;
  }

  const isStaticAsset = url.pathname.startsWith('/assets/') || APP_SHELL.includes(url.pathname);
  if (!isStaticAsset) return;

  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response.ok && response.type === 'basic') {
        const copy = response.clone();
        void caches.open(STATIC_CACHE).then(cache => cache.put(request, copy));
      }
      return response;
    })),
  );
});
