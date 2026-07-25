import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PeruApiService } from '../peru-api/peru-api.service';
import { IsString, IsNotEmpty, IsOptional, IsEmail, IsNumber, IsEnum, Min } from 'class-validator';

export class CreateClienteDto {
  @IsEnum(['DNI', 'RUC', 'CE', 'PASAPORTE']) tipo_documento: 'DNI' | 'RUC' | 'CE' | 'PASAPORTE';
  @IsString() @IsNotEmpty() numero_documento: string;
  @IsString() @IsNotEmpty() razon_social: string;
  @IsOptional() @IsString() nombre_comercial?: string;
  @IsOptional() @IsString() direccion?: string;
  @IsOptional() @IsString() ubigeo?: string;
  @IsOptional() @IsString() departamento?: string;
  @IsOptional() @IsString() provincia?: string;
  @IsOptional() @IsString() distrito?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() telefono?: string;
  @IsOptional() @IsNumber() @Min(0) limite_credito?: number;
  @IsOptional() @IsNumber() @Min(0) dias_credito?: number;
}

@Injectable()
export class ClientesService {
  constructor(
    private prisma: PrismaService,
    private peruApi: PeruApiService,
  ) {}

  async create(dto: CreateClienteDto, creadorId: string) {
    const existente = await this.prisma.tbl_clientes.findFirst({
      where: {
        tipo_documento: dto.tipo_documento as any,
        numero_documento: dto.numero_documento,
        eliminado: false,
      },
    });
    if (existente) throw new ConflictException('Ya existe un cliente con ese documento');

    return this.prisma.tbl_clientes.create({
      data: {
        tipo_documento: dto.tipo_documento as any,
        numero_documento: dto.numero_documento,
        razon_social: dto.razon_social,
        nombre_comercial: dto.nombre_comercial,
        direccion: dto.direccion,
        ubigeo: dto.ubigeo,
        departamento: dto.departamento,
        provincia: dto.provincia,
        distrito: dto.distrito,
        email: dto.email,
        telefono: dto.telefono,
        limite_credito: dto.limite_credito || 0,
        dias_credito: dto.dias_credito || 0,
        usuario_creacion: creadorId,
      },
    });
  }

  async consultarDni(dni: string) {
    return this.peruApi.consultarDni(dni);
  }

  async consultarRuc(ruc: string) {
    return this.peruApi.consultarRuc(ruc);
  }

  async findAll(pagination: PaginationDto) {
    const where: any = { eliminado: false };
    if (pagination.search) {
      where.OR = [
        { razon_social: { contains: pagination.search, mode: 'insensitive' } },
        { numero_documento: { contains: pagination.search } },
        { email: { contains: pagination.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.tbl_clientes.findMany({
        where,
        skip: Number(pagination.skip) || 0,
        take: Number(pagination.limit) || 20,
        orderBy: { razon_social: 'asc' },
      }),
      this.prisma.tbl_clientes.count({ where }),
    ]);

    return { data, total, page: pagination.page, limit: pagination.limit };
  }

  async findOne(id: string) {
    const cliente = await this.prisma.tbl_clientes.findFirst({
      where: { id, eliminado: false },
    });
    if (!cliente) throw new NotFoundException('Cliente no encontrado');
    return cliente;
  }

  async update(id: string, dto: Partial<CreateClienteDto>, modificadorId: string) {
    await this.findOne(id);

    return this.prisma.tbl_clientes.update({
      where: { id },
      data: { ...dto, usuario_modificacion: modificadorId } as any,
    });
  }

  async remove(id: string, modificadorId: string) {
    await this.findOne(id);
    return this.prisma.tbl_clientes.update({
      where: { id },
      data: { eliminado: true, estado: false, usuario_modificacion: modificadorId },
    });
  }
}
