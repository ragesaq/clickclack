/// <reference lib="webworker" />

import { build, files, version } from "$service-worker";

const worker = self as unknown as ServiceWorkerGlobalScope;
const CACHE_NAME = `clickclack-${version}`;
const PRECACHE = [...build, ...files, "/", "/app"];
const PRECACHE_PATHS = new Set(
  PRECACHE.map((path) => new URL(path, worker.location.origin).pathname),
);

worker.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)));
  worker.skipWaiting();
});

worker.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches
        .keys()
        .then((keys) =>
          Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
        ),
      worker.clients.claim(),
    ]),
  );
});

worker.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (
    request.method !== "GET" ||
    url.origin !== worker.location.origin ||
    request.headers.has("range") ||
    url.pathname.startsWith("/api/")
  ) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (PRECACHE_PATHS.has(url.pathname)) {
    event.respondWith(cacheFirst(request));
  }
});

async function cacheFirst(request: Request): Promise<Response> {
  const cached = await caches.match(request);
  return cached ?? fetch(request);
}

async function networkFirstNavigation(request: Request): Promise<Response> {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;

    const appShell = await caches.match("/app");
    if (appShell) return appShell;

    const rootShell = await caches.match("/");
    if (rootShell) return rootShell;

    return new Response("ClickClack is offline.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
