const CACHE = "spare-v9808e58fbd81";
const FILES = ["./", "./index.html", "./manifest.webmanifest",
               "./icon-180.png", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks =>
    Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;

  // THE DATA FILE IS NOT THE SHELL. rules.enc is fetched with a cache-busting
  // query, as often as every thirty seconds of use, and each of those URLs was
  // being stored as its own permanent cache entry. It also must never be
  // answered from cache: the app compares what it fetched against what it
  // already holds, so a cached copy makes every check report "no change".
  // Straight to the network, and the app handles a failure itself.
  if (new URL(e.request.url).pathname.endsWith("rules.enc")) return;

  e.respondWith(
    fetch(e.request).then(r => {
      // ONLY CACHE A GOOD RESPONSE. Cache.put stores anything it is given,
      // unlike Cache.add - so a 404 or a 503 during a deploy window would
      // become the permanently cached shell, and every load afterwards would
      // look completely normal and be wrong.
      if (r && r.ok) {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
      }
      return r;
    }).catch(() => caches.match(e.request).then(m => {
      if (m) return m;
      // FALL BACK TO THE PAGE ONLY FOR A PAGE. Anything else got handed
      // index.html with status 200, so a failed fetch arrived as a successful
      // response full of HTML - which parses as a SyntaxError the caller does
      // not classify, and returns silently. Offline looked exactly like
      // nothing having changed.
      if (e.request.mode === "navigate") return caches.match("./index.html");
      return Response.error();
    }))
  );
});
