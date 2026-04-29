const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const XLSX = require('xlsx');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...\n');

  // ─── 1. Usuarios ───
  console.log('👥 Creating users...');
  const hash = await bcrypt.hash('myselec2026', 10);
  
  const users = await Promise.all([
    prisma.user.upsert({ where: { email: 'victoria@myselec.com.ar' }, update: {}, create: { name: 'Victoria López', email: 'victoria@myselec.com.ar', password: hash, role: 'ADMIN', zone: null }}),
    prisma.user.upsert({ where: { email: 'diego@myselec.com.ar' }, update: {}, create: { name: 'Diego Gómez', email: 'diego@myselec.com.ar', password: hash, role: 'ADMIN', zone: null }}),
    prisma.user.upsert({ where: { email: 'luciano@myselec.com.ar' }, update: {}, create: { name: 'Luciano Pérez', email: 'luciano@myselec.com.ar', password: hash, role: 'VENDEDOR', zone: 'AMBA Sur' }}),
    prisma.user.upsert({ where: { email: 'santiago@myselec.com.ar' }, update: {}, create: { name: 'Santiago Ruiz', email: 'santiago@myselec.com.ar', password: hash, role: 'VENDEDOR', zone: 'Interior Oeste' }}),
    prisma.user.upsert({ where: { email: 'felipe@myselec.com.ar' }, update: {}, create: { name: 'Felipe Morales', email: 'felipe@myselec.com.ar', password: hash, role: 'VENDEDOR', zone: 'AMBA Norte' }}),
    prisma.user.upsert({ where: { email: 'depo1@myselec.com.ar' }, update: {}, create: { name: 'Mariela Ibarra', email: 'depo1@myselec.com.ar', password: hash, role: 'LOGISTICA', zone: 'Depósito Central' }}),
  ]);
  console.log(`   ✅ ${users.length} users created`);

  // Map for quick lookup
  const userMap = {};
  users.forEach(u => { userMap[u.email.split('@')[0]] = u.id; });

  // ─── 2. Etapas Fase 1 (Cotización) ───
  console.log('📋 Creating stage definitions...');
  const stagesF1 = [
    { phase: 'COTIZACION', stageKey: 'recibida',   label: 'Solicitud Recibida',  tone: 'gray',   order: 1, mandatory: true,  maxHours: 4 },
    { phase: 'COTIZACION', stageKey: 'asignada',   label: 'Asignada',            tone: 'blue',   order: 2, mandatory: true,  maxHours: null },
    { phase: 'COTIZACION', stageKey: 'armado',     label: 'En Armado',           tone: 'navy',   order: 3, mandatory: true,  maxHours: 24 },
    { phase: 'COTIZACION', stageKey: 'proveedor',  label: 'Esperando Proveedor', tone: 'amber',  order: 4, mandatory: false, maxHours: 48 },
    { phase: 'COTIZACION', stageKey: 'oferta',     label: 'Oferta Técnica',      tone: 'sky',    order: 5, mandatory: false, maxHours: null },
    { phase: 'COTIZACION', stageKey: 'enviado',    label: 'Presupuesto Enviado', tone: 'orange', order: 6, mandatory: true,  maxHours: null },
    { phase: 'COTIZACION', stageKey: 'aceptada',   label: 'Aceptada',            tone: 'green',  order: 7, mandatory: false, maxHours: null },
    { phase: 'COTIZACION', stageKey: 'rechazada',  label: 'Rechazada',           tone: 'red',    order: 8, mandatory: false, maxHours: null },
  ];

  const stagesF2 = [
    { phase: 'ORDEN_COMPRA', stageKey: 'oc',         label: 'OC Recibida',         tone: 'gray',   order: 1, mandatory: true,  maxHours: null },
    { phase: 'ORDEN_COMPRA', stageKey: 'np',         label: 'NP en Flexxus',       tone: 'blue',   order: 2, mandatory: true,  maxHours: 24 },
    { phase: 'ORDEN_COMPRA', stageKey: 'stock',      label: 'Verificando Stock',   tone: 'amber',  order: 3, mandatory: true,  maxHours: null },
    { phase: 'ORDEN_COMPRA', stageKey: 'proveedor',  label: 'Esperando Proveedor', tone: 'orange', order: 4, mandatory: false, maxHours: null },
    { phase: 'ORDEN_COMPRA', stageKey: 'armado',     label: 'Armado de Pedido',    tone: 'navy',   order: 5, mandatory: true,  maxHours: null },
    { phase: 'ORDEN_COMPRA', stageKey: 'facturada',  label: 'Facturada',           tone: 'purple', order: 6, mandatory: true,  maxHours: 48 },
    { phase: 'ORDEN_COMPRA', stageKey: 'transito',   label: 'En Tránsito',         tone: 'sky',    order: 7, mandatory: true,  maxHours: null },
    { phase: 'ORDEN_COMPRA', stageKey: 'entregada',  label: 'Entregada',           tone: 'green',  order: 8, mandatory: false, maxHours: null },
  ];

  for (const s of [...stagesF1, ...stagesF2]) {
    await prisma.stageDefinition.upsert({
      where: { phase_stageKey: { phase: s.phase, stageKey: s.stageKey } },
      update: {},
      create: s,
    });
  }
  console.log(`   ✅ ${stagesF1.length + stagesF2.length} stages created`);

  // ─── 3. Motivos de rechazo ───
  console.log('❌ Creating rejection reasons...');
  const reasons = [
    { label: 'Precio', order: 1 },
    { label: 'Plazo de entrega', order: 2 },
    { label: 'Condición de pago', order: 3 },
    { label: 'Competencia', order: 4 },
    { label: 'Sin respuesta', order: 5 },
    { label: 'Otro', order: 6 },
  ];
  for (const r of reasons) {
    await prisma.rejectionReason.create({ data: r }).catch(() => {});
  }
  console.log(`   ✅ ${reasons.length} rejection reasons created`);

  // ─── 4. Clientes desde Excel ───
  console.log('🏢 Importing clients from Excel...');
  const vendedorIds = [userMap.luciano, userMap.santiago, userMap.felipe, userMap.victoria];
  
  try {
    const wb = XLSX.readFile(path.join(__dirname, '..', 'DA_MY-LISTA_DE_CLIENTES_CON_MAILS.xlsx'));
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    
    let imported = 0;
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r[1]) continue; // Skip empty rows
      
      const name = String(r[1] || '').trim();
      const cuit = String(r[2] || '').trim();
      const email = String(r[11] || '').trim();
      const domain = email ? email.split('@')[1] || null : null;
      
      const code = `CLI-${String(i).padStart(3, '0')}`;
      
      await prisma.client.upsert({
        where: { code },
        update: {},
        create: {
          code,
          name,
          cuit: cuit || null,
          address: String(r[3] || '').trim() || null,
          phone: String(r[4] || '').trim() || null,
          city: String(r[6] || '').trim() || null,
          province: String(r[7] || '').trim() || null,
          zone: String(r[8] || '').trim() || null,
          activity: String(r[10] || '').trim() || null,
          email: email || null,
          emailDomain: domain,
          postalCode: String(r[12] || '').trim() || null,
          defaultSellerId: vendedorIds[i % vendedorIds.length],
        },
      });
      imported++;
    }
    console.log(`   ✅ ${imported} clients imported from Excel`);
  } catch (err) {
    console.log(`   ⚠️  Could not import Excel: ${err.message}`);
    console.log('   Creating sample clients instead...');
    
    const sampleClients = [
      { code: 'CLI-001', name: 'ARGENCRAFT S.A.', cuit: '30-71045888-3', city: 'Pilar', province: 'Buenos Aires', zone: 'AMBA Norte', activity: 'Tableros eléctricos', email: 'compras@argencraft.com.ar', emailDomain: 'argencraft.com.ar', defaultSellerId: userMap.luciano },
      { code: 'CLI-002', name: 'ALPRE S.A.', cuit: '30-69772311-5', city: 'Córdoba', province: 'Córdoba', zone: 'Interior Oeste', activity: 'Obras eléctricas', email: 'info@alpre.com', emailDomain: 'alpre.com', defaultSellerId: userMap.santiago },
      { code: 'CLI-003', name: 'ANCIEN POSTE SA', cuit: '33-71022199-9', city: 'Rosario', province: 'Santa Fe', zone: 'Interior Este', activity: 'Distribución eléctrica', email: 'ventas@ancienposte.com', emailDomain: 'ancienposte.com', defaultSellerId: userMap.felipe },
      { code: 'CLI-004', name: 'ARMAFERRO SA', cuit: '30-50401922-8', city: 'Avellaneda', province: 'Buenos Aires', zone: 'AMBA Sur', activity: 'Estructuras metálicas', email: 'admin@armaferro.com', emailDomain: 'armaferro.com', defaultSellerId: userMap.luciano },
      { code: 'CLI-005', name: 'CONSTRUCTORA DEL PLATA', cuit: '30-70844332-0', city: 'CABA', province: 'CABA', zone: 'AMBA Norte', activity: 'Construcción', email: 'info@delplata.com.ar', emailDomain: 'delplata.com.ar', defaultSellerId: userMap.luciano },
    ];
    for (const c of sampleClients) {
      await prisma.client.upsert({ where: { code: c.code }, update: {}, create: c });
    }
    console.log(`   ✅ ${sampleClients.length} sample clients created`);
  }

  // ─── 5. Cotizaciones de ejemplo ───
  console.log('📄 Creating sample quotes...');
  const clients = await prisma.client.findMany({ take: 15 });
  const cliMap = {};
  clients.forEach(c => { cliMap[c.code] = c.id; });

  const sampleQuotes = [
    { code: 'COT-2026-041', clientCode: 'CLI-001', sellerKey: 'luciano', stage: 'enviado',   amount: 45200, flexxusCode: 'NP-88120', source: 'EMAIL' },
    { code: 'COT-2026-042', clientCode: 'CLI-002', sellerKey: 'santiago', stage: 'armado',   amount: null,  source: 'EMAIL' },
    { code: 'COT-2026-043', clientCode: 'CLI-003', sellerKey: 'felipe',  stage: 'recibida', amount: null,  source: 'EMAIL' },
    { code: 'COT-2026-038', clientCode: 'CLI-004', sellerKey: 'luciano', stage: 'aceptada', amount: 12800, flexxusCode: 'NP-88092', source: 'MANUAL' },
    { code: 'COT-2026-044', clientCode: 'CLI-005', sellerKey: 'victoria', stage: 'proveedor', amount: null, flexxusCode: 'NP-88144', source: 'EMAIL' },
  ];

  for (const q of sampleQuotes) {
    const clientId = cliMap[q.clientCode];
    if (!clientId) continue;
    await prisma.quote.upsert({
      where: { code: q.code },
      update: {},
      create: {
        code: q.code,
        clientId,
        sellerId: userMap[q.sellerKey],
        stage: q.stage,
        amount: q.amount,
        flexxusCode: q.flexxusCode || null,
        source: q.source,
        createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
      },
    });
  }
  console.log(`   ✅ ${sampleQuotes.length} sample quotes created`);

  // ─── 6. Email integration record ───
  console.log('📧 Creating email integration...');
  await prisma.emailIntegration.create({
    data: {
      accountEmail: process.env.MAIL_USER || 'cotizaciones@myselec.com.ar',
      isActive: true,
    },
  }).catch(() => {});
  console.log('   ✅ Email integration record created');

  console.log('\n🎉 Seed complete!');
  console.log('   Default password for all users: myselec2026');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
