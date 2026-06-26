/**
 * Seed de etapas del pipeline (Fase 1 Cotizaciones + Fase 2 Órdenes de Compra)
 * Uso: node scripts/seedStages.js
 * Requiere DATABASE_URL configurado en .env o en el entorno
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const STAGES = [
  // ─── FASE 1: COTIZACIONES ─────────────────────────────────────────────
  { phase: 'COTIZACION', stageKey: 'recibida',    label: 'Solicitud Recibida',   tone: 'gray',   order: 1, mandatory: true,  maxHours: null, emailAlert: false },
  { phase: 'COTIZACION', stageKey: 'asignada',    label: 'Asignada',             tone: 'blue',   order: 2, mandatory: true,  maxHours: null, emailAlert: false },
  { phase: 'COTIZACION', stageKey: 'armado',      label: 'En Armado',            tone: 'navy',   order: 3, mandatory: false, maxHours: null, emailAlert: false },
  { phase: 'COTIZACION', stageKey: 'proveedor',   label: 'Esperando Proveedor',  tone: 'amber',  order: 4, mandatory: false, maxHours: null, emailAlert: false },
  { phase: 'COTIZACION', stageKey: 'oferta',      label: 'Oferta Técnica',       tone: 'sky',    order: 5, mandatory: false, maxHours: null, emailAlert: false },
  { phase: 'COTIZACION', stageKey: 'enviado',     label: 'Presupuesto Enviado',  tone: 'orange', order: 6, mandatory: true,  maxHours: null, emailAlert: false },
  { phase: 'COTIZACION', stageKey: 'aceptada',    label: 'Aceptada',             tone: 'green',  order: 7, mandatory: false, maxHours: null, emailAlert: false },
  { phase: 'COTIZACION', stageKey: 'rechazada',   label: 'Rechazada',            tone: 'red',    order: 8, mandatory: false, maxHours: null, emailAlert: false },

  // ─── FASE 2: ÓRDENES DE COMPRA ────────────────────────────────────────
  { phase: 'ORDEN_COMPRA', stageKey: 'oc',        label: 'OC Recibida',         tone: 'gray',   order: 1, mandatory: true,  maxHours: null, emailAlert: false },
  { phase: 'ORDEN_COMPRA', stageKey: 'np_enviada',label: 'NP Enviada',          tone: 'indigo', order: 2, mandatory: false, maxHours: null, emailAlert: false },
  { phase: 'ORDEN_COMPRA', stageKey: 'np',        label: 'NP en Flexxus',       tone: 'blue',   order: 3, mandatory: true,  maxHours: null, emailAlert: false },
  { phase: 'ORDEN_COMPRA', stageKey: 'stock',     label: 'Verificando Stock',   tone: 'amber',  order: 4, mandatory: true,  maxHours: null, emailAlert: false },
  { phase: 'ORDEN_COMPRA', stageKey: 'proveedor', label: 'Esperando Proveedor', tone: 'orange', order: 5, mandatory: false, maxHours: null, emailAlert: false },
  { phase: 'ORDEN_COMPRA', stageKey: 'armado',    label: 'Armado de Pedido',    tone: 'navy',   order: 6, mandatory: true,  maxHours: null, emailAlert: false },
  { phase: 'ORDEN_COMPRA', stageKey: 'facturada', label: 'Facturada',           tone: 'purple', order: 7, mandatory: true,  maxHours: null, emailAlert: false },
  { phase: 'ORDEN_COMPRA', stageKey: 'transito',  label: 'En Tránsito',         tone: 'sky',    order: 8, mandatory: true,  maxHours: null, emailAlert: false },
  { phase: 'ORDEN_COMPRA', stageKey: 'entregada', label: 'Entregada',           tone: 'green',  order: 9, mandatory: false, maxHours: null, emailAlert: false },
];

async function main() {
  console.log('🌱 Cargando etapas del pipeline...');
  let created = 0;
  let skipped = 0;

  for (const stage of STAGES) {
    const exists = await prisma.stageDefinition.findFirst({
      where: { phase: stage.phase, stageKey: stage.stageKey },
    });
    if (exists) {
      console.log(`  ⏭  Ya existe: [${stage.phase}] ${stage.stageKey}`);
      skipped++;
    } else {
      await prisma.stageDefinition.create({ data: stage });
      console.log(`  ✅ Creada:    [${stage.phase}] ${stage.stageKey} — ${stage.label}`);
      created++;
    }
  }

  console.log(`\nListo. ${created} etapas creadas, ${skipped} ya existían.`);
}

main()
  .catch(e => { console.error('Error:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
