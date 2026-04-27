// Run from repo root: node apps/api/scripts/create-admin.js
const { PrismaClient } = require('../../packages/database/node_modules/@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  const email = 'admin@priority-crm.com'

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    console.log('Admin user already exists:', email)
    return
  }

  let org = await prisma.organization.findFirst()
  if (!org) {
    org = await prisma.organization.create({ data: { name: 'Priority CRM' } })
    console.log('Created organization:', org.name)
  }

  const password = await bcrypt.hash('Admin1234!', 12)

  const user = await prisma.user.create({
    data: {
      name: 'Admin User',
      email,
      password,
      role: 'ADMIN',
      organizationId: org.id,
    },
  })

  console.log('Admin user created:', user.email, '| org:', org.name)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
