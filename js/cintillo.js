/* Cintillo animado: narrador → transición dorada → Tricolor Hípico.
   Se dibuja en canvas para poder exportarlo cuadro a cuadro (MP4 con WebCodecs, GIF con gifenc). */
(() => {
  "use strict";

  const app = window.BannerApp;
  const $ = (sel) => document.querySelector(sel);
  const cfg = () => app.state.cintillo;

  const GIFENC_URL = "https://cdn.jsdelivr.net/npm/gifenc@1.0.3/dist/gifenc.esm.js";
  const INTRO = 0.95;     // entrada del narrador
  const WIPE = 1.05;      // duración de la barrida dorada
  const SHINE = 1.1;      // duración de cada destello
  const SHINE_CADA = 8;   // segundos entre destellos

  const GOLD_STOPS = [[0, "#fff3b0"], [0.28, "#f7d257"], [0.58, "#e2ac24"], [1, "#b47e10"]];
  const INK = "#0a3a1f";

  // ---------- Recursos ----------
  const logo = new Image();
  logo.src = (window.BANNER_ASSETS || {}).tricolor || "";

  async function recursosListos() {
    await Promise.all([
      document.fonts.load('700 40px "Oswald"'),
      document.fonts.load('600 40px "Oswald"'),
      document.fonts.load('500 40px "Oswald"'),
      logo.complete ? null : new Promise((r) => { logo.onload = logo.onerror = r; }),
    ]);
  }

  // ---------- Línea de tiempo ----------
  const total = () => cfg().tA + cfg().tB;
  const wipeIni = () => cfg().tA - WIPE / 2;
  const wipeFin = () => cfg().tA + WIPE / 2;

  function destellos() {
    const { tA } = cfg();
    const out = [];
    for (let s = 1.5; s + SHINE < wipeIni() - 0.3; s += SHINE_CADA) out.push(s);
    for (let s = tA + 1.6; s + SHINE < total() - 0.2; s += SHINE_CADA) out.push(s);
    return out;
  }

  // ¿Cambia la imagen en el instante t? (los tramos estáticos se agrupan en el GIF)
  function animado(t, lista = destellos()) {
    if (t < INTRO + 0.05) return true;
    if (t >= wipeIni() - 0.05 && t <= wipeFin() + 0.05) return true;
    return lista.some((s) => t >= s - 0.05 && t <= s + SHINE + 0.05);
  }

  // ---------- Utilidades de dibujo ----------
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const easeOut = (x) => 1 - Math.pow(1 - clamp01(x), 3);
  const easeInOut = (x) => { x = clamp01(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };

  function goldV(ctx, y0, y1) {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    GOLD_STOPS.forEach(([o, c]) => g.addColorStop(o, c));
    return g;
  }
  function goldH(ctx, x0, x1) {
    const g = ctx.createLinearGradient(x0, 0, x1, 0);
    [[0, "#a87410"], [0.3, "#f6d158"], [0.5, "#fff1a6"], [0.7, "#f0c140"], [1, "#a87410"]].forEach(([o, c]) => g.addColorStop(o, c));
    return g;
  }
  // Paralelogramo inclinado (como las placas del banner)
  function para(ctx, x, y, w, h, slant) {
    ctx.beginPath();
    ctx.moveTo(x + slant, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w - slant, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
  }
  function font(ctx, weight, px, spacing = 0) {
    ctx.font = `${weight} ${px}px "Oswald", "Arial Narrow", sans-serif`;
    ctx.letterSpacing = spacing ? `${spacing}px` : "0px";
  }
  // Ancho real del texto (letterSpacing añade espacio tras la última letra)
  function ancho(ctx, txt) {
    const sp = parseFloat(ctx.letterSpacing) || 0;
    return ctx.measureText(txt).width - (txt ? sp : 0);
  }
  // Escribe con el centro óptico de las mayúsculas en cy
  function texto(ctx, txt, x, cy) {
    const asc = ctx.measureText("H").actualBoundingBoxAscent;
    ctx.fillText(txt, x, cy + asc / 2);
  }
  function microfono(ctx, x, y, m, color) {
    const cx = x + m / 2;
    ctx.save();
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineCap = "round";
    ctx.lineWidth = m * 0.09;
    ctx.beginPath();
    ctx.roundRect(cx - m * 0.17, y, m * 0.34, m * 0.6, m * 0.17);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, y + m * 0.36, m * 0.3, 0.05 * Math.PI, 0.95 * Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, y + m * 0.67);
    ctx.lineTo(cx, y + m * 0.9);
    ctx.moveTo(cx - m * 0.2, y + m * 0.92);
    ctx.lineTo(cx + m * 0.2, y + m * 0.92);
    ctx.stroke();
    ctx.restore();
  }
  // Separa "www.tricolorhipico.com" en [www., tricolorhipico, .com]
  function partesWeb(web) {
    const m = /^((?:https?:\/\/)?(?:www\.)?)([^./]+)(.*)$/i.exec((web || "").trim());
    return m ? [m[1], m[2], m[3]] : ["", web || "", ""];
  }

  // ---------- Escenas ----------
  function fondo(ctx, W, H, s) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#0e5c33");
    g.addColorStop(0.5, "#074424");
    g.addColorStop(1, "#04301a");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // brillo verde suave arriba
    const r = ctx.createRadialGradient(W * 0.5, -H * 0.6, 0, W * 0.5, -H * 0.6, W * 0.55);
    r.addColorStop(0, "rgba(60,190,110,.35)");
    r.addColorStop(1, "rgba(60,190,110,0)");
    ctx.fillStyle = r;
    ctx.fillRect(0, 0, W, H);
    // vetas diagonales
    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = "#fff";
    for (const [px, w] of [[0.18, 0.05], [0.47, 0.035], [0.74, 0.06]]) {
      para(ctx, W * px, 0, W * w + H * 0.5, H, H * 0.5);
      ctx.fill();
    }
    ctx.restore();
    // filetes dorados arriba y abajo
    const lw = Math.max(2, 3 * s);
    ctx.fillStyle = goldH(ctx, 0, W);
    ctx.fillRect(0, 0, W, lw);
    ctx.fillRect(0, H - lw, W, lw);
  }

  // Galones decorativos "///" a los lados
  function galones(ctx, x, H, s, dir, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = goldV(ctx, H * 0.2, H * 0.8);
    for (let i = 0; i < 3; i++) {
      ctx.globalAlpha = alpha * (1 - i * 0.28);
      para(ctx, x + dir * i * 16 * s, H * 0.26, 7 * s + H * 0.2, H * 0.48, H * 0.2);
      ctx.fill();
    }
    ctx.restore();
  }

  function escenaNarrador(ctx, W, H, s, t, preview) {
    const c = cfg();
    const lw = Math.max(2, 3 * s);
    const ph = H - lw * 2;
    const slant = H * 0.36;

    // Placa dorada con micrófono + etiqueta
    const etiqueta = (c.etiqueta || "").toUpperCase();
    font(ctx, 700, Math.round(H * 0.33), H * 0.012);
    const mic = H * 0.4;
    const pad = H * 0.3;
    const plateW = pad + mic + H * 0.16 + ancho(ctx, etiqueta) + pad + slant;
    const px = -plateW + plateW * easeOut(t / 0.5);

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,.45)";
    ctx.shadowBlur = 12 * s;
    ctx.shadowOffsetX = 4 * s;
    para(ctx, px - slant, lw, plateW + slant, ph, slant);
    ctx.fillStyle = goldV(ctx, lw, H - lw);
    ctx.fill();
    ctx.restore();
    // filo claro de la placa
    ctx.save();
    ctx.strokeStyle = "rgba(255,244,184,.9)";
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.moveTo(px + plateW, lw);
    ctx.lineTo(px + plateW - slant, H - lw);
    ctx.stroke();
    ctx.restore();
    microfono(ctx, px + pad, H / 2 - mic * 0.5, mic, INK);
    ctx.fillStyle = INK;
    texto(ctx, etiqueta, px + pad + mic + H * 0.16, H / 2);

    // Logo Tricolor a la derecha
    const logoH = H * 0.66;
    const logoW = logo.naturalWidth ? logoH * logo.naturalWidth / logo.naturalHeight : 0;
    const margen = H * 0.42;
    const x0 = plateW + H * 0.42;
    const vacio = !(c.narrador || "").trim();
    if (vacio && !preview) return dibujarLogo(true);
    const nombre = vacio ? "NOMBRE DEL NARRADOR" : c.narrador.trim().toUpperCase();
    const lx = W - margen - logoW;
    const sepX = lx - margen * 0.8;

    // Tamaño del nombre que cabe hasta `limite`
    const ajustar = (limite) => {
      let size = Math.round(H * 0.5);
      font(ctx, 600, size, H * 0.01);
      while (ancho(ctx, nombre) > limite - x0 && size > H * 0.22) {
        size -= 1;
        font(ctx, 600, size, H * 0.01);
      }
      return size;
    };
    // Con logo a la derecha si hay espacio; si el nombre quedaría muy pequeño, se omite el logo.
    let conLogo = logoW && W - x0 - (logoW + margen * 2) > W * 0.3;
    if (conLogo && ajustar(sepX - H * 0.35) < H * 0.34) conLogo = false;
    ajustar(conLogo ? sepX - H * 0.35 : W - margen);
    const fuenteNombre = ctx.font;
    dibujarLogo(conLogo);
    ctx.font = fuenteNombre;
    ctx.letterSpacing = `${H * 0.01}px`;

    function dibujarLogo(mostrar) {
      if (!mostrar || !logoW) return;
      const a = easeOut((t - 0.35) / 0.5);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.shadowColor = "rgba(0,0,0,.6)";
      ctx.shadowBlur = 6 * s;
      ctx.shadowOffsetY = 2 * s;
      ctx.drawImage(logo, W - margen - logoW, (H - logoH) / 2, logoW, logoH);
      ctx.restore();
      // separador
      ctx.save();
      ctx.globalAlpha = a;
      const g = ctx.createLinearGradient(0, H * 0.18, 0, H * 0.82);
      g.addColorStop(0, "rgba(242,197,61,0)");
      g.addColorStop(0.5, "#fff4b8");
      g.addColorStop(1, "rgba(242,197,61,0)");
      ctx.fillStyle = g;
      ctx.fillRect(W - margen - logoW - margen * 0.8, H * 0.18, Math.max(2, 2 * s), H * 0.64);
      ctx.restore();
    }

    // Nombre del narrador (se revela de izquierda a derecha)
    const k = easeOut((t - 0.3) / 0.6);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0 - 4, 0, (ancho(ctx, nombre) + 12 * s) * k, H);
    ctx.clip();
    ctx.globalAlpha = vacio ? 0.35 : 1;
    ctx.shadowColor = "rgba(0,0,0,.55)";
    ctx.shadowBlur = 5 * s;
    ctx.shadowOffsetY = 2 * s;
    ctx.fillStyle = "#fff";
    texto(ctx, nombre, x0 + (1 - k) * -20 * s, H / 2);
    ctx.restore();
  }

  function escenaWeb(ctx, W, H, s) {
    const c = cfg();
    const [pre, dominio, post] = partesWeb(c.web);
    const lema = (c.lema || "").trim().toUpperCase();

    const logoH = H * 0.72;
    const logoW = logo.naturalWidth ? logoH * logo.naturalWidth / logo.naturalHeight : 0;
    const gap = H * 0.36;
    const divW = Math.max(2, 2 * s);

    let urlPx = Math.round(H * (lema ? 0.44 : 0.52));
    let lemaPx = Math.round(H * 0.18);
    const medir = () => {
      font(ctx, 600, urlPx, H * 0.004);
      const wu = ancho(ctx, pre + dominio + post);
      font(ctx, 500, lemaPx, lemaPx * 0.24);
      const wl = lema ? ancho(ctx, lema) : 0;
      return Math.max(wu, wl);
    };
    let textoW = medir();
    const disponible = W - H * 0.8 - (logoW ? logoW + gap * 2 + divW : 0);
    while (textoW > disponible && urlPx > H * 0.22) {
      urlPx -= 1;
      lemaPx = Math.max(10, Math.round(urlPx * 0.41));
      textoW = medir();
    }
    const grupoW = (logoW ? logoW + gap * 2 + divW : 0) + textoW;
    let x = (W - grupoW) / 2;

    // galones a los lados si sobra espacio
    if (x > H * 1.2) {
      galones(ctx, x - H * 0.9, H, s, -1, 0.9);
      galones(ctx, x + grupoW + H * 0.5, H, s, 1, 0.9);
    }

    if (logoW) {
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,.6)";
      ctx.shadowBlur = 6 * s;
      ctx.shadowOffsetY = 2 * s;
      ctx.drawImage(logo, x, (H - logoH) / 2, logoW, logoH);
      ctx.restore();
      x += logoW + gap;
      const g = ctx.createLinearGradient(0, H * 0.16, 0, H * 0.84);
      g.addColorStop(0, "rgba(242,197,61,0)");
      g.addColorStop(0.5, "#fff4b8");
      g.addColorStop(1, "rgba(242,197,61,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x, H * 0.16, divW, H * 0.68);
      x += divW + gap;
    }

    // URL: "www." y ".com" en blanco, el dominio en dorado
    font(ctx, 600, urlPx, H * 0.004);
    const wUrl = ancho(ctx, pre + dominio + post);
    const asc = ctx.measureText("H").actualBoundingBoxAscent;
    const lemaAsc = lema ? (font(ctx, 500, lemaPx), ctx.measureText("H").actualBoundingBoxAscent) : 0;
    const bloqueH = asc + (lema ? H * 0.12 + lemaAsc : 0);
    const yUrl = (H - bloqueH) / 2 + asc;
    const xUrl = x + (textoW - wUrl) / 2;

    font(ctx, 600, urlPx, H * 0.004);
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,.55)";
    ctx.shadowBlur = 5 * s;
    ctx.shadowOffsetY = 2 * s;
    let cx = xUrl;
    ctx.fillStyle = "#fff";
    ctx.fillText(pre, cx, yUrl);
    cx += ctx.measureText(pre).width;
    ctx.fillStyle = goldV(ctx, yUrl - asc, yUrl);
    ctx.fillText(dominio, cx, yUrl);
    cx += ctx.measureText(dominio).width;
    ctx.fillStyle = "#fff";
    ctx.fillText(post, cx, yUrl);
    ctx.restore();

    if (lema) {
      font(ctx, 500, lemaPx, lemaPx * 0.24);
      const wl = ancho(ctx, lema);
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,.6)";
      ctx.shadowBlur = 4 * s;
      ctx.fillStyle = "rgba(255,255,255,.92)";
      ctx.fillText(lema, x + (textoW - wl) / 2, yUrl + H * 0.12 + lemaAsc);
      ctx.restore();
    }
  }

  // Banda dorada de transición; devuelve su posición para recortar las escenas
  function banda(ctx, W, H, s, q) {
    const bw = H * 0.9;
    const slant = H * 0.5;
    const bx = -bw - slant + (W + bw + slant * 2) * easeInOut(q);
    return {
      bx, bw, slant,
      dibujar() {
        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,.5)";
        ctx.shadowBlur = 14 * s;
        para(ctx, bx, 0, bw + slant, H, slant);
        ctx.fillStyle = goldV(ctx, 0, H);
        ctx.fill();
        ctx.restore();
        // estela
        ctx.save();
        ctx.fillStyle = "rgba(255,236,160,.55)";
        para(ctx, bx - H * 0.28, 0, H * 0.08 + slant, H, slant);
        ctx.fill();
        ctx.globalAlpha = 0.3;
        para(ctx, bx - H * 0.5, 0, H * 0.05 + slant, H, slant);
        ctx.fill();
        ctx.restore();
      },
    };
  }

  function destello(ctx, W, H, q) {
    const w = H * 1.2;
    const x = -w - H + (W + w + H * 2) * easeInOut(q);
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.5, "rgba(255,250,225,.20)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = g;
    para(ctx, x, 0, w + H * 0.5, H, H * 0.5);
    ctx.fill();
    ctx.restore();
  }

  // Dibuja el cuadro del instante t
  function dibujar(ctx, W, H, t, preview = false, lista = destellos()) {
    const s = H / 100;
    ctx.clearRect(0, 0, W, H);
    fondo(ctx, W, H, s);

    if (t < wipeIni()) {
      escenaNarrador(ctx, W, H, s, t, preview);
    } else if (t > wipeFin()) {
      escenaWeb(ctx, W, H, s);
    } else {
      const b = banda(ctx, W, H, s, (t - wipeIni()) / WIPE);
      // Tricolor a la izquierda de la banda, narrador a la derecha
      ctx.save();
      para(ctx, -W, 0, W + b.bx + b.slant, H, b.slant);
      ctx.clip();
      fondo(ctx, W, H, s);
      escenaWeb(ctx, W, H, s);
      ctx.restore();
      ctx.save();
      para(ctx, b.bx + b.bw, 0, W * 2, H, b.slant);
      ctx.clip();
      escenaNarrador(ctx, W, H, s, t, preview);
      ctx.restore();
      b.dibujar();
    }

    for (const st of lista) {
      if (t >= st && t <= st + SHINE) destello(ctx, W, H, (t - st) / SHINE);
    }
  }

  // ---------- Vista previa ----------
  const canvas = $("#cinCanvas");
  const ctx = canvas.getContext("2d");
  const seek = $("#cinSeek");
  let t = 0;
  let playing = true;
  let ultimo = 0;
  let raf = 0;

  function ajustarCanvas() {
    const { ancho: W, alto: H } = cfg();
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W;
      canvas.height = H;
    }
  }

  function pintar() {
    ajustarCanvas();
    dibujar(ctx, canvas.width, canvas.height, t, true);
    seek.max = total();
    seek.value = t;
    $("#cinTime").textContent = `${t.toFixed(1)} / ${total().toFixed(1)} s`;
  }

  function bucle(ahora) {
    raf = 0;
    if (app.vista !== "cintillo") return;
    if (playing) {
      t += Math.min(0.1, (ahora - (ultimo || ahora)) / 1000);
      if (t > total() + 1) t = 0; // en la vista previa se repite
    }
    ultimo = ahora;
    pintar();
    if (playing) raf = requestAnimationFrame(bucle);
  }
  function arrancar() {
    if (!raf && app.vista === "cintillo") {
      ultimo = 0;
      raf = requestAnimationFrame(bucle);
    }
  }
  function setPlaying(p) {
    playing = p;
    $("#cinPlay").textContent = p ? "Pausar" : "Reproducir";
    if (p) arrancar(); else pintar();
  }

  $("#cinPlay").addEventListener("click", () => setPlaying(!playing));
  $("#cinRestart").addEventListener("click", () => { t = 0; pintar(); setPlaying(true); });
  seek.addEventListener("input", () => { t = Number(seek.value); setPlaying(false); });
  document.addEventListener("keydown", (e) => {
    if (app.vista !== "cintillo" || e.target.matches("input, select, textarea")) return;
    if (e.code === "Space") { e.preventDefault(); setPlaying(!playing); }
  });

  // ---------- Formulario ----------
  const campos = {
    etiqueta: $("#cEtiqueta"), narrador: $("#cNarrador"), web: $("#cWeb"), lema: $("#cLema"),
    tA: $("#cTA"), tB: $("#cTB"),
  };
  const cW = $("#cW"), cH = $("#cH"), cPreset = $("#cPreset"), cLoop = $("#cLoop");

  function renderForm() {
    const c = cfg();
    Object.entries(campos).forEach(([k, el]) => (el.value = c[k]));
    cW.value = c.ancho;
    cH.value = c.alto;
    const key = `${c.ancho}x${c.alto}`;
    cPreset.value = [...cPreset.options].some((o) => o.value === key) ? key : "custom";
    cLoop.value = c.loop ? "si" : "no";
    $("#cinDurA").textContent = `· ${c.tA} s`;
    $("#cinDurB").textContent = `· ${c.tB} s`;
  }

  function cambio() {
    app.guardar();
    renderForm();
    pintar();
  }

  Object.entries(campos).forEach(([k, el]) => {
    el.addEventListener("input", () => {
      const c = cfg();
      if (k === "tA" || k === "tB") {
        const v = Number(el.value);
        if (!v || v < 2) return;
        c[k] = Math.min(k === "tA" ? 120 : 300, v);
        $("#cinDurA").textContent = `· ${c.tA} s`;
        $("#cinDurB").textContent = `· ${c.tB} s`;
        app.guardar();
        pintar();
        return;
      }
      c[k] = el.value;
      app.guardar();
      pintar();
    });
  });
  cPreset.addEventListener("change", () => {
    if (cPreset.value === "custom") return;
    const [w, h] = cPreset.value.split("x").map(Number);
    Object.assign(cfg(), { ancho: w, alto: h });
    cambio();
  });
  const par = (v) => Math.round(v / 2) * 2; // H.264 necesita medidas pares
  [cW, cH].forEach((el) => el.addEventListener("change", () => {
    const w = par(Math.min(3840, Math.max(320, Number(cW.value) || 1920)));
    const h = par(Math.min(400, Math.max(40, Number(cH.value) || 100)));
    Object.assign(cfg(), { ancho: w, alto: h });
    cambio();
  }));
  cLoop.addEventListener("change", () => { cfg().loop = cLoop.value === "si"; app.guardar(); });

  // ---------- Exportar ----------
  const nombreArchivo = (ext) => {
    const n = (cfg().narrador || "").trim().replace(/\s+/g, "-").normalize("NFD").replace(/[^\w-]/g, "");
    return `Cintillo-Tricolor${n ? "_" + n : ""}_${cfg().ancho}x${cfg().alto}.${ext}`;
  };
  function lienzo() {
    const c = document.createElement("canvas");
    c.width = cfg().ancho;
    c.height = cfg().alto;
    return c;
  }
  const respirar = () => new Promise((r) => setTimeout(r, 0));
  function avisarSiVacio() {
    if (!(cfg().narrador || "").trim()) app.toast("Ojo: el nombre del narrador está vacío", true);
  }

  $("#btnCinPng").addEventListener("click", () => app.conBoton($("#btnCinPng"), async () => {
    await recursosListos();
    const cv = lienzo();
    dibujar(cv.getContext("2d"), cv.width, cv.height, t);
    const blob = await new Promise((r) => cv.toBlob(r, "image/png"));
    app.descargarBlob(blob, nombreArchivo("png"));
  }));

  // MP4 (H.264) cuadro a cuadro con WebCodecs; si no está disponible, WebM en tiempo real.
  async function codecH264(W, H, bitrate, framerate) {
    for (const codec of ["avc1.640033", "avc1.640028", "avc1.4d0033", "avc1.42003e", "avc1.42001f"]) {
      const conf = { codec, width: W, height: H, bitrate, framerate, avc: { format: "avc" } };
      try {
        const r = await VideoEncoder.isConfigSupported(conf);
        if (r.supported) return conf;
      } catch (_) { /* probar el siguiente */ }
    }
    return null;
  }

  async function exportarMP4(btn) {
    const W = cfg().ancho, H = cfg().alto, fps = 30;
    const conf = await codecH264(W, H, Math.max(2_500_000, Math.round(W * H * fps * 0.3)), fps);
    if (!conf) return null;

    const muxer = new Mp4Muxer.Muxer({
      target: new Mp4Muxer.ArrayBufferTarget(),
      video: { codec: "avc", width: W, height: H, frameRate: fps },
      fastStart: "in-memory",
    });
    let fallo = null;
    const encoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: (e) => { fallo = e; },
    });
    encoder.configure(conf);

    const cv = lienzo();
    const c2 = cv.getContext("2d");
    const lista = destellos();
    const n = Math.round(total() * fps);
    for (let i = 0; i < n; i++) {
      if (fallo) throw fallo;
      dibujar(c2, W, H, i / fps, false, lista);
      const frame = new VideoFrame(cv, { timestamp: Math.round(i * 1e6 / fps), duration: Math.round(1e6 / fps) });
      encoder.encode(frame, { keyFrame: i % (fps * 2) === 0 });
      frame.close();
      if (i % 10 === 0) {
        btn.textContent = `Video ${Math.round((i / n) * 100)}%…`;
        while (encoder.encodeQueueSize > 8) await new Promise((r) => setTimeout(r, 5));
        await respirar();
      }
    }
    await encoder.flush();
    if (fallo) throw fallo;
    muxer.finalize();
    return new Blob([muxer.target.buffer], { type: "video/mp4" });
  }

  async function exportarWebM(btn) {
    if (!window.MediaRecorder) throw new Error("Este navegador no puede generar video. Usa Chrome o Edge.");
    const W = cfg().ancho, H = cfg().alto;
    const cv = lienzo();
    const c2 = cv.getContext("2d");
    const stream = cv.captureStream(30);
    const tipo = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((x) => MediaRecorder.isTypeSupported(x));
    const rec = new MediaRecorder(stream, { mimeType: tipo, videoBitsPerSecond: 6_000_000 });
    const partes = [];
    rec.ondataavailable = (e) => e.data.size && partes.push(e.data);
    const fin = new Promise((r) => (rec.onstop = r));
    const lista = destellos();
    rec.start();
    const t0 = performance.now();
    await new Promise((resolve) => {
      const paso = () => {
        const tt = (performance.now() - t0) / 1000;
        dibujar(c2, W, H, Math.min(tt, total()), false, lista);
        btn.textContent = `Grabando ${Math.round((tt / total()) * 100)}%…`;
        if (tt >= total()) return resolve();
        requestAnimationFrame(paso);
      };
      paso();
    });
    rec.stop();
    await fin;
    return new Blob(partes, { type: "video/webm" });
  }

  $("#btnCinVideo").addEventListener("click", () => app.conBoton($("#btnCinVideo"), async () => {
    avisarSiVacio();
    await recursosListos();
    const btn = $("#btnCinVideo");
    let blob = null;
    if (window.VideoEncoder && window.Mp4Muxer) blob = await exportarMP4(btn);
    if (blob) {
      app.descargarBlob(blob, nombreArchivo("mp4"));
      app.toast(`Video MP4 listo (${(blob.size / 1048576).toFixed(1)} MB)`);
      return;
    }
    app.toast("MP4 no disponible en este navegador; grabando WebM en tiempo real…");
    blob = await exportarWebM(btn);
    app.descargarBlob(blob, nombreArchivo("webm"));
    app.toast("Video WebM listo");
  }));

  // GIF: los tramos estáticos se guardan como un solo cuadro con espera larga.
  $("#btnCinGif").addEventListener("click", () => app.conBoton($("#btnCinGif"), async () => {
    avisarSiVacio();
    const btn = $("#btnCinGif");
    let gifenc;
    try { gifenc = await import(GIFENC_URL); }
    catch (_) { throw new Error("No se pudo cargar el generador de GIF (¿sin internet?)"); }
    const { GIFEncoder, quantize, applyPalette } = gifenc;
    await recursosListos();

    const W = cfg().ancho, H = cfg().alto, fps = 20;
    const cv = lienzo();
    const c2 = cv.getContext("2d", { willReadFrequently: true });
    const lista = destellos();
    const leer = (tt) => { dibujar(c2, W, H, tt, false, lista); return c2.getImageData(0, 0, W, H).data; };

    // Paleta común a partir de cuadros representativos
    const muestras = [INTRO + 0.5, cfg().tA, wipeFin() + 0.5, (lista[0] ?? 1.5) + SHINE / 2].map(leer);
    const mezcla = new Uint8ClampedArray(muestras.reduce((a, m) => a + m.length, 0));
    let off = 0;
    muestras.forEach((m) => { mezcla.set(m, off); off += m.length; });
    const palette = quantize(mezcla, 256);

    const gif = GIFEncoder();
    const n = Math.round(total() * fps);
    const paso = 1000 / fps;
    let pendiente = null; // { index, delay }
    let primero = true;
    const escribir = () => {
      if (!pendiente) return;
      gif.writeFrame(pendiente.index, W, H, {
        palette, delay: Math.round(pendiente.delay),
        ...(primero ? { repeat: cfg().loop ? 0 : -1 } : {}),
      });
      primero = false;
    };
    for (let i = 0; i < n; i++) {
      const tt = i / fps;
      const cambiaAqui = i === 0 || animado(tt, lista) || animado((i - 1) / fps, lista);
      if (cambiaAqui) {
        escribir();
        pendiente = { index: applyPalette(leer(tt), palette), delay: paso };
      } else {
        pendiente.delay += paso;
      }
      if (i % 10 === 0) {
        btn.textContent = `GIF ${Math.round((i / n) * 100)}%…`;
        await respirar();
      }
    }
    escribir();
    gif.finish();
    const blob = new Blob([gif.bytes()], { type: "image/gif" });
    app.descargarBlob(blob, nombreArchivo("gif"));
    app.toast(`GIF listo (${(blob.size / 1048576).toFixed(1)} MB)`);
  }));

  // ---------- Inicio ----------
  function alEntrar() {
    renderForm();
    recursosListos().then(pintar);
    pintar();
    if (playing) arrancar();
  }
  window.addEventListener("vista", (e) => { if (e.detail === "cintillo") alEntrar(); });
  window.addEventListener("estado-cargado", () => { if (app.vista === "cintillo") alEntrar(); });
  if (app.vista === "cintillo") alEntrar();
})();
