export function normalizeProduct(raw, expectedHandle, observedAt = new Date().toISOString()) {
  if(!raw||raw.handle!==expectedHandle||raw.vendor?.toLowerCase()!=='reolink'||!Array.isArray(raw.variants)||!raw.variants.length)throw new Error('Invalid supplier response');
  const ids=new Set();
  const variants=raw.variants.map(v=>{
    if(!Number.isSafeInteger(v.id)||ids.has(v.id)||!Number.isSafeInteger(v.price)||v.price<=0||v.price%100!==0||typeof v.available!=='boolean'||typeof v.title!=='string')throw new Error('Invalid variant');
    ids.add(v.id);
    let image=null;
    if(v.featured_image?.src){const u=new URL(v.featured_image.src.startsWith('//')?'https:'+v.featured_image.src:v.featured_image.src);if(u.protocol==='https:'&&u.hostname==='cdn.shopify.com')image=u.href;}
    return {id:String(v.id),title:v.title==='Default Title'?'Unidad':v.title,sku:typeof v.sku==='string'?v.sku:'',price:v.price/100,available:v.available,image};
  });
  return {handle:expectedHandle,currency:'CLP',observed_at:observedAt,variants};
}
