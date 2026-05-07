/**
 * flexxusParser.js
 * Extrae datos de PDFs de presupuestos Flexxus:
 *   - NP (número de presupuesto)
 *   - CUIT del cliente
 *   - Razón social
 *   - Líneas de detalle (ítems)
 */

const pdfParse = require('pdf-parse');

// ─── Regex helpers ───────────────────────────────────────────────────────────

// CUIT argentino: XX-XXXXXXXX-X
const CUIT_RE   = /\b(\d{2}-\d{8}-\d{1})\b/;

// NP Flexxus: formato "0000-00017680"  →  4+ ceros, guión, luego ceros + número
const NP_RE     = /^0{4,}-0*(\d+)$/;

// ─── Parsear ítems ────────────────────────────────────────────────────────────
/**
 * Cada línea de ítem tiene la forma (todo concatenado sin separadores):
 *   {descripción}{código}{cant}U$S {total}U$S {unitario}{marca}{N°item}
 *
 * Estrategia:
 *   1. Detectar línea válida: contiene "U$S" al menos 2 veces.
 *   2. Extraer los dos precios con regex sencilla.
 *   3. Guardar el texto previo al primer precio como "descripción bruta".
 *   4. Extraer el número de ítem del final.
 *   5. Marcar NC ("NO COTIZA") con accepted=false.
 */
function parseItems(lines) {
  const items = [];

  for (const line of lines) {
    // Debe tener dos ocurrencias de U$S
    if ((line.match(/U\$S/g) || []).length < 2) continue;

    // Extraer: (todo antes 1er U$S) | precio1 | precio2 | (marca + N°)
    const m = line.match(
      /^(.+?)U\$S\s+([\d,]+)\s*U\$S\s+([\d,]+)(.+?)(\d+)$/
    );
    if (!m) continue;

    const rawDesc  = m[1].trim();     // descripción+código+cant
    const total    = parseArFloat(m[2]);
    const unitPrice= parseArFloat(m[3]);
    const brand    = m[4].trim();
    const sortOrder= parseInt(m[5], 10) - 1;  // 0-based

    // "NO COTIZA" → accepted=false (ítem sin precio)
    const isNC = rawDesc.toUpperCase().startsWith('NO COTIZA');

    // Intentar separar descripción del código:
    // El código suele aparecer al final de rawDesc, en mayúsculas/alfanum sin espacios largos.
    // Simplificación: usamos rawDesc completo como descripción para la demo.
    items.push({
      description: rawDesc,
      quantity:    extractQty(rawDesc, total, unitPrice),
      unit:        null,
      unitPrice:   isNC ? null : unitPrice,
      total:       isNC ? null : total,
      accepted:    !isNC,
      sortOrder,
      brand:       brand || null,
    });
  }

  return items;
}

/**
 * Intenta extraer la cantidad del rawDesc comparando total / unitario.
 * Si no coincide, devuelve 1.
 */
function extractQty(rawDesc, total, unit) {
  if (!unit || unit === 0) return 0;
  const ratio = total / unit;
  if (Number.isInteger(ratio) || Math.abs(ratio - Math.round(ratio)) < 0.01) {
    return Math.round(ratio);
  }
  return 1;
}

function parseArFloat(s) {
  // Formato argentino: "1.234,56" o "208,60"
  return parseFloat((s || '0').replace(/\./g, '').replace(',', '.')) || 0;
}

// ─── Función principal ────────────────────────────────────────────────────────

/**
 * Parsea un buffer de PDF Flexxus.
 * Retorna:
 *   { npCode, cuit, clientName, date, seller, total, items }
 * Todos los campos pueden ser null si no se encontraron.
 */
async function parseFlexxusPDF(buffer) {
  const result = {
    npCode:     null,   // "NP-17680"
    npRaw:      null,   // "17680"
    cuit:       null,   // "30-68621830-5"
    clientName: null,
    date:       null,
    seller:     null,
    items:      [],
  };

  try {
    const data  = await pdfParse(buffer);
    const lines = data.text
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean);

    // ── CUIT ──────────────────────────────────────────────────────────────────
    for (const line of lines) {
      const m = line.match(CUIT_RE);
      if (m) { result.cuit = m[1]; break; }
    }

    // ── Razón social (línea después del primer guión tras CUIT) ──────────────
    // Estructura típica: CUIT / "-" / RAZON SOCIAL / "-" / NP
    let cuitIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (CUIT_RE.test(lines[i])) { cuitIdx = i; break; }
    }
    if (cuitIdx >= 0 && cuitIdx + 2 < lines.length) {
      result.clientName = lines[cuitIdx + 2]; // skip "-"
    }

    // ── NP ────────────────────────────────────────────────────────────────────
    for (const line of lines) {
      const m = line.match(NP_RE);
      if (m) {
        result.npRaw  = m[1];
        result.npCode = `NP-${m[1]}`;
        break;
      }
    }

    // ── Fecha ─────────────────────────────────────────────────────────────────
    for (const line of lines) {
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(line)) {
        result.date = line;
        break;
      }
    }

    // ── Vendedor (línea antes de "Vendedor:") ─────────────────────────────────
    for (let i = 1; i < lines.length; i++) {
      if (lines[i] === 'Vendedor:') {
        result.seller = lines[i - 1];
        break;
      }
    }

    // ── Ítems ─────────────────────────────────────────────────────────────────
    result.items = parseItems(lines);

  } catch (err) {
    console.error('flexxusParser error:', err.message);
  }

  return result;
}

/**
 * Detecta si un attachment es un presupuesto Flexxus.
 * Criterio: filename contiene "Presupuesto" y extensión .pdf
 */
function isFlexxusPDF(att) {
  if (!att || !att.filename) return false;
  const name = att.filename.toLowerCase();
  return name.endsWith('.pdf') && name.includes('presupuesto');
}

module.exports = { parseFlexxusPDF, isFlexxusPDF, parseArFloat };
