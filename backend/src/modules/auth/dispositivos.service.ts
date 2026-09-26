import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { LoginDto } from './dto/login.dto';

export const DEVICE_COOKIE = 'erp_device';
export const deviceKey = (cookie: string, userId: string) => createHash('sha256').update(`${cookie}:${userId}`).digest('hex');
const selection = {
  id: true, id_usuario: true, ip: true, ultima_ip: true, navegador: true, sistema_operativo: true,
  user_agent: true, datos: true, estado: true, fecha_creacion: true, ultimo_uso: true,
  aprobado_en: true, usuario_modificacion: true,
  usuario: { select: { nombre: true, apellido: true, email: true } },
} as const;

@Injectable()
export class DispositivosService {
  constructor(private readonly prisma: PrismaService) {}

  async acceso(userId: string, superadmin: boolean, cookie: string, ip: string, agent: string, dto: LoginDto) {
    const key = deviceKey(cookie, userId);
    const ua = agent.slice(0, 500);
    const navegador = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'No identificado';
    const sistema = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS / iPadOS' : /Windows/.test(ua) ? 'Windows' : /Macintosh/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'No identificado';
    const dispositivo = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('device-enrollment'))`;
      const actual = await tx.tbl_dispositivos.findUnique({ where: { token_dispositivo: key } });
      if (actual) {
        if (actual.eliminado || !actual.estado_registro) throw new ForbiddenException('Dispositivo deshabilitado. Contacte al administrador.');
        return tx.tbl_dispositivos.update({ where: { id: actual.id }, data: { ultima_ip: ip, ultimo_uso: new Date() } });
      }
      // La marca persiste aunque el equipo inicial se bloquee: no hay reapertura automática.
      const inicializado = await tx.tbl_dispositivos.findFirst({ where: { aprobado_en: { not: null } } });
      const inicial = superadmin && !inicializado;
      const creado = await tx.tbl_dispositivos.create({ data: {
        id_usuario: userId, token_dispositivo: key, ip, ultima_ip: ip, navegador, sistema_operativo: sistema,
        user_agent: ua, ultimo_uso: new Date(), estado: inicial ? 'aprobado' : 'pendiente',
        aprobado_en: inicial ? new Date() : null, usuario_modificacion: inicial ? userId : null,
        datos: { tipo: /Mobile|Android|iPhone|iPad/.test(ua) ? 'Móvil / tableta' : 'Computadora',
          zona_horaria: dto.zona_horaria ?? null, idioma: dto.idioma ?? null, pantalla: dto.pantalla ?? null,
          latitud: dto.latitud ?? null, longitud: dto.longitud ?? null, precision: dto.precision ?? null },
      } });
      await tx.tbl_logs_acceso.create({ data: { id_usuario: userId, ip, accion: 'dispositivo',
        resultado: inicial ? 'inicial_aprobado' : 'pendiente', detalle: creado.id, user_agent: ua } });
      return creado;
    });
    if (dispositivo.estado !== 'aprobado') {
      await this.prisma.tbl_logs_acceso.create({ data: { id_usuario: userId, ip, accion: 'login',
        resultado: dispositivo.estado, detalle: dispositivo.id, user_agent: ua } });
      throw new ForbiddenException(dispositivo.estado === 'pendiente'
        ? 'Este dispositivo está pendiente de aprobación. El administrador debe autorizarlo en Administración → Dispositivos. Después vuelva a iniciar sesión.'
        : 'Dispositivo bloqueado. Contacte al administrador.');
    }
    return dispositivo.id;
  }

  async validar(userId: string, id: string | undefined, cookie: string | undefined) {
    if (!id || !cookie || !/^[a-f0-9]{64}$/.test(cookie)) throw new UnauthorizedException('Vuelva a iniciar sesión para verificar este dispositivo');
    const dispositivo = await this.prisma.tbl_dispositivos.findFirst({ where: {
      id, id_usuario: userId, token_dispositivo: deviceKey(cookie, userId), estado: 'aprobado',
      eliminado: false, estado_registro: true,
    } });
    if (!dispositivo) throw new UnauthorizedException('El dispositivo no está autorizado. Contacte al administrador.');
  }

  private async administrador(id: string, accion: 'ver' | 'aprobar' | 'anular') {
    const u = await this.prisma.tbl_usuarios.findFirst({ where: { id, estado: true, eliminado: false },
      include: { roles: { where: { estado: true, eliminado: false }, include: { rol: { include: {
        permisos: { where: { estado: true, eliminado: false }, include: { permiso: true } },
      } } } } } });
    const roles = u?.roles.filter(r => r.rol.estado && !r.rol.eliminado) ?? [];
    if (!u || (u.bloqueado_hasta && u.bloqueado_hasta > new Date()) || !roles.some(r => r.rol.es_superadmin || r.rol.permisos.some(p =>
      p.permiso.estado && !p.permiso.eliminado && p.permiso.modulo === 'seguridad' && p.permiso.accion === accion))) {
      throw new ForbiddenException('No tiene permiso para administrar dispositivos');
    }
  }

  async listar(admin: string) {
    await this.administrador(admin, 'ver');
    const dispositivos = await this.prisma.tbl_dispositivos.findMany({ where: { eliminado: false }, select: selection,
      orderBy: { fecha_creacion: 'desc' }, take: 200 });
    const ids = [...new Set(dispositivos.map(d => d.usuario_modificacion).filter((id): id is string => !!id))];
    const usuarios = await this.prisma.tbl_usuarios.findMany({ where: { id: { in: ids } }, select: { id: true, nombre: true, apellido: true } });
    const nombres = new Map(usuarios.map(u => [u.id, `${u.nombre} ${u.apellido}`]));
    return dispositivos.map(d => ({ ...d, responsable: d.usuario_modificacion ? nombres.get(d.usuario_modificacion) : null }));
  }

  async decidir(id: string, admin: string, estado: 'aprobado' | 'bloqueado', ip: string) {
    await this.administrador(admin, estado === 'aprobado' ? 'aprobar' : 'anular');
    return this.prisma.$transaction(async tx => {
      const d = await tx.tbl_dispositivos.findFirst({ where: { id, eliminado: false, estado_registro: true } });
      if (!d) throw new BadRequestException('Dispositivo no encontrado');
      const actualizado = await tx.tbl_dispositivos.update({ where: { id }, data: {
        estado, usuario_modificacion: admin, ...(estado === 'aprobado' ? { aprobado_en: new Date() } : {}),
      }, select: selection });
      await tx.tbl_logs_acceso.create({ data: { id_usuario: admin, ip, accion: 'dispositivo', resultado: estado,
        detalle: `Dispositivo ${id}; usuario ${d.id_usuario}` } });
      return actualizado;
    });
  }

  async historial(admin: string) {
    await this.administrador(admin, 'ver');
    return this.prisma.tbl_logs_acceso.findMany({ orderBy: { fecha: 'desc' }, take: 200,
      include: { usuario: { select: { nombre: true, apellido: true } } } });
  }
}
