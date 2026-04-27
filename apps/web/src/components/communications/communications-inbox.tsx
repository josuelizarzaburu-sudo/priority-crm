'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Send, MessageSquare } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useCommunicationsStore } from '@/store'
import { api } from '@/lib/api'
import { cn, getInitials } from '@/lib/utils'
import type { Conversation, Message } from '@priority-crm/shared'
import { CommunicationChannel } from '@priority-crm/shared'

const CHANNEL_LABEL: Record<CommunicationChannel, string> = {
  [CommunicationChannel.WHATSAPP]: 'WhatsApp',
  [CommunicationChannel.EMAIL]: 'Email',
  [CommunicationChannel.VOIP]: 'VoIP',
  [CommunicationChannel.SMS]: 'SMS',
}

export function CommunicationsInbox() {
  const { conversations, activeConversationId, messages, setConversations, setActiveConversation, setMessages } =
    useCommunicationsStore()
  const [messageText, setMessageText] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()

  const { data: conversationsData } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => api.get('/communications/conversations').then((r) => r.data),
  })

  useEffect(() => {
    if (conversationsData) setConversations(conversationsData)
  }, [conversationsData, setConversations])

  const { data: messagesData } = useQuery({
    queryKey: ['messages', activeConversationId],
    queryFn: () =>
      api.get(`/communications/conversations/${activeConversationId}/messages`).then((r) => r.data),
    enabled: !!activeConversationId,
  })

  useEffect(() => {
    if (messagesData && activeConversationId) setMessages(activeConversationId, messagesData)
  }, [messagesData, activeConversationId, setMessages])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, activeConversationId])

  const sendMutation = useMutation({
    mutationFn: (content: string) =>
      api.post(`/communications/conversations/${activeConversationId}/messages`, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', activeConversationId] })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      setMessageText('')
    },
  })

  function handleSend() {
    if (!messageText.trim() || !activeConversationId) return
    sendMutation.mutate(messageText.trim())
  }

  const activeMessages = activeConversationId ? (messages[activeConversationId] ?? []) : []
  const activeConversation = conversations.find((c) => c.id === activeConversationId)

  return (
    <div className="flex h-full overflow-hidden rounded-lg border bg-card">
      {/* Conversation list */}
      <div className="flex w-80 shrink-0 flex-col border-r">
        <div className="border-b px-4 py-3">
          <h2 className="font-semibold">Inbox</h2>
        </div>
        <ScrollArea className="flex-1">
          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
              <MessageSquare className="h-8 w-8" />
              <p className="text-sm">No conversations yet</p>
            </div>
          ) : (
            conversations.map((conversation) => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                isActive={conversation.id === activeConversationId}
                onClick={() => setActiveConversation(conversation.id)}
              />
            ))
          )}
        </ScrollArea>
      </div>

      {/* Chat area */}
      <div className="flex flex-1 flex-col">
        {activeConversation ? (
          <>
            <div className="flex items-center gap-3 border-b px-4 py-3">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="text-sm">
                  {activeConversation.contact
                    ? getInitials(
                        `${activeConversation.contact.firstName} ${activeConversation.contact.lastName ?? ''}`,
                      )
                    : '?'}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-sm">
                  {activeConversation.contact
                    ? `${activeConversation.contact.firstName} ${activeConversation.contact.lastName ?? ''}`.trim()
                    : 'Unknown'}
                </p>
                <Badge variant="outline" className="text-xs">
                  {CHANNEL_LABEL[activeConversation.channel]}
                </Badge>
              </div>
            </div>

            <ScrollArea className="flex-1 p-4">
              <div className="space-y-3">
                {activeMessages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            <Separator />
            <div className="flex items-center gap-2 p-3">
              <Input
                placeholder="Type a message..."
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                className="flex-1"
              />
              <Button size="icon" onClick={handleSend} disabled={!messageText.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
            <MessageSquare className="h-10 w-10" />
            <p className="text-sm">Select a conversation to start messaging</p>
          </div>
        )}
      </div>
    </div>
  )
}

function ConversationItem({
  conversation,
  isActive,
  onClick,
}: {
  conversation: Conversation
  isActive: boolean
  onClick: () => void
}) {
  const contactName = conversation.contact
    ? `${conversation.contact.firstName} ${conversation.contact.lastName ?? ''}`.trim()
    : 'Unknown'
  const lastMessage = conversation.messages?.[0]
  const unread = conversation._count?.messages ?? 0

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50',
        isActive && 'bg-muted',
      )}
    >
      <Avatar className="h-9 w-9 shrink-0">
        <AvatarFallback className="text-sm">{getInitials(contactName)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <span className="truncate text-sm font-medium">{contactName}</span>
          <Badge variant="outline" className="ml-1 shrink-0 text-xs">
            {CHANNEL_LABEL[conversation.channel]}
          </Badge>
        </div>
        {lastMessage && (
          <p className="truncate text-xs text-muted-foreground">{lastMessage.content}</p>
        )}
      </div>
      {unread > 0 && (
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
          {unread}
        </span>
      )}
    </button>
  )
}

function MessageBubble({ message }: { message: Message }) {
  const isOutbound = message.direction === 'OUTBOUND'
  return (
    <div className={cn('flex', isOutbound ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[70%] rounded-2xl px-4 py-2 text-sm',
          isOutbound
            ? 'rounded-br-sm bg-primary text-primary-foreground'
            : 'rounded-bl-sm bg-muted',
        )}
      >
        {message.content}
      </div>
    </div>
  )
}
