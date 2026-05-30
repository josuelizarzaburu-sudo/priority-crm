import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common'
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

  @Patch('me')
  @ApiOperation({ summary: 'Update own profile (name, phone)' })
  updateMe(@Body() body: { name?: string; phone?: string }, @Req() req: any) {
    return this.usersService.updateProfile(req.user.id, body)
  }

  @Patch(':id/phone')
  @ApiOperation({ summary: 'Update phone of any team member — ADMIN/MANAGER only' })
  updateMemberPhone(@Param('id') id: string, @Body() body: { phone: string | null }, @Req() req: any) {
    return this.usersService.updateMemberPhone(id, body.phone, req.user.organizationId, req.user.role)
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
