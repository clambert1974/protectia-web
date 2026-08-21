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

  /* Segundos desde medianoche -> "HH:MM:SS". Lo usan el OSD y el log de la
     cámara, que corren sobre la hora de SU escena y no sobre la del visitante. */
  function horaDeSegundos(seg) {
    seg = Math.floor(seg) % 86400;
    return (
      dosDigitos(Math.floor(seg / 3600)) + ':' +
      dosDigitos(Math.floor(seg / 60) % 60) + ':' +
      dosDigitos(seg % 60)
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
    /* La franja de estado sí lleva la hora del VISITANTE: es el reloj vivo del
       sitio. El OSD de la cámara NO — ese lo gobierna la escena, porque los dos
       frames son momentos grabados y reales (15:51 y 15:43), y un OSD con la
       hora de quien mira contradiría al log de su propia escena. */
    if (franjaFecha) franjaFecha.textContent = fecha + ' ';
    if (franjaHora) franjaHora.textContent = hora;

    // Se reagenda al filo del segundo siguiente, no cada 1000 ms exactos:
    // así no acumula deriva ni se salta un segundo a la vista.
    setTimeout(pintarReloj, 1000 - (ahora.getTime() % 1000));
  }

  pintarReloj();

  /* Demo de cámara --------------------------------------------------------- */

  var demo = document.querySelector('.demo');
  var log = document.getElementById('log');
  var camara = document.getElementById('camara');
  var escenario = document.getElementById('momento-inner');

  /* La demo va dentro de un try: es decorativa, y el formulario de contacto
     —que es la vía de conversión— vive más abajo en este mismo IIFE. Sin esto,
     cualquier error acá aborta el resto del archivo y se lleva por delante el
     asistente de tres pasos y el deep-link de los botones de entrada, sin que
     nada en pantalla lo delate. Ya pasó una vez con una constante borrada. */
  try {
  if (demo && log && camara && escenario) {
    // Fuera las líneas de respaldo del HTML: existen solo para el caso sin JS.
    log.textContent = '';

    /* El guión, ahora en DOS escenas que rotan.

       La escena 1 muestra lo que el servicio NO hace: un perro cruza, el sistema
       lo descarta y nadie se entera. La escena 2 muestra lo que sí hace cuando
       importa. El contraste entre los dos remates es el argumento de la sección
       entera, y por eso van en el mismo bucle y no en dos demos separadas.

       `t` son ms desde el arranque de la escena; `linea` lo que entra al log y
       `tono` su color. `pausa` es cuánto se queda quieta la escena tras su última
       línea, para que dé tiempo a leerla antes del fundido. */
    var ESCENAS = [
      {
        clase: 'esc-1',
        chip: 'OPERATIVO',
        // 15:51:43 — la hora real del frame (16-ago-2026). El OSD y el log de
        // la escena cuelgan de acá, así que lo que se lee en pantalla es la
        // hora del momento grabado y no la de quien está mirando la web.
        base: 15 * 3600 + 51 * 60 + 43,
        pausa: 3500,
        guion: [
          { t: 0, linea: 'MOVIMIENTO DETECTADO → VERIFICANDO CON IA', puntos: true },
          { t: 2200, clave: true, linea: 'ANIMAL · FALSA ALARMA DESCARTADA' },
          { t: 4400, remate: true, linea: 'NO TE INTERRUMPIMOS POR UN PERRO' }
        ]
      },
      {
        clase: 'esc-2',
        chip: 'ALERTA',
        base: 15 * 3600 + 43 * 60 + 3,    // 15:43:03, hora real del frame (16-jul-2026)
        pausa: 3500,
        guion: [
          { t: 0, linea: 'MOVIMIENTO DETECTADO → VERIFICANDO CON IA', puntos: true },
          { t: 1800, clave: true,
            linea: 'PERSONA DESCONOCIDA · ROSTRO NO RECONOCIDO' },
          // Entre comillas y en minúsculas a propósito: es lo que el sistema DICE
          // por el parlante y manda al teléfono, no una línea de registro más.
          { t: 3600, voz: true,
            linea: '«Carlos, hay una persona desconocida en la entrada, de pie junto a la reja»' },
          { t: 5800, clave: true, linea: 'ADVERTENCIA POR VOZ EMITIDA · GRABANDO' },
          { t: 7600, clave: true, linea: 'LLAMANDO AL CLIENTE', puntos: true },
          { t: 9400, clave: true, linea: 'ALERTA ENVIADA A VECINOS CONECTADOS' },
          { t: 11200, remate: true, linea: 'POR ESTO SÍ ACTUAMOS · EN SEGUNDOS' }
        ]
      }
    ];

    var pintarLinea = function (guion) {
      var li = document.createElement('li');

      /* El remate no lleva hora: es un titular que cierra la escena, no un paso
         más de la secuencia. */
      if (!guion.remate) {
        var marca = document.createElement('span');
        marca.className = 'lt-hora';
        /* La hora sale del GUIÓN (base del frame + el t del paso), no del reloj
           de pared. Así no deriva si el navegador se atrasa, y sobre todo: con
           prefers-reduced-motion las líneas se pintan todas de golpe y con el
           reloj de pared saldrían las siete con el mismo segundo. */
        marca.textContent = horaDeSegundos(baseEscena + (guion.t || 0) / 1000);
        li.appendChild(marca);
      }

      var txt = document.createElement('span');
      txt.className = 'lt-txt';
      txt.appendChild(document.createTextNode(guion.linea));

      if (guion.puntos) {
        var puntos = document.createElement('span');
        puntos.className = 'log-puntos';
        puntos.textContent = '...';
        txt.appendChild(puntos);
      }
      li.appendChild(txt);

      if (guion.clave) li.classList.add('lt-clave');
      if (guion.voz) li.classList.add('lt-voz');
      if (guion.remate) li.classList.add('lt-remate');
      if (!prefiereMenosMovimiento) li.classList.add('lt-entra');
      log.appendChild(li);
    };

    var chip = demo.querySelector('.modulo-estado-txt');

    var aplicar = function (paso) {
      if (paso.linea) pintarLinea(paso);
    };

    /* Pone una escena: cambia la clase del contenedor y de la cámara — de ahí
       cuelga TODO el aspecto: fondo, caja, modo del OSD, color del módulo. */
    var ponerEscena = function (esc) {
      /* La clase va al contenedor de la SECCIÓN, que es ancestro de la cámara y
         de la línea de tiempo: así una sola clase gobierna el fondo, la caja, el
         chip de la cabecera y el color del remate, sin repetirla en tres sitios.

         Se limpia también de la cámara y del módulo por si quedó ahí de una
         versión anterior del marcado. No es paranoia: las reglas del CSS son de
         descendencia (.esc-1 .cam-fondo-1), así que una clase perdida en la
         propia cámara la convierte en su propio ancestro y activa la escena
         equivocada — con las dos escenas superpuestas y sin ningún error en la
         consola que lo delate. Ya pasó una vez. */
      ESCENAS.forEach(function (e) {
        escenario.classList.remove(e.clase);
        camara.classList.remove(e.clase);
        demo.classList.remove(e.clase);
      });
      escenario.classList.add(esc.clase);
      if (chip) chip.textContent = esc.chip;
    };

    // Debe coincidir con la transición de .cam-fondo en el CSS: es lo que se
    // espera de más al final de cada escena para que el fundido termine antes
    // de que empiece la siguiente.
    var FUNDIDO = 900;

    var iEsc = 0;
    var temporizadores = [];
    var baseEscena = ESCENAS[0].base;
    var arranque = Date.now();
    var transcurrido = function () { return Date.now() - arranque; };

    /* El OSD avanza segundo a segundo desde la hora del frame: la cámara está
       "grabando" ese momento mientras dura la escena. */
    var tictac = function () {
      if (camHora) camHora.textContent = horaDeSegundos(baseEscena + transcurrido() / 1000);
      temporizadores.push(setTimeout(tictac, 1000 - (Date.now() % 1000)));
    };

    var correrEscena = function () {
      // Se cancelan los pendientes de la escena anterior: si el visitante deja
      // la pestaña en segundo plano, los setTimeout se acumulan y al volver
      // vomitan todas las líneas juntas.
      temporizadores.forEach(clearTimeout);
      temporizadores = [];

      var esc = ESCENAS[iEsc];
      ponerEscena(esc);
      log.textContent = '';
      baseEscena = esc.base;
      arranque = Date.now();
      tictac();

      esc.guion.forEach(function (paso) {
        temporizadores.push(setTimeout(function () { aplicar(paso); }, paso.t));
      });

      var ultima = esc.guion[esc.guion.length - 1].t;
      temporizadores.push(setTimeout(function () {
        iEsc = (iEsc + 1) % ESCENAS.length;
        correrEscena();
      }, ultima + esc.pausa + FUNDIDO));
    };

    if (prefiereMenosMovimiento) {
      /* Sin bucle ni fundidos: queda puesta la escena 2 con su log completo.
         Se elige esa y no la 1 porque es la que enseña lo que el servicio hace
         cuando importa; quedarse en el perro sería vender lo que NO hace. */
      var esc2 = ESCENAS[1];
      ponerEscena(esc2);
      baseEscena = esc2.base;
      arranque = Date.now();
      if (camHora) camHora.textContent = horaDeSegundos(esc2.base);
      esc2.guion.forEach(aplicar);
    } else {
      correrEscena();
    }
  }

  } catch (e) {
    // No se relanza: la demo se queda donde quedó y el resto del sitio sigue.
    if (window.console) console.error('[demo] se detuvo:', e);
  }

  /* Formulario de contacto -------------------------------------------------
     Tres pasos. Sin este bloque el formulario se ve de corrido y sigue siendo
     legible: acá se le agrega .wizard-activo al <form> y recién entonces el
     CSS muestra un paso a la vez. */

  /* Endpoint público de leads en ventas-backend. Los tres requisitos que este
     TODO listaba ya están:
       1. POST /api/lead-web, sin la dependencia exigir_access, con honeypot
          (el campo `empresa` de abajo), rate limit por IP, tope diario y
          validación — toda la política vive en ventas-app/backend/web.py.
       2. CORS a https://protectia.cl y https://www.protectia.cl. Son los DOS:
          el sitio responde igual en ambos, sin redirección entre ellos, así que
          permitir solo el apex dejaría a media base con el envío bloqueado.
       3. Una aplicación de Cloudflare Access con política Bypass acotada a
          /api/lead-web. El resto de ventas.protectia.cl sigue pidiendo login.

     Vive en ventas.protectia.cl y no en protectia.cl porque el apex lo ocupa
     Pages y Cloudflare no acepta montar ahí un path del túnel. O sea que la
     llamada es cross-origin y el CORS es obligatorio, no un adorno.

     Si algún día esto vuelve a null, el botón se deshabilita solo y la nota del
     formulario lo explica: el sitio sigue siendo usable, con el teléfono como
     vía de conversión. */
  var ENDPOINT_LEADS = 'https://ventas.protectia.cl/api/lead-web';

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
    }).catch(function (e) {
      if (enviar) enviar.disabled = false;
      if (!nota) return;
      nota.hidden = false;
      /* El 429 es el ÚNICO rechazo que el backend distingue: todo lo demás que
         descarta responde 200, para no enseñarle a un bot qué lo delató. Acá se
         traduce a algo accionable — reintentar no sirve hasta que se libere la
         ventana, así que se ofrece el teléfono. */
      nota.textContent = String(e && e.message) === '429'
        ? 'Recibimos varios envíos desde tu conexión. Llámanos al 600 914 2219 y te atendemos al tiro.'
        : 'No pudimos enviar el formulario. Llámanos al 600 914 2219.';
    });
  });

  mostrar(0);
})();
