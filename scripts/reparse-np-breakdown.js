/**
 * Reparsea todas las Notas de Pedido existentes (mailType: 'NOTA_PEDIDO')
 * que tengan un adjunto PDF de Flexxus, y actualiza en la DB:
 *   - subtotalNeto
 *   - ivaAmount
 *   - totalPercepciones
 *   - amount (total) — si no estaba seteado
 *
 * Correr una sola vez: node scripts/reparse-np-breakdown.js
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const fs   = require('fs');
const path = require('path');
const { parseNotaPedidoPDF, isNotaPedidoPDF } = require('../src/services/flexxusParser');

const prisma = new PrismaClient();
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads', 'attachments');

async function main() {
  console.log('🔍 Buscando Notas de Pedido con adjuntos PDF...\n');

  // Traer todas las NPs con sus adjuntos
  const nps = await prisma.quote.findMany({
    where: { mailType: 'NOTA_PEDIDO' },
    include: {
      attachments: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`📋 Total NOTA_PEDIDO encontradas: ${nps.length}\n`);

  let updated = 0;
  let skipped = 0;
  let errors  = 0;

  for (const np of nps) {
    // Buscar el primer adjunto PDF de Nota de Pedido Flexxus
    const pdfAtt = np.attachments.find(a =>
      a.filename && (
        isNotaPedidoPDF({ filename: a.filename }) ||
        a.filename.toLowerCase().endsWith('.pdf')
      )
    );

    if (!pdfAtt) {
      console.log(`  ⏭  ${np.code} — sin adjunto PDF, omitido`);
      skipped++;
      continue;
    }

    // Construir path absoluto del archivo
    const filePath = pdfAtt.path || path.join(UPLOADS_DIR, pdfAtt.filename);

    if (!fs.existsSync(filePath)) {
      console.log(`  ⚠️  ${np.code} — archivo no encontrado: ${filePath}`);
      skipped++;
      continue;
    }

    try {
      const buffer = fs.readFileSync(filePath);
      const data   = await parseNotaPedidoPDF(buffer);

      // Solo actualizar si se extrajo al menos un valor de breakdown
      const hasBreakdown = data.subtotalNeto != null || data.ivaAmount != null || data.total != null;
      if (!hasBreakdown) {
        console.log(`  ⏭  ${np.code} — PDF sin datos de breakdown extraíbles`);
        skipped++;
        continue;
      }

      const updateData = {};
      if (data.subtotalNeto      != null) updateData.subtotalNeto      = data.subtotalNeto;
      if (data.ivaAmount         != null) updateData.ivaAmount         = data.ivaAmount;
      if (data.totalPercepciones != null) updateData.totalPercepciones = data.totalPercepciones;
      // Actualizar amount solo si no estaba seteado
      if (data.total != null && !np.amount)  updateData.amount = data.total;
      // Actualizar flexxusCode si el NP lo tiene y no estaba
      if (data.npCode && !np.flexxusCode)    updateData.flexxusCode = data.npCode;

      await prisma.quote.update({
        where: { id: np.id },
        data:  updateData,
      });

      console.log(
        `  ✅ ${np.code} (${pdfAtt.filename})` +
        `\n     Subtotal: ${data.subtotalNeto ?? '—'}` +
        ` | IVA: ${data.ivaAmount ?? '—'}` +
        ` | Perc: ${data.totalPercepciones ?? '—'}` +
        ` | Total: ${data.total ?? '—'}`
      );
      updated++;

    } catch (err) {
      console.error(`  ❌ ${np.code} — error: ${err.message}`);
      errors++;
    }
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✅ Actualizadas: ${updated}`);
  console.log(`⏭  Omitidas:    ${skipped}`);
  console.log(`❌ Errores:      ${errors}`);
}

main()
  .catch(err => { console.error('Error fatal:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
