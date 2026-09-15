export const MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const WHATSAPP_NUMBER = '56931022364';
export const LIVE_OFFER_MAX_AGE_MS = 5 * 60 * 1000;
export function isFresh(observedAt, now = Date.now()) {
  const stamp = Date.parse(observedAt);
  return Number.isFinite(stamp) && stamp <= now + 60000 && now - stamp < MAX_AGE_MS;
}
export function initialVariant(variants) {
  return variants.find(v => v.available === true) || variants[0];
}
export function consultationLink(product, variant, observedAt, now = Date.now()) {
  const details = isFresh(observedAt, now)
    ? `Precio consultado: $${variant.price.toLocaleString('es-CL')} CLP (${observedAt}).`
    : 'Solicito precio y disponibilidad actualizados.';
  const body = `Hola, vi en la tienda ProtectIA el modelo Reolink ${product.model}, ${variant.title}.\nSKU: ${variant.sku || 'por confirmar'}.\n${details}\nMe interesa comprar. Por favor, confirmen disponibilidad, precio final y despacho.\n\nTambién me interesa el servicio ProtectIA: sí / no.\nMi comuna es: `;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(body)}`;
}
export function verifiedConsultation(product, variantId, data, now=Date.now()) {
  if(!data||data.handle!==product.handle||data.currency!=='CLP'||!Array.isArray(data.variants))return {ok:false,reason:'unverified'};
  const stamp=Date.parse(data.observed_at);
  if(!Number.isFinite(stamp)||stamp>now+60000||now-stamp>LIVE_OFFER_MAX_AGE_MS)return {ok:false,reason:'stale'};
  const variant=data.variants.find(v=>v.id===variantId);
  if(!variant)return {ok:false,reason:'variant_missing'};
  if(variant.available!==true)return {ok:false,reason:variant.available===false?'unavailable':'unverified'};
  if(!Number.isSafeInteger(variant.price)||variant.price<=0||typeof variant.title!=='string')return {ok:false,reason:'unverified'};
  const url=new URL(consultationLink(product,variant,data.observed_at,now));
  const time=new Intl.DateTimeFormat('es-CL',{dateStyle:'short',timeStyle:'short',timeZone:'America/Santiago'}).format(new Date(stamp));
  url.searchParams.set('text',url.searchParams.get('text').replace('\nMe interesa comprar.',`\nStock informado: disponible, verificado ${time} (Chile). Sujeto a confirmación al reservar.\nMe interesa comprar.`));
  return {ok:true,url:url.href,variant,observedAt:data.observed_at};
}
