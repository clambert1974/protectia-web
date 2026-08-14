# protectia-web

Sitio web comercial de **Protect(IA)** para el dominio raíz `protectia.cl`.

Seguridad residencial con inteligencia artificial en Santiago (La Florida,
Peñalolén y Macul). Sitio estático: HTML, CSS y JS puros — sin frameworks
ni dependencias.

## Estructura

```
index.html        Home
css/styles.css    Estilos (variables al tope; base escritorio, quiebres en 1120 y 760)
js/main.js        Reloj del visitante (franja, OSD de la cámara y log)
fonts/            Space Grotesk variable + IBM Plex Mono 400/500/600
                  (SIL OFL 1.1: fonts/OFL.txt y fonts/OFL-IBM-Plex.txt)
img/              Imágenes (vacío por ahora)
```

La vista de cámara del MOD.01 es una simulación hecha solo con CSS —sin video,
sin imágenes y sin SVG—: capas de gradiente para el ruido, el pasto y la viñeta,
más la caja de detección con su etiqueta.

El layout no usa JS: donde el diseño original decidía con `matchMedia`, aquí
hay media queries.

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

- Favicon e imagen de Open Graph reales (`img/`)
- Menú hamburguesa en móvil (hoy el nav se oculta bajo 768px)
- Páginas interiores

---

© 2026 Protect(IA) — L&F IT Consulting SpA
