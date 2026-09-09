/* ProtectIA HOME — menú de la cabecera y formulario de consulta.
   Dos comportamientos independientes y en ese orden: el menú móvil (que no
   depende del formulario) y el wizard de tres pasos de #contacto. El aspecto
   vive en css/styles.css; acá solo se decide *cuándo* cambia. El layout es
   todo CSS y el smooth-scroll de las anclas lo hace `scroll-behavior`.

   WEB18 retiró de este archivo el reloj de la franja de estado y la secuencia
   temporizada de la demo de cámara: la portada ya no tiene esa franja ni esa
   demo, y el esquema conceptual que las reemplaza es estático. */

(function () {
  'use strict';

  /* Menú de la cabecera ------------------------------------------------------
     Va primero y dentro de su propio try: si algo acá fallara, el formulario
     —que es la vía de conversión— tiene que seguir funcionando igual.

     La navegación está visible en el marcado y el botón nace con `hidden`. El
     colapso móvil se activa recién acá, agregando .menu-js a la cabecera: si
     este archivo no carga o revienta antes de tiempo, el visitante se queda con
     el nav a la vista en vez de con un botón que no abre nada. */
  try {
    var cabecera = document.querySelector('.site-header');
    var boton = document.querySelector('.menu-toggle');
    var navegacion = document.getElementById('navigation');

    if (cabecera && boton && navegacion) {
      var abrirMenu = function (abierto) {
        boton.setAttribute('aria-expanded', String(abierto));
        // El nombre accesible cambia con el estado: el mismo botón cierra.
        boton.setAttribute('aria-label', abierto ? 'Cerrar navegación' : 'Abrir navegación');
        navegacion.classList.toggle('is-open', abierto);
      };

      boton.hidden = false;
      cabecera.classList.add('menu-js');

      boton.addEventListener('click', function () {
        abrirMenu(boton.getAttribute('aria-expanded') !== 'true');
      });

      // Elegir un destino cierra el menú: el ancla ya se lleva el foco y la
      // vista, y dejarlo abierto taparía el contenido al que se acaba de saltar.
      Array.prototype.forEach.call(navegacion.querySelectorAll('a'), function (enlace) {
        enlace.addEventListener('click', function () { abrirMenu(false); });
      });

      // Escape cierra y devuelve el foco al botón, que es de donde salió.
      document.addEventListener('keydown', function (evento) {
        if (evento.key !== 'Escape') return;
        if (boton.getAttribute('aria-expanded') !== 'true') return;
        abrirMenu(false);
        boton.focus();
      });
    }
  } catch (e) {
    if (window.console) console.error('[menu] se detuvo:', e);
  }

  /* Formulario de consulta ---------------------------------------------------
     Tres pasos. Sin este bloque el formulario se ve de corrido y sigue siendo
     legible: acá se le agrega .wizard-activo al <form> y recién entonces el
     CSS muestra un paso a la vez. */

  /* Endpoint público de leads en ventas-backend: POST /api/lead-web, con
     honeypot (el campo `empresa` del marcado), rate limit por IP, tope diario y
     validación del lado del servidor.

     Vive en ventas.protectia.cl y no en protectia.cl porque el apex lo ocupa
     Pages y Cloudflare no acepta montar ahí un path del túnel. O sea que la
     llamada es cross-origin y el CORS es obligatorio, no un adorno.

     Si algún día esto vuelve a null, el botón se queda deshabilitado y la nota
     del formulario lo explica: el sitio sigue siendo usable, con el teléfono
     como vía de conversión. */
  var ENDPOINT_LEADS = 'https://ventas.protectia.cl/api/lead-web';

  var TELEFONO_TEXTO = '600 914 2219';
  var TELEFONO_HREF = 'tel:6009142219';

  /* Estados de la interfaz, textuales de COPY-FINAL-MKT v1.0.

     Lo que el backend responde hoy es un acuse: un 2xx no acredita que la
     consulta quedara guardada, así que no existe un estado de "registrada" y
     tampoco se promete una llamada. Si algún día TEC/DEV acredita un contrato
     de persistencia real, ese estado se agrega acá y no antes. */
  var ESTADOS = {
    enviando: 'Enviando consulta…',
    acuse: 'No podemos confirmar que tu consulta haya quedado registrada. ' +
           'Puedes hablar con Catalina en el ' + TELEFONO_TEXTO + '.',
    limite: 'No se pudo completar la solicitud en este momento. ' +
            'Puedes hablar con Catalina en el ' + TELEFONO_TEXTO + '.',
    error: 'No pudimos confirmar el registro de tu consulta. ' +
           'Puedes hablar con Catalina en el ' + TELEFONO_TEXTO + '.'
  };

  var form = document.getElementById('wizard');
  if (!form) return;

  var pasos = Array.prototype.slice.call(form.querySelectorAll('.wizard-paso'));
  var progreso = document.getElementById('wizard-progreso');
  var enviar = document.getElementById('wizard-enviar');
  var nota = document.getElementById('wizard-nota');
  var puntos = Array.prototype.slice.call(form.querySelectorAll('[data-punto]'));
  if (!pasos.length) return;

  var actual = 0;
  // El foco se mueve solo cuando el paso cambió por una acción del visitante.
  // En la primera pintada no, o el navegador saltaría al formulario sin que
  // nadie se lo haya pedido.
  var yaInteractuo = false;
  // Un envío a la vez: el botón se deshabilita, pero esto además atrapa el
  // Enter dentro de un campo de texto mientras la petición está en vuelo.
  var enviando = false;

  form.classList.add('wizard-activo');
  if (progreso) progreso.hidden = false;

  /* Escribe la nota de estado dejando el teléfono como enlace real: en móvil
     el número tiene que poder marcarse, no solo leerse. */
  function mensaje(texto) {
    if (!nota) return;
    nota.hidden = false;
    nota.textContent = '';

    var partes = texto.split(TELEFONO_TEXTO);
    nota.appendChild(document.createTextNode(partes[0]));

    if (partes.length > 1) {
      var enlace = document.createElement('a');
      enlace.href = TELEFONO_HREF;
      enlace.textContent = TELEFONO_TEXTO;
      nota.appendChild(enlace);
      nota.appendChild(document.createTextNode(partes.slice(1).join(TELEFONO_TEXTO)));
    }
  }

  function mostrar(indice) {
    actual = Math.max(0, Math.min(indice, pasos.length - 1));

    pasos.forEach(function (paso, i) {
      paso.classList.toggle('wizard-paso-visible', i === actual);
    });

    if (progreso) {
      progreso.textContent = 'Paso ' + (actual + 1) + ' de ' + pasos.length;
    }

    // Los "01 — 02 — 03" del encabezado de la tarjeta son decorativos
    // (aria-hidden): quien no los ve tiene el texto del progreso, que es el que
    // se anuncia.
    puntos.forEach(function (punto, i) {
      punto.classList.toggle('es-actual', i === actual);
    });

    if (!yaInteractuo) return;
    var primero = pasos[actual].querySelector(
      'input:not([type="hidden"]):not([tabindex="-1"]), button'
    );
    if (primero) primero.focus();
  }

  function respondido(indice) {
    return !!pasos[indice].querySelector('input[type="radio"]:checked');
  }

  /* Continuar es la única acción de avance de los pasos 1 y 2: marcar una
     opción solo la marca. Se habilita cuando el paso ya tiene respuesta. */
  function refrescarContinuar() {
    pasos.forEach(function (paso, i) {
      var boton = paso.querySelector('[data-continuar]');
      if (boton) boton.disabled = !respondido(i);
    });
  }

  /* Avanza saltándose los pasos que ya vienen respondidos. Es lo que hace que
     "Consultar sobre mis cámaras" no le vuelva a preguntar por las cámaras a
     quien ya lo dijo al entrar por esa puerta. */
  function avanzar() {
    var siguiente = actual + 1;
    while (siguiente < pasos.length - 1 && respondido(siguiente)) {
      siguiente += 1;
    }
    mostrar(siguiente);
  }

  form.addEventListener('change', function (evento) {
    if (evento.target.type !== 'radio') return;
    // Sin autoavance: acá solo se habilita el Continuar del paso.
    refrescarContinuar();
  });

  form.addEventListener('click', function (evento) {
    var atras = evento.target.closest('[data-atras]');
    if (atras) {
      yaInteractuo = true;
      mostrar(actual - 1);
      return;
    }

    var continuar = evento.target.closest('[data-continuar]');
    if (!continuar || continuar.disabled) return;
    // Solo avanza el botón del paso que está a la vista. Es el seguro contra el
    // doble salto: cualquier otro Continuar del formulario no hace nada.
    if (continuar.closest('.wizard-paso') !== pasos[actual]) return;

    yaInteractuo = true;
    avanzar();
  });

  /* La puerta de entrada con cámaras deja marcada su respuesta antes de que el
     ancla baje al formulario. No se cancela el click: el scroll lo hace el <a>. */
  Array.prototype.forEach.call(
    document.querySelectorAll('[data-camaras]'),
    function (enlace) {
      enlace.addEventListener('click', function () {
        var valor = enlace.getAttribute('data-camaras');
        var radio = form.querySelector(
          'input[name="camaras"][value="' + valor + '"]'
        );
        if (radio) radio.checked = true;
        refrescarContinuar();
        yaInteractuo = false;
        mostrar(0);
      });
    }
  );

  if (ENDPOINT_LEADS && enviar) {
    enviar.disabled = false;
    if (nota) nota.hidden = true;
  }

  form.addEventListener('submit', function (evento) {
    evento.preventDefault();

    // Sin endpoint no hay envío posible. El botón ya está deshabilitado; esto
    // cubre el Enter dentro de un campo de texto, que el disabled no atrapa.
    if (!ENDPOINT_LEADS) return;
    if (enviando) return;

    if (!form.reportValidity()) return;

    var datos = new FormData(form);
    // El señuelo: si viene lleno, lo llenó un bot. No se manda nada y no se
    // delata el motivo.
    if (datos.get('empresa')) {
      mostrar(pasos.length - 1);
      return;
    }

    enviando = true;
    if (enviar) enviar.disabled = true;
    mensaje(ESTADOS.enviando);

    fetch(ENDPOINT_LEADS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: datos.get('nombre'),
        comuna: datos.get('comuna'),
        telefono: datos.get('telefono'),
        email: datos.get('email'),
        tipo: datos.get('tipo'),
        camaras: datos.get('camaras')
      })
    }).then(function (respuesta) {
      if (!respuesta.ok) throw new Error(respuesta.status);
      /* 2xx es un acuse de recibo, no una confirmación de registro: el contrato
         actual no devuelve nada que acredite persistencia. Por eso el botón se
         queda deshabilitado —ni reintento automático ni envío duplicado— y el
         texto ofrece el teléfono. */
      mensaje(ESTADOS.acuse);
    }).catch(function (e) {
      // Acá sí se devuelve el control: el visitante puede corregir y reintentar
      // a mano. Reintentar solo no serviría, y menos con un 429.
      enviando = false;
      if (enviar) enviar.disabled = false;
      mensaje(String(e && e.message) === '429' ? ESTADOS.limite : ESTADOS.error);
    });
  });

  refrescarContinuar();
  mostrar(0);
})();
