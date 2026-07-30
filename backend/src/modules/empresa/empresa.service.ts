import { Injectable, NotFoundException } from '@nestjs/common';
import {
  IsString, IsOptional, IsEmail,
} from 'class-validator';
import { PrismaService } from '../../database/prisma.service';

export class UpdateEmpresaDto {
  @IsOptional() @IsString() razon_social?: string;
  @IsOptional() @IsString() nombre_comercial?: string;
  @IsOptional() @IsString() direccion?: string;
  @IsOptional() @IsString() ubigeo?: string;
  @IsOptional() @IsString() departamento?: string;
  @IsOptional() @IsString() provincia?: string;
  @IsOptional() @IsString() distrito?: string;
  @IsOptional() @IsString() telefono?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() web?: string;
  @IsOptional() @IsString() regimen_tributario?: string;
  @IsOptional() @IsString() logo_base64?: string;
}

@Injectable()
export class EmpresaService {
  constructor(private prisma: PrismaService) {}

  async obtener() {
    const empresa = await this.prisma.tbl_empresas.findFirst({ where: { eliminado: false } });
    if (!empresa) throw new NotFoundException('No hay empresa configurada');
    return empresa;
  }

  async actualizar(dto: UpdateEmpresaDto, usuarioId: string) {
    const empresa = await this.obtener();
    return this.prisma.tbl_empresas.update({
      where: { id: empresa.id },
      data: { ...dto, usuario_modificacion: usuarioId },
    });
  }
}
