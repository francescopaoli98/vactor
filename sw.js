const VERSION = 'vactor-v13';
const SHELL = ['./', 'index.html', 'app.css', 'app.js', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'lib/vosk.js', 'content.js', 'lib/lame.min.js'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION && k !== 'vactor-runtime' && k !== 'vactor-inbox').map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Condividi → VActor (Android share target)
  if (e.request.method === 'POST' && url.pathname.endsWith('/share')) {
    e.respondWith((async () => {
      const fd = await e.request.formData();
      const c = await caches.open('vactor-inbox');
      let i = 0;
      for (const f of fd.getAll('files')) {
        if (!(f instanceof File)) continue;
        await c.put(`inbox/${Date.now()}-${i++}`, new Response(f, { headers: { 'content-type': f.type, 'x-name': encodeURIComponent(f.name) } }));
      }
      const text = ['title', 'text', 'url'].map((k) => fd.get(k)).filter(Boolean).join('\n');
      if (text) await c.put(`inbox/${Date.now()}-text`, new Response(text, { headers: { 'content-type': 'text/plain', 'x-name': 'testo.txt' } }));
      return Response.redirect(new URL('./?shared=1', self.registration.scope).href, 303);
    })());
    return;
  }
  if (e.request.method !== 'GET') return;

  // app: prima la rete (così gli aggiornamenti arrivano subito), poi la cache offline
  if (url.origin === location.origin && url.pathname.includes('/models/')) return; // il modello vocale lo salva l'app
  if (url.origin === location.origin) {
    e.respondWith(fetch(e.request).then((r) => {
      if (r.ok) { const cp = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, cp)); }
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html'))));
    return;
  }
  // librerie e font esterni: cache dopo il primo uso
  if (/fonts\.(googleapis|gstatic)\.com|cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net/.test(url.host)) {
    e.respondWith(caches.open('vactor-runtime').then(async (c) => {
      const hit = await c.match(e.request);
      if (hit) return hit;
      const r = await fetch(e.request);
      if (r.ok || r.type === 'opaque') c.put(e.request, r.clone());
      return r;
    }));
  }
});
