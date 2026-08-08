import { ApiProperty } from '@nestjs/swagger'
import { IsIn, IsString, ValidateIf } from 'class-validator'

/**
 * Mueve un lead al lote de otro equipo.
 *
 * Ojo: la API usa forbidNonWhitelisted, asi que cualquier campo extra que mande
 * el cliente tumba TODA la peticion con 400.
 */
export class CambiarEquipoDealDto {
  @ApiProperty({
    description: 'Id del equipo dueño del lead. null lo devuelve a la bolsa común.',
    nullable: true,
  })
  // null es un valor valido a proposito: es como se saca un lead de un equipo
  // sin ponerlo en otro.
  @ValidateIf((_, valor) => valor !== null)
  @IsString()
  equipoId!: string | null
}

/** Corrige el origen de un lead ya creado. Cambia la comisión, por eso es de gerencia. */
export class CambiarOrigenDealDto {
  @IsIn(['PRIORITY_HEALTH', 'PRIORITY', 'PROPIO'])
  leadOrigin!: 'PRIORITY_HEALTH' | 'PRIORITY' | 'PROPIO'
}
