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
// Fecha de referencia en dd-mm-aaaa (hora de Chile) a partir del observed_at.
export function refDate(observedAt) {
  const d = new Date(Date.parse(observedAt));
  if (isNaN(d)) return 'fecha por confirmar';
  const parts = new Intl.DateTimeFormat('es-CL', {day:'2-digit',month:'2-digit',year:'numeric',timeZone:'America/Santiago'}).formatToParts(d);
  const g = t => parts.find(p => p.type === t).value;
  return `${g('day')}-${g('month')}-${g('year')}`;
}
// Modo degradado: cuando la verificación /api falla (503/red/datos vencidos) no
// bloqueamos la compra. Abrimos WhatsApp con un mensaje de ASESORÍA con precio
// referencial y su fecha, SIN afirmar disponibilidad ("disponible"/"en stock"
// no aparecen jamás en este modo). Usa el dato semilla del catálogo estático.
export function referentialConsultation(product, variantId, variants, observedAt) {
  const list = Array.isArray(variants) ? variants : [];
  const variant = list.find(v => v.id === variantId) || list[0] || {};
  const precio = (Number.isSafeInteger(variant.price) && variant.price > 0)
    ? variant.price.toLocaleString('es-CL') : 'a confirmar';
  const sku = variant.sku || 'por confirmar';
  const body = `Hola, quiero asesoría sobre ${product.title} – ${variant.title || 'opción'} (SKU ${sku}). Precio referencial: $${precio} CLP del ${refDate(observedAt)}. ¿Disponibilidad y despacho?`;
  return {url: `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(body)}`, variant};
}
