import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CalendarService } from './calendar.service'
import { CreateCalendarEventDto } from './dto/create-calendar-event.dto'

@ApiTags('Calendar')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get('events')
  @ApiOperation({ summary: 'Get calendar events for a given month' })
  getEvents(
    @Query('year') year: string,
    @Query('month') month: string,
    @Req() req: any,
  ) {
    const y = parseInt(year) || new Date().getFullYear()
    const m = parseInt(month) || new Date().getMonth() + 1
    return this.calendarService.getEvents(req.user.organizationId, y, m)
  }

  @Post('events')
  @ApiOperation({ summary: 'Create a calendar event — MANAGER+ only' })
  createEvent(@Body() dto: CreateCalendarEventDto, @Req() req: any) {
    return this.calendarService.createEvent(dto, req.user.organizationId, req.user.id, req.user.role)
  }

  @Delete('events/:id')
  @ApiOperation({ summary: 'Delete a calendar event — MANAGER+ only' })
  deleteEvent(@Param('id') id: string, @Req() req: any) {
    return this.calendarService.deleteEvent(id, req.user.organizationId, req.user.role)
  }
}
