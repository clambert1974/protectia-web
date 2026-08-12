/* Protect(IA) — smooth-scroll de las anclas del nav.
   (Por ahora esto es todo; el resto viene en pasos siguientes.) */

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
})();
