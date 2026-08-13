/* Protect(IA) — smooth-scroll de las anclas del nav y el reloj de la cámara.
   El recuadro de detección es CSS puro; aquí no hay nada de eso. */

(function () {
  'use strict';

  var prefiereMenosMovimiento = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;

  document.querySelectorAll('a[href^="#"]').forEach(function (enlace) {
    enlace.addEventListener('click', function (evento) {
      var id = enlace.getAttribute('href');
      if (id === '#') return;

      var destino = document.querySelector(id);
      if (!destino) return;

      evento.preventDefault();
      destino.scrollIntoView({
        behavior: prefiereMenosMovimiento ? 'auto' : 'smooth',
        block: 'start'
      });

      // Deja la URL consistente con el ancla, sin salto extra.
      history.pushState(null, '', id);
    });
  });

  /* Reloj sobreimpreso de la vista de cámara --------------------------------
     Muestra la hora local del visitante como DD/MM/AAAA HH:MM:SS.
     Sigue corriendo con prefers-reduced-motion: es un dato, no una animación,
     y congelarlo mostraría una hora falsa. */

  var reloj = document.getElementById('vista-reloj');

  function dosDigitos(numero) {
    return numero < 10 ? '0' + numero : String(numero);
  }

  function pintarReloj() {
    var ahora = new Date();

    reloj.textContent =
      dosDigitos(ahora.getDate()) + '/' +
      dosDigitos(ahora.getMonth() + 1) + '/' +
      ahora.getFullYear() + ' ' +
      dosDigitos(ahora.getHours()) + ':' +
      dosDigitos(ahora.getMinutes()) + ':' +
      dosDigitos(ahora.getSeconds());

    // Se reagenda al filo del segundo siguiente, no cada 1000 ms exactos:
    // así no acumula deriva ni se salta un segundo a la vista.
    setTimeout(pintarReloj, 1000 - (ahora.getTime() % 1000));
  }

  if (reloj) {
    pintarReloj();
  }
})();
