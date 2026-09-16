import { NextResponse } from 'next/server'

/**
 * Manifiesto de instalacion propio de cada referidor.
 *
 * Hace falta uno POR CODIGO: el manifiesto dice en que direccion abrir la app, y
 * esa direccion incluye el codigo de la persona. Con el manifiesto general del
 * CRM, instalar desde aqui abria el pipeline y pedia credenciales —que es
 * justamente lo que reporto Josue.
 *
 * Tambien cambia el nombre y el icono: en el celular tiene que verse como una
 * app distinta, no como un acceso mas al CRM.
 */
export async function GET(_req: Request, { params }: { params: { codigo: string } }) {
  const codigo = params.codigo.toUpperCase()

  return NextResponse.json(
    {
      name: 'Priority Referidos',
      short_name: 'Referidos',
      description: 'Refiere a tus contactos y gana premios con Priority',
      // Abre directo en SU panel: sin esto tendria que pegar el enlace cada vez.
      start_url: `/r/${codigo}`,
      // El alcance se limita a su panel y al formulario de invitacion, para que
      // el resto del CRM no quede dentro de esta app.
      scope: `/r/${codigo}`,
      display: 'standalone',
      orientation: 'portrait-primary',
      background_color: '#0C2057',
      theme_color: '#0C2057',
      lang: 'es',
      categories: ['lifestyle', 'finance'],
      icons: [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        {
          src: '/icons/icon-512-maskable.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
    },
    {
      headers: {
        'Content-Type': 'application/manifest+json',
        // Se cachea poco: si cambia el icono o el nombre, conviene que llegue
        // pronto sin tener que reinstalar.
        'Cache-Control': 'public, max-age=3600',
      },
    },
  )
}
