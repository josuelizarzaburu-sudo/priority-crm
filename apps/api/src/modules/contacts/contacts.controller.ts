import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { ContactsService } from './contacts.service'
import { CreateContactDto } from './dto/create-contact.dto'
import { UpdateContactDto } from './dto/update-contact.dto'
import { ContactsQueryDto } from './dto/contacts-query.dto'
import { LogInteractionDto } from './dto/log-interaction.dto'

@ApiTags('Contacts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  @ApiOperation({ summary: 'List contacts — MEMBERs only see their own' })
  findAll(@Query() query: ContactsQueryDto, @Req() req: any) {
    return this.contactsService.findAll(req.user.organizationId, query, req.user.id, req.user.role)
  }

  @Get('search')
  @ApiOperation({ summary: 'Global search across contacts and deals' })
  search(@Query('q') q: string = '', @Req() req: any) {
    return this.contactsService.search(q, req.user.organizationId, req.user.id, req.user.role)
  }

  @Get('check-duplicate')
  @ApiOperation({ summary: 'Check for duplicate contact by email or phone' })
  checkDuplicate(
    @Query('email') email: string,
    @Query('phone') phone: string,
    @Req() req: any,
  ) {
    return this.contactsService.checkDuplicate(email, phone, req.user.organizationId)
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.contactsService.findOne(id, req.user.organizationId, req.user.id, req.user.role)
  }

  @Post()
  create(@Body() dto: CreateContactDto, @Req() req: any) {
    return this.contactsService.create(dto, req.user.organizationId, req.user.id)
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateContactDto, @Req() req: any) {
    return this.contactsService.update(id, dto, req.user.organizationId)
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.contactsService.remove(id, req.user.organizationId)
  }

  @Get(':id/timeline')
  @ApiOperation({ summary: 'Get full contact interaction timeline' })
  getTimeline(@Param('id') id: string, @Req() req: any) {
    return this.contactsService.getTimeline(
      id,
      req.user.organizationId,
      req.user.id,
      req.user.role,
    )
  }

  @Post(':id/interaction')
  @ApiOperation({ summary: 'Log a contact interaction (call, WhatsApp, email, note)' })
  logInteraction(@Param('id') id: string, @Body() dto: LogInteractionDto, @Req() req: any) {
    return this.contactsService.logInteraction(
      id,
      dto,
      req.user.organizationId,
      req.user.id,
      req.user.role,
    )
  }
}
