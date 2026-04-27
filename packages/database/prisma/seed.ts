import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  const org = await prisma.organization.create({
    data: { name: 'Acme Corp', slug: 'acme-corp' },
  })

  const password = await bcrypt.hash('password123', 12)
  const admin = await prisma.user.create({
    data: {
      name: 'Admin User',
      email: 'admin@acme.com',
      password,
      role: 'ADMIN',
      organizationId: org.id,
    },
  })

  const stages = await Promise.all([
    prisma.pipelineStage.create({ data: { name: 'Lead',       position: 1, probability: 10, color: '#6366f1', organizationId: org.id } }),
    prisma.pipelineStage.create({ data: { name: 'Qualified',  position: 2, probability: 30, color: '#8b5cf6', organizationId: org.id } }),
    prisma.pipelineStage.create({ data: { name: 'Proposal',   position: 3, probability: 50, color: '#a855f7', organizationId: org.id } }),
    prisma.pipelineStage.create({ data: { name: 'Negotiation',position: 4, probability: 70, color: '#d946ef', organizationId: org.id } }),
    prisma.pipelineStage.create({ data: { name: 'Closed Won', position: 5, probability: 100, color: '#22c55e', organizationId: org.id } }),
  ])

  const contacts = await Promise.all([
    prisma.contact.create({ data: { firstName: 'Alice', lastName: 'Johnson', email: 'alice@techco.com', company: 'TechCo', status: 'LEAD', organizationId: org.id, createdById: admin.id, assignedToId: admin.id } }),
    prisma.contact.create({ data: { firstName: 'Bob', lastName: 'Smith', email: 'bob@startup.io', company: 'Startup IO', phone: '+1234567890', status: 'CUSTOMER', organizationId: org.id, createdById: admin.id } }),
    prisma.contact.create({ data: { firstName: 'Carol', lastName: 'White', email: 'carol@enterprise.com', company: 'Enterprise Ltd', status: 'ACTIVE', organizationId: org.id, createdById: admin.id } }),
  ])

  await Promise.all([
    prisma.deal.create({ data: { title: 'TechCo Annual License', value: 24000, stageId: stages[1].id, contactId: contacts[0].id, organizationId: org.id, createdById: admin.id, assignedToId: admin.id, position: 1000 } }),
    prisma.deal.create({ data: { title: 'Startup IO Pilot', value: 5000, stageId: stages[0].id, contactId: contacts[1].id, organizationId: org.id, createdById: admin.id, position: 1000 } }),
    prisma.deal.create({ data: { title: 'Enterprise Expansion', value: 80000, stageId: stages[3].id, contactId: contacts[2].id, organizationId: org.id, createdById: admin.id, assignedToId: admin.id, position: 1000 } }),
  ])

  console.log('Seed complete.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
