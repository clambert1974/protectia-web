# protectia-web

Sitio web comercial de **ProtectIA** para el dominio raíz `protectia.cl`.

Servicio de seguridad para el hogar integrado con inteligencia artificial: el
cliente conserva (o compra por su cuenta) sus cámaras, nosotros integramos el
ecosistema **ProtectIA HOME** y lo activamos a distancia. **No vendemos
hardware.** Sitio estático: HTML, CSS y JS puros — sin frameworks ni
dependencias.

## Estructura

```
index.html        Home (rediseño WEB18)
css/styles.css    Estilos. Variables al tope; base escritorio, quiebres en 1120
                  y 760 para tienda/legales, y un bloque WEB18 al final —todo
                  bajo `.web18`— con la portada y sus quiebres 1600/1100/760/374
js/main.js        Menú de la cabecera y wizard del formulario (solo lo usa la home)
fonts/            Space Grotesk variable + IBM Plex Mono 400/500/600
                  (SIL OFL 1.1: fonts/OFL.txt y fonts/OFL-IBM-Plex.txt)
                  Las usan tienda y páginas legales; la portada WEB18 no
img/              Favicon, hero de la portada, foto de tienda, fotos de producto
                  y los frames de la vista de cámara anterior
                  (falta la imagen de Open Graph)
data/precios.json Feed de precios de la Tienda
```

### Secciones de la home, en orden

1. Portada — ecosistema integrado con IA, con el hero conceptual
2. Franja de capacidades (`#pilares`) — facial, cámaras compatibles, avisos
3. El valor de integrar (`#como-funciona`), con el esquema conceptual (`#momento`)
4. Dos puntos de partida (`#puertas`) — ya tengo cámaras / estoy empezando
5. HOME y Vecinal (`#plan`)
6. Procesamiento y privacidad
7. Consulta (`#contacto`) — formulario de tres pasos
8. Preguntas frecuentes (`#faq`)

El hero (`img/hero-web18-v1.png`, 1672x941) es una **ilustración conceptual
creada con IA**: no representa una instalación real, y tanto su texto
alternativo como el rótulo bajo la imagen lo dicen. El esquema de `#momento` es
estático y describe el flujo del ecosistema; no es telemetría ni una secuencia
de eventos reales.

Los dos JPEG de la reja frontal (`img/camara-reja-frontal.jpg` y
`img/camara-reja-frontal-afuera.jpg`) quedaron sin uso en el sitio al retirarse
la demo temporizada de la home; siguen en el repo y sus reglas CSS también.

El layout no usa JS: donde el diseño original decidía con `matchMedia`, aquí hay
media queries. El JS hace dos cosas, independientes entre sí:

- **Menú de la cabecera.** La navegación está visible en el marcado y el botón
  nace `hidden`. `js/main.js` le agrega `.menu-js` a la cabecera y recién ahí,
  bajo 760px, el nav se colapsa detrás del botón. Sin JS no hay botón: hay nav.
- **Formulario.** Muestra un paso a la vez. Sin JS los tres pasos se ven de
  corrido y el formulario sigue siendo legible.

## El formulario

Tres pasos: tipo (`Casa`/`Negocio`), cámaras (`Sí`/`No`) y datos de contacto.
Marcar una opción solo la marca: **Continuar** es la única acción de avance de
los pasos 1 y 2, y se habilita cuando el paso tiene respuesta. La entrada
«Consultar sobre mis cámaras» (`data-camaras="Sí"`) deja preseleccionada esa
respuesta y el avance se salta el paso ya respondido.

Manda `nombre`, `comuna`, `telefono`, `email`, `tipo` y `camaras` a
`POST https://ventas.protectia.cl/api/lead-web`. El campo `empresa` es un
señuelo local: si viene lleno, no se envía nada y tampoco viaja en el JSON.

Vive en `ventas.protectia.cl` y no en `protectia.cl` porque el apex lo ocupa
Cloudflare Pages y no acepta montar ahí un path del túnel. Por eso la llamada es
cross-origin y el CORS es obligatorio: el backend permite `https://protectia.cl`
y `https://www.protectia.cl` — **los dos**, porque el sitio responde igual en
ambos y sin redirección entre ellos.

Queda público por una aplicación de Cloudflare Access con política **Bypass**
acotada a `/api/lead-web`; el resto de `ventas.protectia.cl` sigue pidiendo
login. Ojo si se toca esa política: tiene que cubrir también el preflight
`OPTIONS`, o el navegador recibe un 302 al login y el `POST` no se llega a
mandar — y el síntoma es un error de CORS, que no se parece en nada a un
problema de autenticación.

De los seis campos, el navegador exige `nombre`, `comuna` y `telefono`. `email`
es opcional y de tipo `email`: vacío es válido, pero una dirección mal escrita la
atrapa `reportValidity()` antes de enviar.

**Lo que el sitio dice del resultado.** Un `2xx` del endpoint es un acuse de
recibo: no acredita que la consulta haya quedado guardada, y el formulario no
afirma lo contrario ni promete una llamada. Los estados son los de
COPY-FINAL-MKT: «Enviando consulta…», «No podemos confirmar que tu consulta haya
quedado registrada…» para el 2xx, «No se pudo completar la solicitud en este
momento…» para el 429, «No pudimos confirmar el registro de tu consulta…» para
el resto de los errores y «Por ahora, puedes consultar con Catalina en el
600 914 2219» cuando el formulario no está habilitado. Los cuatro últimos
ofrecen el teléfono. No hay reintento automático y no se permite un segundo
envío mientras hay uno en curso.

Si `ENDPOINT_LEADS` vuelve a `null`, el botón se queda deshabilitado y el sitio
sigue siendo usable: la conversión se va al teléfono **600 914 2219**, que
contesta Catalina.

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

- Términos y Condiciones: el pie tiene un marcador deshabilitado, sin documento
- Imagen de Open Graph real (`img/og-protectia.jpg`)
- Limpieza del CSS que quedó sin uso al retirarse la home anterior (demo de
  cámara, pilares, tabla comparativa, garantía y plan)

---

© 2026 ProtectIA — L&F IT Consulting SpA
