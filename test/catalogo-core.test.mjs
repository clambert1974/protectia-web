// Pruebas reproducibles del núcleo de la tienda. Correr:  node test/catalogo-core.test.mjs
// Sin dependencias: usa el runtime de Node (fetch global se stubbea). Sale 1 si algo falla.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { refMatches, whatsappURL, mintReference, refDate } from '../js/catalogo-core.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const waText = u => decodeURIComponent(new URL(u).searchParams.get('text'));
let fail = 0;
const ok = (c, m) => { console.log((c ? '  ok ' : '  XX ') + m); if (!c) fail++; };

const product = { handle: 'h', title: 'Cámara Reolink Duo 2 WiFi', model: 'Duo 2 WiFi' };
const variant = { id: 'v1', title: 'Unidad', sku: '697', price: 129990 };
const obs = '2026-09-15T21:42:47+00:00';

console.log('#5 refMatches (discrepancia servidor/cliente)');
ok(refMatches('v1', 2, { variant_id: 'v1', cantidad: 2 }) === true, 'coincide -> true');
ok(refMatches('v1', 2, { variant_id: 'v1', cantidad: 3 }) === false, 'cantidad distinta -> false');
ok(refMatches('v1', 2, { variant_id: 'v2', cantidad: 2 }) === false, 'variante distinta -> false');
ok(refMatches('v1', 2, null) === false, 'sin respuesta -> false');
ok(refMatches('v1', 2, { cantidad: 2 }) === true, 'sin variant_id en la respuesta -> no bloquea por variante');

console.log('#5 whatsappURL usa la cantidad del REGISTRO del servidor');
ok(waText(whatsappURL(product, variant, 1, { verificado: false, precio_ref: 129990, codigo: 'PIA-Z', observed_at: obs, cantidad: 5 }))
  .includes('Cantidad: 5 unidades'), 'refleja la cantidad del servidor (5), no la del cliente (1)');

console.log('mensajes: verificado / asesoría / fallback, con cantidad y referencia');
let t = waText(whatsappURL(product, variant, 2, { verificado: true, precio_ref: 129990, codigo: 'PIA-A', observed_at: obs, cantidad: 2 }));
ok(t.includes('quiero comprar') && t.includes('Cantidad: 2 unidades') && t.includes('$129.990 CLP') && t.includes('Stock verificado') && t.includes('Referencia: PIA-A'), 'verificado completo');
t = waText(whatsappURL(product, variant, 1, { verificado: false, precio_ref: 129990, codigo: 'PIA-B', observed_at: obs, cantidad: 1 }));
ok(t.includes('asesoría') && t.includes(`Precio referencial: $129.990 CLP del ${refDate(obs)}`) && t.includes('Referencia: PIA-B'), 'asesoría con precio referencial + fecha + referencia');
ok(!/\bdisponible\b/i.test(t) && !/en stock/i.test(t), 'asesoría sin "disponible" ni "en stock"');
t = waText(whatsappURL(product, variant, 3, { verificado: false, codigo: null, precio_ref: variant.price, observed_at: obs, cantidad: 3 }));
ok(!t.includes('Referencia:') && t.includes('Cantidad: 3 unidades'), 'fallback sin código pero con cantidad');

console.log('mintReference tolera fallos (no rompe la venta)');
globalThis.fetch = async () => ({ ok: true, json: async () => ({ ok: true, codigo: 'PIA-C', verificado: false }) });
ok((await mintReference({ idem_key: 'k', handle: 'h', cantidad: 1 })).codigo === 'PIA-C', '200 -> respuesta del servidor');
globalThis.fetch = async () => ({ ok: false, json: async () => ({}) });
ok(await mintReference({}) === null, 'no-ok -> null');
globalThis.fetch = async () => { throw new Error('red'); };
ok(await mintReference({}) === null, 'excepción -> null');

console.log('#7 la tarjeta NUNCA afirma disponibilidad desde el catálogo (fecha + booleano)');
const tienda = readFileSync(join(HERE, '..', 'js', 'tienda.js'), 'utf8');
ok(!tienda.includes('Disponible por encargo'), 'sin "Disponible por encargo"');
ok(!/'Sin stock'|"Sin stock"/.test(tienda), 'sin "Sin stock"');
ok(!tienda.includes('· sin stock'), 'sin "· sin stock" en las variantes');

console.log('\n' + (fail === 0 ? 'TODOS OK' : `${fail} FALLARON`));
process.exit(fail ? 1 : 0);
