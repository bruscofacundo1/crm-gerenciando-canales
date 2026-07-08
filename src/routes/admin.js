const express = require('express');
const fs = require('fs');
const crypto = require('crypto');
const { authMiddleware, isDeveloper } = require('../middleware/auth');
const { parseFlexxusPDF, isFlexxusPDF, isNotaPedidoPDF, parseNotaPedidoPDF } = require('../services/flexxusParser');
const prisma = require('../db');

const router = express.Router();

// Cache en memoria para preview pendiente de reparseo
const reparsePreviewCache = new Map(); // token → { results, expiresAt }

function requireDeveloper(req, res, next) {
  if (!isDeveloper(req.user)) return res.status(403).json({ error: 'Solo desarrolladores' });
  next();
}

// GET /api/admin/reparse-candidates — lista todas las cotizaciones Flexxus reparseables
router.get('/reparse-candidates', authMiddleware, requireDeveloper, async (req, res) => {
  try {
    const quotes = await prisma.quote.findMany({
      where: { mailType: { in: ['PRESUPUESTO', 'NOTA_PEDIDO'] } },
      select: {
        id: true, code: true, mailType: true, flexxusCode: true, createdAt: true,
        client: { select: { name: true } },
        _count: { select: { items: true, attachments: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(quotes.map(q => ({
      id: q.id, code: q.code, mailType: q.mailType, flexxusCode: q.flexxusCode,
      createdAt: q.createdAt, clientName: q.client?.name || null,
      itemsCount: q._count.items, attachmentsCount: q._count.attachments,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper: encuentra el adjunto que es el PDF real de Flexxus para esta quote (mailType)
async function findFlexxusAttachment(quoteId, mailType) {
  const attachments = await prisma.attachment.findMany({ where: { quoteId } });
  const check = mailType === 'NOTA_PEDIDO' ? isNotaPedidoPDF : isFlexxusPDF;
  return attachments.find(a => check({ filename: a.originalName || a.filename })) || null;
}

// Helper: reparsea una quote puntual. No escribe nada — devuelve el resultado.
async function reparseOne(quote, catalog) {
  const att = await findFlexxusAttachment(quote.id, quote.mailType);
  if (!att) return { id: quote.id, code: quote.code, mailType: quote.mailType, ok: false, items: [], error: 'No se encontró el PDF de Flexxus entre los adjuntos' };
  if (!fs.existsSync(att.path)) return { id: quote.id, code: quote.code, mailType: quote.mailType, ok: false, items: [], error: 'El archivo del adjunto ya no existe en disco' };

  const buffer = fs.readFileSync(att.path);
  const parsed = quote.mailType === 'NOTA_PEDIDO'
    ? await parseNotaPedidoPDF(buffer, { catalog })
    : await parseFlexxusPDF(buffer, { catalog });

  const items = (parsed.items || []).map((item, i) => ({
    sku:         item.sku || null,
    description: (item.description || '').substring(0, 500),
    quantity:    item.quantity || 0,
    unit:        item.unit || null,
    unitPrice:   item.unitPrice || null,
    total:       item.total || null,
    accepted:    item.accepted !== false,
    sortOrder:   i,
  }));
  const sumItems = items.reduce((s, it) => s + (it.total || 0), 0);

  // Matcheo de cliente por CUIT — solo si la quote no tiene cliente ya asignado
  let matchedClient = null;
  if (!quote.clientId && parsed.cuit) {
    matchedClient = await prisma.client.findFirst({ where: { cuit: { equals: parsed.cuit, mode: 'insensitive' } } });
  }

  return {
    id: quote.id, code: quote.code, mailType: quote.mailType, ok: true,
    attachmentName: att.originalName || att.filename,
    cuit: parsed.cuit || null,
    clientNameParsed: parsed.clientName || null,
    currentClientName: quote.client?.name || null,
    matchedClient: matchedClient ? { id: matchedClient.id, name: matchedClient.name } : null,
    oldItemsCount: quote._count.items,
    newItemsCount: items.length,
    subtotalNeto: parsed.subtotalNeto ?? null,
    sumItems: parseFloat(sumItems.toFixed(2)),
    amountsMatch: parsed.subtotalNeto != null && Math.abs(sumItems - parsed.subtotalNeto) <= 0.02,
    currency: parsed.currency || 'USD',
    items,
    _parsed: parsed,
  };
}

// POST /api/admin/reparse-preview — dry-run sobre las quotes elegidas, no escribe nada
router.post('/reparse-preview', authMiddleware, requireDeveloper, async (req, res) => {
  try {
    const { quoteIds } = req.body;
    if (!Array.isArray(quoteIds) || quoteIds.length === 0) {
      return res.status(400).json({ error: 'quoteIds requerido (array no vacío)' });
    }

    const catalog = await prisma.article.findMany({ select: { code: true, description: true } });
    const quotes = await prisma.quote.findMany({
      where: { id: { in: quoteIds } },
      include: { client: { select: { name: true } }, _count: { select: { items: true } } },
    });

    const results = [];
    for (const q of quotes) {
      results.push(await reparseOne(q, catalog));
    }

    const token = crypto.randomBytes(16).toString('hex');
    reparsePreviewCache.set(token, { results, expiresAt: Date.now() + 30 * 60 * 1000 });
    for (const [k, v] of reparsePreviewCache) if (v.expiresAt < Date.now()) reparsePreviewCache.delete(k);

    res.json({
      token,
      results: results.map(({ _parsed, items, ...r }) => ({ ...r, itemsPreview: (items || []).slice(0, 5) })),
    });
  } catch (err) {
    console.error('reparse-preview error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/reparse-apply — aplica el preview cacheado por token
router.post('/reparse-apply', authMiddleware, requireDeveloper, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token requerido' });
    const cached = reparsePreviewCache.get(token);
    if (!cached || cached.expiresAt < Date.now()) {
      return res.status(400).json({ error: 'El preview expiró. Volvé a generarlo.' });
    }
    reparsePreviewCache.delete(token);

    let applied = 0, skipped = 0;
    const applyLog = [];
    for (const r of cached.results) {
      if (!r.ok) { skipped++; continue; }
      const parsed = r._parsed;

      const updateData = {
        subtotalNeto:      parsed.subtotalNeto ?? null,
        ivaAmount:         parsed.ivaAmount ?? null,
        totalPercepciones: parsed.totalPercepciones ?? null,
        amount:            parsed.total ?? null,
      };
      if (r.mailType === 'NOTA_PEDIDO') updateData.currency = r.currency;
      if (r.matchedClient) {
        updateData.clientId = r.matchedClient.id;
        const seller = await prisma.client.findUnique({ where: { id: r.matchedClient.id }, select: { defaultSellerId: true } });
        if (seller?.defaultSellerId) updateData.sellerId = seller.defaultSellerId;
      }

      await prisma.$transaction([
        prisma.quoteItem.deleteMany({ where: { quoteId: r.id } }),
        prisma.quoteItem.createMany({ data: r.items.map(it => ({ ...it, quoteId: r.id })) }),
        prisma.quote.update({ where: { id: r.id }, data: updateData }),
      ]);

      applyLog.push(`${r.code} (${r.oldItemsCount}→${r.newItemsCount} items${r.matchedClient ? `, cliente: ${r.matchedClient.name}` : ''})`);
      applied++;
    }

    console.log(`[AUDIT] Usuario ${req.user.email} (${req.user.id}) reparseó ${applied} cotización(es) el ${new Date().toISOString()}: ${applyLog.join(' | ')}`);

    res.json({ ok: true, applied, skipped });
  } catch (err) {
    console.error('reparse-apply error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
