import {isFresh, initialVariant, verifiedConsultation} from './catalogo-core.js?v=20260915-whatsapp-stock';
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
  if(!state.checking)state.action.firstChild.textContent='Verificar stock y consultar';
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
    const select=el('select');select.disabled=state.checking;select.setAttribute('aria-label',`Opción de ${state.product.model}`);
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
  const variantBox=el('div');const sku=el('p','sku');const stock=el('p','stock');const price=el('p','price');const checked=el('p','checked');const action=el('button','button','Verificar stock y consultar');action.type='button';action.style.width='100%';action.setAttribute('aria-label',`Verificar stock de Reolink ${product.model} y consultar por WhatsApp`);action.append(el('span','','↗'));
  const feedback=el('p','price-note');feedback.setAttribute('role','status');feedback.style.marginTop='12px';feedback.textContent='Comprobamos disponibilidad antes de abrir WhatsApp.';
  const purchase=el('div','purchase');purchase.append(stock,price,el('p','price-note','Valor de referencia · despacho por confirmar'),checked,action,feedback);
  content.append(el('p','product-brand','REOLINK'),el('h3','',product.model),el('p','product-title',product.title),features,variantBox,sku,purchase);
  card.append(visual,content);
  const state={product,card,image,variantBox,sku,stock,price,checked,action,feedback,variants:product.variants,selected:initialVariant(product.variants).id,observedAt,refreshFailed:false,checking:false};
  action.addEventListener('click',()=>checkAndOpenWhatsApp(state));
  paintVariants(state);paintOffer(state);grid.append(card);cards.set(product.handle,state);
}
async function refresh(state) {
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),12000);
  try {
    const response=await fetch(`/api/catalogo-exterior?modelo=${encodeURIComponent(state.product.handle)}`,{signal:controller.signal,credentials:'omit',cache:'no-store'});
    if(!response.ok)throw new Error('Sin actualización');
    const data=await response.json();
    if(data.handle!==state.product.handle||data.currency!=='CLP'||!isFresh(data.observed_at)||!Array.isArray(data.variants)||!data.variants.length||!data.variants.every(v=>typeof v.id==='string'&&typeof v.title==='string'&&typeof v.available==='boolean'&&Number.isSafeInteger(v.price)&&v.price>0))throw new Error('Datos no válidos');
    state.variants=data.variants;state.observedAt=data.observed_at;state.refreshFailed=false;
    if(!state.variants.some(v=>v.id===state.selected))state.selected=initialVariant(state.variants).id;
    paintVariants(state);paintOffer(state);return data;
  } catch {state.refreshFailed=true;paintOffer(state);return null;} finally {clearTimeout(timeout);}
}
async function checkAndOpenWhatsApp(state) {
  if(state.checking)return;
  const selectedId=state.selected;
  state.checking=true;state.action.disabled=true;state.action.firstChild.textContent='Comprobando stock…';state.feedback.textContent='Verificando la opción seleccionada…';
  const selector=state.variantBox.querySelector('select');if(selector)selector.disabled=true;
  try {
    const data=await refresh(state);
    const decision=verifiedConsultation(state.product,selectedId,data);
    if(!decision.ok){
      state.feedback.textContent=decision.reason==='unavailable'?'Esta opción está sin stock. No se abrió la consulta de compra.':'No pudimos confirmar stock actualizado. La consulta de compra quedará disponible cuando podamos verificarlo.';
      return;
    }
    state.feedback.textContent='Stock informado disponible. Abriendo WhatsApp…';
    window.location.assign(decision.url);
  }finally{state.checking=false;state.action.disabled=false;const current=state.variantBox.querySelector('select');if(current)current.disabled=false;paintOffer(state);}
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
