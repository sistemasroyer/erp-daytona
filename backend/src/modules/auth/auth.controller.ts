import {
  Controller,
  Post,
  Body,
  Get,
  Patch,
  Param,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permisos } from '../../common/decorators/permisos.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: () => parseInt(process.env.RATE_LIMIT_LOGIN || '10', 10), ttl: 60000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión' })
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || '';
    const resultado = await this.authService.login(dto, ip, userAgent);

    res.cookie('refresh_token', resultado.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/auth/refresh',
    });

    return {
      accessToken: resultado.accessToken,
      usuario: resultado.usuario,
    };
  }

  @Public()
  @UseGuards(AuthGuard('jwt-refresh'))
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Renovar access token' })
  async refresh(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    const { sub, refreshToken } = req.user;
    const tokens = await this.authService.refresh(sub, refreshToken);

    res.cookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/auth/refresh',
    });

    return { accessToken: tokens.accessToken };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cerrar sesión' })
  @ApiBearerAuth()
  async logout(@CurrentUser('sub') userId: string, @Res({ passthrough: true }) res: Response) {
    res.clearCookie('refresh_token', { path: '/auth/refresh' });
    return this.authService.logout(userId);
  }

  @Post('dispositivos/registrar')
  @ApiOperation({ summary: 'Registrar dispositivo actual' })
  @ApiBearerAuth()
  async registrarDispositivo(
    @Body() dto: RegisterDeviceDto,
    @CurrentUser('sub') userId: string,
    @Req() req: Request,
  ) {
    const ip = req.ip || 'unknown';
    return this.authService.registrarDispositivo(userId, dto, ip);
  }

  @Get('dispositivos/pendientes')
  @Permisos('seguridad:ver')
  @ApiOperation({ summary: 'Listar dispositivos pendientes de aprobación' })
  @ApiBearerAuth()
  async getDispositivosPendientes() {
    return this.authService.getDispositivosPendientes();
  }

  @Patch('dispositivos/:id/aprobar')
  @Permisos('seguridad:aprobar')
  @ApiOperation({ summary: 'Aprobar dispositivo' })
  @ApiBearerAuth()
  async aprobarDispositivo(@Param('id') id: string, @CurrentUser('sub') adminId: string) {
    return this.authService.aprobarDispositivo(id, adminId);
  }

  @Patch('dispositivos/:id/bloquear')
  @Permisos('seguridad:anular')
  @ApiOperation({ summary: 'Bloquear dispositivo' })
  @ApiBearerAuth()
  async bloquearDispositivo(@Param('id') id: string, @CurrentUser('sub') adminId: string) {
    return this.authService.bloquearDispositivo(id, adminId);
  }

  @Post('cambiar-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cambiar contraseña' })
  @ApiBearerAuth()
  async cambiarPassword(
    @CurrentUser('sub') userId: string,
    @Body() body: { password_actual: string; password_nuevo: string },
  ) {
    return this.authService.cambiarPassword(userId, body.password_actual, body.password_nuevo);
  }

  @Get('perfil')
  @ApiOperation({ summary: 'Obtener perfil del usuario autenticado' })
  @ApiBearerAuth()
  async getPerfil(@CurrentUser() user: any) {
    return user;
  }
}
