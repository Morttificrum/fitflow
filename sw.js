// FitFlow service worker
// Páginas: tenta a internet primeiro (assim as atualizações chegam) e usa o cache se estiver offline.
// Ícones e manifesto: cache primeiro.
const CACHE = 'fitflow-v12';
const ARQUIVOS = ['./', 'index.html', 'manifest.json', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'figuras.js', 'saude.js', 'saude.css', 'dados.js', 'medicoes.js', 'relogios.js', 'ble.js', 'pausa-dados.js', 'pausa.js', 'relax-dados.js', 'relax.js', 'pernas.js', 'audio/CREDITOS.md'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;   // fontes do Google etc. passam direto

  if(req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(res => {
        const copia = res.clone();
        caches.open(CACHE).then(c => c.put(req, copia));
        return res;
      }).catch(() => caches.match(req).then(r => r || caches.match('index.html')))
    );
    return;
  }
  // áudio do relaxamento: guarda no primeiro uso para funcionar sem internet
  if (/\/audio\//.test(req.url)) { e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => { if (res.ok) { const c = res.clone(); caches.open(CACHE).then(ch => ch.put(req, c)); } return res; }))); return; }
  e.respondWith(caches.match(req).then(r => r || fetch(req)));
});
