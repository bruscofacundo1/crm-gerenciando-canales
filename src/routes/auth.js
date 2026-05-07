const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const crypto   = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { sendPasswordReset } = require('../services/mailer');

const router = express.Router();
const prisma  = new PrismaClient();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña requeridos' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.active) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role, zone: user.zone },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, zone: user.zone }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// GET /api/auth/me
const { authMiddleware } = require('../middleware/auth');
router.get('/me', authMiddleware, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, name: true, email: true, role: true, zone: true }
  });
  res.json(user);
});

// POST /api/auth/forgot-password — genera token y envía mail
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email requerido' });

    const user = await prisma.user.findUnique({ where: { email } });
    // Siempre responder OK para no revelar si existe el email
    if (!user || !user.active) return res.json({ ok: true });

    // Invalidar tokens previos del usuario
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, used: false },
      data: { used: true },
    });

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora
    await prisma.passwordResetToken.create({ data: { token, userId: user.id, expiresAt } });

    const baseUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;
    await sendPasswordReset(email, `${baseUrl}/?reset=${token}`);

    res.json({ ok: true });
  } catch (err) {
    console.error('forgot-password error:', err);
    res.status(500).json({ error: 'Error al enviar mail de recuperación' });
  }
});

// POST /api/auth/reset-password — valida token y cambia contraseña
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: 'token y password requeridos' });
    if (password.length < 6) return res.status(400).json({ error: 'Mínimo 6 caracteres' });

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    });
    if (!resetToken || resetToken.used || resetToken.expiresAt < new Date()) {
      return res.status(400).json({ error: 'Token inválido o expirado' });
    }

    const hashed = await bcrypt.hash(password, 10);
    await prisma.user.update({ where: { id: resetToken.userId }, data: { password: hashed } });
    await prisma.passwordResetToken.update({ where: { token }, data: { used: true } });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
