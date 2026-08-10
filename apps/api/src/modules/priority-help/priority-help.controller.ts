import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { PriorityHelpService } from './priority-help.service'
import { KbLoader } from './kb.loader'
import { PriorityHelpDto } from './dto/priority-help.dto'

// Mismo alcance que el Cotizador en el sidebar: comercial + operaciones
// + super admin. Si esto cambia, hay que cambiarlo tambien en el sidebar
// del frontend, porque son dos listas separadas.
const ROLES_HELP = [
  'SUPER_ADMIN',
  'OWNER',
  'MANAGER',
  'SALES_REP',
  'OPERACIONES',
  'JEFE_OPERACIONES',
]

@ApiTags('Priority Help')
@ApiBearerAuth()
@Controller('priority-help')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ROLES_HELP)
export class PriorityHelpController {
  constructor(
    private readonly service: PriorityHelpService,
    private readonly kb: KbLoader,
  ) {}

  @Post('chat')
  @ApiOperation({ summary: 'Consulta de apoyo a la venta sobre coberturas' })
  chat(@Body() dto: PriorityHelpDto) {
    return this.service.responder(dto.messages)
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
