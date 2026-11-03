const CACHE = 'gibberers-shell-v2';
const FILES = ['./','./index.html','./style.css','./app.js','./engine.js','./manifest.webmanifest','./assets/cards.json','./assets/icon.svg','./assets/icon-192.png','./assets/icon-512.png',...Array.from({length:5},(_,i)=>`./assets/ancestor-${i+1}.png`)];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES))));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('gibberers-shell-')&&key!==CACHE)await caches.delete(key);await self.clients.claim();})()));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    const cached=await cache.match(event.request,{ignoreSearch:true});
    if(cached)return cached;
    if(event.request.mode==='navigate')return (await cache.match('./index.html'))||fetch(event.request);
    return fetch(event.request);
  })());
});
self.addEventListener('message',event=>{
  if(event.data?.type!=='CHECK_CACHE')return;
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    const complete=(await Promise.all(FILES.map(file=>cache.match(file)))).every(Boolean);
    if(complete)event.ports[0]?.postMessage({type:'CACHE_READY'});
  })());
});
