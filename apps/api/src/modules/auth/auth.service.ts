import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import * as bcrypt from 'bcryptjs'
import { UsersService } from '../users/users.service'
import { RegisterDto } from './dto/register.dto'

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmail(email)
    if (!user) throw new UnauthorizedException('Invalid credentials')
    const valid = await bcrypt.compare(password, user.password)
    if (!valid) throw new UnauthorizedException('Invalid credentials')
    const { password: _, ...result } = user
    return result
  }

  async register(dto: RegisterDto) {
    const existing = await this.usersService.findByEmail(dto.email)
    if (existing) throw new ConflictException('Email already registered')
    const hashed = await bcrypt.hash(dto.password, 12)
    const user = await this.usersService.create({ ...dto, password: hashed })
    const { password: _, ...result } = user
    return { user: result, ...this.generateTokens(result) }
  }

  async login(user: any) {
    return { user, ...this.generateTokens(user) }
  }

  async refreshToken(token: string) {
    try {
      const payload = this.jwtService.verify(token, {
        secret: this.config.get('JWT_SECRET'),
      })
      const user = await this.usersService.findById(payload.sub)
      if (!user) throw new UnauthorizedException()
      const { password: _, ...result } = user
      return this.generateTokens(result)
    } catch {
      throw new UnauthorizedException('Invalid refresh token')
    }
  }

  private generateTokens(user: any) {
    const payload = { sub: user.id, email: user.email, role: user.role }
    return {
      accessToken: this.jwtService.sign(payload),
      refreshToken: this.jwtService.sign(payload, {
        expiresIn: this.config.get('JWT_REFRESH_EXPIRY', '7d'),
      }),
    }
  }
}
