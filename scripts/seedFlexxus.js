/**
 * scripts/seedFlexxus.js
 * Crea cotizaciones PRESUPUESTO de demo a partir de los PDFs Flexxus
 * que ya están en uploads/attachments.
 *
 * Uso:  node scripts/seedFlexxus.js
 */

const path = require('path');
const fs   = require('fs');
const { PrismaClient } = require('@prisma/client');
const { parseFlexxusPDF, isFlexxusPDF } = require('../src/services/flexxusParser');

const prisma = new PrismaClient();
const UPLOADS = path.join(__dirname, '..', 'uploads', 'attachments');

async function nextCode() {
  const all  = await prisma.quote.findMany({ select: { code: true } });
  const nums = all.map(r => parseInt(r.code.split('-')[2]) || 0).filter(n => !isNaN(n));
  const max  = nums.length > 0 ? Math.max(...nums) : 0;
  return `COT-2026-${String(max + 1).padStart(3, '0')}`;
}

async function main() {
  // Encontrar todos los PDFs Flexxus en uploads
  const files = fs.readdirSync(UPLOADS)
    .filter(f => isFlexxusPDF({ filename: f }))
    .map(f => path.join(UPLOADS, f));

  if (files.length === 0) {
    console.log('No se encontraron PDFs Flexxus en uploads/attachments');
    return;
  }

  for (const filePath of files) {
    const filename = path.basename(filePath);
    console.log(`\n📄 Procesando: ${filename}`);

    const buf = fs.readFileSync(filePath);
    const data = await parseFlexxusPDF(buf);

    console.log(`   NP: ${data.npCode} | CUIT: ${data.cuit} | Cliente: ${data.clientName}`);

    // Evitar duplicados por flexxusCode
    const existing = await prisma.quote.findFirst({
      where: { flexxusCode: data.npCode },
    });
    if (existing) {
      console.log(`   ⏭️  Ya existe: ${existing.code} (${data.npCode})`);
      continue;
    }

    // Buscar cliente por CUIT
    let client = null;
    if (data.cuit) {
      client = await prisma.client.findFirst({
        where: { cuit: data.cuit },
        include: { defaultSeller: true },
      });
    }
    if (!client && data.clientName) {
      client = await prisma.client.findFirst({
        where: { name: { contains: data.clientName.substring(0, 15), mode: 'insensitive' } },
        include: { defaultSeller: true },
      });
    }

    // Calcular total
    const total = data.items
      .filter(i => i.accepted)
      .reduce((s, i) => s + (i.total || 0), 0);

    const code = await nextCode();

    const quote = await prisma.quote.create({
      data: {
        code,
        clientId:    client?.id || null,
        sellerId:    client?.defaultSellerId || null,
        stage:       client ? 'asignada' : 'recibida',
        source:      'EMAIL',
        mailType:    'PRESUPUESTO',
        flexxusCode: data.npCode,
        amount:      total > 0 ? total : null,
        emailSubject: `Presupuesto ${data.npCode} — ${data.clientName || 'sin cliente'}`,
        emailFrom:   'demo@myselec.com.ar',
      },
    });

    // Crear ítems
    if (data.items.length > 0) {
      await prisma.quoteItem.createMany({
        data: data.items.map(item => ({
          quoteId:     quote.id,
          description: item.description.substring(0, 500),
          quantity:    item.quantity || 0,
          unitPrice:   item.unitPrice || null,
          total:       item.total || null,
          accepted:    item.accepted !== false,
          sortOrder:   item.sortOrder || 0,
        })),
      });
    }

    // Crear Attachment record (usa el archivo existente en uploads)
    await prisma.attachment.create({
      data: {
        filename: filename,
        path:     filePath,
        size:     fs.statSync(filePath).size,
        mimeType: 'application/pdf',
        quoteId:  quote.id,
      },
    });

    // Activity log
    await prisma.activity.create({
      data: {
        action:  'CREATED',
        detail:  client
          ? `Cotización ${code} [${data.npCode}] ingresada desde PDF Flexxus — ${client.name}`
          : `Cotización ${code} [${data.npCode}] ingresada desde PDF Flexxus — cliente sin asignar (${data.clientName})`,
        quoteId: quote.id,
      },
    });

    console.log(`   ✅ Creada ${code} → ${client?.name || data.clientName || 'sin cliente'} | ${data.items.length} ítems | Total: U$S ${total.toFixed(2)}`);
  }

  console.log('\n✅ Done');
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
