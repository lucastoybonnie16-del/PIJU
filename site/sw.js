// Piju OS - Service Worker for Android PWA Offline & Caching Support
const CACHE_NAME = 'piju-os-v1';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './css/style.css',
    './manifest.json',
    './js/piju_assets.js',
    './js/piju_pet.js',
    './js/graph.js',
    './js/app.js',
    './assets/icon-192.png',
    './assets/icon-512.png',
    './assets/balanca_pesagem.jpg',
    './assets/expedicao_banner.jpg',
    './assets/lab_banner.jpg',
    './assets/portaria_banner.jpg',
    './assets/producao_banner.jpg',
    './assets/motorista_carlos.jpg',
    './assets/motorista_marcos.jpg',
    './assets/motorista_antonio.jpg',
    './assets/motorista_jobesvaldo.jpg'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE).catch(err => {
                console.warn('Alguns assets falharam no pré-cache:', err);
            });
        }).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    // Apenas requisições GET
    if (event.request.method !== 'GET') return;

    // Responde com cache se disponível, senão busca na rede
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                // Atualiza em background (stale-while-revalidate para recursos locais)
                fetch(event.request).then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse.clone()));
                    }
                }).catch(() => {});
                return cachedResponse;
            }

            return fetch(event.request).then((networkResponse) => {
                if (!networkResponse || networkResponse.status !== 200) {
                    return networkResponse;
                }
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseToCache);
                });
                return networkResponse;
            }).catch(() => {
                // Fallback offline se a página for solicitada
                if (event.request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
            });
        })
    );
});
