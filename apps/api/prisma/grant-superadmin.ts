import { PrismaClient } from '@prisma/client';
import { upsertUser } from './seed-helpers';

/**
 * Creates (or promotes) a platform superadministrator and makes it company
 * administrator of every active company, so the account can operate all of
 * them from day one.
 *
 *   pnpm --filter @talento/api run admin:create -- --email ana@empresa.com --password 'S3cr3ta!' --name "Ana Perez"
 *
 * The password is only read from the command line or from ADMIN_PASSWORD; it
 * is never written anywhere but the hash.
 */
const prisma = new PrismaClient();

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main(): Promise<void> {
  const email = (argument('email') ?? process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
  const password = argument('password') ?? process.env.ADMIN_PASSWORD ?? '';
  const fullName = (argument('name') ?? process.env.ADMIN_NAME ?? 'Administrador').trim();
  if (!email || !password) {
    throw new Error('Faltan --email y --password (o ADMIN_EMAIL y ADMIN_PASSWORD)');
  }
  if (password.length < 10) {
    throw new Error('La contrasena debe tener al menos 10 caracteres');
  }

  const [firstName, ...rest] = fullName.split(/\s+/);
  const lastName = rest.join(' ') || 'TALENTO';
  // The company with the most people opens first: that is where the work is.
  const companies = await prisma.company.findMany({
    where: { deletedAt: null, isActive: true },
    select: { id: true, name: true, slug: true, _count: { select: { employees: true } } },
    orderBy: { createdAt: 'asc' },
  });
  companies.sort((a, b) => b._count.employees - a._count.employees);
  if (!companies.length) throw new Error('No hay empresas: ejecute primero la semilla');

  let userId = '';
  for (const company of companies) {
    userId = await upsertUser(prisma, {
      email,
      firstName,
      lastName,
      password,
      companyId: company.id,
      roleKeys: ['company_admin'],
      isSuperadmin: true,
    });
  }
  await prisma.user.update({ where: { id: userId }, data: { lastCompanyId: companies[0].id } });
  await prisma.companyUser.updateMany({ where: { userId }, data: { isDefault: false } });
  await prisma.companyUser.updateMany({
    where: { userId, companyId: companies[0].id },
    data: { isDefault: true },
  });

  console.log(`Superadministrador listo: ${email}`);
  console.log(`Empresas: ${companies.map((company) => company.slug).join(', ')}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
