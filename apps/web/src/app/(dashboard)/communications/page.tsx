import type { Metadata } from 'next'
import { CommunicationsInbox } from '@/components/communications/communications-inbox'

export const metadata: Metadata = { title: 'Communications' }

export default function CommunicationsPage() {
  return <CommunicationsInbox />
}
