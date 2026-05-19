/**
 * Agrega el stage "np_enviada" (NP Enviada) a las Órdenes de Compra.
 * Correr una sola vez: node scripts/seed-np-stage.js
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Buscar el mayor order actual en ORDEN_COMPRA
  const stages = await prisma.stageDefinition.findMany({
    where: { phase: 'ORDEN_COMPRA' },
    orderBy: { order: 'asc' },
  });

  console.log('Stages actuales ORDEN_COMPRA:');
  stages.forEach(s => console.log(`  ${s.order}. ${s.stageKey} — ${s.label}`));

  // Insertar después del stage "oc" (order 1 o 2 típicamente)
  const ocStage   = stages.find(s => s.stageKey === 'oc');
  const insertAt  = (ocStage?.order ?? 1) + 1;

  // Hacer espacio: mover todos los stages con order >= insertAt
  for (const s of stages.filter(s => s.order >= insertAt)) {
    await prisma.stageDefinition.update({
      where: { id: s.id },
      data:  { order: s.order + 1 },
    });
  }

  // Upsert del stage np_enviada
  await prisma.stageDefinition.upsert({
    where:  { phase_stageKey: { phase: 'ORDEN_COMPRA', stageKey: 'np_enviada' } },
    create: {
      phase:    'ORDEN_COMPRA',
      stageKey: 'np_enviada',
      label:    'NP Enviada',
      tone:     'indigo',
      order:    insertAt,
      mandatory: false,
      active:   true,
    },
    update: {
      label:  'NP Enviada',
      tone:   'indigo',
      order:  insertAt,
      active: true,
    },
  });

  console.log(`\n✅ Stage "np_enviada" (NP Enviada) agregado en posición ${insertAt}`);

  const updated = await prisma.stageDefinition.findMany({
    where:   { phase: 'ORDEN_COMPRA' },
    orderBy: { order: 'asc' },
  });
  console.log('\nStages ORDEN_COMPRA actualizados:');
  updated.forEach(s => console.log(`  ${s.order}. ${s.stageKey} — ${s.label}`));
}

main()
  .then(() => prisma.$disconnect())
  .catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });
