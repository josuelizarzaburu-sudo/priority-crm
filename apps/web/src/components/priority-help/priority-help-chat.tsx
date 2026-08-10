'use client'

import { useState, useRef, useEffect } from 'react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Send, FileText, Loader2, Calculator } from 'lucide-react'
import Link from 'next/link'

interface Mensaje {
  role: 'user' | 'assistant'
  content: string
  fuentes?: string[]
}

const SUGERENCIAS = [
  '¿Cuál es la carencia de maternidad en BMI Sigma?',
  'Compara CONFIPLUS 30K Red 1 TOP con Red 2',
  'El cliente dice que ya tiene IESS, ¿qué le respondo?',
  '¿Qué cubre Proteger de Humana en trasplantes?',
]

export function PriorityHelpChat() {
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [entrada, setEntrada] = useState('')
  const [cargando, setCargando] = useState(false)
  const finRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes, cargando])

  async function enviar(texto?: string) {
    const contenido = (texto ?? entrada).trim()
    if (!contenido || cargando) return

    const nuevos: Mensaje[] = [...mensajes, { role: 'user', content: contenido }]
    setMensajes(nuevos)
    setEntrada('')
    setCargando(true)

    try {
      const { data } = await api.post('/priority-help/chat', {
        // Solo role y content: la API usa forbidNonWhitelisted, cualquier
        // campo extra (como `fuentes`) tumbaria la peticion con 400.
        messages: nuevos.map((m) => ({ role: m.role, content: m.content })),
      })
      setMensajes([
        ...nuevos,
        { role: 'assistant', content: data.respuesta, fuentes: data.fuentes },
      ])
    } catch {
      setMensajes([
        ...nuevos,
        {
          role: 'assistant',
          content: 'No pude conectarme. Revisa tu conexión e intenta de nuevo.',
        },
      ])
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <header className="border-b pb-4">
        <h1 className="text-2xl font-semibold">Priority Help</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Consulta coberturas, carencias y exclusiones. Responde solo desde los
          documentos oficiales y cita su fuente.
        </p>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calculator className="h-3.5 w-3.5" />
          No cotiza ni estima precios. Para valores usa el{' '}
          <Link href="/cotizador" className="font-medium underline">
            cotizador
          </Link>
          .
        </p>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto py-4">
        {mensajes.length === 0 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Prueba con:</p>
            {SUGERENCIAS.map((s) => (
              <button
                key={s}
                onClick={() => enviar(s)}
                className="block w-full rounded-lg border p-3 text-left text-sm transition hover:bg-accent"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {mensajes.map((m, i) => (
          <div
            key={i}
            className={cn(
              'flex',
              m.role === 'user' ? 'justify-end' : 'justify-start',
            )}
          >
            <div
              className={cn(
                'max-w-[85%] rounded-lg px-4 py-3',
                m.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted',
              )}
            >
              <p className="whitespace-pre-wrap text-sm">{m.content}</p>

              {m.fuentes && m.fuentes.length > 0 && (
                <div className="mt-3 border-t pt-2">
                  <p className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground">
                    <FileText className="h-3 w-3" />
                    Documentos consultados
                  </p>
                  <ul className="space-y-0.5">
                    {m.fuentes.map((f) => (
                      <li key={f} className="text-xs text-muted-foreground">
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ))}

        {cargando && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Buscando en los documentos...
          </div>
        )}

        <div ref={finRef} />
      </div>

      <div className="flex gap-2 border-t pt-4">
        <input
          value={entrada}
          onChange={(e) => setEntrada(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              enviar()
            }
          }}
          placeholder="¿Qué necesitas saber?"
          className="flex-1 rounded-lg border px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          disabled={cargando}
        />
        <button
          onClick={() => enviar()}
          disabled={cargando || !entrada.trim()}
          className="rounded-lg bg-primary px-4 py-2 text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
