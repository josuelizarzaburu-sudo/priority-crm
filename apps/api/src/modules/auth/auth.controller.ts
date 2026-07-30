import { Controller, Post, Body, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common'
import { ApiTags, ApiOperation } from '@nestjs/swagger'
import { AuthService } from './auth.service'
import { RegisterDto } from './dto/register.dto'
import { LocalAuthGuard } from './guards/local-auth.guard'
import { RefreshTokenDto } from './dto/refresh-token.dto'
import { Throttle } from '@nestjs/throttler'

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // El registro tambien se limita: si no, se puede usar para tantear que correos
  // ya existen, o para llenar la base de cuentas basura.
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto)
  }

  // Limite propio y estrecho: el login es lo que se ataca probando contrasenias.
  // 5 intentos por minuto desde la misma IP. El limite general de la API (100 por
  // minuto) es demasiado holgado para esto.
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(LocalAuthGuard)
  @ApiOperation({ summary: 'Login with email and password' })
  login(@Req() req: any) {
    return this.authService.login(req.user)
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto.refreshToken)
  }
}
