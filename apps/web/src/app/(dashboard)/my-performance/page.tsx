import { exigirRol } from '@/lib/exigir-rol'
import { MyPerformancePage } from '@/components/reports/my-performance-page'

export default async function MyPerformance() {
  await exigirRol(['SALES_REP', 'OWNER', 'SUPER_ADMIN'])

  return <MyPerformancePage />
}
