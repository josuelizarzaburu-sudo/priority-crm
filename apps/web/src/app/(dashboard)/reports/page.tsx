import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { ReportesHub } from '@/components/reports/reportes-hub'

export default async function Reports() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  const role = (session.user as any)?.role ?? 'SALES_REP'
  if (!['SUPER_ADMIN', 'OWNER', 'MANAGER'].includes(role)) redirect('/pipeline')

  return <ReportesHub />
}
