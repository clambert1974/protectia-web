/* Protect(IA) — reloj del visitante.
   Lo único que hace este archivo: pintar la hora local en la franja de estado,
   en el OSD de la cámara y en el log de eventos. El layout es todo CSS y el
   smooth-scroll de las anclas lo hace `scroll-behavior`, no JS. */

(function () {
  'use strict';

  var prefiereMenosMovimiento = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;

  var franjaFecha = document.getElementById('franja-fecha');
  var franjaHora = document.getElementById('franja-hora');
  var camHora = document.getElementById('cam-hora');
  var logHoras = document.querySelectorAll('.log-hora');

  var logEstampado = false;

  function dosDigitos(numero) {
    return numero < 10 ? '0' + numero : String(numero);
  }

  function pintarReloj() {
    var ahora = new Date();

    var fecha =
      dosDigitos(ahora.getDate()) + '-' +
      dosDigitos(ahora.getMonth() + 1) + '-' +
      ahora.getFullYear();

    var hora =
      dosDigitos(ahora.getHours()) + ':' +
      dosDigitos(ahora.getMinutes()) + ':' +
      dosDigitos(ahora.getSeconds());

    /* Los relojes siguen corriendo con prefers-reduced-motion: son un dato, no
       una animación, y congelarlos mostraría una hora falsa. */
    if (franjaFecha) franjaFecha.textContent = fecha + ' ';
    if (franjaHora) franjaHora.textContent = hora;
    if (camHora) camHora.textContent = hora;

    /* El log sí se congela: con movimiento reducido se estampa una vez y se
       queda quieto. */
    if (!logEstampado) {
      logHoras.forEach(function (marca) {
        marca.textContent = hora + ' · ';
      });
      logEstampado = prefiereMenosMovimiento;
    }

    // Se reagenda al filo del segundo siguiente, no cada 1000 ms exactos:
    // así no acumula deriva ni se salta un segundo a la vista.
    setTimeout(pintarReloj, 1000 - (ahora.getTime() % 1000));
  }

  pintarReloj();
})();
