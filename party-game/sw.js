const CACHE='iskra-pwa-v4-20261020';
const CORE=['./','./index.html','./style.css?v=4','./app.js?v=4','./words.js?v=2','./mode-images.js?v=3','./manifest.webmanifest','./assets/bg-home.webp','./assets/bg-setup.webp','./assets/bg-game.webp','./assets/icon-192.png','./assets/icon-512.png'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('iskra-pwa-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET'||new URL(request.url).origin!==self.location.origin)return;
  event.respondWith(caches.match(request).then(cached=>
    cached||fetch(request).then(response=>{
      if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy));}
      return response;
    }).catch(()=>caches.match('./index.html'))
  ));
});