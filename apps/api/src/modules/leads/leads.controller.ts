import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common'
import { ApiTags, ApiOperation } from '@nestjs/swagger'
import { LeadsService } from './leads.service'
import { IngestLeadDto } from './dto/ingest-lead.dto'

@ApiTags('Leads')
@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit a new lead from the public quote form' })
  ingestLead(@Body() dto: IngestLeadDto) {
    return this.leadsService.ingestLead(dto)
  }
}
