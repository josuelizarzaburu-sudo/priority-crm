import { Controller, Post, Get, Body, Query, Req, UseGuards } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { PriorityHelpAccessGuard } from './priority-help-access.guard'
import { PriorityHelpService } from './priority-help.service'
import { KbLoader } from './kb.loader'
import { PriorityHelpDto } from './dto/priority-help.dto'

// El ROL define quien PODRIA usar Priority Help; el permiso por usuario
// (puedePriorityHelp, ver PriorityHelpAccessGuard) define quien lo usa de
// verdad. Se hace asi porque cada consulta cuesta: el acceso se enciende
// asesor por asesor desde la pantalla de Usuarios, en vez de abrirlo a
// todo un rol de golpe.
//
// Mismo alcance de rol que el Cotizador. Nadie entra solo por el rol: sin
// el permiso individual, el guard lo rechaza. SUPER_ADMIN siempre pasa.
const ROLES_HELP = [
  'SUPER_ADMIN',
  'OWNER',
  'MANAGER',
  'SALES_REP',
  'JEFE_EQUIPO',
  'OPERACIONES',
  'JEFE_OPERACIONES',
]

@ApiTags('Priority Help')
@ApiBearerAuth()
@Controller('priority-help')
@UseGuards(JwtAuthGuard, RolesGuard, PriorityHelpAccessGuard)
@Roles(...ROLES_HELP)
export class PriorityHelpController {
  constructor(
    private readonly service: PriorityHelpService,
    private readonly kb: KbLoader,
  ) {}

  @Post('chat')
  @ApiOperation({ summary: 'Consulta de apoyo a la venta sobre coberturas' })
  chat(@Body() dto: PriorityHelpDto, @Req() req: any) {
    return this.service.responder(dto.messages, req.user?.id)
  }

  @Get('huecos')
  @ApiOperation({
    summary:
      'Consultas que el bot no supo responder. Es la lista de material que falta.',
  })
  huecos(@Query('dias') dias?: string) {
    return this.service.huecos(dias ? Number(dias) : 30)
  }

  @Get('documentos')
  @ApiOperation({ summary: 'Lista los documentos cargados en la base' })
  documentos() {
    return this.kb.todos().map((d) => ({
      archivo: d.archivo,
      aseguradora: d.aseguradora,
      tokens: d.tokens,
    }))
  }
}
