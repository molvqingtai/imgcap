/**
 * Offline shell for the installed app.
 *
 * Network first: a deploy is picked up on the next load instead of pinning
 * whatever the browser happened to cache. The cache only answers when the
 * network does not.
 */

const CACHE = 'imgcap-v5'

const SHELL = [
  './',
  'manifest.webmanifest',
  './app.css',
  './app.js',
  './engine.js',
  './worker.js',
  './zip.js',
  './i18n.js',
  './vendor/comctx.js',
  './vendor/imgcap.js',
  './fonts/inter.woff2',
  './fonts/mono.woff2',
  './favicon.svg',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png'
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
      await self.clients.claim()
    })()
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  if (new URL(request.url).origin !== self.location.origin) return

  event.respondWith(
    (async () => {
      try {
        const response = await fetch(request)
        if (response.ok) {
          const cache = await caches.open(CACHE)
          cache.put(request, response.clone())
        }
        return response
      } catch (error) {
        const cached = await caches.match(request, { ignoreSearch: true })
        if (cached) return cached
        if (request.mode === 'navigate') {
          const shell = await caches.match('./', { ignoreSearch: true })
          if (shell) return shell
        }
        throw error
      }
    })()
  )
})