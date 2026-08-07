import 'next-auth'

declare module 'next-auth' {
  interface Session {
    accessToken?: string
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      role?: string
      /** Permiso individual para gestionar negocios propios en Mi Pipeline. */
      puedeVender?: boolean
      organizationId?: string
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string
    role?: string
    puedeVender?: boolean
    organizationId?: string
    accessToken?: unknown
  }
}
