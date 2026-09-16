import type { Metadata } from 'next'

/**
 * El panel del referidor apunta a SU manifiesto, no al del CRM.
 *
 * Sin esto, el celular usaba la configuracion del CRM al instalar y abria el
 * pipeline pidiendo credenciales.
 */
export function generateMetadata({ params }: { params: { codigo: string } }): Metadata {
  return {
    title: 'Priority Referidos',
    manifest: `/r/${params.codigo}/manifest.webmanifest`,
    appleWebApp: {
      capable: true,
      title: 'Referidos',
      statusBarStyle: 'black-translucent',
    },
  }
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
