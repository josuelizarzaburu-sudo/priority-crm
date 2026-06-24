import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { CommissionsPage } from '@/components/commissions/commissions-page'

export default async function Commissions() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  const role = (session.user as any)?.role ?? 'SALES_REP'
  if (!['SUPER_ADMIN', 'OWNER', 'MANAGER'].includes(role)) redirect('/pipeline')

  return <CommissionsPage />
}
