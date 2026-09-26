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
import { DispositivosService, DEVICE_COOKIE } from './dispositivos.service';
import { randomBytes } from 'crypto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permisos } from '../../common/decorators/permisos.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService, private readonly dispositivos: DispositivosService) {}

  @Public()
  @Throttle({ default: { limit: () => parseInt(process.env.RATE_LIMIT_LOGIN || '10', 10), ttl: 60000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión' })
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = (req.headers['user-agent'] || '').slice(0, 500);
    let deviceCookie = req.cookies?.[DEVICE_COOKIE];
    if (typeof deviceCookie !== 'string' || !/^[a-f0-9]{64}$/.test(deviceCookie)) deviceCookie = randomBytes(32).toString('hex');
    res.cookie(DEVICE_COOKIE, deviceCookie, { httpOnly: true, secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict', maxAge: 365 * 24 * 60 * 60 * 1000, path: '/api/v1' });
    const resultado = await this.authService.login(dto, ip, userAgent, deviceCookie);

    res.cookie('refresh_token', resultado.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api/v1/auth/refresh',
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
    const tokens = await this.authService.refresh(sub, refreshToken, req.user.deviceId, req.cookies?.[DEVICE_COOKIE]);

    res.cookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api/v1/auth/refresh',
    });

    return { accessToken: tokens.accessToken };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cerrar sesión' })
  @ApiBearerAuth()
  async logout(@CurrentUser('sub') userId: string, @Res({ passthrough: true }) res: Response) {
    res.clearCookie('refresh_token', { path: '/api/v1/auth/refresh' });
    return this.authService.logout(userId);
  }

  @Get('dispositivos')
  @Permisos('seguridad:ver')
  listar(@CurrentUser('sub') admin: string) { return this.dispositivos.listar(admin); }

  @Get('accesos')
  @Permisos('seguridad:ver')
  accesos(@CurrentUser('sub') admin: string) { return this.dispositivos.historial(admin); }

  @Patch('dispositivos/:id/aprobar')
  @Permisos('seguridad:aprobar')
  aprobar(@Param('id') id: string, @CurrentUser('sub') admin: string, @Req() req: Request) {
    return this.dispositivos.decidir(id, admin, 'aprobado', req.ip || 'unknown');
  }

  @Patch('dispositivos/:id/bloquear')
  @Permisos('seguridad:anular')
  bloquear(@Param('id') id: string, @CurrentUser('sub') admin: string, @Req() req: Request) {
    return this.dispositivos.decidir(id, admin, 'bloqueado', req.ip || 'unknown');
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
