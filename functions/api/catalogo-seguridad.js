// Sólo el feed sanitizado de precios DE VENTA; nunca consulta IWS desde Pages.
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':status===200?'public, max-age=300':'no-store','X-Content-Type-Options':'nosniff'}});
const validStamp=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/.test(s)&&Number.isFinite(Date.parse(s))&&Date.parse(s)<=Date.now()+60000;
const empty={source:'intcomex_daily',updated_at:null,stale:true,products:[]};
// Ruta pública deliberadamente desconectada mientras el acceso está pendiente.
// Ninguna variable de entorno puede activarla: requiere un cambio de código
// explícito después de validar la fuente autorizada y sus datos de venta.
export async function onRequest({request}) {
  if(request.method!=='GET')return new Response(null,{status:405,headers:{Allow:'GET'}});
  return json({...empty,status:'pending_access'});
}

// Preparado y probado para una activación futura; onRequest NO lo invoca.
export async function readConfiguredFeed({request,env}) {
  if(request.method!=='GET')return new Response(null,{status:405,headers:{Allow:'GET'}});
  // Activación independiente del catálogo y del conector BLU.
  if(env?.PROTECTIA_INTCOMEX_PUBLIC_FEED!=='true')return json({...empty,status:'pending_access'});
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),6000);
  try {
    const r=await fetch('https://ventas.protectia.cl/api/tienda/precios-intcomex',{headers:{Accept:'application/json'},redirect:'manual',signal:controller.signal});
    if(!r.ok)throw new Error('feed');
    const data=await r.json();
    if(data.source!=='intcomex_daily'||!Array.isArray(data.products)||(data.currency!=null&&data.currency!=='CLP')||(data.updated_at!=null&&!validStamp(data.updated_at)))throw new Error('schema');
    const seen=new Set();
    const products=data.products.map(p=>{
      if(typeof p.sku!=='string'||!(/^[A-Z0-9][A-Z0-9-]{1,39}$/).test(p.sku)||(p.currency!=null&&p.currency!=='CLP')||!Number.isSafeInteger(p.price_clp)||p.price_clp<=0||!validStamp(p.observed_at)||seen.has(p.sku))throw new Error('product');
      seen.add(p.sku);return {sku:p.sku,price_clp:p.price_clp,observed_at:p.observed_at};
    });
    return json({source:'intcomex_daily',currency:'CLP',updated_at:typeof data.updated_at==='string'?data.updated_at:null,stale:data.stale!==false,products});
  }catch{return json({...empty,status:'unavailable'},503);}finally{clearTimeout(timeout);}
}
