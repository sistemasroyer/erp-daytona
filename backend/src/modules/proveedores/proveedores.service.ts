import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PeruApiService } from '../peru-api/peru-api.service';
import { IsString, IsNotEmpty, IsOptional, IsEmail, IsNumber, Min, Length } from 'class-validator';

export class CreateProveedorDto {
  @IsString() @IsNotEmpty() @Length(11, 11) ruc: string;
  @IsString() @IsNotEmpty() razon_social: string;
  @IsOptional() @IsString() nombre_comercial?: string;
  @IsOptional() @IsString() direccion?: string;
  @IsOptional() @IsString() ubigeo?: string;
  @IsOptional() @IsString() departamento?: string;
  @IsOptional() @IsString() provincia?: string;
  @IsOptional() @IsString() distrito?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() telefono?: string;
  @IsOptional() @IsString() contacto?: string;
  @IsOptional() @IsString() cuenta_detraccion?: string;
  @IsOptional() @IsString() banco_detraccion?: string;
  @IsOptional() @IsNumber() @Min(0) porcentaje_detraccion?: number;
  @IsOptional() @IsNumber() @Min(0) dias_credito?: number;
}

@Injectable()
export class ProveedoresService {
  constructor(
    private prisma: PrismaService,
    private peruApi: PeruApiService,
  ) {}

  async create(dto: CreateProveedorDto, creadorId: string) {
    const existente = await this.prisma.tbl_proveedores.findFirst({
      where: { ruc: dto.ruc, eliminado: false },
    });
    if (existente) throw new ConflictException('Ya existe un proveedor con ese RUC');

    return this.prisma.tbl_proveedores.create({
      data: { ...dto, usuario_creacion: creadorId } as any,
    });
  }

  async consultarRuc(ruc: string) {
    return this.peruApi.consultarRuc(ruc);
  }

  async findAll(pagination: PaginationDto) {
    const where: any = { eliminado: false };
    if (pagination.search) {
      where.OR = [
        { razon_social: { contains: pagination.search, mode: 'insensitive' } },
        { ruc: { contains: pagination.search } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.tbl_proveedores.findMany({
        where,
        skip: Number(pagination.skip) || 0,
        take: Number(pagination.limit) || 20,
        orderBy: { razon_social: 'asc' },
      }),
      this.prisma.tbl_proveedores.count({ where }),
    ]);

    return { data, total, page: pagination.page, limit: pagination.limit };
  }

  async findOne(id: string) {
    const proveedor = await this.prisma.tbl_proveedores.findFirst({
      where: { id, eliminado: false },
    });
    if (!proveedor) throw new NotFoundException('Proveedor no encontrado');
    return proveedor;
  }

  async update(id: string, dto: Partial<CreateProveedorDto>, modificadorId: string) {
    await this.findOne(id);
    return this.prisma.tbl_proveedores.update({
      where: { id },
      data: { ...dto, usuario_modificacion: modificadorId } as any,
    });
  }

  async remove(id: string, modificadorId: string) {
    await this.findOne(id);
    return this.prisma.tbl_proveedores.update({
      where: { id },
      data: { eliminado: true, estado: false, usuario_modificacion: modificadorId },
    });
  }
}
