// A complete version is cached before installation succeeds. Updates activate
// when the previous app windows close, keeping HTML and hashed assets together.
const CORE_FILES = __CORE_FILES__;
const CACHE_PREFIX = 'krono-app:' + self.registration.scope + ':';
const CACHE_NAME = CACHE_PREFIX + '__VERSION__';
const coreURLs = new Set(CORE_FILES.map(file => new URL(file, self.registration.scope).href));
const indexURL = new URL('index.html', self.registration.scope).href;
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll([...coreURLs])));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  const navigation = request.mode === 'navigate' && url.href.startsWith(self.registration.scope);
  if (!navigation && !coreURLs.has(url.href)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    return (await cache.match(navigation ? indexURL : request)) || fetch(request);
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type === 'ACTIVATE_UPDATE') event.waitUntil(self.skipWaiting());
});
