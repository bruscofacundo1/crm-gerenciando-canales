const express = require('express');
const bcrypt  = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
const prisma  = new PrismaClient();

const adminOnly = (req, res, next) => {
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Solo administradores' });
  next();
};

// GET /api/users — lista usuarios (admin: todos, vendedor: solo activos básico)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, email: true, role: true, zone: true, active: true, createdAt: true },
    });

    // Enriquecer con stats solo para admin
    if (req.user.role === 'ADMIN') {
      const enriched = await Promise.all(users.map(async u => {
        const [cotiz, ganadas, ocs, clientes] = await Promise.all([
          prisma.quote.count({ where: { sellerId: u.id } }),
          prisma.quote.count({ where: { sellerId: u.id, stage: 'aceptada' } }),
          prisma.order.count({ where: { sellerId: u.id } }),
          prisma.client.count({ where: { defaultSellerId: u.id } }),
        ]);
        return { ...u, cotiz, ganadas, ocs, clientes };
      }));
      return res.json(enriched);
    }

    res.json(users.filter(u => u.active).map(u => ({
      id: u.id, name: u.name, email: u.email, role: u.role, zone: u.zone
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users — crear usuario (admin only)
router.post('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { name, email, password, role = 'VENDEDOR', zone } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'name, email y password son requeridos' });

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return res.status(400).json({ error: 'Ya existe un usuario con ese email' });

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email, password: hashed, role, zone: zone || null },
      select: { id: true, name: true, email: true, role: true, zone: true, active: true, createdAt: true },
    });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/users/:id — actualizar usuario (admin only)
router.put('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { name, email, role, zone, password } = req.body;
    const data = {};
    if (name)  data.name  = name;
    if (email) data.email = email;
    if (role)  data.role  = role;
    if (zone !== undefined) data.zone = zone || null;
    if (password) data.password = await bcrypt.hash(password, 10);

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data,
      select: { id: true, name: true, email: true, role: true, zone: true, active: true, createdAt: true },
    });
    res.json(user);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Usuario no encontrado' });
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/users/:id/toggle — activar/desactivar (admin only)
router.patch('/:id/toggle', authMiddleware, adminOnly, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (user.id === req.user.id) return res.status(400).json({ error: 'No podés desactivarte a vos mismo' });

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { active: !user.active },
      select: { id: true, name: true, active: true },
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/users/:id/password — cambiar contraseña (admin o el propio usuario)
router.patch('/:id/password', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN' && req.user.id !== req.params.id) {
      return res.status(403).json({ error: 'Sin permiso' });
    }
    const { password } = req.body;
    if (!password || password.length < 6) return res.status(400).json({ error: 'Contraseña mínimo 6 caracteres' });
    const hashed = await bcrypt.hash(password, 10);
    await prisma.user.update({ where: { id: req.params.id }, data: { password: hashed } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
