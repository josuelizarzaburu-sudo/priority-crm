import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common'
import { ApiTags, ApiOperation } from '@nestjs/swagger'
import { Throttle, ThrottlerGuard } from '@nestjs/throttler'
import { LeadsService } from './leads.service'
import { IngestLeadDto } from './dto/ingest-lead.dto'

@ApiTags('Leads')
@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  // Endpoint publico (formulario de cotizacion de la web). Sin limite, cualquiera
  // podia automatizar miles de leads falsos, ensuciar el pipeline y disparar
  // notificaciones sin parar. 10 por hora por IP es holgado para una persona real
  // llenando el formulario y corta el envio masivo.
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 3600000 } })
  @ApiOperation({ summary: 'Submit a new lead from the public quote form' })
  ingestLead(@Body() dto: IngestLeadDto) {
    return this.leadsService.ingestLead(dto)
  }
}
