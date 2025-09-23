const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function upsertTenant(name, slug, plan) {
  return prisma.tenant.upsert({
    where: { slug },
    update: { name, plan },
    create: { name, slug, plan },
  });
}

async function createUser(email, role, tenantId, hashedPassword) {
  await prisma.user.upsert({
    where: { email },
    update: { role, tenantId, password: hashedPassword },
    create: { email, role, tenantId, password: hashedPassword },
  });
}

async function main() {
  const hashedPassword = await bcrypt.hash('password', 10);

  const acme = await upsertTenant('Acme', 'acme', 'FREE');
  const globex = await upsertTenant('Globex', 'globex', 'FREE');

  await createUser('admin@acme.test', 'ADMIN', acme.id, hashedPassword);
  await createUser('user@acme.test', 'MEMBER', acme.id, hashedPassword);

  await createUser('admin@globex.test', 'ADMIN', globex.id, hashedPassword);
  await createUser('user@globex.test', 'MEMBER', globex.id, hashedPassword);

  console.log('Seed complete: tenants and users.');
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());
