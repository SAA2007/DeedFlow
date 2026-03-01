// DeedFlow Service Worker — Phase 0 Shell
// Caches the app shell for offline access, passes API requests through to network

const CACHE_NAME = 'deedflow-v0.1'
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
]

// Install — cache shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  )
  self.skipWaiting()
})

// Activate — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Fetch — network-first for API, cache-first for shell
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // API requests — always network
  if (url.pathname.startsWith('/api')) {
    event.respondWith(fetch(request))
    return
  }

  // App shell — cache first, fallback to network
  event.respondWith(
    caches.match(request).then((cached) => {
      return cached || fetch(request).then((response) => {
        // Cache successful responses
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
        }
        return response
      })
    }).catch(() => {
      // Offline fallback
      if (request.mode === 'navigate') {
        return caches.match('/index.html')
      }
    })
  )
})
