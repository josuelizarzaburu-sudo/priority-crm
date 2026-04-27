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

@ApiTags('Contacts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  @ApiOperation({ summary: 'List contacts with filters and pagination' })
  findAll(@Query() query: ContactsQueryDto, @Req() req: any) {
    return this.contactsService.findAll(req.user.organizationId, query)
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.contactsService.findOne(id, req.user.organizationId)
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
  @ApiOperation({ summary: 'Get 360° contact timeline' })
  getTimeline(@Param('id') id: string, @Req() req: any) {
    return this.contactsService.getTimeline(id, req.user.organizationId)
  }
}
