var CACHE_NAME = 'aguila-v9.2-2026-04-13'
var OFFLINE_URLS = []

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


// Push notifications
self.addEventListener('push', function(event) {
  var data = event.data ? event.data.json() : { title: 'AGUILA', body: 'Nueva actualización' }
  event.waitUntil(
    self.registration.showNotification(data.title || 'AGUILA', {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag || 'cruz-notification',
      data: { url: data.url || '/' },
      vibrate: [100, 50, 100],
    })
  )
})

self.addEventListener('notificationclick', function(event) {
  event.notification.close()
  var url = event.notification.data && event.notification.data.url ? event.notification.data.url : '/'
  event.waitUntil(clients.openWindow(url))
})

// v9.2 — pass-through SW. Do not cache navigate responses; broken HTML
// was sticking and loading stale chunks across deploys. Online-only for now.
self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET') return
  if (event.request.url.includes('/api/')) return
  event.respondWith(fetch(event.request))
})
