(() => {
  "use strict";

  const STORAGE_KEY = "bannerHipico.v1";
  const BANNER_W = 2000;
  const BANNER_H = 360;
  const MAX_PARCIALES = 7;
  const VISTAS = ["carrera", "ganador", "cintillo"];
  // Categorías del clásico: blanco = sin grado, bronce = GIII, plata = GII, dorado = GI.
  const ESTILOS_CLASICO = ["blanco", "bronce", "plata", "dorado"];

  // Colores estándar de las mantillas por número: [fondo, número].
  const MANTILLAS = {
    1: ["#d4202a", "#fff"], 2: ["#ffffff", "#111"], 3: ["#1d4fa6", "#fff"], 4: ["#f6cf1a", "#111"],
    5: ["#178a3a", "#fff"], 6: ["#141414", "#f6cf1a"], 7: ["#f37321", "#111"], 8: ["#f39ec0", "#111"],
    9: ["#2bbfc4", "#111"], 10: ["#6a2c91", "#fff"], 11: ["#9ea3a8", "#c8102e"], 12: ["#a5cd39", "#111"],
    13: ["#6b4423", "#fff"], 14: ["#7b1e2e", "#f6cf1a"], 15: ["#c8b48a", "#111"], 16: ["#8ec5ea", "#c8102e"],
  };

  // Detecta el grado escrito en el nombre: "(G1)", "GI", "G-III", "Grado 2"...
  function gradoEnNombre(txt) {
    const m = /\b(?:G|GR\.?|GRADO)\s*[-.]?\s*(III|II|I|3|2|1)\b/i.exec(txt || "");
    if (!m) return null;
    return { III: "bronce", 3: "bronce", II: "plata", 2: "plata", I: "dorado", 1: "dorado" }[m[1].toUpperCase()];
  }

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  // ---------- Estado ----------
  function parcialesPorDistancia(dist) {
    dist = Number(dist) || 0;
    if (dist < 400) return [{ d: dist, t: "" }];
    const step = dist <= 1300 ? 200 : 400;
    const out = [];
    for (let d = 400; d < dist; d += step) out.push({ d, t: "" });
    out.push({ d: dist, t: "" });
    // Si son demasiados, conservar los primeros y el final.
    while (out.length > MAX_PARCIALES) out.splice(out.length - 2, 1);
    return out;
  }

  const ganadorVacio = () => ({ dorsal: "", caballo: "", jinete: "", entrenador: "", stud: "", haras: "", tiempo: "" });

  function nuevaCarrera(numero, anual, distancia = 1200) {
    return {
      numero, valida: "", distancia, anual,
      clasico: "", clasicoEstilo: "blanco",
      parciales: parcialesPorDistancia(distancia),
      ganador: ganadorVacio(),
    };
  }

  const cintilloInicial = () => ({
    etiqueta: "Narración", narrador: "", web: "www.tricolorhipico.com", lema: "Tu revista hípica digital",
    tA: 10, tB: 20, loop: false, ancho: 1920, alto: 100,
  });

  function estadoInicial() {
    const c = nuevaCarrera(11, 438, 1200);
    c.valida = "3ra Vál.";
    c.parciales[0].t = "24.80";
    return {
      fecha: "2026-09-20", reunion: 37, logo: "dorado", escala: 2, actual: 0, carreras: [c],
      cintillo: cintilloInicial(),
    };
  }

  function cargarEstado() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return validarEstado(JSON.parse(raw));
    } catch (_) { /* sin almacenamiento disponible */ }
    return estadoInicial();
  }

  function validarEstado(s) {
    const base = estadoInicial();
    if (!s || !Array.isArray(s.carreras) || !s.carreras.length) return base;
    const carreras = s.carreras.map((c) => ({
      numero: c.numero ?? "", valida: c.valida ?? "", distancia: c.distancia ?? "",
      anual: c.anual ?? "",
      clasico: c.clasico ?? "", clasicoEstilo: ESTILOS_CLASICO.includes(c.clasicoEstilo) ? c.clasicoEstilo : "blanco",
      parciales: Array.isArray(c.parciales) ? c.parciales.map((p) => ({ d: p.d ?? "", t: p.t ?? "" })) : [],
      ganador: { ...ganadorVacio(), ...(c.ganador || {}) },
    }));
    return {
      fecha: s.fecha || base.fecha,
      reunion: s.reunion ?? base.reunion,
      logo: s.logo === "blanco" ? "blanco" : "dorado",
      escala: Number(s.escala) === 1 ? 1 : 2,
      actual: Math.min(Math.max(0, s.actual | 0), carreras.length - 1),
      carreras,
      cintillo: { ...cintilloInicial(), ...(s.cintillo || {}) },
    };
  }

  let state = cargarEstado();
  let saveTimer;
  function guardar() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) { /* ignorar */ }
    }, 250);
  }

  const actual = () => state.carreras[state.actual];

  // ---------- Formatos ----------
  function fechaCorta(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
    return m ? `${m[3]}-${m[2]}-${m[1].slice(2)}` : "";
  }

  // "2480" -> "24.80", "11240" -> "1:12.40", "1.12.4" -> "1:12.40"
  function normalizarTiempo(v) {
    v = String(v || "").trim().replace(",", ".");
    if (!v) return "";
    if (/^\d+$/.test(v)) {
      if (v.length <= 2) return `${v}.00`;
      if (v.length <= 4) return `${v.slice(0, -2)}.${v.slice(-2)}`;
      const cc = v.slice(-2), ss = v.slice(-4, -2), mm = v.slice(0, -4);
      return `${Number(mm)}:${ss}.${cc}`;
    }
    const m = /^(\d+)[:.'](\d{1,2})[.,](\d{1,2})$/.exec(v);
    if (m) return `${Number(m[1])}:${m[2].padStart(2, "0")}.${m[3].padEnd(2, "0")}`;
    const s = /^(\d{1,2})\.(\d)$/.exec(v);
    if (s) return `${s[1]}.${s[2]}0`;
    return v;
  }

  const nf = (n) => (n === "" || n == null ? "" : String(n));
  const ultimoParcial = (c) => [...c.parciales].reverse().find((p) => p.t)?.t || "";
  const tiempoGanador = (c) => c.ganador.tiempo || ultimoParcial(c);

  // ---------- Banners ----------
  const banner = $("#banner");
  const bannerGanador = $("#bannerGanador");

  // Inserta la marca compartida en cada banner.
  $$("[data-brand]").forEach((slot) => slot.replaceWith($("#tplBrand").content.cloneNode(true)));

  function aplicarAssets() {
    const A = window.BANNER_ASSETS || {};
    $$("[data-asset]").forEach((img) => {
      const src = A[img.dataset.asset];
      if (src) img.src = src;
    });
  }

  // Reduce la fuente de `el` hasta que su ancho quepa en `avail`.
  function encoger(el, avail, min, paso = 2) {
    el.style.fontSize = "";
    let size = parseFloat(getComputedStyle(el).fontSize);
    while (el.offsetWidth > avail && size > min) {
      size -= paso;
      el.style.fontSize = size + "px";
    }
    return size;
  }

  function ajustarClasico(root) {
    // Busca el tamaño más grande que quepa en 1, luego 2 y luego 3 líneas.
    const placa = $(".clasico", root);
    const cl = $(".clasico-txt", root);
    root.classList.remove("clasico-2l", "clasico-3l");
    cl.style.fontSize = "";
    cl.style.whiteSpace = "";
    cl.style.maxWidth = "";
    if (!cl.textContent) return;
    const etapas = [
      { lineas: 1, desde: 26, hasta: 21 },
      { lineas: 2, desde: 23, hasta: 19 },
      { lineas: 3, desde: 21, hasta: 14 },
    ];
    for (const e of etapas) {
      root.classList.toggle("clasico-2l", e.lineas === 2);
      root.classList.toggle("clasico-3l", e.lineas === 3);
      const avail = parseFloat(getComputedStyle(placa).maxWidth) - (e.lineas === 1 ? 52 : 40);
      cl.style.whiteSpace = e.lineas === 1 ? "nowrap" : "normal";
      cl.style.maxWidth = e.lineas === 1 ? "" : avail + "px";
      for (let size = e.desde; size >= e.hasta; size--) {
        cl.style.fontSize = size + "px";
        const lineas = Math.round(cl.offsetHeight / (size * 1.1));
        if (cl.offsetWidth <= avail && lineas <= e.lineas) return;
      }
    }
  }

  function ajustarTexto(root) {
    $$(".card-value", root).forEach((box) => {
      const el = $(".fit", box);
      if (el) encoger(el, box.clientWidth - 32, 30);
    });
    $$(".card-label", root).forEach((box) => encoger($("span", box), box.clientWidth - 22, 16, 1));
    ajustarClasico(root);

    // Tiempos parciales: todos al mismo tamaño (el del que menos cabe) para que se vean parejos.
    const tiempos = $$(".t-time", root);
    if (tiempos.length) {
      const min = Math.min(...tiempos.map((el) => encoger(el, el.parentElement.clientWidth - 16, 24)));
      tiempos.forEach((el) => (el.style.fontSize = min + "px"));
    }

    // Ganador
    const linea = $(".win-line", root);
    if (linea) {
      const nombre = $(".win-name", root);
      const box = linea.parentElement;
      nombre.style.fontSize = "";
      let size = parseFloat(getComputedStyle(nombre).fontSize);
      while (linea.offsetWidth > box.clientWidth - 52 && size > 34) {
        size -= 2;
        nombre.style.fontSize = size + "px";
      }
    }
    $$(".w-value", root).forEach((el) => {
      const avail = el.parentElement.clientWidth - 44 - $(".w-label", el.parentElement).offsetWidth - 14;
      encoger(el, avail, 18);
    });
  }

  function renderBrand(root, c) {
    root.classList.toggle("logo-blanco", state.logo === "blanco");
    const clasico = (c.clasico || "").trim();
    root.classList.toggle("con-clasico", !!clasico);
    $(".clasico", root).className = "clasico " + (ESTILOS_CLASICO.includes(c.clasicoEstilo) ? c.clasicoEstilo : "blanco");
    $(".clasico-txt", root).textContent = clasico;
  }

  function renderBanner(c = actual()) {
    renderBrand(banner, c);
    $("#vFecha").textContent = fechaCorta(state.fecha) || "– –";
    $("#vDist").textContent = nf(c.distancia) || "– –";
    $("#vCarrera").textContent = nf(c.numero) || "–";
    $("#vValida").textContent = (c.valida || "").trim();
    $("#vReunion").textContent = nf(state.reunion) || "–";
    $("#vAnual").textContent = nf(c.anual) || "–";

    const cont = $("#vTiempos");
    cont.innerHTML = "";
    const parciales = c.parciales.length ? c.parciales : [{ d: "", t: "" }];
    parciales.forEach((p, i) => {
      const cell = document.createElement("div");
      cell.className = "t-cell" + (i === parciales.length - 1 && parciales.length > 1 ? " final" : "");
      const d = document.createElement("div");
      d.className = "t-dist";
      d.textContent = p.d !== "" ? `${p.d} m` : " ";
      const t = document.createElement("div");
      t.className = "t-time" + (p.t ? "" : " empty");
      t.textContent = p.t || "– –";
      cell.append(d, t);
      cont.append(cell);
    });
    ajustarTexto(banner);
  }

  function renderGanador(c = actual()) {
    const g = c.ganador;
    renderBrand(bannerGanador, c);
    const info = [nf(c.numero) && `Carrera ${c.numero}`, nf(c.distancia) && `${c.distancia} mts.`].filter(Boolean);
    $("#wCarreraInfo").textContent = info.length ? "· " + info.join(" · ") : "";

    const dorsal = $("#wDorsal");
    dorsal.textContent = nf(g.dorsal);
    const [fondo, tinta] = MANTILLAS[g.dorsal] || ["#3b4a42", "#fff"];
    dorsal.style.background = fondo;
    dorsal.style.color = tinta;

    const nombre = $("#wCaballo");
    nombre.textContent = (g.caballo || "").trim() || "Ejemplar";
    nombre.classList.toggle("empty", !(g.caballo || "").trim());
    $("#wTiempo").textContent = tiempoGanador(c) || "– –";
    [["#wJinete", g.jinete], ["#wEntrenador", g.entrenador], ["#wStud", g.stud], ["#wHaras", g.haras]].forEach(([sel, v]) => {
      const el = $(sel);
      el.textContent = (v || "").trim() || "– –";
      el.classList.toggle("empty", !(v || "").trim());
    });
    ajustarTexto(bannerGanador);
  }

  const renderVista = (c = actual()) => {
    if (vista === "carrera") renderBanner(c);
    else if (vista === "ganador") renderGanador(c);
  };

  // ---------- Escala de las vistas previas ----------
  $$(".preview").forEach((preview) => {
    const scaler = $(".preview-scaler", preview);
    new ResizeObserver(() => {
      const s = preview.clientWidth / BANNER_W;
      scaler.style.transform = `scale(${s})`;
      preview.style.height = BANNER_H * s + "px";
    }).observe(preview);
  });

  // ---------- Vistas (rutas #carrera, #ganador, #cintillo) ----------
  let vista = "carrera";
  function irA(v) {
    vista = VISTAS.includes(v) ? v : "carrera";
    document.body.dataset.view = vista;
    $$("[data-views]").forEach((el) => (el.hidden = !el.dataset.views.split(" ").includes(vista)));
    $$("#tabs a").forEach((a) => a.classList.toggle("on", a.dataset.tab === vista));
    $("#btnZip").textContent = vista === "ganador" ? "Descargar ganadores (ZIP)" : "Descargar jornada (ZIP)";
    document.title = { carrera: "Banner Hípico", ganador: "Ganador · Banner Hípico", cintillo: "Cintillo · Banner Hípico" }[vista];
    if (vista !== "cintillo") renderTodo();
    window.dispatchEvent(new CustomEvent("vista", { detail: vista }));
  }
  window.addEventListener("hashchange", () => irA(location.hash.slice(1)));

  // ---------- Formulario ----------
  const f = {
    fecha: $("#fFecha"), reunion: $("#fReunion"),
    numero: $("#fNumero"), valida: $("#fValida"), distancia: $("#fDistancia"), anual: $("#fAnual"),
    clasico: $("#fClasico"),
    escala: $("#escala"),
  };
  const fg = {
    dorsal: $("#gwDorsal"), caballo: $("#gwCaballo"), tiempo: $("#gwTiempo"),
    jinete: $("#gwJinete"), entrenador: $("#gwEntrenador"), stud: $("#gwStud"), haras: $("#gwHaras"),
  };

  function renderLista() {
    const list = $("#raceList");
    list.innerHTML = "";
    state.carreras.forEach((c, i) => {
      const b = document.createElement("button");
      b.className = "race-chip" + (i === state.actual ? " on" : "");
      b.type = "button";
      const gan = (c.ganador.caballo || "").trim();
      b.title = `Carrera ${c.numero} · ${c.distancia} m${c.valida ? " · " + c.valida : ""}${c.clasico ? " · " + c.clasico : ""}${gan ? " · Ganador: " + gan : ""}`;
      const tiene = c.parciales.filter((p) => p.t).length;
      b.innerHTML = `C${nf(c.numero) || "?"}<small>${nf(c.distancia) ? c.distancia + " m" : "—"}</small>`;
      if (c.clasico) b.insertAdjacentHTML("beforeend", '<span class="star" title="Clásico / especialidad">★</span>');
      if (c.valida) b.insertAdjacentHTML("beforeend", '<span class="dot" title="Válida"></span>');
      if (vista === "ganador") {
        if (gan) b.insertAdjacentHTML("beforeend", '<span class="trophy-mark" title="Ganador cargado">🏆</span>');
      } else if (tiene && tiene === c.parciales.length) {
        b.insertAdjacentHTML("beforeend", '<span class="done" title="Tiempos completos"></span>');
      }
      b.addEventListener("click", () => seleccionar(i));
      list.append(b);
    });
    $("#countCarreras").textContent = `(${state.carreras.length})`;
    $("#btnEliminar").disabled = state.carreras.length <= 1;
  }

  function renderSplits() {
    const c = actual();
    const wrap = $("#splits");
    wrap.innerHTML = "";
    c.parciales.forEach((p, i) => {
      const row = document.createElement("div");
      row.className = "split";
      row.innerHTML = `
        <span class="idx">${i + 1}</span>
        <span class="unit"><input type="number" min="0" step="50" inputmode="numeric" aria-label="Distancia del parcial ${i + 1}"></span>
        <span class="time"><input type="text" inputmode="decimal" placeholder="– –" aria-label="Tiempo del parcial ${i + 1}"></span>
        <button class="btn del" type="button" title="Quitar parcial">×</button>`;
      const [dIn, tIn] = $$("input", row);
      dIn.value = p.d;
      tIn.value = p.t;
      dIn.addEventListener("input", () => { p.d = dIn.value === "" ? "" : Number(dIn.value); cambio(); });
      tIn.addEventListener("input", () => { p.t = tIn.value.trim(); cambio(false); });
      tIn.addEventListener("blur", () => {
        const n = normalizarTiempo(tIn.value);
        if (n !== tIn.value) { tIn.value = n; }
        p.t = n; cambio();
      });
      tIn.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          const next = $$(".split .time input", wrap)[i + 1];
          tIn.blur();
          if (next) next.focus(); else tIn.focus();
        }
      });
      $(".del", row).addEventListener("click", () => {
        c.parciales.splice(i, 1);
        renderSplits(); cambio();
      });
      wrap.append(row);
    });
    $("#btnAddParcial").disabled = c.parciales.length >= MAX_PARCIALES;
  }

  function renderForm() {
    const c = actual();
    f.fecha.value = state.fecha;
    f.reunion.value = state.reunion;
    f.numero.value = c.numero;
    f.valida.value = c.valida;
    f.clasico.value = c.clasico || "";
    $$("#fClasicoEstilo button").forEach((b) => b.classList.toggle("on", b.dataset.v === (c.clasicoEstilo || "blanco")));
    f.distancia.value = c.distancia;
    f.anual.value = c.anual;
    f.escala.value = String(state.escala);
    $$("#fLogo button").forEach((b) => b.classList.toggle("on", b.dataset.v === state.logo));
    const last = state.carreras[state.carreras.length - 1];
    if (!$("#gAnual").value) $("#gAnual").value = last.anual || "";
    Object.entries(fg).forEach(([k, el]) => (el.value = c.ganador[k] ?? ""));
    fg.tiempo.placeholder = ultimoParcial(c) ? `${ultimoParcial(c)} (último parcial)` : "– –";
    renderTitulos();
    renderSplits();
  }

  function renderTitulos() {
    const c = actual();
    $("#tituloCarrera").textContent = `Carrera ${nf(c.numero)}`;
    $("#tituloGanador").textContent = `Ganador · Carrera ${nf(c.numero)}`;
  }

  function renderTodo() {
    renderForm();
    renderLista();
    renderVista();
  }

  function cambio(lista = true) {
    renderVista();
    if (lista) renderLista();
    renderTitulos();
    guardar();
  }

  function seleccionar(i) {
    state.actual = Math.max(0, Math.min(i, state.carreras.length - 1));
    renderTodo();
    guardar();
  }

  const num = (v) => (v === "" ? "" : Number(v));
  f.fecha.addEventListener("input", () => { state.fecha = f.fecha.value; cambio(); });
  f.reunion.addEventListener("input", () => { state.reunion = num(f.reunion.value); cambio(); });
  f.numero.addEventListener("input", () => { actual().numero = num(f.numero.value); cambio(); });
  f.valida.addEventListener("input", () => { actual().valida = f.valida.value; cambio(); });
  f.clasico.addEventListener("input", () => {
    const c = actual();
    c.clasico = f.clasico.value;
    const grado = gradoEnNombre(c.clasico);
    if (grado && grado !== c.clasicoEstilo) {
      c.clasicoEstilo = grado;
      $$("#fClasicoEstilo button").forEach((x) => x.classList.toggle("on", x.dataset.v === grado));
    }
    cambio();
  });
  $$("#fClasicoEstilo button").forEach((b) => b.addEventListener("click", (e) => {
    e.preventDefault();
    actual().clasicoEstilo = b.dataset.v;
    $$("#fClasicoEstilo button").forEach((x) => x.classList.toggle("on", x === b));
    cambio(false);
  }));
  f.anual.addEventListener("input", () => { actual().anual = num(f.anual.value); cambio(); });
  f.distancia.addEventListener("input", () => {
    const c = actual();
    const prev = c.distancia;
    c.distancia = num(f.distancia.value);
    // Si los parciales siguen vacíos y el último era la distancia anterior, se regeneran.
    const vacios = c.parciales.every((p) => !p.t);
    if (vacios && c.distancia >= 400 && (!c.parciales.length || c.parciales[c.parciales.length - 1].d === prev)) {
      c.parciales = parcialesPorDistancia(c.distancia);
      renderSplits();
    }
    cambio();
  });
  f.escala.addEventListener("change", () => { state.escala = Number(f.escala.value); guardar(); });
  $$("#fLogo button").forEach((b) => b.addEventListener("click", (e) => {
    e.preventDefault();
    state.logo = b.dataset.v;
    renderForm(); cambio(false);
  }));

  // Ganador
  Object.entries(fg).forEach(([k, el]) => {
    el.addEventListener("input", () => {
      actual().ganador[k] = k === "dorsal" ? num(el.value) : el.value;
      cambio(k === "caballo");
    });
  });
  fg.tiempo.addEventListener("blur", () => {
    const n = normalizarTiempo(fg.tiempo.value);
    fg.tiempo.value = n;
    actual().ganador.tiempo = n;
    cambio(false);
  });

  $("#btnAutoParciales").addEventListener("click", () => {
    const c = actual();
    const viejos = new Map(c.parciales.map((p) => [Number(p.d), p.t]));
    c.parciales = parcialesPorDistancia(c.distancia).map((p) => ({ d: p.d, t: viejos.get(p.d) || "" }));
    renderSplits(); cambio();
  });
  $("#btnAddParcial").addEventListener("click", () => {
    const c = actual();
    if (c.parciales.length >= MAX_PARCIALES) return;
    const last = c.parciales[c.parciales.length - 1];
    c.parciales.push({ d: last ? Number(last.d) + 200 : 400, t: "" });
    renderSplits(); cambio();
    const ins = $$(".split .unit input");
    ins[ins.length - 1]?.focus();
  });

  // ---------- Carreras ----------
  $("#btnAgregar").addEventListener("click", () => {
    const last = state.carreras[state.carreras.length - 1];
    const c = nuevaCarrera(
      last.numero !== "" ? Number(last.numero) + 1 : 1,
      last.anual !== "" ? Number(last.anual) + 1 : "",
      last.distancia || 1200
    );
    state.carreras.push(c);
    seleccionar(state.carreras.length - 1);
  });
  $("#btnDuplicar").addEventListener("click", () => {
    const c = JSON.parse(JSON.stringify(actual()));
    c.parciales.forEach((p) => (p.t = ""));
    c.ganador = ganadorVacio();
    state.carreras.splice(state.actual + 1, 0, c);
    seleccionar(state.actual + 1);
  });
  $("#btnEliminar").addEventListener("click", () => {
    if (state.carreras.length <= 1) return;
    if (!confirm(`¿Eliminar la carrera ${actual().numero}?`)) return;
    state.carreras.splice(state.actual, 1);
    seleccionar(Math.min(state.actual, state.carreras.length - 1));
  });
  $("#btnGenerar").addEventListener("click", () => {
    const desde = Number($("#gDesde").value) || 1;
    const cant = Math.min(30, Math.max(1, Number($("#gCantidad").value) || 1));
    const anual = $("#gAnual").value === "" ? "" : Number($("#gAnual").value);
    if (!confirm(`Se reemplazarán las ${state.carreras.length} carrera(s) actuales por ${cant} nuevas. ¿Continuar?`)) return;
    state.carreras = Array.from({ length: cant }, (_, i) =>
      nuevaCarrera(desde + i, anual === "" ? "" : anual + i, 1200));
    seleccionar(0);
    toast(`${cant} carreras creadas. Ajusta distancia y válidas de cada una.`);
  });

  // ---------- Guardar / abrir JSON ----------
  function descargarBlob(blob, nombre) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = nombre;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  const baseNombre = () => `Tricolor-Hipico_R${nf(state.reunion) || "x"}_${state.fecha || "sin-fecha"}`;

  $("#btnGuardar").addEventListener("click", () => {
    descargarBlob(new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }), `${baseNombre()}.json`);
  });
  $("#btnCargar").addEventListener("click", () => $("#fileCargar").click());
  $("#fileCargar").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      state = validarEstado(JSON.parse(await file.text()));
      renderTodo(); guardar();
      window.dispatchEvent(new Event("estado-cargado"));
      toast("Jornada cargada");
    } catch (err) {
      toast("No se pudo leer el archivo", true);
    }
  });

  // ---------- Exportar ----------
  const nodoActual = () => (vista === "ganador" ? bannerGanador : banner);

  async function listoParaCapturar(node) {
    await document.fonts.ready;
    await Promise.all($$("img", node).map((img) =>
      img.complete ? null : new Promise((r) => { img.addEventListener("load", r, { once: true }); img.addEventListener("error", r, { once: true }); })));
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }

  let fontCSS = null;
  async function capturar(node = nodoActual()) {
    if (!window.htmlToImage) throw new Error("No se cargó html-to-image (¿sin internet?)");
    await listoParaCapturar(node);
    const opts = {
      width: BANNER_W, height: BANNER_H,
      pixelRatio: state.escala,
      style: { transform: "none" },
    };
    if (fontCSS === null) {
      try { fontCSS = await htmlToImage.getFontEmbedCSS(node); } catch (_) { fontCSS = undefined; }
    }
    if (fontCSS) opts.fontEmbedCSS = fontCSS;
    return htmlToImage.toBlob(node, opts);
  }

  const nombrePNG = (c, sufijo = vista === "ganador" ? "_ganador" : "") =>
    `${baseNombre()}_C${String(nf(c.numero)).padStart(2, "0")}${sufijo}.png`;

  async function conBoton(btn, fn) {
    const txt = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Generando…";
    try { await fn(); }
    catch (err) { console.error(err); toast(err.message || "Error al generar", true); }
    finally { btn.disabled = false; btn.textContent = txt; }
  }

  async function descargarActual() {
    if (vista === "cintillo") return;
    await conBoton($("#btnDescargar"), async () => {
      const blob = await capturar();
      descargarBlob(blob, nombrePNG(actual()));
      toast(vista === "ganador" ? `Ganador de la carrera ${actual().numero} descargado` : `Carrera ${actual().numero} descargada`);
    });
  }
  $("#btnDescargar").addEventListener("click", descargarActual);

  $("#btnCopiar").addEventListener("click", () => conBoton($("#btnCopiar"), async () => {
    if (!navigator.clipboard || !window.ClipboardItem) throw new Error("El navegador no permite copiar imágenes aquí");
    await navigator.clipboard.write([new ClipboardItem({ "image/png": capturar() })]);
    toast("Imagen copiada al portapapeles");
  }));

  $("#btnZip").addEventListener("click", () => conBoton($("#btnZip"), async () => {
    if (!window.JSZip) throw new Error("No se cargó JSZip (¿sin internet?)");
    const esGanador = vista === "ganador";
    const lista = esGanador ? state.carreras.filter((c) => (c.ganador.caballo || "").trim()) : state.carreras;
    if (!lista.length) throw new Error("Ninguna carrera tiene ganador cargado todavía");
    const zip = new JSZip();
    const btn = $("#btnZip");
    for (let i = 0; i < lista.length; i++) {
      const c = lista[i];
      btn.textContent = `Generando ${i + 1}/${lista.length}…`;
      renderVista(c);
      zip.file(nombrePNG(c), await capturar());
    }
    renderVista();
    const blob = await zip.generateAsync({ type: "blob" });
    descargarBlob(blob, `${baseNombre()}${esGanador ? "_ganadores" : ""}.zip`);
    toast(`${lista.length} imágenes exportadas`);
  }));

  // ---------- Atajos ----------
  document.addEventListener("keydown", (e) => {
    if (vista === "cintillo") return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      document.activeElement?.blur?.();
      descargarActual();
    } else if (e.altKey && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
      e.preventDefault();
      seleccionar(state.actual + (e.key === "ArrowRight" ? 1 : -1));
    }
  });

  // ---------- Toast ----------
  let toastTimer;
  function toast(msg, error = false) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.toggle("error", error);
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
  }

  // API para cintillo.js
  window.BannerApp = {
    get state() { return state; },
    guardar, toast, descargarBlob, conBoton, baseNombre,
    get vista() { return vista; },
  };

  // ---------- Inicio ----------
  aplicarAssets();
  irA(location.hash.slice(1));
  document.fonts.ready.then(() => renderVista());
})();
