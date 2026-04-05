var CACHE_NAME = 'cruz-v2'
var OFFLINE_URLS = ['/', '/traficos', '/entradas', '/pedimentos', '/financiero', '/cruz']

self.addEventListener('install', function(event) {
  event.waitUntil(caches.open(CACHE_NAME).then(function(cache) { return cache.addAll(OFFLINE_URLS) }))
  self.skipWaiting()
})

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k) { return k !== CACHE_NAME }).map(function(k) { return caches.delete(k) }))
    })
  )
  self.clients.claim()
})

self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET') return
  if (event.request.url.includes('/api/')) return
  event.respondWith(
    fetch(event.request).then(function(response) {
      if (response.ok && event.request.mode === 'navigate') {
        var clone = response.clone()
        caches.open(CACHE_NAME).then(function(cache) { cache.put(event.request, clone) })
      }
      return response
    }).catch(function() { return caches.match(event.request) })
  )
})
