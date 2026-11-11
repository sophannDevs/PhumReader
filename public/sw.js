// PhumiReader service worker: only shows the offline page when a page cannot be loaded.
// It caches /offline and /km/offline (and the styles they use) and never touches API calls or other files.
// v2: the V2.1 offline page (activate deletes the old cache).
const CACHE = "phumireader-offline-v2"
const PAGES = ["/offline", "/km/offline"]

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE)
      for (const path of PAGES) {
        const res = await fetch(path, { cache: "reload" })
        if (!res.ok) throw new Error(`Cannot cache ${path}`)
        const html = await res.clone().text()
        await cache.put(path, res)
        // The page's own style sheets, so the offline page looks like the site.
        const sheets = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)].map((m) => m[1])
        await Promise.all(sheets.map((href) => cache.add(href)))
      }
    })()
  )
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  )
})

self.addEventListener("fetch", (event) => {
  const request = event.request
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE)
        const page = url.pathname === "/km" || url.pathname.startsWith("/km/") ? "/km/offline" : "/offline"
        return (await cache.match(page)) ?? Response.error()
      })
    )
    return
  }
  // The offline page's style sheets come from the cache when the network is gone.
  if (url.pathname.startsWith("/_next/static/") && request.destination === "style") {
    event.respondWith(caches.match(request).then((hit) => hit ?? fetch(request)))
  }
})
