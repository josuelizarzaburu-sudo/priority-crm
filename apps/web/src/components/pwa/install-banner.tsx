'use client'

import { useState, useEffect } from 'react'
import { X, Share, PlusSquare } from 'lucide-react'

const DISMISSED_KEY = 'pwa-install-dismissed'

export function InstallBanner() {
  const [visible, setVisible]       = useState(false)
  const [isIos, setIsIos]           = useState(false)
  const [prompt, setPrompt]         = useState<any>(null)

  useEffect(() => {
    // Don't show if already running as standalone (installed)
    if (window.matchMedia('(display-mode: standalone)').matches) return
    // Don't show if user dismissed before
    if (sessionStorage.getItem(DISMISSED_KEY)) return

    const ua      = navigator.userAgent.toLowerCase()
    const ios     = /iphone|ipad|ipod/.test(ua)
    const android = /android/.test(ua)

    if (!ios && !android) return // desktop — skip

    setIsIos(ios)

    if (ios) {
      // iOS Safari doesn't fire beforeinstallprompt; show manual guide
      setVisible(true)
      return
    }

    // Android / Chrome: capture the native prompt
    const handler = (e: Event) => {
      e.preventDefault()
      setPrompt(e)
      setVisible(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  function dismiss() {
    sessionStorage.setItem(DISMISSED_KEY, '1')
    setVisible(false)
  }

  async function install() {
    if (!prompt) return
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') setVisible(false)
    setPrompt(null)
  }

  if (!visible) return null

  return (
    /* Slide up from bottom, only on mobile */
    <div
      className="fixed bottom-0 left-0 right-0 z-[60] md:hidden"
      style={{ animation: 'pwa-slide-up 0.35s cubic-bezier(.4,0,.2,1) both' }}
    >
      <style>{`
        @keyframes pwa-slide-up {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>

      <div
        className="mx-3 mb-3 rounded-2xl px-5 py-4"
        style={{
          background: '#25324b',
          boxShadow: '0 -2px 0 rgba(211,172,118,0.35), 0 12px 40px rgba(37,50,75,0.5)',
        }}
      >
        {/* Close */}
        <button
          onClick={dismiss}
          aria-label="Cerrar"
          className="absolute right-4 top-4 rounded-full p-1.5 transition-opacity hover:opacity-70"
        >
          <X className="h-4 w-4" style={{ color: 'rgba(211,172,118,0.7)' }} />
        </button>

        {/* Header row */}
        <div className="flex items-center gap-3 mb-3 pr-6">
          {/* Mini brand icon */}
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
            style={{
              background: '#1d2e43',
              boxShadow: 'inset 0 1px 0 rgba(211,172,118,0.15)',
            }}
          >
            <span
              className="text-base font-extrabold leading-none tracking-tight"
              style={{ color: '#d3ac76' }}
            >
              PC
            </span>
          </div>

          <div>
            <p className="text-[14px] font-bold text-white leading-tight">Priority CRM</p>
            <p className="text-[11px] font-semibold tracking-wide" style={{ color: '#d3ac76' }}>
              Instala la app · acceso rápido
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="mb-3 h-px" style={{ background: 'rgba(211,172,118,0.15)' }} />

        {isIos ? (
          /* iOS — manual instruction */
          <>
            <p className="mb-3 text-[13px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>
              En Safari, toca{' '}
              <Share className="inline h-[14px] w-[14px] align-middle" style={{ color: '#d3ac76' }} />{' '}
              <span className="font-semibold text-white">"Compartir"</span> y luego{' '}
              <PlusSquare className="inline h-[14px] w-[14px] align-middle" style={{ color: '#d3ac76' }} />{' '}
              <span className="font-semibold text-white">"Añadir a pantalla de inicio"</span>.
            </p>
            <button
              onClick={dismiss}
              className="w-full rounded-xl py-2.5 text-[13px] font-bold"
              style={{ background: '#d3ac76', color: '#25324b' }}
            >
              Entendido
            </button>
          </>
        ) : (
          /* Android — native prompt */
          <>
            <p className="mb-3 text-[13px]" style={{ color: 'rgba(255,255,255,0.55)' }}>
              Instala Priority CRM en tu dispositivo para acceso offline y experiencia nativa.
            </p>
            <div className="flex gap-2">
              <button
                onClick={dismiss}
                className="flex-1 rounded-xl py-2.5 text-[13px] font-medium"
                style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.55)' }}
              >
                Ahora no
              </button>
              <button
                onClick={install}
                className="flex-1 rounded-xl py-2.5 text-[13px] font-bold"
                style={{ background: '#d3ac76', color: '#25324b' }}
              >
                Instalar app
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
