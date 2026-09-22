/**
 * Baseline seed: permission and module catalogs, platform templates and the
 * superadmin account. Safe to run as many times as needed.
 *
 *   pnpm seed
 */
import { PrismaClient } from '@prisma/client';
import {
  bootstrapCompany,
  seedNotificationTemplates,
  seedSurveyTemplates,
  syncCatalogs,
  upsertUser,
} from './seed-helpers';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const started = Date.now();
  console.log('Cargando catalogos de permisos y modulos...');
  await syncCatalogs(prisma);

  console.log('Cargando plantillas de notificacion y encuestas...');
  await seedNotificationTemplates(prisma);
  await seedSurveyTemplates(prisma);

  const companyName = process.env.SEED_COMPANY_NAME ?? 'Mi Empresa S.A.S.';
  console.log(`Creando empresa inicial "${companyName}"...`);
  const companyId = await bootstrapCompany(prisma, {
    name: companyName,
    legalName: companyName,
    slug: process.env.SEED_COMPANY_SLUG ?? 'mi-empresa',
    taxId: '900123456-7',
    city: 'Barranquilla',
  });

  const superadminPassword = process.env.SEED_SUPERADMIN_PASSWORD ?? 'Talento1234!';
  await upsertUser(prisma, {
    email: process.env.SEED_SUPERADMIN_EMAIL ?? 'superadmin@talento.local',
    firstName: 'Super',
    lastName: 'Admin',
    password: superadminPassword,
    companyId,
    roleKeys: ['company_admin'],
    isSuperadmin: true,
  });

  const counts = {
    permisos: await prisma.permission.count(),
    modulos: await prisma.appModule.count(),
    roles: await prisma.role.count({ where: { companyId } }),
    tiposAusencia: await prisma.leaveType.count({ where: { companyId } }),
    festivos: await prisma.holiday.count({ where: { companyId } }),
  };

  console.log('\nSemilla base lista en', ((Date.now() - started) / 1000).toFixed(1), 's');
  console.table(counts);
  console.log(`\nUsuario: ${process.env.SEED_SUPERADMIN_EMAIL ?? 'superadmin@talento.local'}`);
  console.log(`Contrasena: ${superadminPassword}\n`);
}

main()
  .catch((error) => {
    console.error('La semilla fallo:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
