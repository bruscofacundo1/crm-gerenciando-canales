const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/orders
router.get('/', authMiddleware, async (req, res) => {
  try {
    const where = {};
    if (req.user.role === 'VENDEDOR') where.sellerId = req.user.id;

    const orders = await prisma.order.findMany({
      where,
      include: {
        client: { select: { code: true, name: true, city: true, province: true } },
        seller: { select: { id: true, name: true } },
        fromQuote: { select: { code: true } },
        _count: { select: { notes: true, attachments: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formatted = orders.map(o => ({
      id: o.id,
      code: o.code,
      client: o.client?.code || '',
      clientName: o.client?.name || '',
      seller: o.sellerId || '',
      sellerName: o.seller?.name || '',
      stage: o.stage,
      fromQuote: o.fromQuote?.code || '',
      entrega: o.deliveryType || 'AMBA',
      transp: o.carrier || '—',
      flexxus: o.flexxusCode || '',
      fecha: o.createdAt.toISOString(),
      guia: o.trackingNumber || '',
      invoiceIssued: o.invoiceIssued,
      waybillReceived: o.waybillReceived,
    }));

    res.json(formatted);
  } catch (err) {
    console.error('Error fetching orders:', err);
    res.status(500).json({ error: 'Error' });
  }
});

// PATCH /api/orders/:id/stage
router.patch('/:id/stage', authMiddleware, async (req, res) => {
  try {
    const { stage } = req.body;
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order) return res.status(404).json({ error: 'OC no encontrada' });

    const oldStage = order.stage;
    const updated = await prisma.order.update({
      where: { id: req.params.id },
      data: { stage },
    });

    await prisma.activity.create({
      data: {
        action: 'STAGE_CHANGE',
        detail: `Movió ${order.code} de ${oldStage} a ${stage}`,
        userId: req.user.id,
        orderId: order.id,
      },
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
});

module.exports = router;
