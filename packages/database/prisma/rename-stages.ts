import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const RENAMES: Record<string, string> = {
  'Qualified':   'Calificado',
  'Proposal':    'Propuesta',
  'Negotiation': 'Negociación',
  'Closed Won':  'Ganado',
  'Closed Lost': 'Perdido',
}

async function main() {
  for (const [oldName, newName] of Object.entries(RENAMES)) {
    const result = await prisma.pipelineStage.updateMany({
      where: { name: oldName },
      data:  { name: newName },
    })
    if (result.count > 0) {
      console.log(`✓ "${oldName}" → "${newName}" (${result.count} registro${result.count !== 1 ? 's' : ''})`)
    } else {
      console.log(`— "${oldName}" no encontrado en la DB`)
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
