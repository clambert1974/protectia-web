#!/usr/bin/env python3
"""Descarga y normaliza las imágenes oficiales de producto para la Tienda.

Lee scripts/productos_camaras.json (la lista de modelos, con la URL de la imagen
OFICIAL del fabricante ya investigada y guardada ahí para reproducibilidad) y por
cada modelo:

  1. Descarga la imagen desde el sitio/CDN del FABRICANTE (nunca de terceros).
  2. La valida: que sea imagen de verdad, con dimensiones razonables y no un
     placeholder (imagen casi uniforme).
  3. La normaliza: aplana transparencia sobre blanco, encoge a máx 800x800 y la
     recomprime como JPEG bajo ~150KB.
  4. La guarda en img/productos/{slug}.jpg.

Al final imprime una tabla: modelo → archivo → tamaño → fuente, y un resumen.

Uso:
    python3 scripts/fetch_product_images.py            # descarga los que falten
    python3 scripts/fetch_product_images.py --force    # vuelve a bajar todos

NO toca tienda.html: solo produce las imágenes bajo img/productos/.
"""

import argparse
import io
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path
from urllib.parse import urlparse

import requests
from PIL import Image, ImageStat

BASE = Path(__file__).resolve().parent          # scripts/
REPO = BASE.parent                               # raíz de protectia-web
JSON_FILES = [BASE / "productos_camaras.json", BASE / "productos_cerraduras.json"]
OUT_DIR = REPO / "img" / "productos"

MAX_SIDE = 800                 # lado máximo (px) tras redimensionar
MAX_BYTES = 150 * 1024         # tope de peso por imagen
MIN_SRC_SIDE = 200             # una imagen de producto de <200px es sospechosa
MIN_STD = 6.0                  # desviación de luminancia mínima: menos = casi uniforme (placeholder)

# UA de navegador: varios CDN de fabricante responden 403 al User-Agent de
# urllib/requests por defecto. El Referer a la página de producto evita el
# bloqueo por hotlinking de algunos.
HEADERS = {
    "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                   "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"),
    "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
}

FABRICANTE_DOMINIOS = {
    "Dahua": ("dahuasecurity.com",),
    "Hikvision": ("hikvision.com", "hikvisioneurope.com"),
    "Reolink": ("reolink.com", "reolink.us"),
    "Yale": ("yalehome.cl", "yale.cl", "yalehome.com", "yale.com", "yalehome.com.ar"),
    "Kaadas": ("kaadas.com", "kaadas.cl", "kaadas.com.my"),
}


def es_dominio_fabricante(url, fabricante):
    """La URL debe colgar del dominio del fabricante. Para marcas SIN dominio
    propio en el mapa (p.ej. Tuya genérico), no se restringe: se acepta la mejor
    imagen limpia disponible y la fuente queda anotada en el JSON (campo notas)."""
    dominios = FABRICANTE_DOMINIOS.get(fabricante)
    if not dominios:
        return True
    host = (urlparse(url).hostname or "").lower()
    return any(host == d or host.endswith("." + d) for d in dominios)


def descargar(url, referer):
    headers = dict(HEADERS)
    if referer:
        headers["Referer"] = referer
    r = requests.get(url, headers=headers, timeout=30)
    r.raise_for_status()
    ctype = r.headers.get("Content-Type", "").lower()
    # Un HTML casi siempre es una pagina-reto anti-bot o un error, no la imagen.
    if "text/html" in ctype:
        raise ValueError(f"la URL devolvió HTML, no un archivo ({ctype})")
    return r.content


def imagen_desde_descarga(data):
    """PIL.Image a partir de los bytes descargados. Si es un PDF (la ficha oficial
    de Hikvision, cuyas paginas HTML estan tras un muro anti-bot), extrae la
    imagen embebida mas grande de la PAGINA 1: es la foto de estudio del producto."""
    if data[:5] == b"%PDF-":
        return _imagen_de_pdf(data)
    return Image.open(io.BytesIO(data))


def _imagen_de_pdf(data):
    with tempfile.TemporaryDirectory() as td:
        pdf = os.path.join(td, "doc.pdf")
        with open(pdf, "wb") as f:
            f.write(data)
        # Solo pagina 1; -all conserva el formato original de cada imagen embebida.
        subprocess.run(["pdfimages", "-all", "-f", "1", "-l", "1", pdf,
                        os.path.join(td, "img")], check=True, capture_output=True)
        imgs = []
        for name in sorted(os.listdir(td)):
            if not name.startswith("img"):
                continue
            try:
                im = Image.open(os.path.join(td, name))
                im.load()
            except Exception:                      # noqa: BLE001 — no-imagen
                continue
            imgs.append(im)
        # La foto de producto es una imagen a COLOR de aspecto ~cuadrado y grande;
        # el membrete de la ficha es apaisado tamaño-pagina y los iconos, chicos.
        color = [im for im in imgs
                 if im.mode not in ("L", "1", "LA")
                 and min(im.size) >= 250
                 and max(im.size) / min(im.size) <= 1.35]
        if not color:
            raise ValueError("no se hallo una foto de producto (a color, cuadrada, >=250px) en la pagina 1 del PDF")
        color.sort(key=lambda im: -(im.size[0] * im.size[1]))
        prod = color[0].convert("RGB")
        # Soft-mask: algunas fichas (Hikvision) traen la foto sobre fondo NEGRO con
        # una mascara alfa —una imagen en gris del MISMO tamaño— que la recorta. Si
        # existe, la aplicamos: el fondo negro pasa a transparente y normalizar() lo
        # aplana sobre blanco, quedando consistente con las demas fotos.
        mask = next((im for im in imgs
                     if im.mode in ("L", "1") and im.size == prod.size), None)
        if mask is not None:
            prod = prod.copy()
            prod.putalpha(mask.convert("L"))
        return prod


def parece_placeholder(im):
    """Heurística: una imagen casi uniforme (fondo plano sin producto) tiene muy
    poca variación de luminancia. Un producto real —cámara oscura sobre blanco—
    tiene contraste de sobra."""
    g = im.convert("L")
    std = ImageStat.Stat(g).stddev[0]
    return std < MIN_STD, std


def normalizar(im):
    """Aplana sobre blanco, encoge a MAX_SIDE y recomprime a JPEG < MAX_BYTES.
    Devuelve (bytes_jpeg, (w, h), (w0, h0)) o levanta si no valida."""
    im.load()
    w0, h0 = im.size
    if min(w0, h0) < MIN_SRC_SIDE:
        raise ValueError(f"muy chica ({w0}x{h0}, mínimo {MIN_SRC_SIDE})")

    placeholder, std = parece_placeholder(im)
    if placeholder:
        raise ValueError(f"parece placeholder (std luminancia {std:.1f} < {MIN_STD})")

    # Aplana transparencia sobre blanco (las fotos de producto son fondo blanco).
    if im.mode in ("RGBA", "LA", "P"):
        im = im.convert("RGBA")
        fondo = Image.new("RGBA", im.size, (255, 255, 255, 255))
        im = Image.alpha_composite(fondo, im)
    im = im.convert("RGB")

    im.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
    w, h = im.size

    # Baja la calidad hasta entrar en MAX_BYTES.
    for q in (90, 85, 80, 75, 70, 65, 60):
        buf = io.BytesIO()
        im.save(buf, "JPEG", quality=q, optimize=True, progressive=True)
        if buf.tell() <= MAX_BYTES:
            return buf.getvalue(), (w, h), (w0, h0)
    return buf.getvalue(), (w, h), (w0, h0)   # el mejor esfuerzo aunque exceda


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true", help="re-descarga aunque el .jpg ya exista")
    args = ap.parse_args()

    productos = []
    for jf in JSON_FILES:
        if jf.exists():
            productos.extend(json.loads(jf.read_text(encoding="utf-8"))["productos"])
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    filas, ok, fallos = [], 0, 0
    for p in productos:
        modelo, fab, slug = p["modelo"], p["fabricante"], p["slug"]
        url, ref = p.get("image_url"), p.get("product_url")
        destino = OUT_DIR / f"{slug}.jpg"
        rel = destino.relative_to(REPO)
        try:
            if not url:
                raise ValueError("sin image_url en el JSON (falta investigar)")
            if not es_dominio_fabricante(url, fab):
                raise ValueError(f"la URL no es del dominio de {fab}: {urlparse(url).hostname}")
            if destino.exists() and not args.force:
                kb = destino.stat().st_size / 1024
                w, h = Image.open(destino).size
                filas.append((modelo, str(rel), f"{w}x{h}", f"{kb:.0f} KB", "(ya estaba)"))
                ok += 1
                continue
            data = descargar(url, ref)
            jpeg, (w, h), (w0, h0) = normalizar(imagen_desde_descarga(data))
            destino.write_bytes(jpeg)
            kb = len(jpeg) / 1024
            host = urlparse(url).hostname
            filas.append((modelo, str(rel), f"{w}x{h}", f"{kb:.0f} KB", host))
            ok += 1
        except Exception as e:                      # noqa: BLE001 — reportamos, no abortamos
            filas.append((modelo, str(rel), "—", "—", f"ERROR: {e}"))
            fallos += 1

    # Tabla
    cols = ["Modelo", "Archivo", "Dim", "Peso", "Fuente"]
    ancho = [max(len(str(f[i])) for f in ([cols] + filas)) for i in range(len(cols))]
    linea = lambda f: "  ".join(str(f[i]).ljust(ancho[i]) for i in range(len(cols)))
    print(linea(cols))
    print("  ".join("-" * a for a in ancho))
    for f in filas:
        print(linea(f))
    print(f"\nOK: {ok}/{len(productos)}   Fallos: {fallos}")
    return 1 if fallos else 0


if __name__ == "__main__":
    sys.exit(main())
