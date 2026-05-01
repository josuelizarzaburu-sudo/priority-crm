'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Home, ArrowLeft } from 'lucide-react'

export default function NotFound() {
  const router = useRouter()

  return (
    <div
      className="flex min-h-screen items-center justify-center p-6"
      style={{ background: '#25324b' }}
    >
      <div className="w-full max-w-sm text-center">
        {/* Brand mark */}
        <div
          className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-2xl"
          style={{ background: '#1d2e43' }}
        >
          <span
            className="text-2xl font-extrabold tracking-tight"
            style={{ color: '#d3ac76' }}
          >
            PC
          </span>
        </div>

        {/* Error code */}
        <p
          className="text-7xl font-extrabold leading-none tracking-tighter"
          style={{ color: '#d3ac76' }}
        >
          404
        </p>

        {/* Divider */}
        <div
          className="mx-auto my-5 h-0.5 w-12 rounded-full"
          style={{ background: 'rgba(211,172,118,0.35)' }}
        />

        {/* Message */}
        <h1 className="text-xl font-bold text-white">Página no encontrada</h1>
        <p className="mt-2 text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Esta página no existe o fue movida a otra dirección.
        </p>

        {/* Actions */}
        <div className="mt-8 flex flex-col gap-3">
          <Link
            href="/pipeline"
            className="flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-opacity hover:opacity-90"
            style={{ background: '#d3ac76', color: '#25324b' }}
          >
            <Home className="h-4 w-4" />
            Ir al inicio
          </Link>

          <button
            onClick={() => router.back()}
            className="flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition-colors"
            style={{ background: 'rgba(255,255,255,0.08)' }}
          >
            <ArrowLeft className="h-4 w-4" />
            Volver atrás
          </button>
        </div>

        {/* Footer note */}
        <p
          className="mt-10 text-xs"
          style={{ color: 'rgba(255,255,255,0.2)' }}
        >
          Priority CRM
        </p>
      </div>
    </div>
  )
}
