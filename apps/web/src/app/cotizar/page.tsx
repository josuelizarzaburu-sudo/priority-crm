import type { Metadata } from 'next'
import { Shield } from 'lucide-react'
import { QuoteForm } from '@/components/leads/quote-form'

export const metadata: Metadata = {
  title: 'Cotiza tu Seguro | Priority CRM',
  description: 'Obtén una cotización gratuita para tu seguro de Salud o Auto en menos de 24 horas.',
}

export default function CotizarPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-background">
      <div className="mx-auto max-w-lg px-4 py-12 space-y-8">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <Shield className="h-7 w-7 text-primary" />
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Seguros Priority</h1>
          <p className="text-muted-foreground">
            Encuentra el seguro perfecto para ti. Cotización sin costo ni compromiso.
          </p>
        </div>

        <QuoteForm />
      </div>
    </main>
  )
}
