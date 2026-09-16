import type { Metadata } from 'next'
import { InvitacionReferido } from '@/components/referidos/invitacion-referido'

export const metadata: Metadata = {
  title: 'Priority Asesores de Seguros',
  description: 'Déjanos tus datos y un asesor te contacta. Sin costo y sin compromiso.',
}

export const dynamic = 'force-dynamic'

/**
 * Donde aterriza el CONTACTO referido, no el referidor.
 *
 * /ref/CODIGO  el amigo pone sus datos      <- esto
 * /r/CODIGO    el referidor ve sus puntos
 *
 * Son dos pantallas distintas a proposito: antes el boton "Compartir" copiaba el
 * enlace del panel, asi que el amigo habria visto los puntos de quien lo
 * refirio en vez de un formulario.
 */
export default function Page({ params }: { params: { codigo: string } }) {
  return <InvitacionReferido codigo={params.codigo} />
}
