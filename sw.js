// Service worker mínimo para Nexus.
//
// El único objetivo de este archivo es habilitar el "instalar app" del
// navegador (Chrome/Android/Edge lo exigen para mostrar el prompt de
// instalación). No cachea nada de forma agresiva a propósito: el sitio
// usa datos en vivo (KV vía /api/storage), así que preferimos ir
// siempre a la red y no arriesgarnos a mostrar puntajes viejos.
//
// Si en el futuro quieren que funcione offline, se puede sumar un
// cache real acá (cache-first para /icons, network-first para /api).

const CACHE_NAME = "nexus-shell-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Passthrough: siempre red primero. Esto es lo que hace que el sitio
// sea "instalable" sin cambiar cómo se sirven los datos.
self.addEventListener("fetch", (event) => {
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
