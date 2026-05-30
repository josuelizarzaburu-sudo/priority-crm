'use client'

import { useState, useEffect } from 'react'
import { Bell, X, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePushSubscription } from '@/hooks/use-push-subscription'

const DISMISSED_KEY = 'push-banner-dismissed-until'
const SNOOZE_DAYS = 7

function isDismissed(): boolean {
  try {
    const val = localStorage.getItem(DISMISSED_KEY)
    if (!val) return false
    return Date.now() < parseInt(val, 10)
  } catch {
    return false
  }
}

function dismiss() {
  try {
    const until = Date.now() + SNOOZE_DAYS * 24 * 60 * 60 * 1000
    localStorage.setItem(DISMISSED_KEY, String(until))
  } catch { /* ignore */ }
}

export function PushNotificationBanner() {
  const { status, subscribe } = usePushSubscription()
  const [hidden, setHidden] = useState(true)
  const [subscribing, setSubscribing] = useState(false)
  const [success, setSuccess] = useState(false)

  // Delay visibility check to avoid SSR mismatch and read localStorage client-side
  useEffect(() => {
    if (status === 'unsubscribed' && !isDismissed()) {
      setHidden(false)
    }
  }, [status])

  if (hidden || status === 'loading' || status === 'unsupported' || status === 'denied' || status === 'subscribed') {
    return null
  }

  if (success) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 shadow-sm dark:border-green-800 dark:bg-green-950/40 dark:text-green-300">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
        <span className="font-medium">¡Notificaciones activadas! Recibirás alertas de leads y recordatorios.</span>
      </div>
    )
  }

  async function handleActivate() {
    setSubscribing(true)
    try {
      await subscribe()
      setSuccess(true)
      setTimeout(() => setHidden(true), 4000)
    } finally {
      setSubscribing(false)
    }
  }

  function handleDismiss() {
    dismiss()
    setHidden(true)
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-[#d3ac76]/40 bg-[#25324b] px-4 py-3 shadow-sm">
      <Bell className="h-4 w-4 shrink-0 text-[#d3ac76]" />
      <p className="flex-1 text-sm text-white">
        Activa las notificaciones para recibir alertas de nuevos leads y recordatorios de seguimiento.
      </p>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          size="sm"
          onClick={handleActivate}
          disabled={subscribing}
          className="h-8 bg-[#d3ac76] text-[#25324b] hover:bg-[#d3ac76]/90 font-semibold"
        >
          {subscribing ? 'Activando...' : 'Activar'}
        </Button>
        <button
          onClick={handleDismiss}
          className="flex h-7 w-7 items-center justify-center rounded-md text-white/60 hover:bg-white/10 hover:text-white"
          aria-label="Cerrar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
