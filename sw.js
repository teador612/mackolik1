const CACHE_NAME = 'mackolik-v1';

const FILES = [
  './',
  './index.html',
  './manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(FILES))
  );

  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );

  self.clients.claim();
});

self.addEventListener('fetch', event => {

  const url = new URL(event.request.url);

  /*
    matches.json her zaman GitHub'dan güncel çekilsin.
  */
  if(url.pathname.endsWith('/data/matches.json')){
    event.respondWith(
      fetch(event.request, {
        cache:'no-store'
      })
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .catch(() => caches.match(event.request))
  );
});
