import type { Metadata } from 'next'
import { ComparativosPage } from '@/components/comparativos/comparativos-page'

export const metadata: Metadata = { title: 'Comparativos' }

export default function Page() {
  return <ComparativosPage />
}
