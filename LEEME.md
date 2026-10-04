# Banner Hípico — Tricolor Hípico

Editor web con tres pestañas (también accesibles como rutas):

| Pestaña | Ruta | Qué genera |
|---|---|---|
| Carrera | `index.html#carrera` | Banner de la carrera con datos y tiempos parciales (PNG 2000 × 360 o 4000 × 720) |
| Ganador | `index.html#ganador` | Banner del ganador: Nº y mantilla, ejemplar, tiempo, jinete, entrenador, stud y haras |
| Cintillo | `index.html#cintillo` | Cintillo animado para videos: narrador → www.tricolorhipico.com (MP4 o GIF) |

## Uso

1. Abre `index.html` con doble clic (Chrome o Edge). Necesita internet para las fuentes y la exportación.
2. **Jornada**: fecha, reunión y color del logo de La Rinconada (dorado o blanco).
3. **Carreras**: usa `+ Agregar` (sube la carrera y el Nº anual en +1) o «Generar jornada completa».
4. **Carrera**: número, válida, distancia y Nº anual. Los parciales se generan solos según la distancia
   (`Auto por distancia`) y se pueden editar.
   Opcional: nombre del **clásico o especialidad**, que aparece debajo del logo de Tricolor Hípico
   (si es largo, pasa a dos o tres líneas). Categorías: **Blanco** (trofeos y copas sin grado),
   **Bronce** (GIII), **Plateado** (GII) y **Dorado** (GI). Si el nombre incluye el grado
   — p. ej. «(G1)», «GII», «G-III» — la categoría se elige sola.
5. Exporta con **Descargar PNG** (`Ctrl+S`), **Copiar** al portapapeles o **Descargar jornada (ZIP)**.

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

- `index.html` — editor
- `css/banner.css` — diseño del banner (colores, tamaños, posiciones)
- `css/editor.css` — interfaz del editor
- `js/app.js` — lógica de las pestañas Carrera y Ganador (estado, parciales, exportación)
- `js/cintillo.js` — animación del cintillo y exportación a MP4 / GIF
