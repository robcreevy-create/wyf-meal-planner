/* WYF v1.6.0, recipe library 6 photos. No changes to device-local saved data. */
const CACHE_NAME='wyf-offline-v1.6.0-library6-photos1';
const PREFIX='wyf-offline-';
const CORE=[
  './index.html', './app.js?v=1.6.0', './styles.css?v=1.6.0',
  './recipes-packed.js?v=1.6.0', './recipe-images.js?v=library6-photos1',
  './recipe-library-v6.js?v=6',
  './manifest.webmanifest', './icons/wyf-192.png'
];
self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE_NAME);
    // A failed core download rejects installation instead of reporting ready.
    await cache.addAll(CORE.map(path=>new Request(new URL(path,self.location.href),{cache:'reload'})));
    const shell=await cache.match('./index.html');
    if(!shell || !(await shell.clone().text()).includes('recipe-library-v6.js?v=6'))
      throw new Error('The new recipe-library page is not available yet.');
    const supplement=await cache.match('./recipe-library-v6.js?v=6');
    if(!supplement || !(await supplement.clone().text()).includes("const REVISION = 'recipe-library-6'"))
      throw new Error('The complete recipe-library update is not available yet.');
    if(!(await shell.clone().text()).includes('recipe-images.js?v=library6-photos1'))
      throw new Error('The new meal-photo page is not available yet.');
    const photos=await cache.match('./recipe-images.js?v=library6-photos1');
    if(!photos || !(await photos.clone().text()).includes('WYF photo revision: library6-photos1'))
      throw new Error('The complete meal-photo mapping is not available yet.');
    await self.skipWaiting();
  })());
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const current=await caches.open(CACHE_NAME);
    for(const key of await caches.keys()){
      if(!key.startsWith(PREFIX)||key===CACHE_NAME)continue;
      // Retain already viewed food photos when replacing the old app cache.
      const old=await caches.open(key);
      for(const request of await old.keys()){
        if(/\.(webp|png)$/.test(new URL(request.url).pathname)){
          const response=await old.match(request);
          if(response)try{await current.put(request,response);}catch(_){/* Photo fallback remains available. */}
        }
      }
      await caches.delete(key);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;
  if(url.pathname.endsWith('/version.json')||url.pathname.endsWith('/sw.js'))return;
  const scope=new URL(self.registration.scope);
  if(!url.pathname.startsWith(scope.pathname))return;
  if(request.mode==='navigate'){
    event.respondWith(fetch(request).then(response=>{
      if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.put('./index.html',copy)));}
      return response;
    }).catch(()=>caches.open(CACHE_NAME).then(cache=>cache.match('./index.html'))));
    return;
  }
  event.respondWith(caches.open(CACHE_NAME).then(cache=>cache.match(request)).then(cached=>cached||fetch(request).then(response=>{
    if(response.ok && /\.(webp|png)$/.test(url.pathname)){
      const copy=response.clone();event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.put(request,copy)));
    }
    return response;
  })));
});
