import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface DatosRuc {
  ruc: string;
  razon_social: string;
  nombre_comercial?: string;
  direccion?: string;
  ubigeo?: string;
  departamento?: string;
  provincia?: string;
  distrito?: string;
  estado?: string;
  condicion?: string;
}

export interface DatosPersona {
  dni: string;
  nombres: string;
  apellido_paterno: string;
  apellido_materno: string;
  nombre_completo: string;
}

const MOCK_RUC: Record<string, DatosRuc> = {
  '20123456789': {
    ruc: '20123456789',
    razon_social: 'EMPRESA DEMO S.A.C.',
    nombre_comercial: 'EMPRESA DEMO',
    direccion: 'AV. LARCO 1234 - MIRAFLORES',
    departamento: 'LIMA',
    provincia: 'LIMA',
    distrito: 'MIRAFLORES',
    estado: 'ACTIVO',
    condicion: 'HABIDO',
  },
};

const MOCK_DNI: Record<string, DatosPersona> = {
  '12345678': {
    dni: '12345678',
    nombres: 'JUAN CARLOS',
    apellido_paterno: 'GARCIA',
    apellido_materno: 'LOPEZ',
    nombre_completo: 'GARCIA LOPEZ, JUAN CARLOS',
  },
};

@Injectable()
export class PeruApiService {
  private readonly logger = new Logger(PeruApiService.name);

  constructor(private configService: ConfigService) {}

  async consultarRuc(ruc: string): Promise<DatosRuc> {
    if (!/^\d{11}$/.test(ruc)) {
      throw new BadRequestException('RUC debe tener exactamente 11 dígitos');
    }

    const provider = this.configService.get<string>('peruApi.provider');

    if (provider === 'mock') {
      const mock = MOCK_RUC[ruc];
      if (!mock) {
        return {
          ruc,
          razon_social: `EMPRESA CON RUC ${ruc}`,
          estado: 'ACTIVO',
          condicion: 'HABIDO',
        };
      }
      return mock;
    }

    try {
      const apiKey = this.configService.get<string>('peruApi.key');
      const apiUrl = this.configService.get<string>('peruApi.url');

      const response = await axios.get(`${apiUrl}/ruc/${ruc}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: 10000,
      });

      return this.mapearRucResponse(response.data, provider ?? 'mock');
    } catch (error) {
      this.logger.warn(`Error consultando RUC ${ruc}: ${error.message}`);
      throw new BadRequestException(`No se pudo consultar el RUC. Intente manualmente.`);
    }
  }

  async consultarDni(dni: string): Promise<DatosPersona> {
    if (!/^\d{8}$/.test(dni)) {
      throw new BadRequestException('DNI debe tener exactamente 8 dígitos');
    }

    const provider = this.configService.get<string>('peruApi.provider');

    if (provider === 'mock') {
      const mock = MOCK_DNI[dni];
      if (!mock) {
        return {
          dni,
          nombres: 'NOMBRE',
          apellido_paterno: 'APELLIDO',
          apellido_materno: 'PATERNO',
          nombre_completo: `APELLIDO PATERNO, NOMBRE (DNI: ${dni})`,
        };
      }
      return mock;
    }

    try {
      const apiKey = this.configService.get<string>('peruApi.key');
      const apiUrl = this.configService.get<string>('peruApi.url');

      const response = await axios.get(`${apiUrl}/dni/${dni}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: 10000,
      });

      return this.mapearDniResponse(response.data, provider ?? 'mock');
    } catch (error) {
      this.logger.warn(`Error consultando DNI ${dni}: ${error.message}`);
      throw new BadRequestException(`No se pudo consultar el DNI. Intente manualmente.`);
    }
  }

  async obtenerTipoCambio(fecha?: Date): Promise<{ compra: number; venta: number; fecha: string }> {
    const provider = this.configService.get<string>('peruApi.provider');
    const fechaStr = (fecha || new Date()).toISOString().split('T')[0];

    if (provider === 'mock') {
      return { compra: 3.72, venta: 3.75, fecha: fechaStr };
    }

    try {
      const response = await axios.get(
        `https://api.apis.net.pe/v2/sunat/tipo-de-cambio?fecha=${fechaStr}`,
        { timeout: 10000 },
      );
      return {
        compra: parseFloat(response.data.compra),
        venta: parseFloat(response.data.venta),
        fecha: fechaStr,
      };
    } catch (error) {
      this.logger.warn(`Error obteniendo tipo de cambio: ${error.message}`);
      return { compra: 3.75, venta: 3.78, fecha: fechaStr };
    }
  }

  private mapearRucResponse(data: any, provider: string): DatosRuc {
    if (provider === 'apiinti') {
      return {
        ruc: data.ruc,
        razon_social: data.razonSocial || data.razon_social,
        nombre_comercial: data.nombreComercial,
        direccion: data.direccion,
        departamento: data.departamento,
        provincia: data.provincia,
        distrito: data.distrito,
        estado: data.estado,
        condicion: data.condicion,
      };
    }
    return data;
  }

  private mapearDniResponse(data: any, provider: string): DatosPersona {
    if (provider === 'apiinti') {
      return {
        dni: data.numero,
        nombres: data.nombres,
        apellido_paterno: data.apellidoPaterno || data.apellido_paterno,
        apellido_materno: data.apellidoMaterno || data.apellido_materno,
        nombre_completo: `${data.apellidoPaterno} ${data.apellidoMaterno}, ${data.nombres}`,
      };
    }
    return data;
  }
}
