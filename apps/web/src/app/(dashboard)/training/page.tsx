import { exigirRol, COMUNES } from '@/lib/exigir-rol'
import type { Metadata } from 'next'
import { TrainingLibrary } from '@/components/training/training-library'

export const metadata: Metadata = { title: 'Capacitaciones' }

export default async function TrainingPage() {
  await exigirRol(COMUNES)

  return <TrainingLibrary />
}
