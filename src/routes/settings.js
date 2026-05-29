const express = require('express');
const { authMiddleware, requireRole } = require('../middleware/auth');
const prisma = require('../db');

const router = express.Router();

const DEFAULTS = {
  // ── Mail sync ─────────────────────────────────────────────────────────────
  mail_sync_interval_hours:    '2',
  mail_lookback_days:          '2',
  mail_sync_enabled:           'true',

  // ── Etapas de entrada ────────────────────────────────────────────────────
  default_stage_solicitud:     'recibida',
  default_stage_presupuesto:   'enviado',
  default_stage_nota_pedido:   'np_enviada',

  // ── Acceso ───────────────────────────────────────────────────────────────
  allowed_email_domains:       'myselec.com,myselec.com.ar,gmail.com',
  // Correos individuales autorizados aunque su dominio no esté en la lista anterior.
  // Útil para admins/devs con Gmail u otros dominios externos.
  allowed_emails:              '',

  // ── Tiempos de seguimiento ───────────────────────────────────────────────
  // Días tras enviar un presupuesto para marcar seguimiento pendiente (banner naranja)
  follow_up_days:              '4',

  // ── Alertas en panel (inbox CRM) ─────────────────────────────────────────
  // Días sin actividad para mostrar una cotización como alerta en el panel del CRM.
  // Se controla client-side; el usuario lo ve cada vez que abre el inbox.
  idle_inbox_days:             '5',

  // ── Recordatorio por mail al vendedor ────────────────────────────────────
  // Días sin actividad para enviar un mail recordatorio al vendedor (una vez por día).
  // Recomendado: valor mayor que idle_inbox_days para evitar spam.
  idle_email_days:             '7',

  // ── Resumen semanal ───────────────────────────────────────────────────────
  weekly_report_enabled:       'true',
  weekly_report_day:           '1',
  weekly_report_hour:          '9',

  // ── Notificaciones por mail (sistema) ────────────────────────────────────
  // Mail a admins cuando alguien se registra (solicitud de acceso)
  notify_new_register:         'true',
  // Mail al vendedor cuando su cotización supera el tiempo de etapa configurado
  notify_stage_alert:          'true',
  // Mail global cuando llega un email sin cliente asignado (complementa campana por usuario)
  notify_unassigned_mail:      'true',

  // ── Alertas in-app (campanita) ───────────────────────────────────────────
  inapp_unassigned_quotes:     'true',   // Solicitudes sin vendedor asignado
  inapp_unlinked_presupuestos: 'true',   // Presupuestos sin vincular a solicitud
  inapp_pending_users:         'true',   // Usuarios esperando aprobación
  inapp_overdue_stages:        'true',   // Ítems con tiempo de etapa excedido
  inapp_idle_quotes:           'true',   // Cotizaciones sin actividad
  inapp_follow_up:             'true',   // Seguimientos vencidos (vendedor)
};

// GET /api/settings — devuelve todos los settings con defaults
router.get('/', authMiddleware, requireRole('ADMIN'), async (req, res) => {
  try {
    const rows = await prisma.appSetting.findMany();
    const map  = Object.fromEntries(rows.map(r => [r.key, r.value]));
    res.json({ ...DEFAULTS, ...map });
  } catch (err) {
    res.status(500).json({ error: 'Error al leer configuración' });
  }
});

// PATCH /api/settings — guarda uno o varios settings
router.patch('/', authMiddleware, requireRole('ADMIN'), async (req, res) => {
  try {
    const updates = req.body; // { key: value, ... }
    for (const [key, value] of Object.entries(updates)) {
      await prisma.appSetting.upsert({
        where:  { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      });
    }
    const rows = await prisma.appSetting.findMany();
    const map  = Object.fromEntries(rows.map(r => [r.key, r.value]));
    res.json({ ...DEFAULTS, ...map });
  } catch (err) {
    res.status(500).json({ error: 'Error al guardar configuración' });
  }
});

module.exports = router;
