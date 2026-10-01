import { Prisma } from '@prisma/client';

type Db = Pick<Prisma.TransactionClient, 'tbl_autorizaciones' | 'tbl_auditoria' | 'tbl_usuarios'>;

export type RecursoHistorial = 'ventas' | 'compras' | 'gastos' | 'ordenes_compra' | 'toma_inventario' | 'letras_paquetes';

interface UsuarioResumen { nombre: string; apellido: string }

export interface AnulacionDocumento {
  fecha: Date;
  motivo: string | null;
  /** Quien anuló el documento. */
  anulado_por: UsuarioResumen | null;
  /** Supervisor que autorizó la anulación con su PIN (null en anulaciones anteriores a las aprobaciones). */
  autorizado_por: UsuarioResumen | null;
}

export interface EventoHistorial {
  fecha: Date;
  usuario: UsuarioResumen | null;
  operacion: 'INSERT' | 'UPDATE' | 'DELETE';
  /** Acción de la ruta (ej. "anular", "canjear"); null = alta o edición simple. */
  accion: string | null;
}

/** Datos mínimos del documento para la anulación de respaldo (ver `obtenerAnulacion`). */
interface DocumentoBase {
  id: string;
  anulado: boolean;
  motivo?: string | null;
  usuario_modificacion?: string | null;
  fecha_modificacion?: Date;
}

/** Quién anuló el documento y quién lo autorizó. Sale de la aprobación con PIN que exige toda
 * anulación (`tbl_autorizaciones`). Para documentos anulados antes de que existieran las
 * aprobaciones se usa, como respaldo, el último usuario que modificó el registro. */
async function obtenerAnulacion(db: Db, recurso: RecursoHistorial, doc: DocumentoBase): Promise<AnulacionDocumento | null> {
  if (!doc.anulado) return null;
  const autorizacion = await db.tbl_autorizaciones.findFirst({
    where: { recurso, id_documento: doc.id, accion: 'anular', usada_en: { not: null } },
    orderBy: { usada_en: 'desc' },
    include: {
      solicitante: { select: { nombre: true, apellido: true } },
      aprobador: { select: { nombre: true, apellido: true } },
    },
  });
  if (autorizacion) {
    return {
      fecha: autorizacion.usada_en!,
      motivo: autorizacion.motivo,
      anulado_por: autorizacion.solicitante,
      autorizado_por: autorizacion.aprobador,
    };
  }
  const usuario = doc.usuario_modificacion
    ? await db.tbl_usuarios.findFirst({ where: { id: doc.usuario_modificacion }, select: { nombre: true, apellido: true } })
    : null;
  return {
    fecha: doc.fecha_modificacion ?? new Date(0),
    motivo: doc.motivo ?? null,
    anulado_por: usuario,
    autorizado_por: null,
  };
}

/** Todas las operaciones registradas sobre el documento (auditoría global), de la más antigua a la más nueva. */
async function obtenerEventos(db: Db, idDocumento: string): Promise<EventoHistorial[]> {
  const eventos = await db.tbl_auditoria.findMany({
    where: { id_registro: idDocumento },
    orderBy: { fecha: 'asc' },
    select: { fecha: true, operacion: true, accion: true, usuario: { select: { nombre: true, apellido: true } } },
    take: 200,
  });
  return eventos.map((e) => ({ fecha: e.fecha, usuario: e.usuario, operacion: e.operacion, accion: e.accion }));
}

/** `{ anulacion, historial }` para agregar a la respuesta del detalle de un documento. */
export async function historialDocumento(db: Db, recurso: RecursoHistorial, doc: DocumentoBase) {
  const [anulacion, historial] = await Promise.all([obtenerAnulacion(db, recurso, doc), obtenerEventos(db, doc.id)]);
  return { anulacion, historial };
}
