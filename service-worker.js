/* ═════════════════════════════════════════════════════════════
   MATEEN ONLINE STORE — SERVICE WORKER
   Strategy: Cache-first for static assets, network-first for HTML
   ═════════════════════════════════════════════════════════════ */

const CACHE_VERSION = 'mateen-store-v1';
const STATIC_CACHE  = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/404.html',
  '/manifest.json',
  '/pages/welcome.html',
  '/pages/home.html',
  '/pages/login.html',
  '/pages/signup.html',
  '/pages/products.html',
  '/pages/cart.html',
  '/pages/checkout.html',
  '/css/global.css',
  '/css/home.css',
  '/css/responsive.css',
  '/js/firebase-config.js',
  '/js/global.js',
  '/js/i18n.js',
  '/lang/en.json',
  '/lang/ur.json'
];

/* ─── INSTALL ─── */
self.addEventListener('install', (event) => {
  console.log('[SW] Installing…');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        return Promise.all(
          PRECACHE_URLS.map((url) => {
            return cache.add(url).catch((err) => {
              console.warn('[SW] Failed to cache:', url, err);
            });
          })
        );
      })
      .then(() => self.skipWaiting())
  );
});

/* ─── ACTIVATE ─── */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating…');
  event.waitUntil(
    caches.keys()
      .then((keys) => {
        return Promise.all(
          keys
            .filter((k) => k !== STATIC_CACHE && k !== DYNAMIC_CACHE)
            .map((k) => {
              console.log('[SW] Deleting old cache:', k);
              return caches.delete(k);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

/* ─── FETCH ─── */
self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  if (
    url.pathname.includes('/__/auth/') ||
    url.pathname.startsWith('/.well-known/')
  ) return;

  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(cacheFirst(request));
});

/* ─── CACHE FIRST ─── */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    if (request.destination === 'image') {
      return new Response(
        `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
           <rect fill="#f3f4f6" width="200" height="200"/>
           <text x="100" y="105" text-anchor="middle" fill="#9ca3af"
                 font-family="Arial" font-size="14">No Image</text>
         </svg>`,
        { headers: { 'Content-Type': 'image/svg+xml' } }
      );
    }
    throw err;
  }
}

/* ─── NETWORK FIRST ─── */
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;

    if (request.mode === 'navigate') {
      return caches.match('/404.html') ||
        new Response('Offline — Please check your connection.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain' }
        });
    }

    throw err;
  }
}

/* ─── MESSAGE HANDLER ─── */
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data === 'CLEAR_CACHE') {
    caches.keys().then((keys) => {
      keys.forEach((k) => caches.delete(k));
    });
  }
});