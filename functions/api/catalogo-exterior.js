import {HANDLES} from '../lib/blu-handles.js';
import {normalizeProduct} from '../lib/catalogo-normalize.js';
const allowed=new Set(HANDLES);
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':status===200?'public, max-age=300':'no-store','X-Content-Type-Options':'nosniff'}});
export async function onRequest({request,waitUntil}) {
  if(request.method!=='GET')return new Response(null,{status:405,headers:{Allow:'GET','Cache-Control':'no-store'}});
  const url=new URL(request.url);const handle=url.searchParams.get('modelo');
  if(url.searchParams.size!==1||!allowed.has(handle))return json({error:'Modelo no disponible'},400);
  const cache=globalThis.caches?.default;
  const cacheKey=new Request(`${url.origin}/api/catalogo-exterior?modelo=${encodeURIComponent(handle)}`);
  const cached=cache&&await cache.match(cacheKey);
  if(cached)return cached;
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),8000);
  try {
    const response=await fetch(`https://www.blustore.cl/products/${handle}.js`,{signal:controller.signal,redirect:'error',headers:{Accept:'application/json'}});
    if(!response.ok)throw new Error('Supplier unavailable');
    const data=normalizeProduct(await response.json(),handle);
    const result=json(data);
    if(cache)waitUntil(cache.put(cacheKey,result.clone()));
    return result;
  }catch {return json({error:'No fue posible actualizar este modelo'},503);}finally{clearTimeout(timeout);}
}
