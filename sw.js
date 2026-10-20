/*
 * Money Buddy – offline support.
 * Shows the saved copy right away (works with no internet), then quietly
 * fetches a fresh copy for next time.
 *
 * When you change any app file, raise the number in CACHE (v2 → v3)
 * so phones pick up the new version.
 */
var CACHE = 'money-buddy-v3';

var FILES = [
  './',
  './index.html',
  './styles.css',
  './copy.js',
  './logic.js',
  './storage.js',
  './speech.js',
  './app.js',
  './manifest.json',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE)
      .then(function (cache) { return cache.addAll(FILES); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE).then(function (cache) {
      return cache.match(req, { ignoreSearch: true }).then(function (cached) {
        var fresh = fetch(req).then(function (res) {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        }).catch(function () {
          if (cached) return cached;
          if (req.mode === 'navigate') return cache.match('./index.html');
          return Response.error();
        });
        if (cached) {
          event.waitUntil(fresh.catch(function () {}));
          return cached;
        }
        return fresh;
      });
    })
  );
});
