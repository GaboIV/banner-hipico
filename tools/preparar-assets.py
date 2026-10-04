"""Prepara los logos de /assets para el editor web.

- Recorta y optimiza cada logo.
- Extrae el caballo dorado del logo de La Rinconada (sin la línea horizontal).
- Genera js/assets-data.js con los logos embebidos (data URI), para que el
  editor funcione abriendo index.html con doble clic y la exportación PNG no
  falle por restricciones de file://.

Uso:  python tools/preparar-assets.py
"""
import base64, io, os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = os.path.join(ROOT, "assets")
OUT = os.path.join(ROOT, "js", "assets-data.js")

def trim(im):
    return im.crop(im.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox())

def fit(im, max_w):
    if im.width > max_w:
        im = im.resize((max_w, round(im.height * max_w / im.width)), Image.LANCZOS)
    return im

def data_uri(im):
    buf = io.BytesIO()
    im.save(buf, "PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()

rinconada = Image.open(os.path.join(A, "aaa0c0fd-6dc4-4e52-95f9-5ebfda87e77e.png")).convert("RGBA")

# Caballo: región superior del logo, borrando la línea que cruza las patas.
horse = rinconada.crop((470, 0, 1320, 478)).copy()
px = horse.load()
ox = 470
for y in range(418, 452):
    for x in range(horse.width):
        gx = x + ox
        if gx < 885 or gx > 1160 or (gx > 1076 and y > 436):
            px[x, y] = (0, 0, 0, 0)
horse = trim(horse)

logos = {
    "rinconada": fit(trim(rinconada), 900),
    "inh": fit(trim(Image.open(os.path.join(A, "logo-inh.webp")).convert("RGBA")), 640),
    "tricolor": fit(trim(Image.open(os.path.join(A, "logo-tricolor-hipico-1024.png")).convert("RGBA")), 1024),
    "caballo": fit(horse, 520),
}

with open(OUT, "w", encoding="utf-8") as f:
    f.write("// Generado por tools/preparar-assets.py — no editar a mano.\n")
    f.write("window.BANNER_ASSETS = {\n")
    for k, im in logos.items():
        f.write(f'  {k}: "{data_uri(im)}",\n')
        print(k, im.size)
    f.write("};\n")
print("OK ->", OUT)
