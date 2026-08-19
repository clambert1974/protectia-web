/* Protect(IA) — reloj del visitante, demo de cámara y formulario de contacto.
   Pinta la hora local en la franja de estado y en el OSD de la cámara, corre el
   guión de tres escenas de la sección "Cuando cada segundo importa" y maneja
   los tres pasos del formulario. El aspecto de todo eso vive en
   css/styles.css; acá solo se decide *cuándo* cambia. El layout es todo CSS y
   el smooth-scroll de las anclas lo hace `scroll-behavior`. */

(function () {
  'use strict';

  var prefiereMenosMovimiento = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;

  var franjaFecha = document.getElementById('franja-fecha');
  var franjaHora = document.getElementById('franja-hora');
  var camHora = document.getElementById('cam-hora');

  function dosDigitos(numero) {
    return numero < 10 ? '0' + numero : String(numero);
  }

  function horaDe(fecha) {
    return (
      dosDigitos(fecha.getHours()) + ':' +
      dosDigitos(fecha.getMinutes()) + ':' +
      dosDigitos(fecha.getSeconds())
    );
  }

  function pintarReloj() {
    var ahora = new Date();

    var fecha =
      dosDigitos(ahora.getDate()) + '-' +
      dosDigitos(ahora.getMonth() + 1) + '-' +
      ahora.getFullYear();

    var hora = horaDe(ahora);

    /* Los relojes siguen corriendo con prefers-reduced-motion: son un dato, no
       una animación, y congelarlos mostraría una hora falsa. */
    if (franjaFecha) franjaFecha.textContent = fecha + ' ';
    if (franjaHora) franjaHora.textContent = hora;
    if (camHora) camHora.textContent = hora;

    // Se reagenda al filo del segundo siguiente, no cada 1000 ms exactos:
    // así no acumula deriva ni se salta un segundo a la vista.
    setTimeout(pintarReloj, 1000 - (ahora.getTime() % 1000));
  }

  pintarReloj();

  /* Demo de cámara --------------------------------------------------------- */

  var demo = document.querySelector('.demo');
  var log = document.getElementById('log');

  if (demo && log) {
    // Fuera las líneas de respaldo del HTML: existen solo para el caso sin JS.
    log.textContent = '';

    /* El guión. `t` son ms desde el inicio del ciclo, `linea` lo que entra al
       log y `tono` su color.

       Antes esto narraba tres escenas (animal, conocida, desconocida) porque la
       cámara era una simulación que podía cambiar de escena. Ahora el fondo es
       un frame fijo —un perro en la reja frontal— así que el log cuenta esa
       escena y nada más: hablar de una persona desconocida mientras en pantalla
       hay un perro sería describir algo que no está pasando. */
    var GUION = [
      { t: 0, linea: 'MOVIMIENTO DETECTADO → VERIFICANDO CON IA', puntos: true },
      { t: 2800, tono: 'log-gris', linea: 'ANIMAL · FALSA ALARMA DESCARTADA' },
      { t: 5600, tono: 'log-verde', linea: 'NO TE INTERRUMPIMOS POR UN PERRO' },
      { t: 8600, tono: 'log-activo', linea: 'SISTEMA EN VIGILANCIA' }
    ];

    var CICLO = 13500;
    var MAX_LINEAS = 4;

    var paso = 0;

    var sacarLinea = function (li) {
      if (prefiereMenosMovimiento) {
        li.remove();
        return;
      }
      // Se marca primero y se saca después, para que alcance a irse con fade.
      li.classList.add('log-sale');
      setTimeout(function () { li.remove(); }, 400);
    };

    var pintarLinea = function (guion) {
      var li = document.createElement('li');

      var marca = document.createElement('span');
      marca.className = 'log-hora';
      // La hora se estampa recién ahora: es la del visitante en este momento.
      marca.textContent = horaDe(new Date()) + ' · ';
      li.appendChild(marca);
      li.appendChild(document.createTextNode(guion.linea));

      if (guion.puntos) {
        var puntos = document.createElement('span');
        puntos.className = 'log-puntos';
        puntos.textContent = '...';
        li.appendChild(puntos);
      }

      if (guion.tono) li.classList.add(guion.tono);
      if (!prefiereMenosMovimiento) li.classList.add('log-entra');
      log.appendChild(li);

      // Las que ya se están yendo no cuentan, si no se sacarían dos veces.
      var vivas = log.querySelectorAll('li:not(.log-sale)');
      if (vivas.length > MAX_LINEAS) sacarLinea(vivas[0]);
    };

    var aplicar = function (guion) {
      if (guion.linea) pintarLinea(guion);
    };

    var correr = function () {
      var actual = GUION[paso];
      aplicar(actual);
      paso += 1;

      // Al llegar al final se vuelve al primer paso completando los 24 s.
      var espera = paso < GUION.length
        ? GUION[paso].t - actual.t
        : CICLO - actual.t;
      if (paso >= GUION.length) paso = 0;

      setTimeout(correr, espera);
    };

    if (prefiereMenosMovimiento) {
      // Sin bucle: el log se pinta entero una vez y ahí se queda.
      GUION.forEach(aplicar);
    } else {
      correr();
    }
  }

  /* Formulario de contacto -------------------------------------------------
     Tres pasos. Sin este bloque el formulario se ve de corrido y sigue siendo
     legible: acá se le agrega .wizard-activo al <form> y recién entonces el
     CSS muestra un paso a la vez. */

  /* TODO(ventas-backend): ENVÍO DESHABILITADO A PROPÓSITO.
     Todavía no existe un endpoint público de leads en ventas-backend: hoy solo
     está el webhook de VAPI (con secreto compartido, no invocable desde el
     navegador) y el resto de ventas.protectia.cl va detrás de Cloudflare Access.
     Para conectarlo hacen falta tres cosas, en este orden:
       1. Un POST público en ventas-app (sin la dependencia exigir_access), con
          rate limit por IP propio y honeypot — el campo `empresa` del marcado.
       2. CORS que permita el origin https://protectia.cl.
       3. Una regla de bypass de Cloudflare Access para ese path, igual que la
          que ya necesita el path del webhook.
     Hecho eso, poner acá la URL absoluta y revisar que los nombres de los
     campos de abajo calcen con los que espera el endpoint. Mientras sea null,
     el botón queda deshabilitado y la nota del formulario lo explica. */
  var ENDPOINT_LEADS = null;

  var form = document.getElementById('wizard');
  if (!form) return;

  var pasos = Array.prototype.slice.call(
    form.querySelectorAll('.wizard-paso')
  );
  var progreso = document.getElementById('wizard-progreso');
  var enviar = document.getElementById('wizard-enviar');
  var nota = document.getElementById('wizard-nota');
  if (!pasos.length) return;

  var actual = 0;
  // El foco se mueve solo cuando el paso cambió por una acción del visitante.
  // En la primera pintada no, o el navegador saltaría al formulario sin que
  // nadie se lo haya pedido.
  var yaInteractuo = false;

  form.classList.add('wizard-activo');
  if (progreso) progreso.hidden = false;

  function mostrar(indice) {
    actual = Math.max(0, Math.min(indice, pasos.length - 1));

    pasos.forEach(function (paso, i) {
      paso.classList.toggle('wizard-paso-visible', i === actual);
    });

    if (progreso) {
      progreso.textContent = 'Paso ' + (actual + 1) + ' de ' + pasos.length;
    }

    if (!yaInteractuo) return;
    var primero = pasos[actual].querySelector(
      'input:not([type="hidden"]):not([tabindex="-1"]), button'
    );
    if (primero) primero.focus();
  }

  function respondido(indice) {
    return !!pasos[indice].querySelector('input[type="radio"]:checked');
  }

  /* Avanza saltándose los pasos que ya vienen respondidos. Es lo que hace que
     "Verificar compatibilidad" no le vuelva a preguntar por las cámaras a
     quien ya lo dijo al entrar por esa puerta. */
  function avanzar() {
    var siguiente = actual + 1;
    while (siguiente < pasos.length - 1 && respondido(siguiente)) {
      siguiente += 1;
    }
    mostrar(siguiente);
  }

  form.addEventListener('change', function (evento) {
    var control = evento.target;
    if (control.type !== 'radio') return;
    yaInteractuo = true;
    // Un respiro para que se alcance a ver la opción marcada antes del cambio.
    setTimeout(avanzar, 180);
  });

  form.addEventListener('click', function (evento) {
    var boton = evento.target.closest('[data-atras]');
    if (!boton) return;
    yaInteractuo = true;
    mostrar(actual - 1);
  });

  /* Las puertas de entrada dejan marcada su respuesta antes de que el ancla
     baje al formulario. No se cancela el click: el scroll lo hace el <a>. */
  document.querySelectorAll('[data-camaras]').forEach(function (enlace) {
    enlace.addEventListener('click', function () {
      var valor = enlace.getAttribute('data-camaras');
      var radio = form.querySelector(
        'input[name="camaras"][value="' + valor + '"]'
      );
      if (radio) radio.checked = true;
      yaInteractuo = false;
      mostrar(0);
    });
  });

  if (ENDPOINT_LEADS && enviar) {
    enviar.disabled = false;
    if (nota) nota.hidden = true;
  }

  form.addEventListener('submit', function (evento) {
    evento.preventDefault();
    // Sin endpoint no hay envío posible. El botón ya está deshabilitado; esto
    // cubre el Enter dentro de un campo de texto, que el disabled no atrapa.
    if (!ENDPOINT_LEADS) return;

    if (!form.reportValidity()) return;

    var datos = new FormData(form);
    // El honeypot: si viene lleno, lo llenó un bot. Se responde igual que en el
    // caso bueno y no se manda nada.
    if (datos.get('empresa')) {
      mostrar(pasos.length - 1);
      return;
    }

    if (enviar) enviar.disabled = true;

    fetch(ENDPOINT_LEADS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: datos.get('nombre'),
        telefono: datos.get('telefono'),
        tipo: datos.get('tipo'),
        camaras: datos.get('camaras')
      })
    }).then(function (respuesta) {
      if (!respuesta.ok) throw new Error(respuesta.status);
      if (nota) {
        nota.hidden = false;
        nota.textContent = 'Listo: recibimos tus datos y te llamamos a la brevedad.';
      }
    }).catch(function () {
      if (enviar) enviar.disabled = false;
      if (nota) {
        nota.hidden = false;
        nota.textContent = 'No pudimos enviar el formulario. Llámanos al 600 914 2219.';
      }
    });
  });

  mostrar(0);
})();
