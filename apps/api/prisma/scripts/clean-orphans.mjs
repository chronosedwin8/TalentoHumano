import { Prisma, PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const companies = await prisma.company.findMany({ select: { id: true } });
const ids = companies.map((c) => c.id);
const models = Prisma.dmmf.datamodel.models.filter(
  (m) => m.name !== 'Company' && m.fields.some((f) => f.name === 'companyId' && f.isRequired),
);
let total = 0;
for (let pass = 0; pass < 4; pass += 1) {
  for (const model of models) {
    const key = model.name.charAt(0).toLowerCase() + model.name.slice(1);
    try {
      const res = await prisma[key].deleteMany({ where: { companyId: { notIn: ids } } });
      total += res.count;
    } catch { /* FK order; next pass */ }
  }
}
console.log('filas huerfanas eliminadas:', total);
await prisma.$disconnect();
