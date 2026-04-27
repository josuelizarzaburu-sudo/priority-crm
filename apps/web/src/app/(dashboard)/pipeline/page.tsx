import type { Metadata } from 'next'
import { KanbanBoard } from '@/components/pipeline/kanban-board'
import { PipelineHeader } from '@/components/pipeline/pipeline-header'

export const metadata: Metadata = { title: 'Pipeline' }

export default function PipelinePage() {
  return (
    <div className="flex h-full flex-col gap-4">
      <PipelineHeader />
      <KanbanBoard />
    </div>
  )
}
