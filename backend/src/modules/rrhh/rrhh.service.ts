import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { IsString, IsNotEmpty, IsOptional, IsEmail, IsNumber, IsEnum, IsDateString, Min } from 'class-validator';

export class CreatePersonalDto {
  @IsString() @IsNotEmpty() dni: string;
  @IsString() @IsNotEmpty() nombres: string;
  @IsString() @IsNotEmpty() apellidos: string;
  @IsOptional() @IsString() cargo?: string;
  @IsOptional() @IsString() area?: string;
  @IsDateString() fecha_ingreso: string;
  @IsOptional() @IsDateString() fecha_cese?: string;
  @IsNumber() @Min(0) sueldo: number;
  @IsOptional() @IsString() cuenta_bancaria?: string;
  @IsOptional() @IsString() banco?: string;
  @IsOptional() @IsString() cci?: string;
  @IsOptional() @IsEnum(['indefinido', 'plazo_fijo', 'services', 'practicas', 'locacion_servicios'])
  tipo_contrato?: 'indefinido' | 'plazo_fijo' | 'services' | 'practicas' | 'locacion_servicios';
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() telefono?: string;
}

@Injectable()
export class RrhhService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreatePersonalDto, creadorId: string) {
    const existente = await this.prisma.tbl_personal.findFirst({
      where: { dni: dto.dni, eliminado: false },
    });
    if (existente) throw new ConflictException('Ya existe personal con ese DNI');

    return this.prisma.tbl_personal.create({
      data: {
        dni: dto.dni,
        nombres: dto.nombres,
        apellidos: dto.apellidos,
        cargo: dto.cargo,
        area: dto.area,
        fecha_ingreso: new Date(dto.fecha_ingreso),
        fecha_cese: dto.fecha_cese ? new Date(dto.fecha_cese) : null,
        sueldo: dto.sueldo,
        cuenta_bancaria: dto.cuenta_bancaria,
        banco: dto.banco,
        cci: dto.cci,
        tipo_contrato: (dto.tipo_contrato as any) || 'indefinido',
        email: dto.email,
        telefono: dto.telefono,
        usuario_creacion: creadorId,
      },
    });
  }

  async findAll(pagination: PaginationDto & { area?: string }) {
    const where: any = { eliminado: false };
    if (pagination.search) {
      where.OR = [
        { nombres: { contains: pagination.search, mode: 'insensitive' } },
        { apellidos: { contains: pagination.search, mode: 'insensitive' } },
        { dni: { contains: pagination.search } },
        { cargo: { contains: pagination.search, mode: 'insensitive' } },
      ];
    }
    if (pagination.area) where.area = { equals: pagination.area, mode: 'insensitive' };

    const [data, total] = await Promise.all([
      this.prisma.tbl_personal.findMany({
        where,
        skip: Number(pagination.skip) || 0,
        take: Number(pagination.limit) || 20,
        orderBy: [{ apellidos: 'asc' }, { nombres: 'asc' }],
      }),
      this.prisma.tbl_personal.count({ where }),
    ]);

    return { data, total, page: pagination.page, limit: pagination.limit };
  }

  async findOne(id: string) {
    const p = await this.prisma.tbl_personal.findFirst({ where: { id, eliminado: false } });
    if (!p) throw new NotFoundException('Personal no encontrado');
    return p;
  }

  async update(id: string, dto: Partial<CreatePersonalDto>, modificadorId: string) {
    await this.findOne(id);
    const data: any = { usuario_modificacion: modificadorId };
    const campos = ['nombres', 'apellidos', 'cargo', 'area', 'sueldo', 'cuenta_bancaria', 'banco', 'cci', 'tipo_contrato', 'email', 'telefono'];
    for (const c of campos) {
      if (dto[c] !== undefined) data[c] = dto[c];
    }
    if (dto.fecha_ingreso) data.fecha_ingreso = new Date(dto.fecha_ingreso);
    if (dto.fecha_cese) data.fecha_cese = new Date(dto.fecha_cese);

    return this.prisma.tbl_personal.update({ where: { id }, data });
  }

  async remove(id: string, modificadorId: string) {
    await this.findOne(id);
    return this.prisma.tbl_personal.update({
      where: { id },
      data: { eliminado: true, estado: false, usuario_modificacion: modificadorId },
    });
  }

  async getAreas() {
    const areas = await this.prisma.tbl_personal.findMany({
      where: { eliminado: false, area: { not: null } },
      select: { area: true },
      distinct: ['area'],
    });
    return areas.map((a) => a.area).filter(Boolean);
  }
}
