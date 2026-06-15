require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const o = await prisma.order.deleteMany({});
  console.log('Orders borradas:', o.count);

  const u = await prisma.quote.updateMany({ data: { linkedQuoteId: null } });
  console.log('Links rotos:', u.count);

  const q = await prisma.quote.deleteMany({});
  console.log('Quotes borradas:', q.count);

  await prisma.$disconnect();
  console.log('Listo.');
}

main().catch(e => { console.error(e); process.exit(1); });
