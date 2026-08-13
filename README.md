# protectia-web

Sitio web comercial de **Protect(IA)** para el dominio raíz `protectia.cl`.

Seguridad residencial con inteligencia artificial en Santiago (La Florida,
Peñalolén y Macul). Sitio estático: HTML, CSS y JS puros — sin frameworks
ni dependencias.

## Estructura

```
index.html        Home
css/styles.css    Estilos (variables al tope, mobile-first)
js/main.js        Smooth-scroll de las anclas y reloj de la vista de cámara
fonts/            Space Grotesk variable (SIL OFL 1.1, ver fonts/OFL.txt)
img/              Imágenes (vacío por ahora)
```

La vista de cámara de la celda Home es una simulación hecha con SVG y CSS
—sin video ni imágenes—, con el recuadro de detección animado en CSS puro.

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
