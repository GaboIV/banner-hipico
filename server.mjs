// Servidor local del Banner Hípico: sirve el editor y lee la base de datos de Tricolor Hípico.
//
//   npm start               → base local (DATABASE_URL del .env de Tricolor Hípico)
//   npm start -- --prod     → producción (DATABASE_URL_PROD, con el túnel SSH abierto)
//
// Solo hace SELECT sobre la base de la revista. Lo único que escribe es
// data/narradores.json, la lista de narradores guardados del cintillo.
import http from "node:http";
import fs from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const PUERTO = Number(process.env.PORT) || 5173;
const PROD = process.argv.includes("--prod");
const TRICOLOR_DIR = process.env.TRICOLOR_DIR || path.resolve(RAIZ, "..", "Tricolor Hípico");
const NARRADORES = path.join(RAIZ, "data", "narradores.json");

// ---------- Conexión ----------
function leerEnv(archivo) {
  const vars = {};
  try {
    for (const linea of readFileSync(archivo, "utf8").split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(linea);
      if (!m) continue;
      let v = m[2];
      const q = /^(["'])(.*)\1/.exec(v);
      v = q ? q[2] : v.replace(/\s+#.*$/, "");
      vars[m[1]] = v;
    }
  } catch (_) { /* sin archivo */ }
  return vars;
}

function urlBase() {
  const clave = PROD ? "DATABASE_URL_PROD" : "DATABASE_URL";
  const propio = { ...leerEnv(path.join(RAIZ, ".env")), ...process.env };
  if (propio[`BANNER_${clave}`]) return propio[`BANNER_${clave}`];
  const tricolor = leerEnv(path.join(TRICOLOR_DIR, ".env"));
  return tricolor[clave] || null;
}

const DB_URL = urlBase();
const pool = DB_URL ? new pg.Pool({ connectionString: DB_URL, max: 4 }) : null;
const destino = DB_URL ? (() => { try { const u = new URL(DB_URL); return `${u.hostname}:${u.port}${u.pathname}`; } catch { return "?"; } })() : null;

// ---------- Formatos (mismos criterios que src/lib/format.ts de la revista) ----------
const PREPOSICIONES = /^(de|del|di|da|do|du|la|las|los|san|santa|st\.?)$/i;

function titulo(s) {
  return String(s)
    .replace(/[´’‘`ʼʻ]/g, "'")
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => {
      const letras = w.replace(/\P{L}/gu, "");
      if (i === 0 && letras.length > 1 && /^(c?)(x[cl]|l?x{0,3})(i[xv]|v?i{0,3})$/i.test(letras) && !/^(di|id|im|mi)$/i.test(letras)) return w.toUpperCase();
      if (/^(jr|sr)\.?$/i.test(w)) return w[0].toUpperCase() + "r.";
      if (/^[a-z]\.?$/i.test(w)) return w.toUpperCase();
      return letras.length > 2 ? w.replace(/\p{L}/u, (c) => c.toUpperCase()).replace(/(['])(\p{L})/gu, (_, a, c) => a + c.toUpperCase()) : w;
    })
    .join(" ")
    .replace(/^\P{L}*\p{L}/u, (c) => c.toUpperCase());
}

// "VELASQUEZ F FRANKLIN R" → "Franklin Velasquez"; si ya viene en caja mixta se respeta.
function nombrePersona(oficial) {
  if (!oficial) return "";
  const limpio = oficial.trim().replace(/[´’‘`ʼʻ]/g, "'").replace(/\b([A-Za-z])\s*'\s*(\p{L}+)/gu, "$1'$2");
  if (/\p{Ll}/u.test(limpio)) return titulo(limpio);
  const tokens = limpio.split(/\s+/);
  const sufijo = tokens.some((t) => /^(JR|SR)\.?$/i.test(t)) ? " Jr." : "";
  const palabras = tokens.filter((t) => t.replace(/\./g, "").length > 1 && !/^(JR|SR)\.?$/i.test(t));
  if (palabras.length < 2) return titulo(limpio);
  let apellido = palabras[0];
  if (palabras.length >= 3 && PREPOSICIONES.test(palabras[0])) {
    apellido = palabras.length >= 4 && /^de$/i.test(palabras[0]) && /^(la|las|los)$/i.test(palabras[1])
      ? palabras.slice(0, 3).join(" ") : palabras.slice(0, 2).join(" ");
  }
  return `${titulo(palabras[palabras.length - 1])} ${titulo(apellido)}${sufijo}`;
}
const persona = (nombre, corto) => (corto || nombrePersona(nombre) || "").trim();

// "LA MILAGROSA" → "La Milagrosa"; lo que ya trae caja mixta se respeta.
function nombreStud(s) {
  if (!s) return "";
  if (s !== s.toUpperCase() || (s.length <= 4 && !/\s/.test(s))) return s;
  let primera = true;
  return s.replace(/[\p{L}\p{N}][\p{L}\p{N}']*/gu, (p) => {
    const esPrimera = primera;
    primera = false;
    if (/^[IVX]+$/.test(p) || !/[AEIOUÁÉÍÓÚÜ]/.test(p)) return p;
    const b = p.toLowerCase();
    if (!esPrimera && ["de", "del", "y"].includes(b)) return b;
    return b[0].toUpperCase() + b.slice(1);
  });
}

// El banner ya rotula «Haras», así que se quita la palabra si viene incluida.
function harasBanner(haras, harasNombre) {
  let h = (harasNombre || haras || "").trim();
  if (!h) return "";
  if (h === h.toUpperCase()) h = titulo(h).replace(/\b([CS])\.?a\.?$/i, (_, l) => `${l.toUpperCase()}.A.`);
  return h.replace(/^haras\s+/i, "");
}

// Tiempos de la revista ("1:14 3/5", "75.2" = 75 2/5, "1:38 flat", "87.72")
// → formato del banner en centésimas ("1:14.60", "1:15.40", "1:38.00", "1:27.72").
function tiempoBanner(bruto) {
  const s = String(bruto ?? "").trim().replace(/\s*flat$/i, "").replace(",", ".");
  const m = /^(?:(\d+):)?(\d{1,3})(?:\.(\d{1,2}))?(?:\s+(\d)\/5)?$/.exec(s);
  if (!m) return "";
  let cent = ((m[1] ? Number(m[1]) * 60 : 0) + Number(m[2])) * 100;
  if (m[4] != null) cent += Number(m[4]) * 20;
  else if (m[3] != null) cent += m[3].length === 2 ? Number(m[3]) : Number(m[3]) * (Number(m[3]) <= 4 ? 20 : 10);
  const min = Math.floor(cent / 6000);
  const seg = Math.floor((cent % 6000) / 100);
  const cc = String(cent % 100).padStart(2, "0");
  return min ? `${min}:${String(seg).padStart(2, "0")}.${cc}` : `${seg}.${cc}`;
}

// "25.1 47.3 72.1" o "24 4/5 49 75 3/5 (7 2/5)": acumulados cada 400 m.
// El paréntesis es el último tramo, no un acumulado, y se descarta.
function parcialesBanner(texto, distancia, final) {
  if (!texto) return null;
  const limpio = String(texto).replace(/\(.*?\)/g, " ");
  const tiempos = [...limpio.matchAll(/(\d+(?::\d+)?(?:[.,]\d{1,2})?)(?:\s+(\d)\/5)?/g)]
    .map((m) => tiempoBanner(m[2] ? `${m[1]} ${m[2]}/5` : m[1]))
    .filter(Boolean);
  if (!tiempos.length) return null;
  const out = [];
  tiempos.forEach((t, i) => { const d = (i + 1) * 400; if (d < distancia) out.push({ d, t }); });
  out.push({ d: distancia, t: final || "" });
  return out;
}

const ORDINALES = ["1ra", "2da", "3ra", "4ta", "5ta", "6ta"];

// Válidas del 5y6: Valencia las numera en `juegos` («5 Y 6 NACIONAL (3RA)»); La
// Rinconada solo marca la primera («5y6 NAC») y le siguen las cinco de después.
function validas(carreras) {
  const out = new Map();
  for (const c of carreras) {
    const m = /5\s*Y\s*6[^·]*\((\d)/i.exec(c.juegos || "");
    if (m) out.set(c.id, `${ORDINALES[Number(m[1]) - 1] || m[1]} Vál.`);
  }
  if (out.size) return out;
  let desde = carreras.findIndex((c) => /5\s*Y\s*6/i.test(c.juegos || ""));
  if (desde < 0) desde = carreras.length >= 6 ? carreras.length - 6 : -1;
  if (desde >= 0) carreras.slice(desde, desde + 6).forEach((c, i) => out.set(c.id, `${ORDINALES[i]} Vál.`));
  return out;
}

const ESTILO_GRADO = { GI: "dorado", G1: "dorado", GII: "plata", G2: "plata", GIII: "bronce", G3: "bronce" };

// ---------- Consultas ----------
async function reuniones() {
  const { rows } = await pool.query(`
    select r.id, to_char(r.fecha, 'YYYY-MM-DD') as fecha, r."nroReunion" as nro, h.nombre as hipodromo,
           r.estado::text as estado, count(distinct c.id)::int as carreras,
           count(distinct res."carreraId")::int as "conGanador"
      from "Reunion" r
      join "Hipodromo" h on h.id = r."hipodromoId"
      left join "Carrera" c on c."reunionId" = r.id
      left join "Resultado" res on res."carreraId" = c.id and res.posicion = 1
     group by r.id, h.nombre
     order by r.fecha desc, h.nombre
     limit 300`);
  return rows;
}

async function reunion(id) {
  const { rows: [r] } = await pool.query(`
    select r.id, to_char(r.fecha, 'YYYY-MM-DD') as fecha, r."nroReunion" as nro, h.nombre as hipodromo, r.estado::text as estado
      from "Reunion" r join "Hipodromo" h on h.id = r."hipodromoId" where r.id = $1`, [id]);
  if (!r) return null;

  const { rows: carreras } = await pool.query(`
    select id, "nroCarrera", "nroAnual", distancia, "nombreClasico", grado, juegos
      from "Carrera" where "reunionId" = $1 order by "nroCarrera"`, [id]);

  const { rows: inscritos } = await pool.query(`
    select i."carreraId", i."nroPuesto", i.retirado, e.nombre as ejemplar, e.haras, e."harasNombre",
           j.nombre as jinete, j."nombreCorto" as "jineteCorto",
           en.nombre as entrenador, en."nombreCorto" as "entrenadorCorto",
           coalesce(s.nombre, se.nombre) as stud,
           res.posicion, res."tiempoGanador", res.parciales,
           (select a.parciales from "Actuacion" a
             where a."carreraId" = i."carreraId" and a."ejemplarId" = i."ejemplarId" limit 1) as "parcialesAct"
      from "Inscripcion" i
      join "Carrera" c on c.id = i."carreraId"
      join "Ejemplar" e on e.id = i."ejemplarId"
      left join "Jinete" j on j.id = i."jineteId"
      left join "Entrenador" en on en.id = i."entrenadorId"
      left join "Stud" s on s.id = i."studId"
      left join "Stud" se on se.id = e."studId"
      left join "Resultado" res on res."inscripcionId" = i.id
     where c."reunionId" = $1
     order by i."carreraId", i."nroPuesto"`, [id]);

  const vals = validas(carreras);
  return {
    ...r,
    carreras: carreras.map((c) => {
      const lista = inscritos.filter((i) => i.carreraId === c.id).map((i) => ({
        dorsal: i.nroPuesto,
        caballo: i.ejemplar,
        jinete: persona(i.jinete, i.jineteCorto),
        entrenador: persona(i.entrenador, i.entrenadorCorto),
        stud: nombreStud(i.stud),
        haras: harasBanner(i.haras, i.harasNombre),
        retirado: !!i.retirado,
        posicion: i.posicion ?? null,
        tiempo: i.posicion === 1 ? tiempoBanner(i.tiempoGanador) : "",
        _parciales: i.posicion === 1 ? i.parciales || i.parcialesAct : null,
      }));
      const ganador = lista.find((i) => i.posicion === 1) || null;
      const parciales = ganador ? parcialesBanner(ganador._parciales, c.distancia, ganador.tiempo) : null;
      lista.forEach((i) => delete i._parciales);
      const grado = (c.grado || "").toUpperCase().replace(/[\s.]/g, "");
      const clasico = c.nombreClasico ? titulo(c.nombreClasico) + (grado ? ` (${grado})` : "") : "";
      return {
        numero: c.nroCarrera,
        anual: c.nroAnual ?? "",
        distancia: c.distancia,
        valida: vals.get(c.id) || "",
        clasico,
        clasicoEstilo: ESTILO_GRADO[grado] || "blanco",
        parciales,
        ganadorDorsal: ganador ? ganador.dorsal : null,
        inscritos: lista,
      };
    }),
  };
}

// ---------- Narradores ----------
async function leerNarradores() {
  try { return JSON.parse(await fs.readFile(NARRADORES, "utf8")); } catch { return []; }
}
async function guardarNarradores(lista) {
  const limpia = [...new Set((Array.isArray(lista) ? lista : []).map((n) => String(n).trim()).filter(Boolean))]
    .slice(0, 500).sort((a, b) => a.localeCompare(b, "es"));
  await fs.mkdir(path.dirname(NARRADORES), { recursive: true });
  await fs.writeFile(NARRADORES, JSON.stringify(limpia, null, 2) + "\n");
  return limpia;
}

// ---------- HTTP ----------
const TIPOS = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".png": "image/png",
  ".webp": "image/webp", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon",
};

function json(res, status, data) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(data));
}

async function cuerpo(req) {
  let raw = "";
  for await (const chunk of req) { raw += chunk; if (raw.length > 1e6) throw new Error("Cuerpo demasiado grande"); }
  return JSON.parse(raw || "null");
}

async function api(req, res, ruta) {
  if (ruta === "/api/estado") {
    if (!pool) return json(res, 200, { db: false, error: `No se encontró DATABASE_URL en ${TRICOLOR_DIR}\\.env` });
    try { await pool.query("select 1"); return json(res, 200, { db: true, destino, prod: PROD }); }
    catch (e) { return json(res, 200, { db: false, destino, error: e.message }); }
  }
  if (ruta === "/api/narradores") {
    if (req.method === "PUT") return json(res, 200, await guardarNarradores(await cuerpo(req)));
    return json(res, 200, await leerNarradores());
  }
  if (!pool) return json(res, 503, { error: "Sin conexión a la base de datos" });
  if (ruta === "/api/reuniones") return json(res, 200, await reuniones());
  const m = /^\/api\/reuniones\/(\d+)$/.exec(ruta);
  if (m) {
    const r = await reunion(Number(m[1]));
    return r ? json(res, 200, r) : json(res, 404, { error: "Reunión no encontrada" });
  }
  return json(res, 404, { error: "No existe" });
}

async function estatico(res, ruta) {
  const rel = decodeURIComponent(ruta === "/" ? "/index.html" : ruta);
  const archivo = path.normalize(path.join(RAIZ, rel));
  const bloqueado = /[\\/](node_modules|\.git|data)([\\/]|$)|[\\/]\.env/i.test(archivo.slice(RAIZ.length));
  if (!archivo.startsWith(RAIZ) || bloqueado) { res.writeHead(403); return res.end(); }
  try {
    const datos = await fs.readFile(archivo);
    res.writeHead(200, { "content-type": TIPOS[path.extname(archivo).toLowerCase()] || "application/octet-stream", "cache-control": "no-cache" });
    res.end(datos);
  } catch {
    res.writeHead(404); res.end("No encontrado");
  }
}

// El editor también puede abrirse desde otro servidor local (p. ej. `python -m http.server 8000`)
// o con doble clic (origen "null"): se le permite usar la API, pero solo desde la propia computadora.
const ORIGEN_LOCAL = /^(null|https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?)$/;

http.createServer(async (req, res) => {
  const ruta = new URL(req.url, "http://x").pathname;
  const origen = req.headers.origin;
  if (ruta.startsWith("/api/") && origen && ORIGEN_LOCAL.test(origen)) {
    res.setHeader("access-control-allow-origin", origen);
    res.setHeader("access-control-allow-methods", "GET, PUT, OPTIONS");
    res.setHeader("access-control-allow-headers", "content-type");
    res.setHeader("access-control-allow-private-network", "true");
    res.setHeader("vary", "origin");
    if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
  }
  try {
    if (ruta.startsWith("/api/")) await api(req, res, ruta);
    else await estatico(res, ruta);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) json(res, 500, { error: e.message });
  }
}).listen(PUERTO, "127.0.0.1", () => {
  console.log(`Banner Hípico → http://localhost:${PUERTO}`);
  console.log(DB_URL ? `Base de datos${PROD ? " (PRODUCCIÓN)" : ""}: ${destino}` : `⚠ Sin DATABASE_URL (buscado en ${TRICOLOR_DIR}\\.env)`);
});
