import type { Metadata } from 'next'
import { PantallaConsentimiento } from '@/components/consentimientos/pantalla-consentimiento'

export const metadata: Metadata = {
  title: 'Autorización de datos — Priority',
  // Que no lo indexe ningun buscador: son enlaces personales.
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default function Page({ params }: { params: { token: string } }) {
  return <PantallaConsentimiento token={params.token} />
}
