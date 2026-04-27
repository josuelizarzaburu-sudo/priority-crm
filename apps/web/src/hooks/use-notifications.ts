'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { io } from 'socket.io-client'
import { useToast } from './use-toast'

export function useNotifications() {
  const { data: session } = useSession()
  const { toast } = useToast()

  useEffect(() => {
    if (!session?.user?.id) return

    const socket = io(`${process.env.NEXT_PUBLIC_WS_URL}/pipeline`, {
      transports: ['websocket'],
    })

    socket.on('connect', () => {
      socket.emit('join-user', session.user.id)
    })

    socket.on('lead:assigned', (deal: any) => {
      const contact = deal.contact
      const cf = deal.customFields as Record<string, string> | null
      const insuranceLabel = cf?.insuranceType === 'SALUD' ? 'Salud' : cf?.insuranceType === 'AUTO' ? 'Auto' : ''
      const name = contact
        ? `${contact.firstName} ${contact.lastName ?? ''}`.trim()
        : deal.title

      toast({
        title: '¡Nuevo lead asignado!',
        description: `${name}${insuranceLabel ? ` — Seguro de ${insuranceLabel}` : ''}${contact?.phone ? ` · ${contact.phone}` : ''}`,
      })
    })

    return () => {
      socket.disconnect()
    }
  }, [session?.user?.id, toast])
}
