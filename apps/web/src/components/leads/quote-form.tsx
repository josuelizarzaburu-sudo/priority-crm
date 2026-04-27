'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, CheckCircle2, Shield, Car } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const schema = z.object({
  firstName: z.string().min(2, 'Ingresa tu nombre'),
  lastName: z.string().optional(),
  phone: z.string().min(8, 'Ingresa un teléfono válido'),
  email: z.string().email('Ingresa un email válido').optional().or(z.literal('')),
  insuranceType: z.enum(['SALUD', 'AUTO'], { required_error: 'Selecciona el tipo de seguro' }),
})

type FormValues = z.infer<typeof schema>

const INSURANCE_OPTIONS = [
  { value: 'SALUD', label: 'Seguro de Salud', description: 'Cobertura médica para ti y tu familia', icon: Shield },
  { value: 'AUTO', label: 'Seguro de Auto', description: 'Protección para tu vehículo', icon: Car },
] as const

export function QuoteForm() {
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const selectedInsurance = watch('insuranceType')

  async function onSubmit(values: FormValues) {
    setError(null)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, source: 'WEB' }),
      })
      if (!res.ok) throw new Error('Server error')
      setSubmitted(true)
    } catch {
      setError('Ocurrió un error. Por favor intenta de nuevo.')
    }
  }

  if (submitted) {
    return (
      <Card className="text-center">
        <CardContent className="pt-10 pb-8 space-y-4">
          <div className="flex justify-center">
            <CheckCircle2 className="h-16 w-16 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold">¡Solicitud recibida!</h2>
          <p className="text-muted-foreground max-w-sm mx-auto">
            Un asesor se comunicará contigo en breve para ofrecerte la mejor cobertura.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Solicita tu cotización</CardTitle>
        <CardDescription>Sin costo ni compromiso. Te contactamos en menos de 24 horas.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Insurance type selector */}
          <div className="space-y-2">
            <Label>¿Qué tipo de seguro necesitas? *</Label>
            <div className="grid grid-cols-2 gap-3">
              {INSURANCE_OPTIONS.map(({ value, label, description, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setValue('insuranceType', value, { shouldValidate: true })}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-lg border-2 p-4 text-center transition-all hover:border-primary/60',
                    selectedInsurance === value
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border text-muted-foreground',
                  )}
                >
                  <Icon className="h-7 w-7" />
                  <span className="text-sm font-medium">{label}</span>
                  <span className="text-xs">{description}</span>
                </button>
              ))}
            </div>
            {errors.insuranceType && (
              <p className="text-xs text-destructive">{errors.insuranceType.message}</p>
            )}
          </div>

          {/* Name fields */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="firstName">Nombre *</Label>
              <Input id="firstName" placeholder="Juan" {...register('firstName')} />
              {errors.firstName && (
                <p className="text-xs text-destructive">{errors.firstName.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName">Apellido</Label>
              <Input id="lastName" placeholder="Pérez" {...register('lastName')} />
            </div>
          </div>

          {/* Contact info */}
          <div className="space-y-1.5">
            <Label htmlFor="phone">Teléfono / WhatsApp *</Label>
            <Input id="phone" type="tel" placeholder="+52 55 1234 5678" {...register('phone')} />
            {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email (opcional)</Label>
            <Input id="email" type="email" placeholder="juan@ejemplo.com" {...register('email')} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          )}

          <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Solicitar cotización gratuita
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Al enviar aceptas que un asesor se comunique contigo. Sin spam.
          </p>
        </form>
      </CardContent>
    </Card>
  )
}
