const CACHE='kvip-pwa-v44-20261022-mode-compatibility';
const CORE=['./','./index.html','./style.css?v=24','./cards.js?v=7','./approx-questions.js?v=7','./mode-config.js?v=2','./mode-compatibility.js?v=1','./rules.js?v=4','./penalties.js?v=3','./modifiers.js?v=3','./round-planner.js?v=1','./task-history.js?v=1','./modifiers-v2.js?v=2','./content-packs.js?v=12','./presets.js?v=4','./app.js?v=33','./words.js?v=2','./extra-words.js?v=1','./curated-words.js?v=1','./curated-songs.js?v=1','./curated-people.js?v=1','./mode-images.js?v=6','./manifest.webmanifest?v=2','./assets/bg-home.webp?v=4','./assets/bg-setup.webp?v=3','./assets/bg-game.webp?v=3','./assets/icon-192.png?v=2','./assets/icon-512.png?v=2','./assets/icon-maskable-192.png?v=2','./assets/icon-maskable-512.png?v=2',...['talk','mime','draw','sing','yesno','secret','blitz','approx'].map(id=>'./assets/modes/'+id+'.webp?v=3')];
self.addEventListener('install',event=>{
  // A new worker must cache the deployed bundle, even while older HTTP responses
  // are still fresh. Otherwise an offline reload can reopen the previous UI.
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE.map(url=>new Request(url,{cache:'reload'})))).then(()=>self.skipWaiting()));
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
