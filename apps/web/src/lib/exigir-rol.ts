import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

/**
 * Comprueba el rol EN EL SERVIDOR antes de dibujar una pantalla.
 *
 * Esconder el enlace del menu no protege nada: cualquiera puede escribir la
 * direccion a mano. Esto si, porque corre antes de mandar el HTML y el navegador
 * no lo puede saltar.
 *
 * Los conjuntos de roles son los mismos del menu lateral, a proposito: si un rol
 * no ve el enlace, tampoco debe poder entrar escribiendo la ruta.
 */

export const ELEVATED = ['SUPER_ADMIN', 'OWNER', 'MANAGER']
export const ALL_ROLES = ['SUPER_ADMIN', 'OWNER', 'MANAGER', 'SALES_REP']
export const OPS = ['OPERACIONES', 'JEFE_OPERACIONES']
export const COMUNES = [...ALL_ROLES, ...OPS]

/** Perfiles de operaciones + admin: clientes, reclamos y sus reportes. */
export const OPS_Y_ADMIN = [...OPS, 'SUPER_ADMIN']

/**
 * Redirige a la portada si el rol de la sesion no esta en la lista.
 * Se llama al principio de un page.tsx de servidor.
 */
export async function exigirRol(rolesPermitidos: string[]) {
  const session = await getServerSession(authOptions)
  const rol = (session?.user as { role?: string } | undefined)?.role ?? ''
  if (!rolesPermitidos.includes(rol)) redirect('/')
}
