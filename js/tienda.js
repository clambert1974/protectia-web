/* Tienda ProtectIA HOME — comportamiento progresivo.
 *
 * El catálogo, el estado «Precio por confirmar» y los enlaces de cotización
 * están en el HTML y funcionan sin JavaScript. Este archivo sólo añade:
 *   1) el menú de navegación en pantallas angostas (teclado y Escape),
 *   2) un aviso legible cuando una imagen no carga,
 *   3) la presentación de un importe cuando —y sólo cuando— coinciden una
 *      habilitación comercial declarada aquí y un registro técnico válido
 *      del feed `data/precios.json`.
 *
 * El feed no habilita por sí mismo: `stock:true` y una fecha vigente no
 * autorizan mostrar un precio. Nunca se inserta HTML proveniente del feed ni
 * se construyen selectores con sus valores; sólo texto y sólo en las tarjetas
 * ya presentes en la página.
 */
(function (global) {
  'use strict';

  /* ------------------------------------------------------------------ *
   * 1. Habilitación comercial (declarativa)
   * ------------------------------------------------------------------ *
   * Lista vacía = ningún producto tiene importe habilitado hoy: los 13
   * mantienen «Precio por confirmar» y «Solicitar cotización», y ningún
   * importe se agrega al mensaje de WhatsApp.
   *
   * Cada entrada habilita UN importe exacto para UN producto; no autoriza
   * cualquier precio futuro del mismo slug. Para mostrarlo debe coincidir
   * exactamente con el registro del feed. Estructura de una entrada:
   *
   *   {
   *     slug: 'reolink-rlc-510wa',      // identidad del producto en la página
   *     importe: 54990,                 // importe aprobado, entero, en CLP
   *     moneda: 'CLP',                  // sin conversión supuesta
   *     vigenciaHasta: '2026-09-11T08:00:05-03:00', // ISO con zona/offset
   *     requiereStock: true,            // condición aprobada
   *     condiciones: 'Precio referencial · CLP'     // texto visible breve
   *   }
   *
   * La aprobación no se toma del feed, de la URL ni de ningún parámetro
   * externo: sólo de esta constante, que se edita con decisión comercial
   * trazable por producto. Una entrada mal formada se ignora (queda
   * pendiente); dos entradas para el mismo slug se descartan por ambiguas.
   */
  var HABILITACIONES = [];

  /* Textos fijos del estado pendiente (decisión comercial vigente). */
  var TEXTO_PENDIENTE = 'Precio por confirmar';
  var ETIQUETA_PENDIENTE = 'Compra por pedido';
  var ETIQUETA_APROBADA = 'Precio referencial · CLP';
  var AVISO_IMAGEN = 'Imagen no disponible. El modelo se confirma al cotizar.';
  var RUTA_FEED = 'data/precios.json';

  /* ------------------------------------------------------------------ *
   * 2. Validaciones puras (sin DOM; TEC las ejercita desde tests/)
   * ------------------------------------------------------------------ */

  /* Fecha ISO inequívoca: exige zona explícita (Z u offset ±HH:MM). */
  var ISO_CON_ZONA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

  function instanteValido(valor) {
    if (typeof valor !== 'string' || !ISO_CON_ZONA.test(valor)) return null;
    var t = Date.parse(valor);
    return (typeof t === 'number' && isFinite(t)) ? t : null;
  }

  function esObjetoPlano(valor) {
    return !!valor && typeof valor === 'object' && !Array.isArray(valor);
  }

  function esSlug(valor) {
    return typeof valor === 'string' && valor.length > 0;
  }

  /* CLP no usa decimales: se exige entero positivo finito. Así un valor
     decimal nunca puede redondearse hasta coincidir con un importe aprobado. */
  function importeValido(valor) {
    return typeof valor === 'number' && isFinite(valor) &&
      Math.floor(valor) === valor && valor > 0;
  }

  /* Formato local sin depender de Intl, para que la salida sea idéntica en
     navegador y en las pruebas. */
  function formatearCLP(monto) {
    if (!importeValido(monto)) return null;
    var digitos = String(monto);
    var salida = '';
    for (var i = digitos.length - 1, n = 0; i >= 0; i--) {
      salida = digitos.charAt(i) + salida;
      n++;
      if (n % 3 === 0 && i > 0) salida = '.' + salida;
    }
    return '$' + salida;
  }

  /* Normaliza la lista declarativa: devuelve un Map slug -> habilitación. */
  function normalizarHabilitaciones(lista) {
    var validas = new Map();
    var ambiguas = new Set();
    if (!Array.isArray(lista)) return validas;
    lista.forEach(function (entrada) {
      if (!esObjetoPlano(entrada) || !esSlug(entrada.slug)) return;
      var vence = instanteValido(entrada.vigenciaHasta);
      var ok = importeValido(entrada.importe) &&
        entrada.moneda === 'CLP' &&
        entrada.requiereStock === true &&
        vence !== null &&
        (entrada.condiciones === undefined || typeof entrada.condiciones === 'string');
      if (!ok) return;
      if (validas.has(entrada.slug)) { ambiguas.add(entrada.slug); return; }
      validas.set(entrada.slug, {
        slug: entrada.slug,
        importe: entrada.importe,
        moneda: entrada.moneda,
        vigenciaHasta: vence,
        requiereStock: true,
        condiciones: typeof entrada.condiciones === 'string' && entrada.condiciones
          ? entrada.condiciones
          : ETIQUETA_APROBADA
      });
    });
    ambiguas.forEach(function (slug) { validas.delete(slug); });
    return validas;
  }

  function decisionPendiente(slug, motivo) {
    return {
      slug: slug,
      mostrarImporte: false,
      motivo: motivo,
      importe: null,
      texto: TEXTO_PENDIENTE,
      etiqueta: ETIQUETA_PENDIENTE,
      venceEn: null
    };
  }

  function aSet(valor) {
    if (valor instanceof Set) return valor;
    return new Set(Array.isArray(valor) ? valor : []);
  }

  /* Evalúa el feed completo contra la habilitación comercial.
   *
   * opciones: { habilitaciones: Array, slugsConocidos: Array|Set, ahora: ms }
   * Devuelve { estructura, decisiones: Array, porSlug: Map }, con una decisión
   * por cada slug conocido de la página —nunca por slugs que sólo existen en
   * el feed— y pendiente por defecto. Un registro defectuoso no interrumpe el
   * procesamiento de los demás. */
  function evaluarFeed(feed, opciones) {
    opciones = opciones || {};
    var ahora = typeof opciones.ahora === 'number' ? opciones.ahora : Date.now();
    var aprobadas = normalizarHabilitaciones(opciones.habilitaciones);
    var conocidos = aSet(opciones.slugsConocidos);

    var porSlug = new Map();
    conocidos.forEach(function (slug) {
      porSlug.set(slug, decisionPendiente(slug, 'sin-registro-en-feed'));
    });

    var resultado = function (estructura) {
      return {
        estructura: estructura,
        porSlug: porSlug,
        decisiones: Array.from(porSlug.values())
      };
    };

    if (feed === null || feed === undefined) {
      porSlug.forEach(function (d, slug) {
        porSlug.set(slug, decisionPendiente(slug, 'feed-no-disponible'));
      });
      return resultado('no-disponible');
    }
    if (!esObjetoPlano(feed) || !Array.isArray(feed.productos)) {
      porSlug.forEach(function (d, slug) {
        porSlug.set(slug, decisionPendiente(slug, 'estructura-invalida'));
      });
      return resultado('invalida');
    }

    /* Primera pasada: detectar slugs repetidos en el feed. Un duplicado no
       puede resolverse eligiendo una oferta arbitraria. */
    var apariciones = new Map();
    feed.productos.forEach(function (item) {
      if (!esObjetoPlano(item) || !esSlug(item.slug)) return;
      apariciones.set(item.slug, (apariciones.get(item.slug) || 0) + 1);
    });

    feed.productos.forEach(function (item) {
      if (!esObjetoPlano(item)) return;                       // registro nulo o no objeto
      if (!esSlug(item.slug)) return;                         // sin identidad utilizable
      if (!porSlug.has(item.slug)) return;                    // slug desconocido en la página
      if (apariciones.get(item.slug) > 1) {
        porSlug.set(item.slug, decisionPendiente(item.slug, 'slug-duplicado'));
        return;
      }

      var aprobada = aprobadas.get(item.slug);
      if (!aprobada) {
        porSlug.set(item.slug, decisionPendiente(item.slug, 'sin-habilitacion'));
        return;
      }
      if (item.stock !== true) {
        porSlug.set(item.slug, decisionPendiente(item.slug, 'sin-stock-en-feed'));
        return;
      }
      if (!importeValido(item.precio_publicado)) {
        porSlug.set(item.slug, decisionPendiente(item.slug, 'importe-invalido'));
        return;
      }
      if (item.moneda !== undefined && item.moneda !== aprobada.moneda) {
        porSlug.set(item.slug, decisionPendiente(item.slug, 'moneda-no-coincide'));
        return;
      }
      if (item.precio_publicado !== aprobada.importe) {
        porSlug.set(item.slug, decisionPendiente(item.slug, 'importe-no-aprobado'));
        return;
      }
      var venceFeed = instanteValido(item.valido_hasta);
      if (venceFeed === null) {
        porSlug.set(item.slug, decisionPendiente(item.slug, 'fecha-invalida'));
        return;
      }
      if (!(venceFeed > ahora)) {
        porSlug.set(item.slug, decisionPendiente(item.slug, 'vencido'));
        return;
      }
      if (!(aprobada.vigenciaHasta > ahora)) {
        porSlug.set(item.slug, decisionPendiente(item.slug, 'habilitacion-vencida'));
        return;
      }

      var texto = formatearCLP(item.precio_publicado);
      if (texto === null) {
        porSlug.set(item.slug, decisionPendiente(item.slug, 'importe-invalido'));
        return;
      }
      porSlug.set(item.slug, {
        slug: item.slug,
        mostrarImporte: true,
        motivo: 'habilitado',
        importe: item.precio_publicado,
        texto: texto,
        etiqueta: aprobada.condiciones,
        venceEn: Math.min(venceFeed, aprobada.vigenciaHasta)
      });
    });

    return resultado('ok');
  }

  /* Vigencia comprobable en cualquier momento posterior (pestaña abierta). */
  function sigueVigente(decision, ahora) {
    if (!decision || decision.mostrarImporte !== true) return false;
    if (typeof decision.venceEn !== 'number') return false;
    return decision.venceEn > (typeof ahora === 'number' ? ahora : Date.now());
  }

  /* Reconstruye siempre desde la URL base del producto: sin sufijos repetidos
     y sin importe cuando no hay habilitación vigente. */
  function construirEnlaceConsulta(base, textoImporte) {
    if (typeof base !== 'string' || base === '') return base;
    if (typeof textoImporte !== 'string' || textoImporte === '') return base;
    return base + encodeURIComponent(' — Precio referencial: ' + textoImporte);
  }

  var API = {
    HABILITACIONES: HABILITACIONES,
    TEXTO_PENDIENTE: TEXTO_PENDIENTE,
    ETIQUETA_PENDIENTE: ETIQUETA_PENDIENTE,
    ETIQUETA_APROBADA: ETIQUETA_APROBADA,
    instanteValido: instanteValido,
    importeValido: importeValido,
    formatearCLP: formatearCLP,
    normalizarHabilitaciones: normalizarHabilitaciones,
    evaluarFeed: evaluarFeed,
    sigueVigente: sigueVigente,
    construirEnlaceConsulta: construirEnlaceConsulta
  };

  /* ------------------------------------------------------------------ *
   * 3. Capa de presentación
   * ------------------------------------------------------------------ */

  function iniciar(doc) {
    /* Menú progresivo: sólo se activa si existen sus dos piezas. */
    var menu = doc.querySelector('.menu-toggle');
    var nav = doc.getElementById('menu-principal');
    if (menu && nav) {
      doc.body.classList.add('menu-js');
      menu.addEventListener('click', function () {
        var abierto = menu.getAttribute('aria-expanded') !== 'true';
        menu.setAttribute('aria-expanded', String(abierto));
        nav.classList.toggle('is-open', abierto);
      });
      doc.addEventListener('keydown', function (evento) {
        if (evento.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') {
          menu.setAttribute('aria-expanded', 'false');
          nav.classList.remove('is-open');
          menu.focus();
        }
      });
    }

    /* Imagen fallida: marco neutro y legible, sin sustituir el producto. */
    function marcarImagenFallida(img) {
      var marco = img.parentNode;
      if (!marco || !marco.classList || !marco.classList.contains('producto-foto')) return;
      if (marco.classList.contains('sin-imagen')) return;
      marco.classList.add('sin-imagen');
      img.setAttribute('hidden', '');
      var aviso = doc.createElement('span');
      aviso.className = 'foto-aviso';
      aviso.textContent = AVISO_IMAGEN;
      marco.insertBefore(aviso, marco.firstChild);
    }
    Array.prototype.forEach.call(doc.querySelectorAll('.producto-foto img'), function (img) {
      img.addEventListener('error', function () { marcarImagenFallida(img); });
      if (img.complete && img.naturalWidth === 0) marcarImagenFallida(img);
    });

    /* Tarjetas conocidas: la identidad viene del HTML, nunca del feed. */
    var tarjetas = new Map();
    var repetidas = new Set();
    Array.prototype.forEach.call(doc.querySelectorAll('.producto[data-slug]'), function (card) {
      var slug = card.getAttribute('data-slug');
      if (!esSlug(slug)) return;
      if (tarjetas.has(slug)) { repetidas.add(slug); return; }
      tarjetas.set(slug, card);
    });
    repetidas.forEach(function (slug) { tarjetas.delete(slug); });
    if (!tarjetas.size) return;

    function baseConsulta(enlace) {
      if (!enlace.dataset.consultaBase) {
        enlace.dataset.consultaBase = enlace.getAttribute('href') || '';
      }
      return enlace.dataset.consultaBase;
    }

    function pintar(decision) {
      var card = tarjetas.get(decision.slug);
      if (!card) return;
      var precio = card.querySelector('.producto-precio');
      var etiqueta = card.querySelector('.producto-precio-etiqueta');
      var enlace = card.querySelector('.producto-cotizar');
      if (!precio || !etiqueta || !enlace) return;
      var base = baseConsulta(enlace);
      var vigente = sigueVigente(decision, Date.now());
      if (vigente) {
        precio.textContent = decision.texto;
        precio.classList.remove('pendiente');
        etiqueta.textContent = decision.etiqueta;
        enlace.setAttribute('href', construirEnlaceConsulta(base, decision.texto));
      } else {
        precio.textContent = TEXTO_PENDIENTE;
        precio.classList.add('pendiente');
        etiqueta.textContent = ETIQUETA_PENDIENTE;
        enlace.setAttribute('href', base);
      }
    }

    var decisiones = [];
    var temporizador = null;

    function repintar() {
      decisiones.forEach(pintar);
      programarVencimiento();
    }

    /* El importe deja de aparecer como vigente al vencer, aunque la pestaña
       siga abierta: temporizador + revisión al volver y antes de usar el CTA. */
    function programarVencimiento() {
      if (temporizador) { clearTimeout(temporizador); temporizador = null; }
      var ahora = Date.now();
      var proximo = null;
      decisiones.forEach(function (d) {
        if (d.mostrarImporte && typeof d.venceEn === 'number' && d.venceEn > ahora) {
          if (proximo === null || d.venceEn < proximo) proximo = d.venceEn;
        }
      });
      if (proximo === null) return;
      var espera = Math.min(Math.max(proximo - ahora + 500, 500), 2147483647);
      temporizador = setTimeout(repintar, espera);
    }

    function aplicar(feed) {
      var evaluacion = evaluarFeed(feed, {
        habilitaciones: HABILITACIONES,
        slugsConocidos: Array.from(tarjetas.keys()),
        ahora: Date.now()
      });
      decisiones = evaluacion.decisiones;
      repintar();
    }

    doc.addEventListener('visibilitychange', function () {
      if (!doc.hidden) repintar();
    });
    if (global.addEventListener) {
      global.addEventListener('pageshow', repintar);
      global.addEventListener('focus', repintar);
    }
    /* Antes de abrir la consulta se revalida: si venció, se abre igualmente
       pero sin importe en el mensaje. El contacto nunca se bloquea. */
    doc.addEventListener('click', function (evento) {
      var destino = evento.target && evento.target.closest
        ? evento.target.closest('.producto-cotizar')
        : null;
      if (destino) repintar();
    }, true);

    /* Estado inicial: las tarjetas ya vienen pendientes desde el HTML. */
    if (typeof global.fetch !== 'function') return;
    global.fetch(RUTA_FEED, { cache: 'no-store' })
      .then(function (respuesta) {
        if (!respuesta || !respuesta.ok) return null;
        return respuesta.json().catch(function () { return null; });
      })
      .then(aplicar)
      .catch(function () { aplicar(null); });
  }

  if (typeof module === 'object' && module && module.exports) {
    module.exports = API;          // uso desde las pruebas de TEC (Node)
  } else {
    global.TiendaProtectIA = API;
  }
  if (typeof document !== 'undefined' && document) {
    iniciar(document);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
