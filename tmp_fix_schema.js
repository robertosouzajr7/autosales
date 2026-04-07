import fs from 'fs';
let c = fs.readFileSync('prisma/schema.prisma', 'utf8');

const productModel = '\nmodel Product {\n  id          String   @id @default(uuid())\n  tenantId    String\n  name        String\n  description String?\n  price       Float?\n  size        String?\n  imageUrl    String?\n  buyUrl      String?\n  type        String   @default(\"PRODUCT\")\n  isActive    Boolean  @default(true)\n  createdAt   DateTime @default(now())\n  updatedAt   DateTime @updatedAt\n  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)\n}\n';
const icpModel = '\nmodel IcpProfile {\n  id               String   @id @default(uuid())\n  tenantId         String\n  name             String\n  industry         String?\n  companySize      String?\n  role             String?\n  location         String?\n  painPoints       String?\n  goals            String?\n  isActive         Boolean  @default(true)\n  isProspectingActive Boolean @default(false)\n  sdrId            String?\n  createdAt        DateTime @default(now())\n  updatedAt        DateTime @updatedAt\n  tenant           Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)\n  sdrBot           SdrBot?  @relation(fields: [sdrId], references: [id], onDelete: SetNull)\n}\n';

if (!c.includes('model Product')) c += productModel;
if (!c.includes('model IcpProfile')) c += icpModel;

if (!c.includes('products     Product[]')) {
  c = c.replace(/model Tenant \{([\s\S]*?)messages      Message\[\]/, 'model Tenant {$1messages      Message[]\n  products     Product[]\n  icpProfiles  IcpProfile[]');
}

if (!c.includes('icpProfiles        IcpProfile[]')) {
  // Use a different regex that is less fragile
  const sdrBotFind = /model SdrBot \{([\s\S]*?)tenant             Tenant   @relation\(fields: \[tenantId\], references: \[id\], onDelete: Cascade\)\n\}/;
  if (sdrBotFind.test(c)) {
      c = c.replace(sdrBotFind, 'model SdrBot {$1tenant             Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)\n  icpProfiles        IcpProfile[]\n}');
  }
}

fs.writeFileSync('prisma/schema.prisma', c, 'utf8');
console.log('✅ Schema updated successfully');
