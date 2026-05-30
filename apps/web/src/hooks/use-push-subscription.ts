'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { api } from '@/lib/api'

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const arr = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) arr[i] = rawData.charCodeAt(i)
  return arr.buffer
}

export type PushStatus = 'unsupported' | 'loading' | 'denied' | 'subscribed' | 'unsubscribed'

export function usePushSubscription() {
  const { data: session } = useSession()
  const [status, setStatus] = useState<PushStatus>('loading')

  useEffect(() => {
    if (!session?.user?.id) return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported')
      return
    }
    if (Notification.permission === 'denied') {
      setStatus('denied')
      return
    }
    navigator.serviceWorker.ready.then((reg) =>
      reg.pushManager.getSubscription().then((sub) => {
        setStatus(sub ? 'subscribed' : 'unsubscribed')
      }),
    )
  }, [session?.user?.id])

  const subscribe = useCallback(async () => {
    if (!('serviceWorker' in navigator)) return
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      setStatus('denied')
      return
    }

    const { data: { publicKey } } = await api.get('/push/vapid-public-key')
    if (!publicKey) return

    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    })

    const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
    await api.post('/push/subscribe', { endpoint: json.endpoint, keys: json.keys })
    setStatus('subscribed')
  }, [])

  const unsubscribe = useCallback(async () => {
    if (!('serviceWorker' in navigator)) return
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) {
      await api.delete('/push/unsubscribe', { data: { endpoint: sub.endpoint } })
      await sub.unsubscribe()
    }
    setStatus('unsubscribed')
  }, [])

  return { status, subscribe, unsubscribe }
}
