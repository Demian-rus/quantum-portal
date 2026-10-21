const CACHE='kvip-pwa-v27-20261021-ui';
const CORE=['./','./index.html','./style.css?v=18','./cards.js?v=1','./approx-questions.js?v=1','./mode-config.js?v=2','./rules.js?v=2','./penalties.js?v=2','./modifiers.js?v=1','./round-planner.js?v=1','./content-packs.js?v=4','./presets.js?v=3','./app.js?v=21','./words.js?v=2','./extra-words.js?v=1','./curated-words.js?v=1','./curated-songs.js?v=1','./curated-people.js?v=1','./mode-images.js?v=6','./manifest.webmanifest','./assets/bg-home.webp?v=3','./assets/bg-setup.webp?v=3','./assets/bg-game.webp?v=3','./assets/icon-192.png','./assets/icon-512.png',...['talk','mime','draw','sing','yesno','secret','blitz','approx'].map(id=>'./assets/modes/'+id+'.webp?v=3')];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>(key.startsWith('iskra-pwa-')||key.startsWith('kvip-pwa-'))&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET'||new URL(request.url).origin!==self.location.origin)return;
  // Network-first for page navigation: users of the installed PWA receive UI updates.
  if(request.mode==='navigate'){
    event.respondWith(fetch(request).then(response=>{
      if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put('./index.html',copy));}
      return response;
    }).catch(()=>caches.match('./index.html')));
    return;
  }
  event.respondWith(caches.match(request).then(cached=>
    cached||fetch(request).then(response=>{
      if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy));}
      return response;
    })
  ));
});