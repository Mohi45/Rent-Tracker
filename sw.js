const CACHE_NAME = "pg-rent-v1";
const ASSETS = [
    "./",
    "./index.html",
    "./style.css",
    "./script.js",
    "./manifest.json",
    "./icon-192.png",
    "./icon-512.png",
    "https://cdn.jsdelivr.net/npm/chart.js",
    "https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.5.13/cropper.min.css",
    "https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.5.13/cropper.min.js"
];


// INSTALL
self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

// ACTIVATE
self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.map(key => {
                    if (key !== CACHE_NAME) return caches.delete(key);
                })
            )
        )
    );
    self.clients.claim();
});

// FETCH (Offline support)
self.addEventListener("fetch", event => {
    if (event.request.mode === "navigate") {
        event.respondWith(
            caches.match("./index.html").then(res => res || fetch(event.request))
        );
        return;
    }

    event.respondWith(
        caches.match(event.request).then(res => res || fetch(event.request))
    );
});


// NOTIFICATION CLICK
self.addEventListener("notificationclick", event => {
    event.notification.close();
    event.waitUntil(
        clients.openWindow("./index.html")
    );
});
