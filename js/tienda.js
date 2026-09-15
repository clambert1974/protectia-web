import {isFresh, initialVariant, consultationLink} from './catalogo-core.js';
const money = new Intl.NumberFormat('es-CL', {style:'currency',currency:'CLP',maximumFractionDigits:0});
const date = new Intl.DateTimeFormat('es-CL', {day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'America/Santiago'});
const grid = document.querySelector('#products');
const cards = new Map();
let category = 'all';
const el = (tag, className, text) => {const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;};
function filterCards() {
  const query=document.querySelector('#search').value.trim().toLocaleLowerCase('es');
  let visible=0;
  for(const state of cards.values()) {
    const p=state.product;
    state.card.hidden = !(category==='all'||p.category===category) || !`${p.model} ${p.title} ${p.features.join(' ')}`.toLocaleLowerCase('es').includes(query);
    if(!state.card.hidden)visible++;
  }
  document.querySelector('#count').textContent=`${visible} ${visible===1?'producto':'productos'}`;
  document.querySelector('#empty').hidden=visible!==0;
}
function paintOffer(state) {
  const variant=state.variants.find(v=>v.id===state.selected)||initialVariant(state.variants);
  state.selected=variant.id;
  const fresh=isFresh(state.observedAt);
  state.stock.dataset.state=fresh?(variant.available?'available':'unavailable'):'unknown';
  state.stock.textContent=fresh?(variant.available?'Disponible por encargo':'Sin stock'):'Disponibilidad por confirmar';
  state.price.textContent=fresh?money.format(variant.price):'Precio por confirmar';
  state.sku.textContent=`SKU: ${variant.sku||'Por confirmar'}`;
  state.checked.textContent=`Consultado: ${date.format(new Date(state.observedAt))} · hora de Chile${state.refreshFailed?' · actualización pendiente':''}`;
  state.image.src=variant.image||state.product.image;
  state.action.href=consultationLink(state.product,variant,state.observedAt);
  state.action.firstChild.textContent=fresh&&variant.available?'Consultar este modelo':'Consultar disponibilidad';
}
function paintVariants(state) {
  const signature=JSON.stringify([state.variants,isFresh(state.observedAt)]);
  if(state.variantSignature===signature)return;
  const previous=state.variantBox.querySelector('select');
  if(previous&&document.activeElement===previous){
    if(!state.variantUpdatePending){state.variantUpdatePending=true;previous.addEventListener('blur',()=>{state.variantUpdatePending=false;paintVariants(state);},{once:true});}
    return;
  }
  state.variantSignature=signature;
  state.variantBox.replaceChildren();
  if(state.variants.length>1) {
    const label=el('label','variant-label','Elige una opción');
    const select=el('select');select.setAttribute('aria-label',`Opción de ${state.product.model}`);
    for(const v of state.variants){const option=el('option','',v.title+(isFresh(state.observedAt)&&!v.available?' · sin stock':''));option.value=v.id;select.append(option);}
    select.value=state.selected;select.addEventListener('change',()=>{state.selected=select.value;paintOffer(state);});label.append(select);state.variantBox.append(label);
  }else state.variantBox.append(el('p','single-variant',state.variants[0].title));
}
function buildCard(product, observedAt) {
  const card=el('article','product-card');
  const visual=el('div','product-visual');
  const image=el('img');image.alt=`Reolink ${product.model}`;image.loading='lazy';image.decoding='async';image.width=320;image.height=240;
  visual.append(el('span','type-badge',({camara:'Exterior',kit:'Kit / pack',openbox:'Open Box'})[product.category]),image);
  const content=el('div','product-content');
  const features=el('ul','features');product.features.forEach(f=>features.append(el('li','',f)));
  const variantBox=el('div');const sku=el('p','sku');const stock=el('p','stock');const price=el('p','price');const checked=el('p','checked');const action=el('a','button','Consultar este modelo');action.append(el('span','','↗'));
  const purchase=el('div','purchase');purchase.append(stock,price,el('p','price-note','Valor de referencia · despacho por confirmar'),checked,action);
  content.append(el('p','product-brand','REOLINK'),el('h3','',product.model),el('p','product-title',product.title),features,variantBox,sku,purchase);
  card.append(visual,content);
  const state={product,card,image,variantBox,sku,stock,price,checked,action,variants:product.variants,selected:initialVariant(product.variants).id,observedAt,refreshFailed:false};
  paintVariants(state);paintOffer(state);grid.append(card);cards.set(product.handle,state);
}
async function refresh(state) {
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),12000);
  try {
    const response=await fetch(`/api/catalogo-exterior?modelo=${encodeURIComponent(state.product.handle)}`,{signal:controller.signal,credentials:'omit'});
    if(!response.ok)throw new Error('Sin actualización');
    const data=await response.json();
    if(data.handle!==state.product.handle||data.currency!=='CLP'||!isFresh(data.observed_at)||!Array.isArray(data.variants)||!data.variants.length||!data.variants.every(v=>typeof v.id==='string'&&typeof v.title==='string'&&typeof v.available==='boolean'&&Number.isSafeInteger(v.price)&&v.price>0))throw new Error('Datos no válidos');
    state.variants=data.variants;state.observedAt=data.observed_at;state.refreshFailed=false;
    if(!state.variants.some(v=>v.id===state.selected))state.selected=initialVariant(state.variants).id;
    paintVariants(state);paintOffer(state);
  } catch {state.refreshFailed=true;paintOffer(state);} finally {clearTimeout(timeout);}
}
document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{category=button.dataset.filter;document.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));filterCards();}));
document.querySelector('#search').addEventListener('input',filterCards);
try {
  const response=await fetch('/data/catalogo-exterior.json',{credentials:'omit'});
  if(!response.ok)throw new Error('Catálogo no disponible');
  const data=await response.json();
  for(const p of data.products)buildCard(p,data.observed_at);
  grid.setAttribute('aria-busy','false');filterCards();
  const queue=[...cards.values()];
  await Promise.all(Array.from({length:4},async()=>{while(queue.length)await refresh(queue.shift());}));
  setInterval(()=>{for(const state of cards.values()){paintVariants(state);paintOffer(state);}},60000);
}catch {grid.setAttribute('aria-busy','false');document.querySelector('#load-error').hidden=false;document.querySelector('#count').textContent='Catálogo no disponible';}
