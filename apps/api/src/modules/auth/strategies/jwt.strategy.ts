import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { ConfigService } from '@nestjs/config'
import { UsersService } from '../../users/users.service'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_SECRET'),
    })
  }

  async validate(payload: { sub: string; email: string; role: string }) {
    const user = await this.usersService.findById(payload.sub)
    if (!user) throw new UnauthorizedException()

    // Corte inmediato al desactivar la cuenta.
    //
    // Esta comprobacion corre en CADA peticion, asi que apagar el interruptor
    // deja a la persona fuera al instante: no hay que esperar a que caduque su
    // token de acceso (12 horas) ni el de renovacion (7 dias). Ese era el hueco
    // de cambiar la contrasena, que no cerraba la sesion abierta.
    if ((user as any).activo === false) {
      throw new UnauthorizedException('Esta cuenta está desactivada')
    }

    const { password: _, ...result } = user
    return result
  }
}
