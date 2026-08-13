import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

/**
 * Acceso a Priority Help, activado usuario por usuario.
 *
 * Cada consulta al bot cuesta dinero, asi que el acceso no se reparte por
 * rol: se enciende asesor por asesor desde la pantalla de Usuarios. Un
 * vendedor nuevo entra SIN acceso hasta que se lo activen a mano.
 *
 * SUPER_ADMIN siempre pasa, para no quedarse fuera de su propia
 * herramienta ni tener que activarse a si mismo.
 *
 * Se consulta la base en vez de leer el JWT porque el token puede haberse
 * emitido antes de quitarle el permiso a alguien: si se leyera del token,
 * seguiria entrando hasta que la sesion caduque.
 */
@Injectable()
export class PriorityHelpAccessGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest()
    const userId = req.user?.id
    if (!userId) throw new ForbiddenException('Sesión no válida.')

    if (req.user?.role === 'SUPER_ADMIN') return true

    const user = await (this.prisma as any).user.findUnique({
      where: { id: userId },
      select: { puedePriorityHelp: true },
    })

    if (!user?.puedePriorityHelp) {
      throw new ForbiddenException(
        'No tienes acceso a Priority Help. Pídeselo a tu administrador.',
      )
    }
    return true
  }
}
