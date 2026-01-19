const CACHE_NAME = 'site-organizer-v1';

// Assets to cache immediately on install
const PRECACHE_ASSETS = [
    '/',
    '/dashboard',
    '/login',
    '/manifest.json'
];

// Install event - cache essential assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(PRECACHE_ASSETS);
        })
    );
    self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            );
        })
    );
    self.clients.claim();
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    // Skip Supabase API calls (always need fresh data)
    if (event.request.url.includes('supabase.co')) return;

    // Skip Chrome extension requests
    if (event.request.url.startsWith('chrome-extension://')) return;

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Clone response for caching
                const responseClone = response.clone();

                // Cache successful responses
                if (response.status === 200) {
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }

                return response;
            })
            .catch(() => {
                // Fallback to cache when offline
                return caches.match(event.request).then((cachedResponse) => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }

                    // Return offline page for navigation requests
                    if (event.request.mode === 'navigate') {
                        return caches.match('/');
                    }

                    return new Response('Offline', { status: 503 });
                });
            })
    );
});

// Handle push notifications (optional, for future use)
self.addEventListener('push', (event) => {
    if (event.data) {
        const data = event.data.json();
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-72x72.png'
        });
    }
});
