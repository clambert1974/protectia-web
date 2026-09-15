export const MAX_AGE_MS = 24 * 60 * 60 * 1000;
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
  const body = `Hola, me interesa ${product.model}, ${variant.title}.\nSKU: ${variant.sku || 'por confirmar'}.\n${details}\nPor favor, confirmen disponibilidad, precio final y despacho.\n\nMi comuna es: `;
  return `mailto:contacto@protectia.cl?subject=${encodeURIComponent(`Consulta tienda — ${product.model}`)}&body=${encodeURIComponent(body)}`;
}
