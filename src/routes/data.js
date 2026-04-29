const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/data/users
router.get('/users', authMiddleware, async (req, res) => {
  const users = await prisma.user.findMany({
    where: { active: true },
    select: { id: true, name: true, email: true, role: true, zone: true },
    orderBy: { name: 'asc' },
  });
  res.json(users);
});

// GET /api/data/stages
router.get('/stages', authMiddleware, async (req, res) => {
  const stages = await prisma.stageDefinition.findMany({
    where: { active: true },
    orderBy: [{ phase: 'asc' }, { order: 'asc' }],
  });
  const f1 = stages.filter(s => s.phase === 'COTIZACION').map(s => ({ id: s.stageKey, label: s.label, tone: s.tone, mandatory: s.mandatory, maxHours: s.maxHours }));
  const f2 = stages.filter(s => s.phase === 'ORDEN_COMPRA').map(s => ({ id: s.stageKey, label: s.label, tone: s.tone, mandatory: s.mandatory, maxHours: s.maxHours }));
  res.json({ f1, f2 });
});

// GET /api/data/activity
router.get('/activity', authMiddleware, async (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  const activities = await prisma.activity.findMany({
    take: limit,
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { id: true, name: true } } },
  });
  const formatted = activities.map(a => ({
    at: a.createdAt.toISOString(),
    by: a.userId,
    byName: a.user?.name || 'Sistema',
    text: a.detail,
  }));
  res.json(formatted);
});

// GET /api/data/rejection-reasons
router.get('/rejection-reasons', authMiddleware, async (req, res) => {
  const reasons = await prisma.rejectionReason.findMany({
    where: { active: true },
    orderBy: { order: 'asc' },
  });
  res.json(reasons);
});

// GET /api/data/dashboard - Stats for admin dashboard
router.get('/dashboard', authMiddleware, async (req, res) => {
  try {
    const [totalQuotes, sentQuotes, activeOrders, deliveredOrders] = await Promise.all([
      prisma.quote.count({ where: { stage: { notIn: ['aceptada', 'rechazada'] } } }),
      prisma.quote.count({ where: { stage: 'enviado' } }),
      prisma.order.count({ where: { stage: { notIn: ['entregada'] } } }),
      prisma.order.count({ where: { stage: 'entregada' } }),
    ]);

    const totalAmount = await prisma.quote.aggregate({
      _sum: { amount: true },
      where: { amount: { not: null } },
    });

    const accepted = await prisma.quote.count({ where: { stage: 'aceptada' } });
    const total = await prisma.quote.count();
    const conversionRate = total > 0 ? Math.round((accepted / total) * 100) : 0;

    res.json({
      cotizacionesActivas: totalQuotes,
      presupuestosEnviados: sentQuotes,
      ocEnCurso: activeOrders,
      entregasEsteMes: deliveredOrders,
      montoTotal: totalAmount._sum.amount || 0,
      tasaConversion: conversionRate,
    });
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
});

module.exports = router;
