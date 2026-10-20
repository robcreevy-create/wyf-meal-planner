/* WYF v1.6.0 offline shopping and cooking. Device-local data stays in localStorage. */
const CACHE_NAME='wyf-offline-v1.6.0';
const PREFIX='wyf-offline-';
const CORE=[
  './index.html', './app.js?v=1.6.0', './styles.css?v=1.6.0',
  './recipes-packed.js?v=1.6.0', './recipe-images.js?v=1.6.0',
  './manifest.webmanifest', './icons/wyf-192.png'
];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;
  if(url.pathname.endsWith('/version.json'))return; // update checks must use the network
  const scope=new URL(self.registration.scope);
  if(!url.pathname.startsWith(scope.pathname))return;
  if(request.mode==='navigate'){
    event.respondWith(fetch(request).then(response=>{
      if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.put('./index.html',copy)));}
      return response;
    }).catch(()=>caches.match('./index.html')));
    return;
  }
  if(url.pathname.endsWith('/sw.js'))return;
  event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{
    if(response.ok && (url.pathname.endsWith('.webp')||url.pathname.endsWith('.png'))){
      const copy=response.clone();event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.put(request,copy)));
    }
    return response;
  })));
});
