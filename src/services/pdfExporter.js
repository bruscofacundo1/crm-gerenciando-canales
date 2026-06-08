/**
 * pdfExporter.js — Genera reportes PDF para exportación
 * Usa pdfkit para crear PDFs con header, tabla de datos y resumen.
 */
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

// ─── Constantes de diseño ─────────────────────────────────────────────────────
const COLORS = {
  headerBg:   '#1e293b', // navy-900
  headerText: '#ffffff',
  brandBlue:  '#2563eb',
  textDark:   '#1e293b',
  textMid:    '#475569',
  textLight:  '#94a3b8',
  line:       '#e2e8f0',
  rowAlt:     '#f8fafc',
  usd:        '#1e40af',
  ars:        '#047857',
};

const PAGE = { width: 842, height: 595, margin: 40 }; // A4 landscape
const LOGO_PATH = path.join(__dirname, '../../public/Logo.png');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMoney(n, cur) {
  if (n == null) return '—';
  const prefix = cur === 'ARS' ? 'AR$ ' : 'U$S ';
  return prefix + Number(n).toLocaleString('es-AR');
}

function fmtMoney2(n, cur) {
  if (n == null) return '—';
  const prefix = cur === 'ARS' ? 'AR$ ' : 'U$S ';
  return prefix + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d) {
  if (!d) return '—';
  const o = typeof d === 'string' ? new Date(d) : d;
  return o.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtDateShort(d) {
  if (!d) return '—';
  const o = typeof d === 'string' ? new Date(d) : d;
  return o.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }).replace('.', '');
}

function truncate(s, max) {
  if (!s) return '—';
  return s.length > max ? s.substring(0, max - 1) + '…' : s;
}

// ─── Dibujar header común ──────────────────────────────────────────────────────

function drawHeader(doc, title, subtitle, filters) {
  const m = PAGE.margin;

  // Header bar
  doc.rect(0, 0, PAGE.width, 56).fill(COLORS.headerBg);

  // Logo (si existe)
  if (fs.existsSync(LOGO_PATH)) {
    try { doc.image(LOGO_PATH, m, 10, { height: 36 }); } catch (_) {}
  }

  // Título del reporte
  doc.font('Helvetica-Bold').fontSize(14).fillColor(COLORS.headerText)
    .text(title, PAGE.width / 2 - 150, 12, { width: 300, align: 'center' });
  doc.font('Helvetica').fontSize(8).fillColor('#94a3b8')
    .text(subtitle, PAGE.width / 2 - 150, 30, { width: 300, align: 'center' });

  // Fecha de generación
  const now = new Date().toLocaleString('es-AR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  doc.font('Helvetica').fontSize(8).fillColor('#94a3b8')
    .text(`Generado: ${now}`, PAGE.width - m - 180, 18, { width: 180, align: 'right' });

  // Filtros aplicados
  let y = 66;
  if (filters && (filters.seller || filters.from || filters.to)) {
    const parts = [];
    if (filters.seller) parts.push(`Vendedor: ${filters.seller}`);
    if (filters.from)   parts.push(`Desde: ${fmtDate(filters.from)}`);
    if (filters.to)     parts.push(`Hasta: ${fmtDate(filters.to)}`);
    doc.font('Helvetica').fontSize(8).fillColor(COLORS.textMid)
      .text(`Filtros: ${parts.join(' · ')}`, m, y);
    y += 16;
  }

  return y;
}

// ─── Dibujar tabla genérica ────────────────────────────────────────────────────

function drawTable(doc, startY, columns, rows, options = {}) {
  const m = PAGE.margin;
  const tableWidth = PAGE.width - m * 2;
  const rowHeight = 18;
  const headerHeight = 22;

  // Calcular anchos de columna
  const totalFlex = columns.reduce((s, c) => s + (c.flex || 1), 0);
  const colWidths = columns.map(c => (c.flex || 1) / totalFlex * tableWidth);

  let y = startY;

  // Header de tabla
  doc.rect(m, y, tableWidth, headerHeight).fill('#f1f5f9');
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(COLORS.textMid);
  let x = m;
  columns.forEach((col, i) => {
    const textX = col.align === 'right' ? x : x + 4;
    const textW = col.align === 'right' ? colWidths[i] - 4 : colWidths[i] - 4;
    doc.text(col.header.toUpperCase(), textX, y + 6, { width: textW, align: col.align || 'left' });
    x += colWidths[i];
  });
  y += headerHeight;

  // Línea debajo del header
  doc.moveTo(m, y).lineTo(m + tableWidth, y).lineWidth(0.5).strokeColor(COLORS.line).stroke();

  // Filas de datos
  rows.forEach((row, ri) => {
    // Nueva página si no hay espacio
    if (y + rowHeight > PAGE.height - 50) {
      doc.addPage({ size: [PAGE.width, PAGE.height], margin: m });
      y = m;
      // Repetir header de tabla
      doc.rect(m, y, tableWidth, headerHeight).fill('#f1f5f9');
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(COLORS.textMid);
      let hx = m;
      columns.forEach((col, i) => {
        const textX = col.align === 'right' ? hx : hx + 4;
        const textW = col.align === 'right' ? colWidths[i] - 4 : colWidths[i] - 4;
        doc.text(col.header.toUpperCase(), textX, y + 6, { width: textW, align: col.align || 'left' });
        hx += colWidths[i];
      });
      y += headerHeight;
      doc.moveTo(m, y).lineTo(m + tableWidth, y).lineWidth(0.5).strokeColor(COLORS.line).stroke();
    }

    // Fondo alternado
    if (ri % 2 === 1) {
      doc.rect(m, y, tableWidth, rowHeight).fill(COLORS.rowAlt);
    }

    // Datos de la fila
    doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.textDark);
    x = m;
    columns.forEach((col, i) => {
      const val = col.key ? (typeof col.key === 'function' ? col.key(row) : row[col.key]) : '';
      const text = val != null ? String(val) : '—';
      const textX = col.align === 'right' ? x : x + 4;
      const textW = col.align === 'right' ? colWidths[i] - 4 : colWidths[i] - 4;

      if (col.color) doc.fillColor(col.color(row) || COLORS.textDark);
      if (col.bold)  doc.font('Helvetica-Bold');
      if (col.mono)  doc.font('Courier');

      doc.text(text, textX, y + 5, { width: textW, align: col.align || 'left', lineBreak: false });

      // Reset
      doc.font('Helvetica').fillColor(COLORS.textDark);
      x += colWidths[i];
    });

    // Línea separadora
    y += rowHeight;
    doc.moveTo(m, y).lineTo(m + tableWidth, y).lineWidth(0.3).strokeColor(COLORS.line).stroke();
  });

  return y;
}

// ─── Dibujar KPI cards ─────────────────────────────────────────────────────────

function drawKPIs(doc, y, kpis) {
  const m = PAGE.margin;
  const cardW = (PAGE.width - m * 2 - (kpis.length - 1) * 10) / kpis.length;
  const cardH = 42;

  kpis.forEach((kpi, i) => {
    const x = m + i * (cardW + 10);
    // Card background
    doc.roundedRect(x, y, cardW, cardH, 4).fill('#f8fafc');
    doc.roundedRect(x, y, cardW, cardH, 4).lineWidth(0.5).strokeColor(COLORS.line).stroke();
    // Label
    doc.font('Helvetica').fontSize(7).fillColor(COLORS.textMid)
      .text(kpi.label.toUpperCase(), x + 8, y + 6, { width: cardW - 16 });
    // Value
    doc.font('Helvetica-Bold').fontSize(13).fillColor(COLORS.textDark)
      .text(kpi.value, x + 8, y + 20, { width: cardW - 16 });
  });

  return y + cardH + 12;
}

// ─── Dibujar footer con totales ───────────────────────────────────────────────

function drawTotals(doc, y, totals) {
  const m = PAGE.margin;
  const tableWidth = PAGE.width - m * 2;

  doc.rect(m, y, tableWidth, 24).fill('#f1f5f9');
  doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.textDark);

  const parts = [];
  totals.forEach(t => {
    if (t.value) parts.push(`${t.label}: ${t.value}`);
  });

  doc.text(parts.join('     |     '), m + 8, y + 7, { width: tableWidth - 16, align: 'center' });
  return y + 30;
}


// ═══════════════════════════════════════════════════════════════════════════════
// REPORTE 1: Cotizaciones
// ═══════════════════════════════════════════════════════════════════════════════

async function generateCotizaciones(quotes, { filters, stages } = {}) {
  const doc = new PDFDocument({ size: [PAGE.width, PAGE.height], margin: PAGE.margin, autoFirstPage: true });
  const buffers = [];
  doc.on('data', b => buffers.push(b));

  const subtitle = `${quotes.length} cotizaciones · Reporte generado desde Myselec CRM`;
  let y = drawHeader(doc, 'Reporte de Cotizaciones', subtitle, filters);

  // KPIs
  const totalUSD = quotes.filter(q => (q.currency || 'USD') !== 'ARS').reduce((s, q) => s + (q.amount || 0), 0);
  const totalARS = quotes.filter(q => q.currency === 'ARS').reduce((s, q) => s + (q.amount || 0), 0);
  const enviados = quotes.filter(q => q.stage === 'enviado').length;
  const aceptadas = quotes.filter(q => q.stage === 'aceptada').length;

  y = drawKPIs(doc, y, [
    { label: 'Total cotizaciones', value: String(quotes.length) },
    { label: 'Enviados', value: String(enviados) },
    { label: 'Aceptadas', value: String(aceptadas) },
    { label: 'Monto USD', value: totalUSD > 0 ? fmtMoney(Math.round(totalUSD), 'USD') : '—' },
    { label: 'Monto ARS', value: totalARS > 0 ? fmtMoney(Math.round(totalARS), 'ARS') : '—' },
  ]);

  // Mapa de etapas
  const stageMap = {};
  if (stages) stages.forEach(s => { stageMap[s.stageKey] = s.label; });

  // Tabla
  const columns = [
    { header: 'Código',   key: 'code',       flex: 1.2, mono: true },
    { header: 'Cliente',  key: r => truncate(r.clientName, 28), flex: 2.5 },
    { header: 'Vendedor', key: r => truncate(r.sellerName, 16), flex: 1.5 },
    { header: 'Etapa',    key: r => stageMap[r.stage] || r.stage, flex: 1.5 },
    { header: 'Tipo',     key: r => r.mailType || 'MANUAL', flex: 1 },
    { header: 'Moneda',   key: r => r.currency || 'USD', flex: 0.7 },
    { header: 'Monto',    key: r => r.amount != null ? fmtMoney(r.amount, r.currency) : '—', flex: 1.5, align: 'right', bold: true },
    { header: 'Días',     key: r => r.dias != null ? `${r.dias}d` : '—', flex: 0.6, align: 'right',
      color: r => r.dias >= 5 ? '#dc2626' : COLORS.textDark },
    { header: 'Ingreso',  key: r => fmtDateShort(r.createdAt), flex: 1, align: 'right' },
  ];

  const rows = quotes.map(q => ({
    code:       q.code,
    clientName: q.client?.name || '—',
    sellerName: q.seller?.name || '—',
    stage:      q.stage,
    mailType:   q.mailType,
    currency:   q.currency || 'USD',
    amount:     q.amount,
    dias:       Math.floor((Date.now() - new Date(q.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
    createdAt:  q.createdAt,
  }));

  y = drawTable(doc, y, columns, rows);

  // Totales
  const totals = [];
  if (totalUSD > 0) totals.push({ label: 'Total USD', value: fmtMoney(Math.round(totalUSD), 'USD') });
  if (totalARS > 0) totals.push({ label: 'Total ARS', value: fmtMoney(Math.round(totalARS), 'ARS') });
  totals.push({ label: 'Registros', value: String(quotes.length) });
  if (y + 30 < PAGE.height - 20) drawTotals(doc, y + 6, totals);

  doc.end();
  return new Promise(resolve => doc.on('end', () => resolve(Buffer.concat(buffers))));
}


// ═══════════════════════════════════════════════════════════════════════════════
// REPORTE 2: Rechazos
// ═══════════════════════════════════════════════════════════════════════════════

async function generateRechazos(quotes, { filters } = {}) {
  const doc = new PDFDocument({ size: [PAGE.width, PAGE.height], margin: PAGE.margin, autoFirstPage: true });
  const buffers = [];
  doc.on('data', b => buffers.push(b));

  const subtitle = `${quotes.length} rechazos · Análisis de oportunidades perdidas`;
  let y = drawHeader(doc, 'Reporte de Rechazos', subtitle, filters);

  // KPIs
  const totalUSD = quotes.filter(q => (q.currency || 'USD') !== 'ARS').reduce((s, q) => s + (q.amount || 0), 0);
  const totalARS = quotes.filter(q => q.currency === 'ARS').reduce((s, q) => s + (q.amount || 0), 0);
  const avgDias = quotes.length
    ? Math.round(quotes.reduce((s, q) => s + Math.floor((new Date(q.updatedAt).getTime() - new Date(q.createdAt).getTime()) / (1000 * 60 * 60 * 24)), 0) / quotes.length)
    : 0;

  // Motivo más frecuente
  const reasonCounts = {};
  quotes.forEach(q => {
    const r = q.rejectReason || 'Sin especificar';
    reasonCounts[r] = (reasonCounts[r] || 0) + 1;
  });
  const topReason = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])[0];

  y = drawKPIs(doc, y, [
    { label: 'Total rechazos', value: String(quotes.length) },
    { label: 'Perdido USD', value: totalUSD > 0 ? fmtMoney(Math.round(totalUSD), 'USD') : '—' },
    { label: 'Perdido ARS', value: totalARS > 0 ? fmtMoney(Math.round(totalARS), 'ARS') : '—' },
    { label: 'Días prom. hasta rechazo', value: `${avgDias}d` },
    { label: 'Motivo principal', value: topReason ? truncate(topReason[0], 20) : '—' },
  ]);

  // Tabla
  const columns = [
    { header: 'Código',   key: 'code',       flex: 1.1, mono: true },
    { header: 'Cliente',  key: r => truncate(r.clientName, 25), flex: 2.2 },
    { header: 'Vendedor', key: r => truncate(r.sellerName, 14), flex: 1.3 },
    { header: 'Motivo',   key: r => truncate(r.rejectReason, 22), flex: 2, bold: true,
      color: () => '#dc2626' },
    { header: 'Moneda',   key: r => r.currency || 'USD', flex: 0.6 },
    { header: 'Monto',    key: r => r.amount != null ? fmtMoney(r.amount, r.currency) : '—', flex: 1.3, align: 'right', bold: true },
    { header: 'Días',     key: r => `${r.diasHastaRechazo}d`, flex: 0.6, align: 'right' },
    { header: 'Rechazo',  key: r => fmtDateShort(r.updatedAt), flex: 0.9, align: 'right' },
  ];

  const rows = quotes.map(q => ({
    code:             q.code,
    clientName:       q.client?.name || '—',
    sellerName:       q.seller?.name || '—',
    rejectReason:     q.rejectReason || 'Sin especificar',
    currency:         q.currency || 'USD',
    amount:           q.amount,
    diasHastaRechazo: Math.floor((new Date(q.updatedAt).getTime() - new Date(q.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
    updatedAt:        q.updatedAt,
  }));

  y = drawTable(doc, y, columns, rows);

  // Totales
  const totals = [];
  if (totalUSD > 0) totals.push({ label: 'Perdido USD', value: fmtMoney(Math.round(totalUSD), 'USD') });
  if (totalARS > 0) totals.push({ label: 'Perdido ARS', value: fmtMoney(Math.round(totalARS), 'ARS') });
  totals.push({ label: 'Rechazos', value: String(quotes.length) });
  if (y + 30 < PAGE.height - 20) drawTotals(doc, y + 6, totals);

  doc.end();
  return new Promise(resolve => doc.on('end', () => resolve(Buffer.concat(buffers))));
}


// ═══════════════════════════════════════════════════════════════════════════════
// REPORTE 3: Órdenes de Compra
// ═══════════════════════════════════════════════════════════════════════════════

async function generateOrdenes(orders, { filters, stages } = {}) {
  const doc = new PDFDocument({ size: [PAGE.width, PAGE.height], margin: PAGE.margin, autoFirstPage: true });
  const buffers = [];
  doc.on('data', b => buffers.push(b));

  const subtitle = `${orders.length} órdenes · Estado de entregas y logística`;
  let y = drawHeader(doc, 'Reporte de Órdenes de Compra', subtitle, filters);

  // KPIs
  const stageMap = {};
  if (stages) stages.forEach(s => { stageMap[s.stageKey] = s.label; });
  const lastStage = stages?.[stages.length - 1]?.stageKey;
  const entregadas = orders.filter(o => o.stage === lastStage).length;
  const enCurso = orders.filter(o => o.stage !== lastStage).length;
  const conTracking = orders.filter(o => o.trackingNumber).length;

  y = drawKPIs(doc, y, [
    { label: 'Total órdenes', value: String(orders.length) },
    { label: 'En curso', value: String(enCurso) },
    { label: 'Entregadas', value: String(entregadas) },
    { label: 'Con tracking', value: String(conTracking) },
  ]);

  // Tabla
  const columns = [
    { header: 'Código OC', key: 'code',         flex: 1.1, mono: true },
    { header: 'Cliente',   key: r => truncate(r.clientName, 25), flex: 2.5 },
    { header: 'Vendedor',  key: r => truncate(r.sellerName, 14), flex: 1.3 },
    { header: 'Etapa',     key: r => stageMap[r.stage] || r.stage, flex: 1.5 },
    { header: 'OC Cliente',key: r => r.clientOCCode || '—', flex: 1.2, mono: true },
    { header: 'NP Flexxus',key: r => r.flexxusCode || '—', flex: 1, mono: true },
    { header: 'Transporte',key: r => truncate(r.carrier, 16) , flex: 1.2 },
    { header: 'Tracking',  key: r => r.trackingNumber || '—', flex: 1.2, mono: true },
    { header: 'Creada',    key: r => fmtDateShort(r.createdAt), flex: 0.8, align: 'right' },
  ];

  const rows = orders.map(o => ({
    code:           o.code,
    clientName:     o.client?.name || '—',
    sellerName:     o.seller?.name || '—',
    stage:          o.stage,
    clientOCCode:   o.clientOCCode,
    flexxusCode:    o.flexxusCode,
    carrier:        o.carrier,
    trackingNumber: o.trackingNumber,
    createdAt:      o.createdAt,
  }));

  y = drawTable(doc, y, columns, rows);

  // Totales
  const totals = [
    { label: 'Total órdenes', value: String(orders.length) },
    { label: 'En curso', value: String(enCurso) },
    { label: 'Entregadas', value: String(entregadas) },
  ];
  if (y + 30 < PAGE.height - 20) drawTotals(doc, y + 6, totals);

  doc.end();
  return new Promise(resolve => doc.on('end', () => resolve(Buffer.concat(buffers))));
}


module.exports = {
  generateCotizaciones,
  generateRechazos,
  generateOrdenes,
};
