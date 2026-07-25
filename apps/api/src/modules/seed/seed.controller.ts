import { Controller, Post, Get, Query, HttpCode, HttpStatus } from '@nestjs/common'
import { ApiTags, ApiOperation } from '@nestjs/swagger'
import { SeedService } from './seed.service'

// Endpoint TEMPORAL para la carga inicial del módulo de Operaciones.
// Protegido por un token secreto (env SEED_SECRET). Se puede llamar desde el
// navegador. Una vez cargados los datos, este módulo debe quitarse.
@ApiTags('Seed')
@Controller('seed')
export class SeedController {
  constructor(private readonly seedService: SeedService) {}

  // GET para poder dispararlo desde el navegador con un simple enlace.
  @Get('operaciones')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Carga inicial de Operaciones (temporal, protegido por token)' })
  async runGet(@Query('secret') secret: string, @Query('password') password: string) {
    return this.run(secret, password)
  }

  @Post('operaciones')
  @HttpCode(HttpStatus.OK)
  async runPost(@Query('secret') secret: string, @Query('password') password: string) {
    return this.run(secret, password)
  }

  private async run(secret: string, password: string) {
    const esperado = process.env.SEED_SECRET
    if (!esperado || secret !== esperado) {
      return { ok: false, error: 'Token inválido o SEED_SECRET no configurado' }
    }
    const pass = password || process.env.SEED_DEFAULT_PASSWORD
    if (!pass) {
      return { ok: false, error: 'Falta la contraseña (parámetro password o env SEED_DEFAULT_PASSWORD)' }
    }
    return this.seedService.cargarOperaciones(pass)
  }
}
