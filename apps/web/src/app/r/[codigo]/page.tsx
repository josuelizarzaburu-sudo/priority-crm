import type { Metadata } from 'next'
import { PanelReferidor } from '@/components/referidos/panel-referidor'

export const metadata: Metadata = {
  title: 'Priority — Programa de referidos',
}

/**
 * Pantalla del referidor.
 *
 * Fuera del dashboard a proposito: quien entra aqui no es del equipo y no tiene
 * usuario del CRM. Su codigo, que va en la direccion, es su credencial.
 *
 * Pedirle crear una cuenta para mandar un contacto perderia a la mitad antes de
 * empezar.
 */
/**
 * Se renderiza en cada visita, no al construir.
 *
 * Next intenta generar estaticamente las paginas que puede. Aqui no sirve: el
 * codigo es distinto en cada visita y los datos cambian, asi que la pagina tiene
 * que armarse en el momento.
 */
export const dynamic = 'force-dynamic'

export default function Page({ params }: { params: { codigo: string } }) {
  return <PanelReferidor codigo={params.codigo} />
}
