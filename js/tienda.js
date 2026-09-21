import {isFresh, initialVariant, refDate, mintReference, whatsappURL, refMatches} from './catalogo-core.js?v=20260921-ref-pendiente';
const money = new Intl.NumberFormat('es-CL', {style:'currency',currency:'CLP',maximumFractionDigits:0});
const grid = document.querySelector('#products');
const cards = new Map();
// idem_key estable por (handle|variante|cantidad) durante la sesión: el doble
// clic o el reintento reusan el mismo y el servidor NO duplica la referencia.
const refsSesion = new Map();
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
  // NUNCA afirmamos "disponible"/"sin stock" desde el catálogo (una fecha + un
  // booleano): eso es una foto del inventario, no una comprobación en vivo. La
  // tarjeta muestra siempre precio referencial y "Disponibilidad por confirmar";
  // el stock real para la variante y la cantidad lo verifica el servidor al
  // consultar (referencias.py).
  state.stock.dataset.state='unknown';
  state.stock.textContent='Disponibilidad por confirmar';
  state.price.textContent=(Number.isSafeInteger(variant.price)&&variant.price>0)?money.format(variant.price):'Precio por confirmar';
  state.sku.textContent=`SKU: ${variant.sku||'Por confirmar'}`;
  state.checked.textContent=`Precio referencial del ${refDate(state.observedAt)} · Disponibilidad por confirmar`;
  state.image.src=variant.image||state.product.image;
  if(!state.checking)state.action.firstChild.textContent='Consultar disponibilidad';
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
    for(const v of state.variants){const option=el('option','',v.title);option.value=v.id;select.append(option);}
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
  const variantBox=el('div');const sku=el('p','sku');const stock=el('p','stock');const price=el('p','price');const checked=el('p','checked');
  const qtyInput=el('input');qtyInput.type='number';qtyInput.min='1';qtyInput.max='99';qtyInput.step='1';qtyInput.value='1';qtyInput.inputMode='numeric';qtyInput.setAttribute('aria-label',`Cantidad de Reolink ${product.model}`);
  const qty=el('label','qty','Cantidad');qty.append(qtyInput);
  const action=el('button','button','Consultar disponibilidad');action.type='button';action.style.width='100%';action.setAttribute('aria-label',`Consultar disponibilidad y precio de Reolink ${product.model} por WhatsApp`);action.append(el('span','','↗'));
  const feedback=el('p','price-note');feedback.setAttribute('role','status');feedback.style.marginTop='12px';feedback.textContent='Consultamos disponibilidad y precio antes de abrir WhatsApp.';
  const purchase=el('div','purchase');purchase.append(stock,price,el('p','price-note','Valor de referencia · despacho por confirmar'),checked,qty,action,feedback);
  content.append(el('p','product-brand','REOLINK'),el('h3','',product.model),el('p','product-title',product.title),features,variantBox,sku,purchase);
  card.append(visual,content);
  const state={product,card,image,variantBox,sku,stock,price,checked,action,feedback,variants:product.variants,selected:initialVariant(product.variants).id,observedAt,refreshFailed:false,checking:false,cantidad:1};
  qtyInput.addEventListener('change',()=>{let n=parseInt(qtyInput.value,10);if(!Number.isFinite(n)||n<1)n=1;if(n>99)n=99;qtyInput.value=String(n);state.cantidad=n;});
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
  const cantidad=state.cantidad||1;
  const variant=state.variants.find(v=>v.id===state.selected)||initialVariant(state.variants);
  state.checking=true;state.action.disabled=true;state.action.firstChild.textContent='Preparando consulta…';state.feedback.textContent='Comprobando con nuestro sistema…';
  const selector=state.variantBox.querySelector('select');if(selector)selector.disabled=true;
  try {
    // El SERVIDOR verifica (con su fuente) y mintea la referencia. El navegador
    // no manda precio ni stock. Doble clic dedup por idem_key estable.
    const key=`${state.product.handle}|${variant.id}|${cantidad}`;
    let idemKey=refsSesion.get(key);
    if(!idemKey){idemKey=(self.crypto&&crypto.randomUUID)?crypto.randomUUID():`${Date.now()}-${Math.random().toString(16).slice(2)}`;refsSesion.set(key,idemKey);}
    const srv=await mintReference({idem_key:idemKey,handle:state.product.handle,variant_id:variant.id,variant_title:variant.title,sku:variant.sku,cantidad});
    let datos=srv;
    // Discrepancia: lo que registró el servidor (cantidad/variante) debe coincidir
    // con lo pedido. Si no, no usamos esa referencia (se degrada a asesoría sin
    // código) para no abrir WhatsApp con datos que no calzan con el registro.
    if(datos&&!refMatches(variant.id,cantidad,datos)){
      console.warn('tienda: discrepancia servidor/cliente en la referencia; asesoría sin código.');
      datos=null;
    }
    // Si ventas no respondió (o hubo discrepancia): asesoría sin código, con
    // precio referencial del seed. Nunca afirma stock; no se bloquea la venta.
    // Sin código (fallo del POST, tope diario o discrepancia): WhatsApp igual,
    // con "Referencia: pendiente". Es una MITIGACIÓN: esa consulta no queda en
    // el panel ni avisa al vendedor. Se deja rastro en consola.
    if(datos&&!datos.codigo)console.warn('tienda: el servidor no devolvió código; WhatsApp con "Referencia: pendiente".');
    if(!datos)datos={verificado:false,codigo:null,precio_ref:variant.price,moneda:'CLP',observed_at:state.observedAt};
    state.feedback.textContent=datos.verificado?'Stock verificado. Abriendo WhatsApp…':'Abriendo WhatsApp para consultar disponibilidad…';
    window.location.assign(whatsappURL(state.product,variant,cantidad,datos));
  }finally{state.checking=false;state.action.disabled=false;const current=state.variantBox.querySelector('select');if(current)current.disabled=false;paintOffer(state);}
}
// Aviso de catálogo: deja claro que el pedido lo opera BLU STORE y ProtectIA
// asesora. Usa la clase .catalogue-info ya existente; se inserta una sola vez.
if(grid&&grid.parentNode&&!document.querySelector('.catalogue-info')){
  grid.parentNode.insertBefore(el('p','catalogue-info','Los pedidos los cobra, factura y despacha BLU STORE. ProtectIA te asesora en la elección e instalación.'),grid);
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
