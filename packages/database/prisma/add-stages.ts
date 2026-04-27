import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const DEFAULT_STAGES = [
  { name: 'Prospección', position: 1, probability: 10, color: '#6366f1' },
  { name: 'Contactado',  position: 2, probability: 25, color: '#8b5cf6' },
  { name: 'Demo',        position: 3, probability: 45, color: '#a855f7' },
  { name: 'Propuesta',   position: 4, probability: 60, color: '#d946ef' },
  { name: 'Negociación', position: 5, probability: 80, color: '#ec4899' },
  { name: 'Cerrado',     position: 6, probability: 100, color: '#22c55e' },
]

async function main() {
  const org = await prisma.organization.findFirst({ where: { slug: 'acme-corp' } })
  if (!org) {
    console.error('Organization acme-corp not found. Run the seed first: pnpm db:seed')
    process.exit(1)
  }

  await prisma.$transaction(async (tx) => {
    const oldStages = await tx.pipelineStage.findMany({ where: { organizationId: org.id } })

    // Create new stages
    const newStages = await Promise.all(
      DEFAULT_STAGES.map((s) => tx.pipelineStage.create({ data: { ...s, organizationId: org.id } })),
    )

    // Move all deals to the first new stage before deleting old ones
    if (oldStages.length > 0) {
      await tx.deal.updateMany({
        where: { stageId: { in: oldStages.map((s) => s.id) } },
        data: { stageId: newStages[0].id },
      })
      await tx.pipelineStage.deleteMany({ where: { id: { in: oldStages.map((s) => s.id) } } })
      console.log(`  Removed ${oldStages.length} old stage(s), deals moved to "Prospección"`)
    }

    console.log(`✓ Created ${newStages.length} stages for "${org.name}":`)
    newStages.forEach((s) => console.log(`  ${s.position}. ${s.name}`))
  })
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
