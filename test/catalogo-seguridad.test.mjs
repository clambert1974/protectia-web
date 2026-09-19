// Pruebas sintéticas: no contactan proveedores, ventas, WhatsApp ni bases reales.
// Ejecutar: node test/catalogo-seguridad.test.mjs
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dailyPriceFor, matchesProduct} from '../js/catalogo-seguridad.js';
import {isFresh, whatsappURL, WHATSAPP_NUMBER} from '../js/catalogo-core.js';

let passed=0;
async function check(name, fn) {
  try {await fn();passed++;console.log(`ok ${passed} - ${name}`);}
  catch(error){console.error(`FAIL - ${name}`);throw error;}
}
const NOW=Date.parse('2026-09-19T15:00:00Z');
const recent='2026-09-19T14:55:00Z';
const stale='2026-09-17T14:00:00Z';
const row={sku:'SYN-ALARM-01',price_clp:115000,observed_at:recent};
const feedFor=(rows=[row],extra={})=>({source:'intcomex_daily',updated_at:recent,stale:false,products:rows,...extra});
const camera={handle:'synthetic-camera',category:'camara',model:'Duo de prueba',title:'Cámara de prueba',features:['WiFi'],variants:[{id:'cam-1',title:'Unidad',sku:'SYN-CAM-01',price:99000}]};
const alarm={handle:'intcomex-synthetic-alarm',provider:'intcomex',brand:'Hikvision',category:'intrusion',model:'Alarma de prueba',title:'Sensor de prueba',features:['Interior'],variants:[{id:'alarm-1',title:'Unidad',sku:'SYN-ALARM-01',price:null}]};
const recorder={...alarm,handle:'intcomex-synthetic-nvr',category:'videovigilancia',model:'NVR de prueba',variants:[{...alarm.variants[0],id:'nvr-1',sku:'SYN-NVR-01'}]};
const textOfURL=url=>new URL(url).searchParams.get('text');

await check('búsqueda por marca y SKU sin distinguir mayúsculas',()=>{
  assert.equal(matchesProduct(alarm,'all','  HIKVISION  '),true);
  assert.equal(matchesProduct(alarm,'intrusion','syn-alarm-01'),true);
  assert.equal(matchesProduct(camera,'all','reolink'),true);
  assert.equal(matchesProduct(alarm,'all','marca inexistente'),false);
});
await check('Cámaras y grabación combina cámaras, kits, Open Box y grabadores; excluye alarmas',()=>{
  for(const category of ['camara','kit','openbox'])assert.equal(matchesProduct({...camera,category},'videovigilancia',''),true);
  assert.equal(matchesProduct(recorder,'videovigilancia','NVR'),true);
  assert.equal(matchesProduct(alarm,'videovigilancia',''),false);
  assert.equal(matchesProduct(alarm,'incendio',''),false);
  assert.equal(matchesProduct(alarm,'intrusion','sensor'),true);
});
await check('precio diario válido usa exactamente SKU y valor publicado',()=>{
  assert.deepEqual(dailyPriceFor(row.sku,feedFor(),NOW),{price:115000,observed_at:recent,stale:false});
  assert.equal(dailyPriceFor('SKU-DISTINTO',feedFor(),NOW),null);
});
await check('precio vencido se conserva como referencia, nunca como precio reciente',()=>{
  const offer=dailyPriceFor(row.sku,feedFor([{...row,observed_at:stale}],{stale:true}),NOW);
  assert.deepEqual(offer,{price:115000,observed_at:stale,stale:true});
  assert.equal(isFresh(offer.observed_at,NOW),false);
  assert.equal(isFresh(new Date(NOW-24*60*60*1000).toISOString(),NOW),false);
  assert.equal(isFresh(recent,NOW),true);
});
await check('rechaza fechas inválidas y fechas futuras fuera de tolerancia',()=>{
  for(const observed_at of [null,'fecha mala',new Date(NOW+60001).toISOString()])
    assert.equal(dailyPriceFor(row.sku,feedFor([{...row,observed_at}]),NOW),null);
});
await check('rechaza precios desconocidos, booleanos, negativos y no enteros',()=>{
  for(const price_clp of [null,true,false,0,-10,11.5,'115000',Number.MAX_SAFE_INTEGER+1])
    assert.equal(dailyPriceFor(row.sku,feedFor([{...row,price_clp}]),NOW),null);
});
await check('rechaza duplicados de SKU y fuentes distintas de la diaria autorizada',()=>{
  assert.equal(dailyPriceFor(row.sku,feedFor([row,{...row,price_clp:99999}]),NOW),null);
  assert.equal(dailyPriceFor(row.sku,feedFor([row],{source:'blu_live'}),NOW),null);
  assert.equal(dailyPriceFor(row.sku,null,NOW),null);
  assert.equal(dailyPriceFor(row.sku,{source:'intcomex_daily',products:{}},NOW),null);
});
await check('WhatsApp sin stock confirmado pide asesoría, conserva modelo y cantidad y no inventa referencia',()=>{
  const url=whatsappURL(alarm,alarm.variants[0],3,{verificado:false,precio_ref:null,codigo:null,cantidad:3});
  const body=textOfURL(url);
  assert.equal(new URL(url).pathname,`/${WHATSAPP_NUMBER}`);
  assert.match(body,/asesoría/);
  assert.match(body,/Sensor de prueba/);
  assert.match(body,/SYN-ALARM-01/);
  assert.match(body,/Cantidad: 3 unidades/);
  assert.match(body,/Solicito precio actualizado/);
  assert.doesNotMatch(body,/Referencia:|Stock verificado|en stock|quiero comprar/i);
});
await check('referencia real del servidor pasa al mensaje sin transformaciones',()=>{
  const body=textOfURL(whatsappURL(alarm,alarm.variants[0],2,{verificado:false,precio_ref:115000,codigo:'PIA-SYNTHETIC',cantidad:2,observed_at:recent}));
  assert.match(body,/Referencia: PIA-SYNTHETIC\./);
  assert.match(body,/Cantidad: 2 unidades/);
  assert.match(body,/Precio referencial: \$115\.000 CLP/);
  assert.doesNotMatch(body,/Stock verificado|en stock|quiero comprar/i);
});

// DOM mínimo para ejecutar el módulo real de tienda, sus cargas asíncronas y
// eventos. No se sustituye la lógica de filtros, precios ni mensajes.
class Node {
  constructor(tag='div',text='') {this.tagName=tag;this.children=[];this._text=text;this.attributes={};this.listeners={};this.dataset={};this.style={};this.hidden=false;this.disabled=false;this.value='';this.className='';this.src='';}
  append(...nodes){for(const node of nodes)this.children.push(typeof node==='string'?new Node('#text',node):node);}
  replaceChildren(...nodes){this.children=[];this._text='';this.append(...nodes);}
  get textContent(){return this._text+this.children.map(n=>n.textContent).join('');}
  set textContent(value){this._text=String(value);this.children=[];}
  get firstChild(){if(this._text){const parent=this;return {get textContent(){return parent._text;},set textContent(value){parent._text=String(value);}};}return this.children[0]||null;}
  setAttribute(name,value){this.attributes[name]=String(value);}
  addEventListener(name,fn){(this.listeners[name]??=[]).push(fn);}
  async dispatch(name){for(const fn of this.listeners[name]||[])await fn({target:this});}
  querySelector(selector){return this.walk().find(n=>selector.startsWith('.')?n.className.split(' ').includes(selector.slice(1)):n.tagName===selector)||null;}
  walk(){return this.children.flatMap(n=>[n,...n.walk()]);}
}
const baseURL=new URL('../js/',import.meta.url);
const source=readFileSync(fileURLToPath(new URL('tienda.js',baseURL)),'utf8')
  .replace(/(['"])\.\/(catalogo-(?:core|seguridad)\.js)(?:\?[^'"]*)?\1/g,(_,quote,name)=>JSON.stringify(new URL(name,baseURL).href));
let fixtureSequence=0;
async function runStore({brokenLegacy=false,brokenSecurity=false,priceFeed=feedFor([], {stale:true}),reference=null,referenceFails=false}={},fn) {
  const saved=Object.fromEntries(['document','window','self','fetch','setInterval'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  const selectors=Object.fromEntries(['#products','#search','#count','#empty','#load-error'].map(key=>[key,new Node()]));
  selectors['#load-error'].append(new Node('#text','Error al cargar '));
  const filters=['all','videovigilancia','intrusion','acceso','incendio'].map(category=>{const node=new Node('button');node.dataset.filter=category;return node;});
  const calls=[];let opened=null;
  const doc={querySelector:selector=>selectors[selector],querySelectorAll:()=>filters,createElement:tag=>new Node(tag),activeElement:null};
  const fetchStub=async (url,options={})=>{
    calls.push({url,options});
    if(url==='/data/catalogo-exterior.json'){
      if(brokenLegacy)throw new Error('catálogo no disponible');
      return {ok:true,json:async()=>({observed_at:stale,products:structuredClone([camera])})};
    }
    if(url==='/data/catalogo-seguridad.json'){
      if(brokenSecurity)throw new Error('catálogo no disponible');
      return {ok:true,json:async()=>({products:structuredClone([alarm,recorder,camera])})};
    }
    if(url==='/api/catalogo-seguridad')return {ok:true,json:async()=>structuredClone(priceFeed)};
    if(url==='https://ventas.protectia.cl/api/tienda/referencia'){
      if(referenceFails)throw new Error('ventas no disponible');
      return {ok:true,json:async()=>reference??{ok:true,verificado:false,codigo:'PIA-INTEGRATION',cantidad:3,variant_id:'alarm-1',precio_ref:null}};
    }
    throw new Error(`Petición inesperada: ${url}`);
  };
  for(const [key,value]of Object.entries({document:doc,window:{location:{assign:url=>{opened=url;}}},self:{crypto:globalThis.crypto},fetch:fetchStub,setInterval:()=>0}))Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});
  try {
    await import(`data:text/javascript;base64,${Buffer.from(source+`\n// fixture ${++fixtureSequence}`).toString('base64')}`);
    await fn({selectors,filters,calls,get opened(){return opened;}});
  }finally{for(const [key,descriptor]of Object.entries(saved)){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}
}
const cardByTitle=(fixture,title)=>fixture.selectors['#products'].children.find(card=>card.querySelector('h3').textContent===title);

await check('ambos catálogos se combinan sin duplicar handles ni llamar al proveedor por tarjeta',()=>runStore({},fixture=>{
  assert.equal(fixture.selectors['#products'].children.length,3);
  assert.equal(fixture.selectors['#count'].textContent,'3 productos');
  assert.equal(fixture.calls.length,3);
  assert.equal(fixture.calls.some(call=>String(call.url).startsWith('/api/catalogo-exterior')),false);
  for(const card of fixture.selectors['#products'].children)assert.equal(card.querySelector('.stock').textContent,'Disponibilidad por confirmar');
}));
await check('caída de un catálogo conserva el otro y muestra aviso parcial',()=>runStore({brokenLegacy:true},fixture=>{
  assert.equal(fixture.selectors['#products'].children.length,3);
  assert.equal(fixture.selectors['#load-error'].hidden,false);
  assert.match(fixture.selectors['#load-error'].textContent,/Parte del catálogo/);
}));
await check('caída de seguridad no elimina las cámaras existentes',()=>runStore({brokenSecurity:true},fixture=>{
  assert.equal(fixture.selectors['#products'].children.length,1);
  assert.ok(cardByTitle(fixture,camera.model));
}));
await check('filtros y búsqueda del DOM muestran solamente la categoría y SKU elegidos',()=>runStore({},async fixture=>{
  await fixture.filters.find(n=>n.dataset.filter==='intrusion').dispatch('click');
  const visible=()=>fixture.selectors['#products'].children.filter(card=>!card.hidden);
  assert.equal(visible().length,1);
  assert.equal(visible()[0].querySelector('h3').textContent,alarm.model);
  fixture.selectors['#search'].value='SYN-NVR-01';
  await fixture.selectors['#search'].dispatch('input');
  assert.equal(visible().length,0);
  assert.equal(fixture.selectors['#empty'].hidden,false);
  await fixture.filters.find(n=>n.dataset.filter==='all').dispatch('click');
  assert.equal(visible().length,1);
  assert.equal(visible()[0].querySelector('h3').textContent,recorder.model);
}));
await check('precio vencido mantiene su fecha y requiere actualización, sin afirmar stock',()=>runStore({priceFeed:feedFor([{...row,observed_at:stale}],{stale:true})},fixture=>{
  const card=cardByTitle(fixture,alarm.model);
  assert.match(card.querySelector('.price').textContent,/115[.,]000/);
  assert.match(card.querySelector('.checked').textContent,/Precio referencial del .*Requiere actualización/);
  assert.equal(card.querySelector('.stock').textContent,'Disponibilidad por confirmar');
}));
await check('fallo de actualización exige revisión aunque el último precio tenga menos de 24 horas',()=>{
  const current=new Date(Date.now()-60000).toISOString();
  const failedFeed=feedFor([{...row,observed_at:current}],{updated_at:current,stale:true});
  const offer=dailyPriceFor(row.sku,failedFeed);
  assert.equal(isFresh(offer.observed_at),true);
  assert.equal(offer.stale,true);
  return runStore({priceFeed:failedFeed},fixture=>{
    const card=cardByTitle(fixture,alarm.model);
    assert.match(card.querySelector('.checked').textContent,/Requiere actualización/);
    assert.equal(card.querySelector('.stock').textContent,'Disponibilidad por confirmar');
  });
});
await check('sin precio autorizado se ofrece cotización y la consulta enviada incluye cantidad, variante y SKU',()=>runStore({},async fixture=>{
  const card=cardByTitle(fixture,alarm.model);
  assert.equal(card.querySelector('.price').textContent,'Precio por confirmar');
  const input=card.querySelector('input');input.value='3';await input.dispatch('change');
  await card.querySelector('button').dispatch('click');
  const sent=JSON.parse(fixture.calls.find(call=>call.options.method==='POST').options.body);
  assert.equal(sent.handle,alarm.handle);assert.equal(sent.variant_id,'alarm-1');assert.equal(sent.sku,'SYN-ALARM-01');assert.equal(sent.cantidad,3);
  assert.equal('precio_ref' in sent,false);assert.equal('verificado' in sent,false);
  const body=textOfURL(fixture.opened);
  assert.match(body,/asesoría/);assert.match(body,/Cantidad: 3 unidades/);assert.match(body,/Referencia: PIA-INTEGRATION/);
  assert.doesNotMatch(body,/Stock verificado|quiero comprar/);
}));
await check('si falla ventas, WhatsApp sigue como asesoría sin inventar referencia',()=>runStore({referenceFails:true},async fixture=>{
  const card=cardByTitle(fixture,alarm.model);
  const input=card.querySelector('input');input.value='2';await input.dispatch('change');
  await card.querySelector('button').dispatch('click');
  const body=textOfURL(fixture.opened);
  assert.match(body,/asesoría/);assert.match(body,/Cantidad: 2 unidades/);
  assert.doesNotMatch(body,/Referencia:|Stock verificado|quiero comprar/);
  assert.equal(input.disabled,false);assert.equal(card.querySelector('button').disabled,false);
}));
await check('cantidad editada inmediatamente antes del clic se captura aunque no haya evento change',()=>runStore({reference:{ok:true,verificado:false,codigo:'PIA-EDITED',cantidad:2,variant_id:'alarm-1',precio_ref:null}},async fixture=>{
  const card=cardByTitle(fixture,alarm.model);
  card.querySelector('input').value='2'; // No dispatch de change: escribir y clicar.
  await card.querySelector('button').dispatch('click');
  const sent=JSON.parse(fixture.calls.find(call=>call.options.method==='POST').options.body);
  assert.equal(sent.cantidad,2);
  assert.match(textOfURL(fixture.opened),/Cantidad: 2 unidades/);
  assert.match(textOfURL(fixture.opened),/Referencia: PIA-EDITED/);
}));
console.log(`\n${passed} escenarios OK (datos sintéticos, sin red).`);
