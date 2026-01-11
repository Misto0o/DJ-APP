self.addEventListener('install', (event) => {
    // Activate immediately
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        (async () => {
            const cacheNames = await caches.keys();

            await Promise.all(
                cacheNames.map((cache) => {
                    console.warn('[SW] Deleting cache:', cache);
                    return caches.delete(cache);
                })
            );

            // Take control of all pages instantly
            await self.clients.claim();

            console.warn('[SW] All caches nuked 💣');
        })()
    );
});

// Optional: block caching entirely
self.addEventListener('fetch', (event) => {
    event.respondWith(fetch(event.request));
});
