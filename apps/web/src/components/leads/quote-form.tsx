'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, CheckCircle2, Shield, Car, Dumbbell, Sofa, ShieldCheck, ShieldOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

const schema = z.object({
  firstName: z.string().min(2, 'Ingresa tu nombre'),
  lastName: z.string().optional(),
  phone: z.string().min(8, 'Ingresa un teléfono válido'),
  email: z.string().email('Ingresa un email válido').optional().or(z.literal('')),
  insuranceType: z.enum(['SALUD', 'AUTO'], { required_error: 'Selecciona el tipo de seguro' }),
  sport: z.boolean().optional(),
  insured: z.boolean().optional(),
  autoData: z.object({
    marca: z.string().optional(),
    modelo: z.string().optional(),
    anio: z.string().optional(),
    placa: z.string().optional(),
    ciudad: z.string().optional(),
    cedulaRuc: z.string().optional(),
    edad: z.string().optional(),
    estadoCivil: z.string().optional(),
    sexo: z.string().optional(),
  }).optional(),
})

type FormValues = z.infer<typeof schema>

const INSURANCE_OPTIONS = [
  { value: 'SALUD', label: 'Seguro de Salud', description: 'Cobertura médica para ti y tu familia', icon: Shield },
  { value: 'AUTO', label: 'Seguro de Auto', description: 'Protección para tu vehículo', icon: Car },
] as const

const SPORT_OPTIONS = [
  { value: true,  label: 'Sí, hago deporte', icon: Dumbbell },
  { value: false, label: 'No hago deporte',   icon: Sofa },
] as const

const INSURED_OPTIONS = [
  { value: true,  label: 'Sí, tengo seguro',   icon: ShieldCheck },
  { value: false, label: 'No tengo seguro',     icon: ShieldOff },
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
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { sport: false, insured: false },
  })

  const selectedInsurance = watch('insuranceType')
  const selectedSport = watch('sport')
  const selectedInsured = watch('insured')
  const isAuto = selectedInsurance === 'AUTO'

  async function onSubmit(values: FormValues) {
    setError(null)
    try {
      const body: Record<string, unknown> = {
        firstName: values.firstName,
        lastName: values.lastName,
        phone: values.phone,
        email: values.email,
        insuranceType: values.insuranceType,
        source: 'WEB',
      }

      if (isAuto) {
        body.autoData = {
          ...values.autoData,
          nombrePropietario: `${values.firstName}${values.lastName ? ` ${values.lastName}` : ''}`,
        }
      } else {
        body.sport = values.sport
        body.insured = values.insured
      }

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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
            <Input id="phone" type="tel" placeholder="+593 99 123 4567" {...register('phone')} />
            {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email (opcional)</Label>
            <Input id="email" type="email" placeholder="juan@ejemplo.com" {...register('email')} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>

          {/* ── SALUD fields ──────────────────────────────────────────────── */}
          {!isAuto && (
            <>
              <div className="space-y-2">
                <Label>¿Practicas deporte regularmente? *</Label>
                <div className="grid grid-cols-2 gap-3">
                  {SPORT_OPTIONS.map(({ value, label, icon: Icon }) => (
                    <button
                      key={String(value)}
                      type="button"
                      onClick={() => setValue('sport', value, { shouldValidate: true })}
                      className={cn(
                        'flex flex-col items-center gap-2 rounded-lg border-2 p-3 text-center transition-all hover:border-primary/60',
                        selectedSport === value
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-border text-muted-foreground',
                      )}
                    >
                      <Icon className="h-6 w-6" />
                      <span className="text-sm font-medium">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>¿Ya cuentas con un seguro? *</Label>
                <div className="grid grid-cols-2 gap-3">
                  {INSURED_OPTIONS.map(({ value, label, icon: Icon }) => (
                    <button
                      key={String(value)}
                      type="button"
                      onClick={() => setValue('insured', value, { shouldValidate: true })}
                      className={cn(
                        'flex flex-col items-center gap-2 rounded-lg border-2 p-3 text-center transition-all hover:border-primary/60',
                        selectedInsured === value
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-border text-muted-foreground',
                      )}
                    >
                      <Icon className="h-6 w-6" />
                      <span className="text-sm font-medium">{label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── AUTO fields ───────────────────────────────────────────────── */}
          {isAuto && (
            <div className="space-y-4">
              <p className="text-sm font-medium text-muted-foreground">🚗 Datos del vehículo</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Marca *</Label>
                  <Input placeholder="Toyota" {...register('autoData.marca')} />
                </div>
                <div className="space-y-1.5">
                  <Label>Modelo *</Label>
                  <Input placeholder="Corolla" {...register('autoData.modelo')} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Año *</Label>
                  <Input placeholder="2020" {...register('autoData.anio')} />
                </div>
                <div className="space-y-1.5">
                  <Label>Placa *</Label>
                  <Input placeholder="ABC-1234" {...register('autoData.placa')} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Ciudad donde circula *</Label>
                <Input placeholder="Quito" {...register('autoData.ciudad')} />
              </div>

              <p className="text-sm font-medium text-muted-foreground pt-1">🪪 Datos del propietario</p>
              <div className="space-y-1.5">
                <Label>Cédula o RUC *</Label>
                <Input placeholder="1234567890" {...register('autoData.cedulaRuc')} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Edad</Label>
                  <Input placeholder="35" {...register('autoData.edad')} />
                </div>
                <div className="space-y-1.5">
                  <Label>Estado civil</Label>
                  <Select onValueChange={(v) => setValue('autoData.estadoCivil', v)}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="soltero">Soltero/a</SelectItem>
                      <SelectItem value="casado">Casado/a</SelectItem>
                      <SelectItem value="divorciado">Divorciado/a</SelectItem>
                      <SelectItem value="viudo">Viudo/a</SelectItem>
                      <SelectItem value="unión libre">Unión libre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Sexo</Label>
                  <Select onValueChange={(v) => setValue('autoData.sexo', v)}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="masculino">Masculino</SelectItem>
                      <SelectItem value="femenino">Femenino</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

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
