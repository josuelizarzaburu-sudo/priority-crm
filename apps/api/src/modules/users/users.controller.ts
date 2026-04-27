import { Controller, Get, Post, Delete, Body, Param, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { UsersService } from './users.service'
import { CreateTeamMemberDto } from './dto/create-team-member.dto'

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getMe(@Req() req: any) {
    const { password: _, ...user } = req.user
    return user
  }

  @Get()
  @ApiOperation({ summary: 'List all team members in the organization' })
  getTeamMembers(@Req() req: any) {
    return this.usersService.findByOrganization(req.user.organizationId)
  }

  @Post()
  @ApiOperation({ summary: 'Create a new team member — ADMIN/MANAGER only' })
  createTeamMember(@Body() dto: CreateTeamMemberDto, @Req() req: any) {
    return this.usersService.createTeamMember(dto, req.user.organizationId, req.user.role)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a team member — ADMIN only' })
  removeTeamMember(@Param('id') id: string, @Req() req: any) {
    return this.usersService.removeTeamMember(id, req.user.organizationId, req.user.id, req.user.role)
  }
}
