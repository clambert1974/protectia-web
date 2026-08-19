# protectia-web

Sitio web comercial de **Protect(IA)** para el dominio raíz `protectia.cl`.

Servicio remoto de seguridad con inteligencia artificial: el cliente conserva
(o compra por su cuenta) sus cámaras, nosotros le enviamos el equipo Protect(IA)
y activamos todo a distancia. **No vendemos hardware.** Sitio estático: HTML,
CSS y JS puros — sin frameworks ni dependencias.

## Estructura

```
index.html        Home
css/styles.css    Estilos (variables al tope; base escritorio, quiebres en 1120 y 760)
js/main.js        Reloj del visitante, demo de cámara y wizard del formulario
fonts/            Space Grotesk variable + IBM Plex Mono 400/500/600
                  (SIL OFL 1.1: fonts/OFL.txt y fonts/OFL-IBM-Plex.txt)
img/              Favicon y el frame de la vista de cámara
                  (falta la imagen de Open Graph)
```

### Secciones de la home, en orden

1. Doble puerta de entrada — «¿ya tienes cámaras?» / «¿no tienes cámaras?»
2. Cuando cada segundo importa — el argumento, con la demo de cámara
3. Cuatro pilares
4. Cómo funciona — cuatro pasos
5. Plan y precios — plan único, $30.000/mes
6. Comparación con las alarmas tradicionales
7. Garantía de 30 días
8. Formulario de contacto — tres pasos
9. Preguntas frecuentes

La vista de cámara de la sección 2 es un **fotograma real** de la reja frontal
(16-ago-2026, 15:51) con las capas del sistema encima: viñeta, caja de detección
sobre el perro con la etiqueta ANIMAL, OSD y el log animado. Antes era una
simulación dibujada con gradientes; el frame la reemplazó entera.

El JPEG (`img/camara-reja-frontal.jpg`, 960x600) es un recorte 16:10 del original
1280x960, tomado en `x 0..960, y 315..915`. El recorte hace dos cosas: cierra el
encuadre para que el perro se lea (pasa del 22% al 29% del alto) y se lleva el
OSD que la cámara quema en el frame —la fecha arriba y "Reja frontal" abajo— que
si no chocaría con el OSD del sitio.

No se cerró más que eso a propósito: con un recorte de 800px la reja desaparece
y el plano queda como un jardín, no como una cámara de perímetro — y el OSD dice
"REJA FRONTAL".

La caja está posicionada en porcentajes medidos sobre ese recorte. **Si se cambia
el frame, hay que volver a medir la caja**: no hay nada que la ajuste sola.

El layout no usa JS: donde el diseño original decidía con `matchMedia`, aquí
hay media queries. Lo único que el JS hace fuera del reloj y de la demo es
mostrar el formulario de a un paso; sin JS los tres pasos se ven de corrido y
el formulario sigue siendo legible.

## El formulario está deshabilitado a propósito

El botón de envío viene `disabled` y `ENDPOINT_LEADS` en `js/main.js` es `null`.
Todavía no existe un endpoint público de leads en `ventas-backend`: hoy solo
está el webhook de VAPI (con secreto compartido, no invocable desde el
navegador) y el resto de `ventas.protectia.cl` va detrás de Cloudflare Access.

Para conectarlo hacen falta tres cosas, en este orden:

1. Un POST público en `ventas-app` (sin la dependencia `exigir_access`), con
   rate limit por IP propio y honeypot — el campo `empresa` del marcado.
2. CORS que permita el origin `https://protectia.cl`.
3. Una regla de bypass de Cloudflare Access para ese path, igual que la que ya
   necesita el path del webhook.

Mientras tanto la conversión va por el teléfono: **600 914 2219**, que contesta
Catalina y sí deja el lead en `leads.db`.

## Cómo se publica

Cloudflare Pages está conectado al repo de GitHub:

1. `git push` a `master`
2. Cloudflare Pages hace el deploy automático

No hay paso de build: se sirve la raíz del repo tal cual.

La Raspberry Pi es solo el taller de desarrollo — **no** sirve el sitio.

## Desarrollo local

Cualquier servidor estático sirve, por ejemplo:

```bash
python3 -m http.server 8000
```

Y abrir <http://localhost:8000>.

## Pendientes

- Conectar el formulario (ver arriba)
- Páginas de Política de Privacidad y Términos y Condiciones: hoy el pie tiene
  marcadores sin destino
- Imagen de Open Graph real (`img/og-protectia.jpg`)
- Menú hamburguesa en móvil (hoy el nav se oculta bajo 760px)

---

© 2026 Protect(IA) — L&F IT Consulting SpA
