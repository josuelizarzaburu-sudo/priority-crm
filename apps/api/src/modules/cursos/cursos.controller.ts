import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CursosService } from './cursos.service'

// Ojo: la API usa forbidNonWhitelisted. Estos endpoints reciben estructuras
// anidadas (preguntas con sus opciones), asi que se tipan como any a proposito y
// la validacion vive en el servicio, donde puede dar mensajes utiles del estilo
// "la pregunta 2 no tiene marcada la respuesta correcta".

@ApiTags('Cursos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('cursos')
export class CursosController {
  constructor(private readonly service: CursosService) {}

  @Get()
  @ApiOperation({ summary: 'Cursos visibles, con el avance de quien consulta' })
  listar(@Req() req: any) {
    return this.service.listar(req.user.organizationId, req.user.id, req.user.role)
  }

  @Get('mis-certificados')
  @ApiOperation({ summary: 'Certificados obtenidos por el usuario' })
  misCertificados(@Req() req: any) {
    return this.service.misCertificados(req.user.organizationId, req.user.id)
  }

  @Get('reporte')
  @ApiOperation({ summary: 'Quién completó qué — solo administración' })
  reporte(@Req() req: any) {
    return this.service.reporte(req.user.organizationId, req.user.role)
  }

  @Get('modulos/:id')
  @ApiOperation({ summary: 'Abrir un módulo: video y preguntas, sin las respuestas' })
  abrirModulo(@Param('id') id: string, @Req() req: any) {
    return this.service.abrirModulo(id, req.user.organizationId, req.user.id)
  }

  @Post('modulos/:id/responder')
  @ApiOperation({ summary: 'Corregir las respuestas del módulo' })
  responder(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.service.responderModulo(
      id,
      body?.respuestas ?? [],
      req.user.organizationId,
      req.user.id,
    )
  }

  // ─── Administración ────────────────────────────────────────────────────

  @Post()
  crearCurso(@Body() dto: any, @Req() req: any) {
    return this.service.crearCurso(dto, req.user.organizationId, req.user.id, req.user.role)
  }

  @Patch(':id')
  actualizarCurso(@Param('id') id: string, @Body() dto: any, @Req() req: any) {
    return this.service.actualizarCurso(id, dto, req.user.organizationId, req.user.role)
  }

  @Delete(':id')
  eliminarCurso(@Param('id') id: string, @Req() req: any) {
    return this.service.eliminarCurso(id, req.user.organizationId, req.user.role)
  }

  @Post(':id/modulos')
  crearModulo(@Param('id') id: string, @Body() dto: any, @Req() req: any) {
    return this.service.crearModulo(id, dto, req.user.organizationId, req.user.role)
  }

  @Patch('modulos/:id')
  actualizarModulo(@Param('id') id: string, @Body() dto: any, @Req() req: any) {
    return this.service.actualizarModulo(id, dto, req.user.organizationId, req.user.role)
  }

  @Delete('modulos/:id')
  eliminarModulo(@Param('id') id: string, @Req() req: any) {
    return this.service.eliminarModulo(id, req.user.organizationId, req.user.role)
  }

  @Get('modulos/:id/preguntas')
  @ApiOperation({ summary: 'Preguntas con sus respuestas — solo para editarlas' })
  preguntas(@Param('id') id: string, @Req() req: any) {
    return this.service.preguntasDeModulo(id, req.user.organizationId, req.user.role)
  }

  @Put('modulos/:id/preguntas')
  @ApiOperation({ summary: 'Reemplaza todas las preguntas del módulo' })
  guardarPreguntas(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.service.guardarPreguntas(
      id,
      body?.preguntas ?? [],
      req.user.organizationId,
      req.user.role,
    )
  }
}
