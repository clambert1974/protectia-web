/* Protect(IA) — reloj del visitante y demo narrativa de MOD.01.
   Pinta la hora local en la franja de estado y en el OSD de la cámara, y
   corre el guión de tres escenas del módulo Home. El aspecto de cada escena
   vive en css/styles.css; acá solo se decide *cuándo* cambia. El layout es
   todo CSS y el smooth-scroll de las anclas lo hace `scroll-behavior`. */

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

  /* Demo de MOD.01 ---------------------------------------------------------- */

  var modulo = document.querySelector('.modulo-home');
  var log = document.getElementById('log');
  if (!modulo || !log) return;

  // Fuera las líneas de respaldo del HTML: existen solo para el caso sin JS.
  log.textContent = '';

  /* El guión. `t` son ms desde el inicio del ciclo; `esc` es la clase de
     escena, `chip` y `etq` los rótulos que cambian, `linea` lo que entra al
     log y `tono` su color. Sin `esc`, el paso solo agrega una línea. */
  var GUION = [
    { t: 0, esc: 'esc-1', etq: 'ANIMAL', tono: 'log-gris',
      linea: 'ANIMAL DETECTADO · SIN ALERTA — FALSA ALARMA DESCARTADA' },
    { t: 6000, esc: 'esc-2', etq: 'CATA · ROSTRO CONOCIDO', tono: 'log-verde',
      linea: 'ROSTRO CONOCIDO · SIN ALERTA' },
    { t: 12000, esc: 'esc-3', chip: 'ALERTA', etq: 'PERSONA · DESCONOCIDA' },
    { t: 12500, linea: 'PERSONA DESCONOCIDA — ADVERTENCIA POR VOZ EMITIDA' },
    { t: 15000, linea: 'SIRENA ACTIVADA · GRABANDO', rec: true },
    { t: 17500, linea: 'EVIDENCIA RESPALDADA FUERA DE LA CASA' },
    { t: 20000, linea: 'LLAMANDO EN CADENA A LA FAMILIA', tono: 'log-activo',
      puntos: true },
    { t: 22500, esc: 'esc-0', chip: 'OPERATIVO', rec: false,
      linea: 'SISTEMA EN VIGILANCIA' }
  ];

  var CICLO = 24000;
  var ESCENAS = ['esc-0', 'esc-1', 'esc-2', 'esc-3'];
  var MAX_LINEAS = 4;

  var chip = modulo.querySelector('.modulo-estado-txt');
  var etq = modulo.querySelector('.cam-caja-etq');
  var paso = 0;

  function sacarLinea(li) {
    if (prefiereMenosMovimiento) {
      li.remove();
      return;
    }
    // Se marca primero y se saca después, para que alcance a irse con fade.
    li.classList.add('log-sale');
    setTimeout(function () { li.remove(); }, 400);
  }

  function pintarLinea(guion) {
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
  }

  function aplicar(guion) {
    if (guion.esc) {
      ESCENAS.forEach(function (clase) { modulo.classList.remove(clase); });
      modulo.classList.add(guion.esc);
    }
    if (guion.chip && chip) chip.textContent = guion.chip;
    if (guion.etq && etq) etq.textContent = guion.etq;
    if (guion.rec !== undefined) {
      modulo.classList.toggle('rec-on', guion.rec);
    }
    if (guion.linea) pintarLinea(guion);
  }

  function correr() {
    var actual = GUION[paso];
    aplicar(actual);
    paso += 1;

    // Al llegar al final se vuelve al primer paso completando los 24 s.
    var espera = paso < GUION.length
      ? GUION[paso].t - actual.t
      : CICLO - actual.t;
    if (paso >= GUION.length) paso = 0;

    setTimeout(correr, espera);
  }

  if (prefiereMenosMovimiento) {
    /* Sin loop: queda fijo el frame de la escena 3 con su log completo, desde
       el paso que la abre (índice 2) hasta su última línea. */
    for (var i = 2; i <= 6; i += 1) aplicar(GUION[i]);
  } else {
    correr();
  }
})();
