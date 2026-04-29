const express = require('express');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { syncMails, listRecentMails } = require('../services/mailReader');

const router = express.Router();

// POST /api/mail/sync - Trigger mail sync (creates quotes from new emails)
router.post('/sync', authMiddleware, requireRole('ADMIN'), async (req, res) => {
  try {
    console.log('📧 Manual mail sync triggered...');
    const result = await syncMails();
    res.json(result);
  } catch (err) {
    console.error('Mail sync error:', err);
    res.status(500).json({ error: 'Error al sincronizar mails', detail: err.message });
  }
});

// GET /api/mail/inbox - List recent emails
router.get('/inbox', authMiddleware, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const mails = await listRecentMails(limit);
    res.json(mails);
  } catch (err) {
    console.error('Inbox error:', err);
    res.status(500).json({ error: 'Error al leer bandeja' });
  }
});

module.exports = router;
