import { exigirRol, COMUNES } from '@/lib/exigir-rol'
import type { Metadata } from 'next'
import { CalendarView } from '@/components/calendar/calendar-view'

export const metadata: Metadata = { title: 'Calendario' }

export default async function CalendarPage() {
  await exigirRol(COMUNES)

  return <CalendarView />
}
