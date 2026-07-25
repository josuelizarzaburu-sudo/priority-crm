import { Module } from '@nestjs/common'
import { SeedController } from './seed.controller'
import { SeedService } from './seed.service'

// Módulo TEMPORAL para la carga inicial de Operaciones. Quitar de AppModule
// una vez que los datos estén cargados.
@Module({
  controllers: [SeedController],
  providers: [SeedService],
})
export class SeedModule {}
