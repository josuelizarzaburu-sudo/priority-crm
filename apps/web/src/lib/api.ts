import axios from 'axios'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Attach auth token — only runs in the browser
if (typeof window !== 'undefined') {
  api.interceptors.request.use(async (config) => {
    const { getSession } = await import('next-auth/react')
    const session = await getSession()
    if (session?.accessToken) {
      config.headers.Authorization = `Bearer ${session.accessToken}`
    }
    return config
  })

  api.interceptors.response.use(
    (response) => response,
    async (error) => {
      // Un 401 ya no manda directo al login: primero se intenta una vez con el
      // token renovado. NextAuth lo renueva solo, asi que basta pedir la sesion
      // de nuevo. Antes, cualquier 401 expulsaba a la persona aunque estuviera
      // trabajando, que era la causa de que "a los 5 minutos pida login".
      const original: any = error.config ?? {}
      if (error.response?.status === 401 && !original._reintento) {
        original._reintento = true
        try {
          const { getSession } = await import('next-auth/react')
          const session: any = await getSession()
          if (session?.accessToken && !session?.error) {
            original.headers = {
              ...(original.headers ?? {}),
              Authorization: `Bearer ${session.accessToken}`,
            }
            return api.request(original)
          }
        } catch {
          // cae al redirect de abajo
        }
        window.location.href = '/login'
      }
      return Promise.reject(error)
    },
  )
}

// Server-side helper — used in NextAuth authorize callback with an explicit token
export function createServerApi(accessToken?: string) {
  const instance = axios.create({
    baseURL: BASE_URL,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  })
  return instance
}
