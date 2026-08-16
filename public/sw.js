// SelfGains service worker — caché de app-shell únicamente.
// No guarda datos de usuario ni intercepta escrituras a Supabase.
// Ver docs/superpowers/specs/2026-08-16-pwa-instalable-y-fluidez-design.md.
const VERSION = 'selfgains-shell-v1';

const SHELL = ['/SelfGains/', '/SelfGains/favicon.svg', '/SelfGains/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isHashedAsset(url) {
  return url.pathname.includes('/_astro/');
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== 'GET') return;

  if (isHashedAsset(url)) {
    // Cache-first: Vite hashea el nombre de archivo por contenido, es seguro
    // cachearlo indefinidamente.
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          const copy = response.clone();
          caches.open(VERSION).then((cache) => cache.put(event.request, copy));
          return response;
        });
      })
    );
    return;
  }

  // Network-first para todo lo demás (HTML, manifest, favicons, este mismo
  // sw.js) — siempre preferir la versión más nueva cuando hay conexión, caer
  // al caché del shell solo si falla la red.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(VERSION).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
