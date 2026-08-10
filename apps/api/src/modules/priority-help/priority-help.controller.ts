import { Controller, Post, Get, Body, Query, Req, UseGuards } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { PriorityHelpService } from './priority-help.service'
import { KbLoader } from './kb.loader'
import { PriorityHelpDto } from './dto/priority-help.dto'

// FASE DE PRUEBAS: solo SUPER_ADMIN.
//
// El bot todavia no se ha validado con preguntas reales de venta. Abrirlo
// al equipo antes de eso multiplica los errores: mas gente, mas rapido y
// con menos supervision.
//
// Para abrirlo despues hay que cambiarlo en TRES lugares, que son listas
// separadas: aca, en apps/web/src/app/(dashboard)/priority-help/page.tsx
// y en el sidebar. El alcance previsto es el mismo del Cotizador:
//   [...COMUNES, 'SUPER_ADMIN']
const ROLES_HELP = ['SUPER_ADMIN']

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
