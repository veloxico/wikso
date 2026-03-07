import { PrismaClient, GlobalRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

async function main() {
  const prisma = new PrismaClient();

  const email = process.env.ADMIN_EMAIL || 'admin@example.com';
  const password = process.env.ADMIN_PASSWORD || 'Admin1234!';

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin user ${email} already exists (id: ${existing.id}, role: ${existing.role})`);
    if (existing.role !== GlobalRole.ADMIN) {
      await prisma.user.update({ where: { id: existing.id }, data: { role: GlobalRole.ADMIN } });
      console.log(`Updated role to ADMIN`);
    }
    await prisma.$disconnect();
    return;
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  const user = await prisma.user.create({
    data: {
      email,
      name: 'Admin',
      passwordHash,
      emailVerified: true,
      role: GlobalRole.ADMIN,
    },
  });

  console.log(`Admin user created: ${user.email} (id: ${user.id})`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
