import { exigirRol, ALL_ROLES } from '@/lib/exigir-rol'
import type { Metadata } from 'next'
import { PipelineClient } from './pipeline-client'

export const metadata: Metadata = { title: 'Pipeline' }

export default async function PipelinePage() {
  await exigirRol(ALL_ROLES)

  return <PipelineClient />
}
