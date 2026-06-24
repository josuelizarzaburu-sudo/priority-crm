import type { Metadata } from 'next'
import { TrainingLibrary } from '@/components/training/training-library'

export const metadata: Metadata = { title: 'Capacitaciones' }

export default function TrainingPage() {
  return <TrainingLibrary />
}
