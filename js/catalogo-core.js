export const MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const WHATSAPP_NUMBER = '56931022364';
export const LIVE_OFFER_MAX_AGE_MS = 5 * 60 * 1000;
// El ventas-backend es quien verifica y mintea las referencias. Mismo patrón
// cross-origin que el lead del formulario (js/main.js).
export const VENTAS_URL = 'https://ventas.protectia.cl';

export function isFresh(observedAt, now = Date.now()) {
  const stamp = Date.parse(observedAt);
  return Number.isFinite(stamp) && stamp <= now + 60000 && now - stamp < MAX_AGE_MS;
}
export function initialVariant(variants) {
  return variants.find(v => v.available === true) || variants[0];
}
// Fecha de referencia en dd-mm-aaaa (hora de Chile) a partir del observed_at.
export function refDate(observedAt) {
  const d = new Date(Date.parse(observedAt));
  if (isNaN(d)) return 'fecha por confirmar';
  const parts = new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Santiago' }).formatToParts(d);
  const g = t => parts.find(p => p.type === t).value;
  return `${g('day')}-${g('month')}-${g('year')}`;
}

// Pide al ventas-backend que VERIFIQUE (con su propia fuente) y mintee la
// referencia. El navegador NO manda precio/stock/verificado: solo identifica la
// variante y la cantidad. Devuelve la respuesta del servidor
// {ok, codigo, cantidad, precio_ref, moneda, verificado, estado_disponibilidad,
//  observed_at} o null si no se pudo (ventas caído / rechazo). idem_key da
// idempotencia contra el doble clic.
export async function mintReference(payload) {
  try {
    const r = await fetch(`${VENTAS_URL}/api/tienda/referencia`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'omit',
      body: JSON.stringify(payload),
    });
    if (!r.ok) return null;
    const d = await r.json();
    return (d && d.ok) ? d : null;
  } catch {
    return null;
  }
}

// ¿La referencia que devolvió el servidor corresponde EXACTAMENTE a la variante
// y cantidad que se pidieron? Si no, no se usa esa referencia (se detecta la
// discrepancia y se degrada a asesoría sin código).
export function refMatches(variantId, cantidad, srv) {
  if (!srv) return false;
  if (Number.isInteger(srv.cantidad) && srv.cantidad !== cantidad) return false;
  if (srv.variant_id != null && String(srv.variant_id) !== String(variantId)) return false;
  return true;
}

// Arma el link de WhatsApp SIEMPRE con los datos del servidor (`srv`). El
// navegador solo aporta nombre/variante/SKU para el texto, nunca precio ni
// stock. `srv` puede ser sintético (fallback si ventas cayó): verificado=false,
// codigo=null, precio referencial del seed. En modo NO verificado no aparecen
// jamás las palabras "disponible" ni "en stock".
export function whatsappURL(product, variant, cantidad, srv) {
  const s = srv || {};
  const verificado = s.verificado === true;
  const precio = Number.isFinite(s.precio_ref) ? s.precio_ref : null;
  const sku = (variant && variant.sku) || 'por confirmar';
  const titulo = (product && (product.title || product.model)) || 'producto';
  const vtitulo = (variant && variant.title) || 'opción';
  // La cantidad del mensaje es la del REGISTRO del servidor cuando existe (el
  // cliente ya verificó que coincide con lo pedido), no la del navegador suelto.
  const n = Number.isInteger(s.cantidad) ? s.cantidad : cantidad;
  const cant = `${n} ${n === 1 ? 'unidad' : 'unidades'}`;
  const refLinea = s.codigo ? ` Referencia: ${s.codigo}.` : '';
  let body;
  if (verificado) {
    const precioTxt = precio != null ? `$${precio.toLocaleString('es-CL')} CLP` : 'a confirmar';
    body = `Hola, quiero comprar ${titulo} – ${vtitulo} (SKU ${sku}). Cantidad: ${cant}. Precio ${precioTxt}. Stock verificado.${refLinea} ¿Cómo sigo con el pago y el despacho?`;
  } else {
    const precioTxt = precio != null
      ? `Precio referencial: $${precio.toLocaleString('es-CL')} CLP${s.observed_at ? ` del ${refDate(s.observed_at)}` : ''}.`
      : 'Solicito precio actualizado.';
    body = `Hola, quiero asesoría sobre ${titulo} – ${vtitulo} (SKU ${sku}). Cantidad: ${cant}. ${precioTxt}${refLinea} ¿Disponibilidad y despacho?`;
  }
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(body)}`;
}
