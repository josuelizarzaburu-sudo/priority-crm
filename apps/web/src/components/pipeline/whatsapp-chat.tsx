'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Paperclip, Send, FileText, AlertTriangle, CheckCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

interface WaMessage {
  id: string
  dealId: string
  direction: 'INBOUND' | 'OUTBOUND'
  messageType: 'TEXT' | 'DOCUMENT' | 'IMAGE'
  content: string
  mediaUrl?: string | null
  mediaFileName?: string | null
  status: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED'
  read: boolean
  createdAt: string
  sentBy?: { id: string; name: string } | null
}

const MS_24H = 24 * 60 * 60 * 1000

export function WhatsappChat({ dealId, contactPhone }: { dealId: string; contactPhone?: string }) {
  const qc = useQueryClient()
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState('')

  const { data: messages = [], isLoading } = useQuery<WaMessage[]>({
    queryKey: ['wa-messages', dealId],
    queryFn: () => api.get(`/whatsapp-chat/deals/${dealId}/messages`).then((r) => r.data),
    enabled: !!dealId,
    refetchInterval: 8000,
  })

  // Mark inbound messages as read when tab is opened
  useEffect(() => {
    if (!dealId) return
    api.post(`/whatsapp-chat/deals/${dealId}/mark-read`).catch(() => {})
  }, [dealId])

  // Invalidate the unread badge in the tab bar
  useEffect(() => {
    qc.invalidateQueries({ queryKey: ['wa-messages', dealId] })
  }, [dealId, qc])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const sendText = useMutation({
    mutationFn: (t: string) =>
      api.post(`/whatsapp-chat/deals/${dealId}/send-text`, { text: t }).then((r) => r.data),
    onSuccess: () => {
      setText('')
      qc.invalidateQueries({ queryKey: ['wa-messages', dealId] })
    },
  })

  const sendDocument = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData()
      form.append('file', file)
      return api
        .post(`/whatsapp-chat/deals/${dealId}/send-document`, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        .then((r) => r.data)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wa-messages', dealId] }),
  })

  const handleSend = useCallback(() => {
    const trimmed = text.trim()
    if (!trimmed) return
    sendText.mutate(trimmed)
  }, [text, sendText])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    sendDocument.mutate(file)
    e.target.value = ''
  }

  // 24h window: look for most recent INBOUND message
  const lastInbound = [...messages].reverse().find((m) => m.direction === 'INBOUND')
  const windowOpen = lastInbound
    ? Date.now() - new Date(lastInbound.createdAt).getTime() < MS_24H
    : null

  return (
    <div className="flex h-full flex-col">
      {/* 24h window banner */}
      {windowOpen !== null && (
        <div
          className={cn(
            'mx-1 mb-2 flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium',
            windowOpen
              ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-800/40 dark:bg-green-950/30 dark:text-green-400'
              : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-400',
          )}
        >
          {windowOpen ? (
            <>
              <CheckCheck className="h-3.5 w-3.5 shrink-0" />
              Puedes responder libremente (ventana de 24h activa)
            </>
          ) : (
            <>
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              Han pasado más de 24h — solo se pueden enviar plantillas aprobadas
            </>
          )}
        </div>
      )}

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-1" ref={scrollRef}>
        {isLoading && (
          <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
            Cargando mensajes…
          </div>
        )}
        {!isLoading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-xs text-muted-foreground">
            <span className="text-2xl">💬</span>
            <p>Sin mensajes aún</p>
            {contactPhone && <p className="font-mono text-[10px]">{contactPhone}</p>}
          </div>
        )}
        <div className="space-y-2 py-2">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} msg={msg} />
          ))}
        </div>
      </div>

      {/* Input bar */}
      <div className="border-t pt-2">
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => fileInputRef.current?.click()}
            disabled={sendDocument.isPending}
            title="Adjuntar archivo"
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe un mensaje…"
            className="h-8 flex-1 text-sm"
            disabled={sendText.isPending}
          />
          <Button
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={handleSend}
            disabled={!text.trim() || sendText.isPending}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        {(sendText.isError || sendDocument.isError) && (
          <p className="mt-1 text-[11px] text-red-500">Error al enviar. Intenta de nuevo.</p>
        )}
      </div>
    </div>
  )
}

async function downloadMedia(mediaUrl: string, fileName?: string) {
  try {
    const res = await api.get(mediaUrl, { responseType: 'blob' })
    const blob: Blob = res.data
    const objectUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objectUrl
    a.download = fileName || 'archivo'
    a.click()
    URL.revokeObjectURL(objectUrl)
  } catch {
    // fallback: open in new tab (will fail for Meta-direct URLs but fine for proxy)
    window.open(mediaUrl, '_blank')
  }
}

function MessageBubble({ msg }: { msg: WaMessage }) {
  const isOut = msg.direction === 'OUTBOUND'
  const time = format(new Date(msg.createdAt), 'HH:mm', { locale: es })
  const dateLabel = formatDistanceToNow(new Date(msg.createdAt), { locale: es, addSuffix: true })

  return (
    <div className={cn('flex', isOut ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[82%] rounded-2xl px-3 py-2 text-sm shadow-sm',
          isOut
            ? 'rounded-tr-sm bg-[#25324b] text-white'
            : 'rounded-tl-sm border bg-white text-foreground dark:bg-muted',
        )}
      >
        {/* Sender label for outbound */}
        {isOut && msg.sentBy && (
          <p className="mb-0.5 text-[10px] font-semibold text-[#d3ac76]">{msg.sentBy.name}</p>
        )}

        {/* Media / document */}
        {(msg.messageType === 'DOCUMENT' || msg.messageType === 'IMAGE') && (
          <div className="mb-1">
            {msg.mediaUrl ? (
              <button
                type="button"
                onClick={() => downloadMedia(msg.mediaUrl!, msg.mediaFileName ?? undefined)}
                className="flex w-full items-center gap-2 rounded-md border border-white/20 bg-white/10 px-2 py-1.5 text-xs font-medium hover:bg-white/20"
              >
                <FileText className="h-4 w-4 shrink-0" />
                {msg.mediaFileName ?? (msg.messageType === 'IMAGE' ? 'imagen' : 'documento')}
              </button>
            ) : (
              <div className="flex items-center gap-2 rounded-md border border-white/20 bg-white/10 px-2 py-1.5 text-xs font-medium opacity-60">
                <FileText className="h-4 w-4 shrink-0" />
                {msg.mediaFileName ?? 'archivo'}
              </div>
            )}
          </div>
        )}

        {/* Text content */}
        {msg.content && (
          <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
        )}

        {/* Timestamp */}
        <p
          className={cn(
            'mt-0.5 text-right text-[10px]',
            isOut ? 'text-white/50' : 'text-muted-foreground',
          )}
          title={dateLabel}
        >
          {time}
          {isOut && msg.status === 'FAILED' && (
            <span className="ml-1 text-red-400">✗</span>
          )}
        </p>
      </div>
    </div>
  )
}
