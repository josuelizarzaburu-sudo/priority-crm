import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { ReportsPage } from '@/components/reports/reports-page'

export default async function Reports() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  const role = (session.user as any)?.role ?? 'MEMBER'
  if (!['ADMIN', 'MANAGER'].includes(role)) redirect('/pipeline')

  return <ReportsPage />
}
