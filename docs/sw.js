'use strict';

const SHELL_CACHE = 'engineering-answers-shell-v1';
const MEDIA_CACHE = 'engineering-answers-pages-v1';
const SHELL = ['./', './index.html', './style.css?v=1', './app.js?v=1', './pages-data.js?v=1',
  './manifest.webmanifest', './icon.svg', './icon-180.png', './icon-192.png', './icon-512.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL_CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('engineering-answers-shell-') && key !== SHELL_CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || !url.href.startsWith(self.registration.scope)) return;
  const isImage = /\/(pages|pages-mobile|thumbnails)\/\d+\.webp$/.test(url.pathname);
  event.respondWith((async () => {
    const cache = await caches.open(isImage ? MEDIA_CACHE : SHELL_CACHE);
    const cached = await cache.match(event.request);
    if (cached) return cached;
    try {
      const response = await fetch(event.request);
      if (response.ok) event.waitUntil(cache.put(event.request, response.clone()));
      return response;
    } catch {
      if (event.request.mode === 'navigate') return cache.match(new URL('./index.html', self.registration.scope));
      if (/\/pages(?:-mobile)?\//.test(url.pathname)) {
        url.pathname = url.pathname.includes('/pages-mobile/') ? url.pathname.replace('/pages-mobile/', '/pages/') : url.pathname.replace('/pages/', '/pages-mobile/');
        const otherSize = await cache.match(url.href);
        if (otherSize) return otherSize;
      }
      return Response.error();
    }
  })());
});
