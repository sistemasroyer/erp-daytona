import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';

import configuration from './config/configuration';
import { validationSchema } from './config/validation.schema';

import { PrismaModule } from './database/prisma.module';
import { PeruApiModule } from './modules/peru-api/peru-api.module';

import { AuthModule } from './modules/auth/auth.module';
import { UsuariosModule } from './modules/usuarios/usuarios.module';
import { RolesModule } from './modules/roles/roles.module';
import { PermisosModule } from './modules/permisos/permisos.module';
import { CategoriasModule } from './modules/categorias/categorias.module';
import { MarcasModule } from './modules/marcas/marcas.module';
import { UnidadesMedidaModule } from './modules/unidades-medida/unidades-medida.module';
import { AlmacenesModule } from './modules/almacenes/almacenes.module';
import { ClientesModule } from './modules/clientes/clientes.module';
import { ProveedoresModule } from './modules/proveedores/proveedores.module';
import { ProductosModule } from './modules/productos/productos.module';
import { InventarioModule } from './modules/inventario/inventario.module';
import { VentasModule } from './modules/ventas/ventas.module';
import { ComprasModule } from './modules/compras/compras.module';
import { OrdenesCompraModule } from './modules/ordenes-compra/ordenes-compra.module';
import { CajaModule } from './modules/caja/caja.module';
import { FacturacionModule } from './modules/facturacion/facturacion.module';
import { RrhhModule } from './modules/rrhh/rrhh.module';
import { ReportesModule } from './modules/reportes/reportes.module';
import { ConfigMargenesModule } from './modules/config-margenes/config-margenes.module';
import { TiposCambioModule } from './modules/tipos-cambio/tipos-cambio.module';
import { SeriesDocumentoModule } from './modules/series-documento/series-documento.module';
import { MetodosPagoModule } from './modules/metodos-pago/metodos-pago.module';

import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermisosGuard } from './common/guards/permisos.guard';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseTransformInterceptor } from './common/interceptors/response-transform.interceptor';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
      validationOptions: { allowUnknown: true },
    }),

    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ([{
        ttl: 60000,
        limit: config.get<number>('security.rateLimitGeneral') || 100,
      }]),
      inject: [ConfigService],
    }),

    EventEmitterModule.forRoot({
      wildcard: false,
      delimiter: '.',
      newListener: false,
      removeListener: false,
      maxListeners: 20,
      verboseMemoryLeak: true,
      ignoreErrors: false,
    }),

    PrismaModule,
    PeruApiModule,

    AuthModule,
    UsuariosModule,
    RolesModule,
    PermisosModule,
    CategoriasModule,
    MarcasModule,
    UnidadesMedidaModule,
    AlmacenesModule,
    ClientesModule,
    ProveedoresModule,
    ProductosModule,
    InventarioModule,
    VentasModule,
    ComprasModule,
    OrdenesCompraModule,
    CajaModule,
    FacturacionModule,
    RrhhModule,
    ReportesModule,
    ConfigMargenesModule,
    TiposCambioModule,
    SeriesDocumentoModule,
    MetodosPagoModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermisosGuard },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseTransformInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
