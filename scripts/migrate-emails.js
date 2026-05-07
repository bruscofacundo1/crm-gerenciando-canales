// scripts/migrate-emails.js
// Uso: node scripts/migrate-emails.js
// Ejecutar UNA VEZ después de npx prisma db push

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Migrando emails de clientes al modelo ClientEmail...\n');

  const clients = await prisma.client.findMany({
    where: { email: { not: null } },
    select: { id: true, email: true, name: true },
  });

  let created = 0;
  let skipped = 0;

  for (const client of clients) {
    if (!client.email || !client.email.trim()) {
      skipped++;
      continue;
    }

    const email = client.email.trim().toLowerCase();

    // Verificar si ya existe (idempotente)
    const exists = await prisma.clientEmail.findFirst({
      where: { email, clientId: client.id },
    });

    if (exists) {
      skipped++;
      continue;
    }

    await prisma.clientEmail.create({
      data: {
        email,
        clientId: client.id,
        isPrimary: true,
      },
    });
    created++;
    console.log(`   ✅ ${client.name} → ${email}`);
  }

  console.log(`\n📊 Resultado: ${created} creados, ${skipped} omitidos (ya existían o vacíos)`);
  console.log('✅ Migración completada');
}

main()
  .catch(e => { console.error('❌ Error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
