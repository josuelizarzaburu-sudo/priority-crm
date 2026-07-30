import { exigirRol } from '@/lib/exigir-rol'
import type { Metadata } from 'next'
import { MyPipelineBoard } from '@/components/pipeline/my-pipeline-board'

export const metadata: Metadata = { title: 'Mi Pipeline' }

export default async function MyPipelinePage() {
  await exigirRol(['SUPER_ADMIN', 'SALES_REP'])

  return <MyPipelineBoard />
}
