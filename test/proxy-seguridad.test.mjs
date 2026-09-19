// Contrato público del proxy: sin red, credenciales reales ni servicios externos.
// Ejecutar: node test/proxy-seguridad.test.mjs
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {onRequest,readConfiguredFeed} from '../functions/api/catalogo-seguridad.js';

let passed=0,failed=0;
async function check(name,fn){try{await fn();passed++;console.log(`ok - ${name}`);}catch(error){failed++;console.error(`FAIL - ${name}\n  ${error.message}`);}}
const now=Date.now();
const recent=new Date(now-60000).toISOString();
const old=new Date(now-48*60*60*1000).toISOString();
const row={sku:'SYN-SENSOR-01',price_clp:115000,observed_at:recent};
const feed=(products=[row],extra={})=>({source:'intcomex_daily',updated_at:recent,stale:false,products,...extra});
async function invoke({enabled=true,method='GET',data=feed(),failure=null,status=200,headers={},timeout=false,handler=readConfiguredFeed,envOverride}={}){
  const previousFetch=globalThis.fetch, previousTimeout=globalThis.setTimeout;
  const calls=[];
  globalThis.fetch=async(url,options)=>{
    calls.push({url,options});
    if(timeout)return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new Error('timeout')),{once:true}));
    if(failure==='network')throw new Error('private diagnostic / token=SECRET-SYNTHETIC');
    return {ok:status>=200&&status<300,status,json:async()=>{
      if(failure==='json')throw new Error('token=SECRET-SYNTHETIC');
      return structuredClone(data);
    }};
  };
  if(timeout)globalThis.setTimeout=(fn,ms,...args)=>previousTimeout(fn,ms===6000?0:ms,...args);
  try{
    const response=await handler({request:new Request('https://preview.invalid/api/catalogo-seguridad?url=https://evil.invalid',{method,headers}),env:envOverride??(enabled?{PROTECTIA_INTCOMEX_PUBLIC_FEED:'true'}:{})});
    const text=await response.text();
    return {status:response.status,headers:response.headers,text,data:text?JSON.parse(text):null,calls};
  }finally{globalThis.fetch=previousFetch;globalThis.setTimeout=previousTimeout;}
}
function assertUnavailable(result){
  assert.equal(result.status,503);
  assert.equal(result.headers.get('Cache-Control'),'no-store');
  assert.equal(result.data.status,'unavailable');
  assert.deepEqual(result.data.products,[]);
  assert.equal(result.data.stale,true);
  assert.equal(result.data.updated_at,null);
  assert.doesNotMatch(result.text,/SECRET-SYNTHETIC|private diagnostic/);
}

await check('ruta pública permanece desconectada para todas las flags, incluso true',async()=>{
  for(const flag of [undefined,null,'true','false',true,false,'1','']){
    const result=await invoke({handler:onRequest,envOverride:{PROTECTIA_INTCOMEX_PUBLIC_FEED:flag}});
    assert.equal(result.calls.length,0);assert.equal(result.status,200);
    assert.deepEqual(result.data,{source:'intcomex_daily',updated_at:null,stale:true,products:[],status:'pending_access'});
  }
  // La ruta no necesita siquiera leer la configuración privada.
  const env=new Proxy({},{get(){throw new Error('No se debe consultar configuración');}});
  const result=await invoke({handler:onRequest,envOverride:env});
  assert.equal(result.calls.length,0);assert.equal(result.status,200);assert.equal(result.data.status,'pending_access');
});
await check('ruta pública rechaza métodos distintos de GET sin llamar al helper ni al backend',async()=>{
  for(const method of ['POST','PUT','DELETE','PATCH','HEAD','OPTIONS']){
    const result=await invoke({handler:onRequest,method,envOverride:{PROTECTIA_INTCOMEX_PUBLIC_FEED:'true'}});
    assert.equal(result.status,405);assert.equal(result.calls.length,0);assert.equal(result.headers.get('Allow'),'GET');
  }
});
await check('desactivado no consulta ningún servicio y declara acceso pendiente',async()=>{
  const result=await invoke({enabled:false});
  assert.equal(result.calls.length,0);assert.equal(result.status,200);
  assert.equal(result.data.status,'pending_access');assert.deepEqual(result.data.products,[]);
  assert.equal(result.data.stale,true);assert.equal(result.data.updated_at,null);
});
await check('sólo GET; método no permitido no llega al backend',async()=>{
  for(const method of ['POST','PUT','DELETE']){
    const result=await invoke({method});assert.equal(result.status,405);assert.equal(result.calls.length,0);assert.equal(result.headers.get('Allow'),'GET');
  }
});
await check('activo publica sólo precio de venta, SKU y fecha; excluye costos y credenciales',async()=>{
  const source=feed([{...row,cost:100000,costo_neto:100000,api_key:'SECRET-SYNTHETIC',inventory:23}],{api_secret:'SECRET-SYNTHETIC',raw:{password:'SECRET-SYNTHETIC'},account:'private-account'});
  const result=await invoke({data:source});
  assert.equal(result.status,200);
  assert.deepEqual(result.data,{source:'intcomex_daily',currency:'CLP',updated_at:recent,stale:false,products:[row]});
  assert.doesNotMatch(result.text,/SECRET-SYNTHETIC|cost|inventory|private-account/);
  assert.match(result.headers.get('Content-Type'),/^application\/json/);
  assert.equal(result.headers.get('X-Content-Type-Options'),'nosniff');
});
await check('URL fija; no reenvía cookies ni Authorization, ni sigue redirecciones',async()=>{
  const result=await invoke({headers:{Authorization:'Bearer SECRET-SYNTHETIC',Cookie:'session=SECRET-SYNTHETIC'}});
  assert.equal(result.calls.length,1);
  assert.equal(result.calls[0].url,'https://ventas.protectia.cl/api/tienda/precios-intcomex');
  assert.equal(result.calls[0].options.redirect,'manual');
  assert.equal(new Headers(result.calls[0].options.headers).get('Authorization'),null);
  assert.equal(new Headers(result.calls[0].options.headers).get('Cookie'),null);
});
await check('red, JSON inválido, respuesta HTTP fallida o redirigida: feed vacío sin detalles internos',async()=>{
  for(const options of [{failure:'network'},{failure:'json'},{status:500},{status:403},{status:302}])assertUnavailable(await invoke(options));
});
await check('timeout aborta y responde cerrado sin bloquear el cliente',async()=>assertUnavailable(await invoke({timeout:true})));
await check('fuente incorrecta o estructura malformada nunca publica filas',async()=>{
  for(const data of [null,{},feed([],{source:'blu_live'}),feed(null),feed([null])])assertUnavailable(await invoke({data}));
});
await check('SKU duplicado invalida la actualización completa',async()=>assertUnavailable(await invoke({data:feed([row,{...row,price_clp:99999}])})));
await check('precios null, booleanos, cero, negativos, cadena o fracción se rechazan',async()=>{
  for(const price_clp of [null,true,false,0,-1,'115000',115000.5,Number.MAX_SAFE_INTEGER+1])assertUnavailable(await invoke({data:feed([{...row,price_clp}])}));
});
await check('fecha futura fuera de tolerancia o fecha inválida se rechaza',async()=>{
  for(const observed_at of [null,'sin fecha',new Date(now+5*60*1000).toISOString()])assertUnavailable(await invoke({data:feed([{...row,observed_at}])}));
});
await check('precio antiguo conserva su fecha original y condición de referencia',async()=>{
  const result=await invoke({data:feed([{...row,observed_at:old}],{updated_at:old,stale:true})});
  assert.equal(result.status,200);assert.equal(result.data.stale,true);
  assert.equal(result.data.updated_at,old);assert.equal(result.data.products[0].observed_at,old);
});
await check('SKU vacío, espacios o fecha no textual nunca salen como datos públicos válidos',async()=>{
  for(const sku of ['', '   '])assertUnavailable(await invoke({data:feed([{...row,sku}])}));
  for(const observed_at of [1,2026,true])assertUnavailable(await invoke({data:feed([{...row,observed_at}])}));
});
await check('rechaza moneda contradictoria a CLP aunque exista price_clp',async()=>{
  for(const data of [feed([{...row,currency:'USD'}]),feed([row],{currency:'USD'})])assertUnavailable(await invoke({data}));
  assert.equal((await invoke({data:feed([{...row,currency:'CLP'}],{currency:'CLP'})})).status,200);
});
await check('updated_at no puede publicar texto interno que no es fecha',async()=>{
  const result=await invoke({data:feed([row],{updated_at:'SECRET-SYNTHETIC'})});
  assert.doesNotMatch(result.text,/SECRET-SYNTHETIC/);
  assert.ok(result.status===503||result.data.updated_at===null);
});
await check('catálogo local tiene 18 SKU y handles únicos, imágenes HTTPS y precios/stock desconocidos',()=>{
  const catalogue=JSON.parse(readFileSync(new URL('../data/catalogo-seguridad.json',import.meta.url),'utf8'));
  assert.equal(catalogue.products.length,18);
  const handles=new Set(),skus=new Set();
  const allowedImages=new Set(['store.intcomex.com','static.tp-link.com','cdn.cs.1worldsync.com']);
  const categories=new Set(['videovigilancia','intrusion','acceso','incendio']);
  for(const product of catalogue.products){
    assert.match(product.handle,/^intcomex-[a-z0-9-]+$/);assert.equal(handles.has(product.handle),false);handles.add(product.handle);
    assert.equal(product.provider,'intcomex');assert.ok(categories.has(product.category));
    assert.ok(product.brand&&product.model&&product.title);assert.ok(Array.isArray(product.features));
    const image=new URL(product.image);assert.equal(image.protocol,'https:');assert.ok(allowedImages.has(image.hostname));assert.equal(image.username,'');assert.equal(image.password,'');
    const source=new URL(product.source_url);assert.equal(source.origin,'https://store.intcomex.com');assert.match(source.pathname,/^\/es-XCL\/Product\/Detail\/\d+$/);
    assert.equal(product.variants.length,1);
    for(const variant of product.variants){
      assert.match(variant.sku,/^[A-Z0-9-]+$/);assert.equal(skus.has(variant.sku),false);skus.add(variant.sku);
      assert.equal(variant.price,null);assert.equal(variant.available,null);
    }
  }
  assert.equal(skus.size,18);
});

console.log(`\n${passed} escenarios OK; ${failed} fallidos. Sin red ni datos reales.`);
process.exitCode=failed?1:0;
