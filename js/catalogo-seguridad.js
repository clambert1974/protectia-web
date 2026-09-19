// Catálogo comercial: una lectura diaria de precios NO verifica inventario.
export const CATEGORY_LABELS = Object.freeze({camara:'Exterior', kit:'Kit / pack', openbox:'Open Box', videovigilancia:'Cámaras y grabación', intrusion:'Alarmas y sensores', acceso:'Control de acceso', incendio:'Incendio'});
export function matchesProduct(p, category, query) {
  const group = category === 'videovigilancia'
    ? ['camara','videovigilancia','kit','openbox'].includes(p.category)
    : category === 'all' || p.category === category;
  const text = [p.brand || 'Reolink', p.model, p.title, ...(p.features || []), ...p.variants.map(v=>v.sku || '')].join(' ').toLocaleLowerCase('es');
  return group && text.includes(query.trim().toLocaleLowerCase('es'));
}
export function dailyPriceFor(sku, feed, now=Date.now()) {
  if (!feed || feed.source !== 'intcomex_daily' || !Array.isArray(feed.products) || (feed.currency != null && feed.currency !== 'CLP')) return null;
  const rows=feed.products.filter(p=>p.sku === sku);
  if(rows.length!==1)return null;
  const p=rows[0]; if(typeof p.observed_at!=='string'||(p.currency != null && p.currency !== 'CLP'))return null; const stamp=Date.parse(p.observed_at);
  if(!Number.isSafeInteger(p.price_clp) || p.price_clp <= 0 || !Number.isFinite(stamp) || stamp > now+60000) return null;
  return {price:p.price_clp, observed_at:p.observed_at, stale:feed.stale===true};
}
