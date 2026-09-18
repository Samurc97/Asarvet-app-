// Service Worker de ASARVET
// Cambia este número cada vez que actualices el HTML/CSS/JS para forzar
// que los teléfonos descarguen la nueva versión.
const CACHE_VERSION = "asarvet-v3";
const APP_SHELL_CACHE = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

// Archivos propios de la app: se descargan y guardan apenas se instala
// el Service Worker, para que la app abra sin internet desde el primer uso.
const APP_SHELL_FILES = [
  "./",
  "./index.html",
  "./instalar.html",
  "./manifest.json",
  "./logo.png",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "./apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== APP_SHELL_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const isAppShell = url.origin === self.location.origin;

  if (isAppShell) {
    // App propia: cache primero, y si no está, va a la red y la guarda.
    // Si la red falla (VPN, señal débil, etc.), usa index.html guardado
    // como último recurso en vez de dejar que el navegador muestre un error.
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request)
          .then((response) => {
            const clone = response.clone();
            caches.open(APP_SHELL_CACHE).then((cache) => cache.put(request, clone));
            return response;
          })
          .catch(() => caches.match("./index.html"));
      })
    );
  } else {
    // Recursos externos (fuentes, imágenes de plantas, etc.):
    // se sirven de caché si existen, y en paralelo se actualiza el caché
    // desde la red para la próxima vez (stale-while-revalidate).
    event.respondWith(
      caches.open(RUNTIME_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          const networkFetch = fetch(request)
            .then((response) => {
              if (response && response.status === 200) {
                cache.put(request, response.clone());
              }
              return response;
            })
            .catch(() => cached);
          return cached || networkFetch;
        })
      )
    );
  }
});
