# protectia-web

Sitio web comercial de **Protect(IA)** para el dominio raíz `protectia.cl`.

Seguridad residencial con inteligencia artificial en Santiago (La Florida,
Peñalolén y Macul). Sitio estático: HTML, CSS y JS puros — sin frameworks
ni dependencias.

## Estructura

```
index.html        Home
css/styles.css    Estilos (variables al tope, mobile-first)
js/main.js        Smooth-scroll de las anclas del nav
img/              Imágenes (vacío por ahora)
```

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

- Tipografía definitiva (hoy usa system font stack)
- Favicon e imagen de Open Graph reales (`img/`)
- Vista de cámara real en la celda Home (hoy es un placeholder)
- Páginas interiores y animaciones

---

© 2026 Protect(IA) — L&F IT Consulting SpA
