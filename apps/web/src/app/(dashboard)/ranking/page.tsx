import { exigirRol, ALL_ROLES } from '@/lib/exigir-rol'
import type { Metadata } from 'next'
import { RankingPage } from '@/components/ranking/ranking-page'

export const metadata: Metadata = { title: 'Ranking' }

export default async function Page() {
  await exigirRol(ALL_ROLES)

  return (
    <div className="flex h-full flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#0C2057' }}>
          Ranking de vendedores
        </h1>
        <p className="text-sm text-muted-foreground">
          Quién va vendiendo más, y de qué producto.
        </p>
      </div>
      <RankingPage />
    </div>
  )
}
