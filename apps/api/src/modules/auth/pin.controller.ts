import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { IsString, Length, Matches } from 'class-validator'
import { JwtAuthGuard } from './guards/jwt-auth.guard'
import { PinService } from './pin.service'

// Ojo: la API usa forbidNonWhitelisted, asi que cualquier campo no declarado
// aqui tumba TODA la peticion con 400.

export class ConfigurarPinDto {
  @IsString()
  @Matches(/^\d{6}$/, { message: 'El PIN debe tener 6 dígitos' })
  pin!: string

  /** Contraseña escrita a mano. Es lo que impide que quien robe el teléfono
   *  se configure un PIN nuevo con la contraseña guardada del navegador. */
  @IsString()
  @Length(1, 200)
  password!: string
}

export class VerificarPinDto {
  @IsString()
  @Matches(/^\d{6}$/, { message: 'El PIN debe tener 6 dígitos' })
  pin!: string
}

@ApiTags('PIN')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('auth/pin')
export class PinController {
  constructor(private readonly service: PinService) {}

  @Get('estado')
  @ApiOperation({ summary: 'Si el usuario ya tiene PIN configurado' })
  estado(@Req() req: any) {
    return this.service.estado(req.user.id)
  }

  @Post('configurar')
  @ApiOperation({ summary: 'Crear o cambiar el PIN — exige la contraseña' })
  configurar(@Body() dto: ConfigurarPinDto, @Req() req: any) {
    return this.service.configurar(req.user.id, dto.pin, dto.password)
  }

  @Post('verificar')
  @ApiOperation({ summary: 'Desbloquear con el PIN' })
  verificar(@Body() dto: VerificarPinDto, @Req() req: any) {
    return this.service.verificar(req.user.id, dto.pin)
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Borrar el PIN de otra persona — solo SUPER_ADMIN' })
  borrar(@Param('id') id: string, @Req() req: any) {
    return this.service.borrarDeOtro(id, req.user.organizationId, req.user.role)
  }
}
