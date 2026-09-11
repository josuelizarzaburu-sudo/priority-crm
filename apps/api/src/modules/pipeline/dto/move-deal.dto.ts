import { IsString, IsNumber, IsOptional, IsArray } from 'class-validator'

export class MoveDealDto {
  @IsString()
  stageId!: string

  @IsNumber()
  position!: number

  /**
   * Datos del seguro que se capturan al cerrar.
   *
   * El tipo es solo documentacion: con @IsArray la lista pasa entera y los
   * campos de dentro NO se recortan. Aun asi se declaran todos los que manda el
   * formulario, para que quede claro que viaja.
   *
   * Aqui faltaba "ramo", y era el motivo de que la inspeccion no se exigiera: el
   * modal mandaba ramo AUTO, pero el backend nunca lo veia y trataba el negocio
   * como si fuera de salud.
   */
  @IsOptional()
  @IsArray()
  insuranceData?: Array<{
    ramo?: string
    netPremium: number
    plan: string
    paymentFrequency?: string
    issueDate?: string
    holderName?: string
    aseguradora?: string
    identificacion?: string
    deducible?: string
    marca?: string
    modelo?: string
    anio?: number
    placa?: string
    sumaAsegurada?: number
  }>
}
