const { Resend } = require('resend');

// Dirección remitente: configurá MAIL_FROM en Railway para usar tu propio dominio.
// Sin dominio verificado en Resend, solo podés enviar a tu propia cuenta de Resend.
// Ejemplo: MAIL_FROM=MySelec CRM <noreply@myselec.com>
const FROM_ADDRESS = process.env.MAIL_FROM || 'MySelec CRM <onboarding@resend.dev>';

let _resend = null;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

// Convierte "a@x.com, b@x.com" o un array en array limpio
function toArray(to) {
  if (Array.isArray(to)) return to.map(s => s.trim()).filter(Boolean);
  return String(to).split(',').map(s => s.trim()).filter(Boolean);
}

// Reemplaza {{key}} en template con valores del objeto ctx
function renderTemplate(text, ctx) {
  return text.replace(/\{\{([\w.]+)\}\}/g, (_, key) => {
    const parts = key.split('.');
    let val = ctx;
    for (const p of parts) val = val?.[p];
    return val ?? '';
  });
}

async function sendMail({ to, subject, html, text }) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('⚠️  Mailer: RESEND_API_KEY no configurado, mail omitido.');
    return;
  }
  const resend = getResend();
  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: toArray(to),
    subject,
    html: html || `<pre>${text || ''}</pre>`,
    text: text || '',
  });
  if (error) {
    const err = new Error(error.message || 'Resend error');
    err.code = error.name;
    throw err;
  }
}

async function sendPasswordReset(toEmail, resetUrl) {
  await sendMail({
    to: toEmail,
    subject: 'Recuperar contraseña · MySelec CRM',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#1B2A4A">Recuperar contraseña</h2>
        <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en MySelec CRM.</p>
        <p>
          <a href="${resetUrl}"
             style="display:inline-block;padding:12px 24px;background:#3B82F6;color:white;text-decoration:none;border-radius:8px;font-weight:600">
            Restablecer contraseña
          </a>
        </p>
        <p style="color:#64748B;font-size:13px">Este link expira en 1 hora. Si no solicitaste esto, ignorá este mail.</p>
      </div>
    `,
  });
}

async function sendNotification({ toEmails, subject, body, ctx }) {
  const renderedSubject = renderTemplate(subject, ctx);
  const renderedBody    = renderTemplate(body,    ctx);
  await sendMail({
    to: toEmails,
    subject: renderedSubject,
    html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;white-space:pre-wrap">${renderedBody}</div>`,
    text: renderedBody,
  });
}

// Verifica la configuración de Resend — útil para diagnóstico desde el admin panel
async function verifySmtp() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY no configurado');
  }
  const resend = getResend();
  // Llama a la API de Resend para verificar que la API key sea válida
  const { data, error } = await resend.domains.list();
  if (error) {
    const err = new Error(error.message || 'Resend API error');
    err.code = error.name;
    throw err;
  }
  const domains = (data?.data || []).map(d => d.name);
  return { provider: 'resend', from: FROM_ADDRESS, domains };
}

module.exports = { sendMail, sendPasswordReset, sendNotification, renderTemplate, verifySmtp };
