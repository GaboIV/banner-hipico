# Banner Hípico — Tricolor Hípico

Editor web con tres pestañas (también accesibles como rutas):

| Pestaña | Ruta | Qué genera |
|---|---|---|
| Carrera | `index.html#carrera` | Banner de la carrera con datos y tiempos parciales (PNG 2000 × 360 o 4000 × 720) |
| Ganador | `index.html#ganador` | Banner del ganador: Nº y mantilla, ejemplar, tiempo, jinete, entrenador, stud y haras |
| Cintillo | `index.html#cintillo` | Cintillo animado para videos: narrador → www.tricolorhipico.com (MP4 o GIF) |

## Conexión con la revista (Tricolor Hípico)

El editor lee la base de datos de la revista (PostgreSQL del proyecto `../Tricolor Hípico`,
variable `DATABASE_URL` de su `.env`). Solo lee; no modifica nada de la revista.

```
npm install        # solo la primera vez
npm start          # base local (Docker, puerto 5433) → http://localhost:5173
npm run start:prod # base de producción (DATABASE_URL_PROD, con el túnel SSH abierto)
```

Si la revista está en otra carpeta: `TRICOLOR_DIR="D:/ruta/Tricolor Hípico" npm start`
(o define `BANNER_DATABASE_URL` en un `.env` de este proyecto).

- **Fecha**: es un selector con las reuniones de la revista. Al elegir una se cargan todas sus
  carreras: número, distancia, Nº anual, válidas del 5y6, clásico con su categoría según el grado y,
  si ya se corrió, el ganador, el tiempo final y los parciales (cuando la revista los tiene).
  Al cambiar de fecha y volver, se conserva lo editado a mano. «↻» la vuelve a leer desde cero.
  «Jornada manual» permite trabajar sin base, como antes.
- **Ganador**: en el buscador escribe el Nº (`5`) o parte del nombre (`ade`) del ejemplar y elígelo con
  clic o Enter (🏆 = ganador oficial). Se llenan Nº, jinete, entrenador, stud, haras y tiempo con los datos
  de la revista.
- **Narradores**: cada narrador escrito en el cintillo se guarda en la lista «Narradores guardados»
  (navegador + `data/narradores.json`) para elegirlo la próxima vez.

Si abres el editor de otra forma (doble clic en `index.html` o `python -m http.server 8000`), igual se conecta
a la base **siempre que `npm start` esté corriendo**: busca el servidor en el puerto 5173. Sin él, se trabaja a mano.

## Uso

1. Ejecuta `npm start` y abre http://localhost:5173 (Chrome o Edge). Necesita internet para las fuentes y la exportación.
2. **Jornada**: fecha (reunión de la revista), reunión y color del logo de La Rinconada (dorado o blanco).
3. **Carreras**: usa `+ Agregar` (sube la carrera y el Nº anual en +1) o «Generar jornada completa».
4. **Carrera**: número, válida, distancia y Nº anual. Los parciales se generan solos según la distancia
   cada 400 m hasta la llegada (`Auto por distancia`; p. ej. 1300 m → 400, 800, 1200, 1300) y se pueden editar.
   Opcional: nombre del **clásico o especialidad**, que aparece debajo del logo de Tricolor Hípico
   (si es largo, pasa a dos o tres líneas). Categorías: **Blanco** (trofeos y copas sin grado),
   **Bronce** (GIII), **Plateado** (GII) y **Dorado** (GI). Si el nombre incluye el grado
   — p. ej. «(G1)», «GII», «G-III» — la categoría se elige sola.
5. **Paquete ZIP** (botón dorado, en cualquier pestaña): «Esta carrera» o «Toda la jornada».
   Por carrera incluye la imagen sin tiempos, una imagen por cada parcial (los tiempos se van sumando),
   el banner del ganador y el cintillo del narrador en MP4 y GIF. Cada archivo lleva la carrera y su
   Nº anual, p. ej.:
   ```
   Tricolor-Hipico_R34_2026-08-30_C02_A389/
     C02_A389_00_sin-tiempos.png
     C02_A389_01_400m.png  …  C02_A389_04_1300m-final.png
     C02_A389_ganador_La-Dama.png
     Cintillo-Tricolor_<Narrador>_1920x100.mp4 / .gif
   ```
   En «Toda la jornada» va una carpeta por carrera (`C01_A388/`, …) y el cintillo en `Cintillo/`.
6. Exporta suelto con **Descargar PNG** (`Ctrl+S`), **Copiar** al portapapeles o **Descargar jornada (ZIP)**.

Todo se guarda automáticamente en el navegador. Usa «Guardar jornada (.json)» para tener respaldo
o pasar la jornada a otra computadora.

### Ganador
Elige la carrera en la lista de la jornada y completa los datos del ganador. La fecha, distancia y clásico
se toman de la carrera. El color de la mantilla sale del número (1 rojo, 2 blanco, 3 azul, 4 amarillo,
5 verde, 6 negro…). Si el tiempo queda vacío, se usa el último parcial cargado.
«Descargar ganadores (ZIP)» exporta todas las carreras que ya tienen ganador.

### Cintillo
Muestra el nombre del narrador (10 s por defecto), pasa con una barrida dorada y queda fijo en
Tricolor Hípico (20 s por defecto). Los tiempos, textos y tamaño se pueden cambiar.
- **MP4 (recomendado)**: H.264 a 30 fps, sirve en cualquier editor de video. Se genera en segundos (Chrome/Edge).
- **GIF**: por si el editor no acepta video. Pesa más y tiene menos calidad de color.
  «Repetir GIF: No» hace que se reproduzca una vez y quede fijo en Tricolor Hípico.

### Tiempos rápidos
Escribe solo los dígitos: `2480` → `24.80`, `11240` → `1:12.40`. Enter pasa al siguiente parcial.

## Cambiar logos

Reemplaza los archivos en `assets/` (mismos nombres) y ejecuta:

```
python tools/preparar-assets.py
```

Esto regenera `js/assets-data.js` (logos embebidos y caballo dorado recortado del logo de La Rinconada).

## Archivos

- `server.mjs` — servidor local: sirve el editor y la API de la base de datos (`/api/reuniones`, `/api/narradores`)
- `index.html` — editor
- `css/banner.css` — diseño del banner (colores, tamaños, posiciones)
- `css/editor.css` — interfaz del editor
- `js/app.js` — lógica de las pestañas Carrera y Ganador (estado, parciales, exportación)
- `js/cintillo.js` — animación del cintillo y exportación a MP4 / GIF
