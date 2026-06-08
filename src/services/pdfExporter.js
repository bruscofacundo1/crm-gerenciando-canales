/**
 * pdfExporter.js — Reportes PDF con identidad visual Myselec
 */
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

// ─── Brand colors (manual de identidad 2022) ─────────────────────────────────
const C = {
  brand:      '#20759E',
  brandDark:  '#004669',
  black:      '#231F20',
  grayDark:   '#939598',
  grayMid:    '#BCBEC0',
  grayLight:  '#E8E9EA',
  grayBg:     '#F5F6F7',
  white:      '#FFFFFF',
  accent:     '#20759E',
  danger:     '#C0392B',
  success:    '#1A7A4C',
};

const PAGE = { width: 842, height: 595, margin: 40 };
const LOGO_PATH = path.join(__dirname, '../../public/Logo.png');
const CONTENT_W = PAGE.width - PAGE.margin * 2;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMoney(n, cur) {
  if (n == null) return '—';
  return (cur === 'ARS' ? 'AR$ ' : 'U$S ') + Number(n).toLocaleString('es-AR');
}

function fmtMoney2(n, cur) {
  if (n == null) return '—';
  return (cur === 'ARS' ? 'AR$ ' : 'U$S ') + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

// ─── Header ───────────────────────────────────────────────────────────────────

function drawHeader(doc, title, subtitle, filters) {
  const m = PAGE.margin;

  // Top accent line
  doc.rect(0, 0, PAGE.width, 4).fill(C.brand);

  // Header area
  doc.rect(0, 4, PAGE.width, 62).fill(C.brandDark);

  // Logo
  if (fs.existsSync(LOGO_PATH)) {
    try { doc.image(LOGO_PATH, m, 14, { height: 42 }); } catch (_) {}
  }

  // Title block — right-aligned
  doc.font('Helvetica-Bold').fontSize(16).fillColor(C.white)
    .text(title, PAGE.width - m - 350, 16, { width: 350, align: 'right' });
  doc.font('Helvetica').fontSize(9).fillColor(C.grayMid)
    .text(subtitle, PAGE.width - m - 350, 36, { width: 350, align: 'right' });

  // Date stamp
  const now = new Date().toLocaleString('es-AR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  doc.font('Helvetica').fontSize(7).fillColor(C.grayMid)
    .text(now, PAGE.width - m - 350, 50, { width: 350, align: 'right' });

  let y = 78;

  // Filter chips
  if (filters && (filters.seller || filters.from || filters.to)) {
    const parts = [];
    if (filters.seller) parts.push(filters.seller);
    if (filters.from)   parts.push(`Desde ${fmtDate(filters.from)}`);
    if (filters.to)     parts.push(`Hasta ${fmtDate(filters.to)}`);

    let chipX = m;
    parts.forEach(label => {
      const w = doc.font('Helvetica').fontSize(7.5).widthOfString(label) + 16;
      doc.roundedRect(chipX, y, w, 18, 9).fill(C.grayBg);
      doc.font('Helvetica').fontSize(7.5).fillColor(C.brandDark)
        .text(label, chipX + 8, y + 4, { width: w - 16 });
      chipX += w + 6;
    });
    y += 28;
  }

  return y;
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function drawFooter(doc, pageNum, totalPages) {
  const m = PAGE.margin;
  const y = PAGE.height - 28;

  doc.moveTo(m, y).lineTo(PAGE.width - m, y).lineWidth(0.5).strokeColor(C.grayMid).stroke();

  doc.font('Helvetica').fontSize(7).fillColor(C.grayDark)
    .text('Myselec SRL · Reporte generado desde CRM', m, y + 6, { width: CONTENT_W / 2 });

  doc.font('Helvetica').fontSize(7).fillColor(C.grayDark)
    .text(`Página ${pageNum} de ${totalPages}`, m + CONTENT_W / 2, y + 6, { width: CONTENT_W / 2, align: 'right' });
}

// ─── KPI Cards ────────────────────────────────────────────────────────────────

function drawKPIs(doc, y, kpis) {
  const m = PAGE.margin;
  const gap = 10;
  const cardW = (CONTENT_W - (kpis.length - 1) * gap) / kpis.length;
  const cardH = 48;

  kpis.forEach((kpi, i) => {
    const x = m + i * (cardW + gap);

    // Card with left accent border
    doc.roundedRect(x, y, cardW, cardH, 4).fill(C.white);
    doc.roundedRect(x, y, cardW, cardH, 4).lineWidth(0.5).strokeColor(C.grayLight).stroke();
    doc.rect(x, y + 4, 3, cardH - 8).fill(kpi.accent || C.brand);

    // Label
    doc.font('Helvetica').fontSize(7).fillColor(C.grayDark)
      .text(kpi.label.toUpperCase(), x + 12, y + 8, { width: cardW - 20 });

    // Value
    doc.font('Helvetica-Bold').fontSize(14).fillColor(C.black)
      .text(kpi.value, x + 12, y + 22, { width: cardW - 20 });
  });

  return y + cardH + 14;
}

// ─── Table ────────────────────────────────────────────────────────────────────

function drawTable(doc, startY, columns, rows) {
  const m = PAGE.margin;
  const rowH = 20;
  const headerH = 24;

  const totalFlex = columns.reduce((s, c) => s + (c.flex || 1), 0);
  const colWidths = columns.map(c => (c.flex || 1) / totalFlex * CONTENT_W);

  let y = startY;
  let pageCount = 1;

  function drawTableHeader(yPos) {
    // Header background
    doc.rect(m, yPos, CONTENT_W, headerH).fill(C.brandDark);
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(C.white);
    let x = m;
    columns.forEach((col, i) => {
      doc.text(col.header.toUpperCase(), x + 6, yPos + 7, { width: colWidths[i] - 12, align: col.align || 'left', lineBreak: false });
      x += colWidths[i];
    });
    return yPos + headerH;
  }

  y = drawTableHeader(y);

  rows.forEach((row, ri) => {
    if (y + rowH > PAGE.height - 45) {
      drawFooter(doc, pageCount, '__TOTAL__');
      pageCount++;
      doc.addPage({ size: [PAGE.width, PAGE.height], margin: m });
      y = m;
      y = drawTableHeader(y);
    }

    // Zebra stripe
    if (ri % 2 === 0) {
      doc.rect(m, y, CONTENT_W, rowH).fill(C.grayBg);
    }

    // Row data
    let x = m;
    columns.forEach((col, i) => {
      const val = col.key ? (typeof col.key === 'function' ? col.key(row) : row[col.key]) : '';
      const text = val != null ? String(val) : '—';

      let color = C.black;
      if (col.color) color = col.color(row) || C.black;

      doc.font(col.bold ? 'Helvetica-Bold' : col.mono ? 'Courier' : 'Helvetica')
        .fontSize(7.5).fillColor(color)
        .text(text, x + 6, y + 6, { width: colWidths[i] - 12, align: col.align || 'left', lineBreak: false });

      x += colWidths[i];
    });

    y += rowH;

    // Subtle row divider
    doc.moveTo(m, y).lineTo(m + CONTENT_W, y).lineWidth(0.3).strokeColor(C.grayLight).stroke();
  });

  return { y, pageCount };
}

// ─── Summary bar ──────────────────────────────────────────────────────────────

function drawSummary(doc, y, items) {
  const m = PAGE.margin;

  if (y + 34 > PAGE.height - 45) return y;

  y += 8;
  doc.roundedRect(m, y, CONTENT_W, 30, 4).fill(C.brandDark);

  const segW = CONTENT_W / items.length;
  items.forEach((item, i) => {
    const x = m + i * segW;
    doc.font('Helvetica').fontSize(7).fillColor(C.grayMid)
      .text(item.label.toUpperCase(), x + 12, y + 4, { width: segW - 24, align: 'center' });
    doc.font('Helvetica-Bold').fontSize(10).fillColor(C.white)
      .text(item.value, x + 12, y + 14, { width: segW - 24, align: 'center' });
  });

  return y + 38;
}

// ─── Build PDF with page numbers ──────────────────────────────────────────────

function finalizePdf(doc, pageCount) {
  const range = doc.bufferedPageRange();
  const total = range.count;
  for (let i = 0; i < total; i++) {
    doc.switchToPage(i);
    drawFooter(doc, i + 1, total);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// REPORTE 1: Cotizaciones
// ═══════════════════════════════════════════════════════════════════════════════

async function generateCotizaciones(quotes, { filters, stages } = {}) {
  const doc = new PDFDocument({ size: [PAGE.width, PAGE.height], margin: PAGE.margin, autoFirstPage: true, bufferPages: true });
  const buffers = [];
  doc.on('data', b => buffers.push(b));

  let y = drawHeader(doc, 'Reporte de Cotizaciones', `${quotes.length} cotizaciones`, filters);

  const totalUSD = quotes.filter(q => (q.currency || 'USD') !== 'ARS').reduce((s, q) => s + (q.amount || 0), 0);
  const totalARS = quotes.filter(q => q.currency === 'ARS').reduce((s, q) => s + (q.amount || 0), 0);
  const enviados = quotes.filter(q => q.stage === 'enviado').length;
  const aceptadas = quotes.filter(q => q.stage === 'aceptada').length;

  y = drawKPIs(doc, y, [
    { label: 'Total cotizaciones', value: String(quotes.length) },
    { label: 'Enviados', value: String(enviados) },
    { label: 'Aceptadas', value: String(aceptadas) },
    { label: 'Monto USD', value: totalUSD > 0 ? fmtMoney(Math.round(totalUSD), 'USD') : '—', accent: '#1e40af' },
    { label: 'Monto ARS', value: totalARS > 0 ? fmtMoney(Math.round(totalARS), 'ARS') : '—', accent: C.success },
  ]);

  const stageMap = {};
  if (stages) stages.forEach(s => { stageMap[s.stageKey] = s.label; });

  const columns = [
    { header: 'Código',   key: 'code',       flex: 1.2, mono: true, bold: true },
    { header: 'Cliente',  key: r => truncate(r.clientName, 28), flex: 2.5 },
    { header: 'Vendedor', key: r => truncate(r.sellerName, 16), flex: 1.5 },
    { header: 'Etapa',    key: r => stageMap[r.stage] || r.stage, flex: 1.5 },
    { header: 'Tipo',     key: r => r.mailType || 'MANUAL', flex: 1 },
    { header: 'Moneda',   key: r => r.currency || 'USD', flex: 0.7 },
    { header: 'Monto',    key: r => r.amount != null ? fmtMoney(r.amount, r.currency) : '—', flex: 1.5, align: 'right', bold: true },
    { header: 'Días',     key: r => r.dias != null ? `${r.dias}d` : '—', flex: 0.6, align: 'right',
      color: r => r.dias >= 5 ? C.danger : C.black },
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

  const result = drawTable(doc, y, columns, rows);

  const summaryItems = [];
  if (totalUSD > 0) summaryItems.push({ label: 'Total USD', value: fmtMoney(Math.round(totalUSD), 'USD') });
  if (totalARS > 0) summaryItems.push({ label: 'Total ARS', value: fmtMoney(Math.round(totalARS), 'ARS') });
  summaryItems.push({ label: 'Registros', value: String(quotes.length) });
  drawSummary(doc, result.y, summaryItems);

  finalizePdf(doc);
  doc.end();
  return new Promise(resolve => doc.on('end', () => resolve(Buffer.concat(buffers))));
}


// ═══════════════════════════════════════════════════════════════════════════════
// REPORTE 2: Rechazos
// ═══════════════════════════════════════════════════════════════════════════════

async function generateRechazos(quotes, { filters } = {}) {
  const doc = new PDFDocument({ size: [PAGE.width, PAGE.height], margin: PAGE.margin, autoFirstPage: true, bufferPages: true });
  const buffers = [];
  doc.on('data', b => buffers.push(b));

  let y = drawHeader(doc, 'Análisis de Rechazos', `${quotes.length} oportunidades perdidas`, filters);

  const totalUSD = quotes.filter(q => (q.currency || 'USD') !== 'ARS').reduce((s, q) => s + (q.amount || 0), 0);
  const totalARS = quotes.filter(q => q.currency === 'ARS').reduce((s, q) => s + (q.amount || 0), 0);
  const avgDias = quotes.length
    ? Math.round(quotes.reduce((s, q) => s + Math.floor((new Date(q.updatedAt).getTime() - new Date(q.createdAt).getTime()) / (1000 * 60 * 60 * 24)), 0) / quotes.length)
    : 0;

  const reasonCounts = {};
  quotes.forEach(q => {
    const r = q.rejectReason || 'Sin especificar';
    reasonCounts[r] = (reasonCounts[r] || 0) + 1;
  });
  const topReason = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])[0];

  y = drawKPIs(doc, y, [
    { label: 'Total rechazos', value: String(quotes.length), accent: C.danger },
    { label: 'Perdido USD', value: totalUSD > 0 ? fmtMoney(Math.round(totalUSD), 'USD') : '—', accent: C.danger },
    { label: 'Perdido ARS', value: totalARS > 0 ? fmtMoney(Math.round(totalARS), 'ARS') : '—', accent: C.danger },
    { label: 'Días prom.', value: `${avgDias}d` },
    { label: 'Motivo principal', value: topReason ? truncate(topReason[0], 18) : '—' },
  ]);

  const columns = [
    { header: 'Código',   key: 'code',       flex: 1.1, mono: true, bold: true },
    { header: 'Cliente',  key: r => truncate(r.clientName, 25), flex: 2.2 },
    { header: 'Vendedor', key: r => truncate(r.sellerName, 14), flex: 1.3 },
    { header: 'Motivo',   key: r => truncate(r.rejectReason, 22), flex: 2, bold: true,
      color: () => C.danger },
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

  const result = drawTable(doc, y, columns, rows);

  const summaryItems = [];
  if (totalUSD > 0) summaryItems.push({ label: 'Perdido USD', value: fmtMoney(Math.round(totalUSD), 'USD') });
  if (totalARS > 0) summaryItems.push({ label: 'Perdido ARS', value: fmtMoney(Math.round(totalARS), 'ARS') });
  summaryItems.push({ label: 'Total rechazos', value: String(quotes.length) });
  drawSummary(doc, result.y, summaryItems);

  finalizePdf(doc);
  doc.end();
  return new Promise(resolve => doc.on('end', () => resolve(Buffer.concat(buffers))));
}


// ═══════════════════════════════════════════════════════════════════════════════
// REPORTE 3: Órdenes de Compra
// ═══════════════════════════════════════════════════════════════════════════════

async function generateOrdenes(orders, { filters, stages } = {}) {
  const doc = new PDFDocument({ size: [PAGE.width, PAGE.height], margin: PAGE.margin, autoFirstPage: true, bufferPages: true });
  const buffers = [];
  doc.on('data', b => buffers.push(b));

  let y = drawHeader(doc, 'Reporte de Órdenes de Compra', `${orders.length} órdenes`, filters);

  const stageMap = {};
  if (stages) stages.forEach(s => { stageMap[s.stageKey] = s.label; });
  const lastStage = stages?.[stages.length - 1]?.stageKey;
  const entregadas = orders.filter(o => o.stage === lastStage).length;
  const enCurso = orders.filter(o => o.stage !== lastStage).length;
  const conTracking = orders.filter(o => o.trackingNumber).length;

  y = drawKPIs(doc, y, [
    { label: 'Total órdenes', value: String(orders.length) },
    { label: 'En curso', value: String(enCurso), accent: '#D4A017' },
    { label: 'Entregadas', value: String(entregadas), accent: C.success },
    { label: 'Con tracking', value: String(conTracking) },
  ]);

  const columns = [
    { header: 'Código OC', key: 'code',         flex: 1.1, mono: true, bold: true },
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

  const result = drawTable(doc, y, columns, rows);

  drawSummary(doc, result.y, [
    { label: 'Total', value: String(orders.length) },
    { label: 'En curso', value: String(enCurso) },
    { label: 'Entregadas', value: String(entregadas) },
  ]);

  finalizePdf(doc);
  doc.end();
  return new Promise(resolve => doc.on('end', () => resolve(Buffer.concat(buffers))));
}


module.exports = {
  generateCotizaciones,
  generateRechazos,
  generateOrdenes,
};
