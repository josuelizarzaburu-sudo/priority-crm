import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { inicioSegunRol } from '@/lib/exigir-rol'
import { CommissionsPage } from '@/components/commissions/commissions-page'

export default async function Commissions() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  const role = (session.user as any)?.role ?? 'SALES_REP'
  // Comisiones queda solo para super admin: el reporte es para calcular las
  // comisiones propias, no para que circule por la empresa. Debe coincidir con
  // PUEDEN_VER_COMISIONES en pipeline.service.ts de la API.
  if (role !== 'SUPER_ADMIN') redirect(inicioSegunRol(role))

  return <CommissionsPage />
}
