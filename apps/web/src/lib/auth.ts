import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { createServerApi } from './api'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null
        try {
          const { data } = await createServerApi().post('/auth/login', {
            email: credentials.email,
            password: credentials.password,
          })
          return data.user
            ? { ...data.user, accessToken: data.accessToken, refreshToken: data.refreshToken }
            : null
        } catch {
          return null
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.accessToken = (user as any).accessToken
        token.refreshToken = (user as any).refreshToken
        token.id = user.id
        token.role = (user as any).role
        token.organizationId = (user as any).organizationId
        // El token del API dura 15 min. Se guarda cuándo vence para renovarlo
        // ANTES de que caduque, en vez de esperar a que una petición falle.
        token.accessTokenExpires = Date.now() + 15 * 60 * 1000
        return token
      }

      // Todavía vigente (con 1 min de margen): se reutiliza.
      if (Date.now() < ((token.accessTokenExpires as number) ?? 0) - 60 * 1000) {
        return token
      }

      // Vencido o por vencer: se renueva con el refresh token, que dura 7 días.
      // Sin esto, a los 15 minutos la siguiente acción daba 401 y mandaba al
      // login aunque la persona estuviera trabajando.
      try {
        const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: token.refreshToken }),
        })
        if (!r.ok) throw new Error('refresh failed')
        const data = await r.json()
        return {
          ...token,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken ?? token.refreshToken,
          accessTokenExpires: Date.now() + 15 * 60 * 1000,
        }
      } catch {
        // Si la renovación falla, se marca la sesión como inválida para que el
        // usuario vuelva a entrar. Es el único caso en que debe pedirse login.
        return { ...token, error: 'RefreshFailed' }
      }
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        session.user.organizationId = token.organizationId as string | undefined
        session.accessToken = token.accessToken as string | undefined
        ;(session as any).error = (token as any).error
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
    // 12 horas: cubre una jornada completa sin pedir login, pero no deja la
    // sesión viva una semana en una computadora que quedó abierta.
    maxAge: 12 * 60 * 60,
    // Se renueva con la actividad: cada vez que la persona usa el CRM, el reloj
    // vuelve a empezar. Quien deja de usarlo, caduca.
    updateAge: 30 * 60,
  },
}
