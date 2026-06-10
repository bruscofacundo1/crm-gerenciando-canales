const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const email = 'bruscofacundo1@gmail.com';
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    console.log('✓ Usuario maestro ya existe:', existing.name);
    return;
  }

  const tempPw = process.env.ADMIN_SEED_PASSWORD || require('crypto').randomBytes(16).toString('hex');
  console.log('  Contraseña temporal:', tempPw, '(cambiarla tras el primer login)');
  const hashed = await bcrypt.hash(tempPw, 10);
  const user = await prisma.user.create({
    data: {
      name: 'Facundo Brusco',
      email,
      password: hashed,
      role: 'ADMIN',
      active: true,
      pendingApproval: false,
    },
  });

  console.log('✓ Usuario maestro creado:', user.name, user.email);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
