// Priority CRM Service Worker
const CACHE = 'priority-crm-v1'

// Assets to pre-cache on install (minimal shell)
const PRECACHE = [
  '/manifest.json',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
]

// ── Install ────────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE))
  )
  // Activate immediately — don't wait for old SW to die
  self.skipWaiting()
})

// ── Activate ───────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  )
  // Take control of all open clients immediately
  self.clients.claim()
})

// ── Fetch ──────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Only intercept GET from our own origin
  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  // Never intercept NextAuth, API routes, or Next.js data fetches
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/_next/data/') ||
    url.pathname.startsWith('/_next/image')
  ) return

  // ── Next.js immutable static chunks → cache-first (safe: they're hash-named) ──
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then((hit) => {
        if (hit) return hit
        return fetch(request).then((res) => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(CACHE).then((c) => c.put(request, clone))
          }
          return res
        })
      })
    )
    return
  }

  // ── Shell icons & manifest → cache-first ──────────────────────────────────
  if (url.pathname.startsWith('/icons/') || url.pathname === '/manifest.json') {
    event.respondWith(
      caches.match(request).then((hit) => hit || fetch(request))
    )
    return
  }

  // ── HTML navigation → network-first, cache fallback ──────────────────────
  if (request.destination === 'document' || request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(CACHE).then((c) => c.put(request, clone))
          }
          return res
        })
        .catch(async () => {
          const cached = await caches.match(request)
          if (cached) return cached
          // Last resort: try cached pipeline page
          const fallback = await caches.match('/pipeline')
          if (fallback) return fallback
          return new Response(
            `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Sin conexión — Priority CRM</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#25324b;color:#fff;font-family:-apple-system,sans-serif;
         display:flex;align-items:center;justify-content:center;min-height:100dvh;padding:24px}
    .card{background:#1d2e43;border-radius:24px;padding:40px 32px;text-align:center;max-width:340px;width:100%}
    .logo{font-size:40px;font-weight:800;color:#d3ac76;letter-spacing:-1px;margin-bottom:8px}
    .line{height:3px;width:48px;background:#d3ac76;border-radius:99px;margin:0 auto 24px}
    h1{font-size:20px;font-weight:700;margin-bottom:8px}
    p{font-size:14px;color:rgba(255,255,255,.55);line-height:1.6}
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">PC</div>
    <div class="line"></div>
    <h1>Sin conexión</h1>
    <p>Verifica tu conexión a internet y vuelve a intentarlo.</p>
  </div>
</body>
</html>`,
            { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 503 }
          )
        })
    )
  }
})
