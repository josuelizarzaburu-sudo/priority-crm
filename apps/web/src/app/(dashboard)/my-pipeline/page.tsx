import type { Metadata } from 'next'
import { MyPipelineBoard } from '@/components/pipeline/my-pipeline-board'

export const metadata: Metadata = { title: 'Mi Pipeline' }

export default function MyPipelinePage() {
  return <MyPipelineBoard />
}
