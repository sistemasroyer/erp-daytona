import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { AnulacionAprobadaDto, ConfigurarPinDto, DocumentoAprobacionDto, RecursoAnulacion, SolicitarAprobacionDto } from './aprobaciones.dto';

@Injectable()
export class AprobacionesService {
  constructor(private readonly prisma: PrismaService) {}

  private async usuario(id: string, db: Prisma.TransactionClient = this.prisma) {
    const u = await db.tbl_usuarios.findFirst({
      where: { id, estado: true, eliminado: false },
      include: { roles: { where: { estado: true, eliminado: false }, include: {
        rol: { include: { permisos: { where: { estado: true, eliminado: false }, include: { permiso: true } } } },
      } } },
    });
    if (!u || (u.bloqueado_hasta && u.bloqueado_hasta > new Date())) throw new ForbiddenException('Usuario no autorizado');
    const roles = u.roles.filter((r) => r.rol.estado && !r.rol.eliminado);
    const superadmin = roles.some((r) => r.rol.es_superadmin);
    const permisos = new Set(roles.flatMap((r) => r.rol.permisos.filter((p) => p.permiso.estado && !p.permiso.eliminado)
      .map((p) => `${p.permiso.modulo}:${p.permiso.accion}`)));
    return { ...u, puede: (permiso: string) => superadmin || permisos.has(permiso), superadmin };
  }

  private modulo(recurso: RecursoAnulacion) { return recurso === 'toma_inventario' ? 'inventario' : recurso; }
  private async contexto(id: string, dto: DocumentoAprobacionDto, db: Prisma.TransactionClient = this.prisma) {
    const usuario = await this.usuario(id, db);
    if (!usuario.puede(`${this.modulo(dto.recurso)}:anular`)) throw new ForbiddenException('No tiene permiso para solicitar esta anulación');
    let documento: { eliminado?: boolean; id_punto_venta?: string | null; estado?: string | boolean; estado_venta?: string; estado_sunat?: string; pagado?: boolean } | null;
    switch (dto.recurso) {
      case 'ventas': documento = await db.tbl_ventas.findUnique({ where: { id: dto.id_documento } }); break;
      case 'compras': documento = await db.tbl_compras.findUnique({ where: { id: dto.id_documento } }); break;
      case 'gastos': documento = await db.tbl_gastos.findUnique({ where: { id: dto.id_documento } }); break;
      case 'ordenes_compra': documento = await db.tbl_ordenes_compra.findUnique({ where: { id: dto.id_documento } }); break;
      case 'toma_inventario': documento = await db.tbl_tomas_inventario.findUnique({ where: { id: dto.id_documento } }); break;
      default: throw new BadRequestException('Documento no soportado');
    }
    if (!documento || documento.eliminado) throw new NotFoundException('Documento no encontrado');
    if (documento.estado_sunat === 'aceptado' || documento.pagado) {
      throw new BadRequestException('El documento ya no permite anulación directa');
    }
    const pv = documento.id_punto_venta;
    if (pv && !usuario.superadmin && pv !== usuario.id_punto_venta) throw new ForbiddenException('Documento de otro punto de venta');
    const estado = documento.estado_venta ?? documento.estado;
    if (['anulada', 'anulado', 'canjeada', 'convertido', 'finalizada'].includes(String(estado ?? ''))) {
      throw new BadRequestException('El documento ya no permite anulación');
    }
    return { usuario, puntoVenta: pv ?? usuario.id_punto_venta };
  }

  private async supervisor(id: string, recurso?: RecursoAnulacion, puntoVenta?: string | null, db: Prisma.TransactionClient = this.prisma) {
    const u = await this.usuario(id, db);
    if (!u.puede('seguridad:aprobar') || (recurso && !u.puede(`${this.modulo(recurso)}:anular`))) {
      throw new ForbiddenException('El supervisor no tiene permiso para aprobar');
    }
    if (recurso && !u.superadmin && (!puntoVenta || puntoVenta !== u.id_punto_venta)) {
      throw new ForbiddenException('El supervisor no pertenece al punto de venta');
    }
    return u;
  }

  async estadoPin(id: string) {
    await this.supervisor(id);
    const c = await this.prisma.tbl_credenciales_aprobacion.findUnique({ where: { id_usuario: id } });
    return { configurado: !!c, activo: c?.activo ?? false, bloqueado_hasta: c?.bloqueado_hasta ?? null };
  }

  private async verificarPassword(id: string, password: string) {
    const u = await this.supervisor(id);
    if (!await bcrypt.compare(password, u.password_hash)) throw new ForbiddenException('Contraseña incorrecta');
  }

  async configurarPin(id: string, dto: ConfigurarPinDto) {
    await this.verificarPassword(id, dto.password);
    const pin_hash = await bcrypt.hash(dto.pin, 12);
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pin:${id}`}))`;
      await tx.tbl_credenciales_aprobacion.upsert({ where: { id_usuario: id },
        create: { id_usuario: id, pin_hash }, update: { pin_hash, activo: true, intentos_fallidos: 0, bloqueado_hasta: null } });
      await tx.tbl_autorizaciones.updateMany({ where: { id_aprobador: id, usada_en: null }, data: { vence_en: new Date() } });
    });
    return { activo: true };
  }

  async desactivarPin(id: string, password: string) {
    await this.verificarPassword(id, password);
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pin:${id}`}))`;
      await tx.tbl_credenciales_aprobacion.updateMany({ where: { id_usuario: id }, data: { activo: false } });
      await tx.tbl_autorizaciones.updateMany({ where: { id_aprobador: id, usada_en: null }, data: { vence_en: new Date() } });
    });
    return { activo: false };
  }

  async supervisores(id: string, dto: DocumentoAprobacionDto) {
    const { puntoVenta } = await this.contexto(id, dto);
    const candidatos = await this.prisma.tbl_credenciales_aprobacion.findMany({ where: { activo: true }, select: { id_usuario: true } });
    const resultado: { id: string; nombre: string }[] = [];
    for (const c of candidatos) {
      try {
        const u = await this.supervisor(c.id_usuario, dto.recurso, puntoVenta);
        resultado.push({ id: u.id, nombre: `${u.nombre} ${u.apellido}` });
      } catch (error) { if (!(error instanceof ForbiddenException)) throw error; }
    }
    return resultado;
  }

  async aprobar(id: string, dto: SolicitarAprobacionDto) {
    const resultado = await this.prisma.$transaction(async (tx) => {
      const { puntoVenta } = await this.contexto(id, dto, tx);
      await this.supervisor(dto.id_aprobador, dto.recurso, puntoVenta, tx);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pin:${dto.id_aprobador}`}))`;
      const c = await tx.tbl_credenciales_aprobacion.findUnique({ where: { id_usuario: dto.id_aprobador } });
      if (!c?.activo) throw new ForbiddenException('El supervisor no tiene un PIN activo');
      if (c.bloqueado_hasta && c.bloqueado_hasta > new Date()) throw new ForbiddenException('PIN bloqueado temporalmente. Intente más tarde');
      if (!await bcrypt.compare(dto.pin, c.pin_hash)) {
        const intentos = (c.bloqueado_hasta ? 0 : c.intentos_fallidos) + 1;
        await tx.tbl_credenciales_aprobacion.update({ where: { id_usuario: c.id_usuario }, data: {
          intentos_fallidos: intentos, bloqueado_hasta: intentos >= 5 ? new Date(Date.now() + 15 * 60000) : null,
        } });
        return null; // Confirmar el contador antes de devolver el error.
      }
      await tx.tbl_credenciales_aprobacion.update({ where: { id_usuario: c.id_usuario }, data: { intentos_fallidos: 0, bloqueado_hasta: null } });
      const token = randomBytes(32).toString('hex');
      const vence_en = new Date(Date.now() + 5 * 60000);
      await tx.tbl_autorizaciones.create({ data: {
        token_hash: this.hash(token), recurso: dto.recurso, id_documento: dto.id_documento,
        id_solicitante: id, id_aprobador: dto.id_aprobador, motivo: dto.motivo, vence_en,
      } });
      return { autorizacion: token, vence_en };
    }, { timeout: 15000 });
    if (!resultado) throw new ForbiddenException('PIN incorrecto');
    return resultado;
  }

  private hash(token: string) { return createHash('sha256').update(token).digest('hex'); }

  async consumir(tx: Prisma.TransactionClient, recurso: RecursoAnulacion, documento: string, solicitante: string, dto: AnulacionAprobadaDto) {
    if (!dto?.autorizacion || !dto.motivo?.trim()) throw new ForbiddenException('Se requiere aprobación del supervisor');
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${recurso}:${documento}`}))`;
    const tablas = { ventas: 'tbl_ventas', compras: 'tbl_compras', gastos: 'tbl_gastos',
      ordenes_compra: 'tbl_ordenes_compra', toma_inventario: 'tbl_tomas_inventario' };
    await tx.$queryRaw(Prisma.sql`SELECT id FROM ${Prisma.raw(tablas[recurso])} WHERE id = ${documento} FOR UPDATE`);
    const { puntoVenta } = await this.contexto(solicitante, { recurso, id_documento: documento }, tx);
    const a = await tx.tbl_autorizaciones.findUnique({ where: { token_hash: this.hash(dto.autorizacion) } });
    if (!a || a.recurso !== recurso || a.id_documento !== documento || a.id_solicitante !== solicitante
      || a.accion !== 'anular' || a.motivo !== dto.motivo.trim() || a.usada_en || a.vence_en <= new Date()) {
      throw new ForbiddenException('Autorización inválida, vencida o ya utilizada');
    }
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pin:${a.id_aprobador}`}))`;
    await this.supervisor(a.id_aprobador, recurso, puntoVenta, tx);
    const c = await tx.tbl_credenciales_aprobacion.findUnique({ where: { id_usuario: a.id_aprobador } });
    if (!c?.activo) throw new ForbiddenException('El PIN del supervisor está desactivado');
    const usado = await tx.tbl_autorizaciones.updateMany({
      where: { id: a.id, usada_en: null, vence_en: { gt: new Date() } }, data: { usada_en: new Date() },
    });
    if (usado.count !== 1) throw new ForbiddenException('Autorización vencida o ya utilizada');
  }

  async historial(id: string) {
    const u = await this.supervisor(id);
    const registros = await this.prisma.tbl_autorizaciones.findMany({
      where: u.superadmin ? {} : { id_aprobador: id }, orderBy: { fecha_creacion: 'desc' }, take: 100,
      select: { id: true, recurso: true, id_documento: true, motivo: true, fecha_creacion: true, vence_en: true, usada_en: true,
        solicitante: { select: { nombre: true, apellido: true } }, aprobador: { select: { nombre: true, apellido: true } } },
    });
    return Promise.all(registros.map(async (registro) => {
      const where = { id: registro.id_documento };
      let numero: string | undefined;
      switch (registro.recurso) {
        case 'ventas': numero = (await this.prisma.tbl_ventas.findUnique({ where, select: { numero_comprobante: true } }))?.numero_comprobante; break;
        case 'compras': numero = (await this.prisma.tbl_compras.findUnique({ where, select: { numero_interno: true } }))?.numero_interno; break;
        case 'gastos': numero = (await this.prisma.tbl_gastos.findUnique({ where, select: { numero_interno: true } }))?.numero_interno; break;
        case 'ordenes_compra': numero = (await this.prisma.tbl_ordenes_compra.findUnique({ where, select: { numero: true } }))?.numero; break;
        case 'toma_inventario': numero = (await this.prisma.tbl_tomas_inventario.findUnique({ where, select: { numero_interno: true } }))?.numero_interno; break;
      }
      return { ...registro, numero_documento: numero ?? 'Documento no disponible' };
    }));
  }
}
