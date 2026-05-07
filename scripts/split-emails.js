// scripts/split-emails.js
// Uso: node scripts/split-emails.js
// Idempotente — puede correrse varias veces sin romper nada

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Buscando emails concatenados en ClientEmail...\n');

  const concatenated = await prisma.clientEmail.findMany({
    where: { email: { contains: ',' } },
  });

  if (concatenated.length === 0) {
    console.log('✅ No hay emails concatenados. Nada que hacer.');
    return;
  }

  console.log(`📋 Encontrados: ${concatenated.length} registros con comas\n`);

  let created = 0;
  let deleted = 0;
  let skipped = 0;

  for (const record of concatenated) {
    const parts = record.email
      .split(',')
      .map(e => e.trim().toLowerCase())
      .filter(e => e.length > 0);

    console.log(`\n  Cliente ${record.clientId} — splitting: ${record.email}`);

    for (let i = 0; i < parts.length; i++) {
      const email = parts[i];
      const isPrimary = i === 0 ? record.isPrimary : false;

      const exists = await prisma.clientEmail.findFirst({
        where: { email, clientId: record.clientId },
      });

      if (exists) {
        console.log(`    ⏭  ya existe: ${email}`);
        skipped++;
        continue;
      }

      await prisma.clientEmail.create({
        data: { email, clientId: record.clientId, isPrimary },
      });
      console.log(`    ✅ creado${isPrimary ? ' (primary)' : ''}:  ${email}`);
      created++;
    }

    // Eliminar el registro concatenado original
    await prisma.clientEmail.delete({ where: { id: record.id } });
    console.log(`    🗑  eliminado registro original`);
    deleted++;
  }

  console.log(`\n📊 Resultado:`);
  console.log(`   ${created} emails creados`);
  console.log(`   ${deleted} registros concatenados eliminados`);
  console.log(`   ${skipped} omitidos (ya existían)`);
  console.log('✅ Split completado');
}

main()
  .catch(e => { console.error('❌ Error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
