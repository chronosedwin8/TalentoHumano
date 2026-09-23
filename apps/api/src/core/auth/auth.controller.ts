import { Body, Controller, Delete, Get, HttpCode, Param, Post, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  verifyTwoFactorSchema,
  uuid,
  type LoginInput,
} from '@talento/shared';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { ClientIp, Ctx, Public, SkipTenant } from '../../common/decorators';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { RequestContext } from '../../common/types/request-context';
import { AuthService, type LoginResult } from './auth.service';

const REFRESH_COOKIE = 'talento_refresh';

/**
 * Throttle decorators are evaluated when the class loads, before the config
 * container exists, so they read the environment directly with the same
 * defaults that `configuration.ts` validates.
 */
const LOGIN_LIMIT = Number(process.env.AUTH_LOGIN_LIMIT ?? 60);
const REFRESH_LIMIT = Number(process.env.AUTH_REFRESH_LIMIT ?? 120);

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  private setRefreshCookie(res: Response, token: string): void {
    res.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.COOKIE_SECURE === 'true',
      domain: process.env.COOKIE_DOMAIN || undefined,
      path: '/',
      maxAge: 30 * 24 * 3600 * 1000,
    });
  }

  private present(result: LoginResult) {
    return {
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
      user: result.user,
    };
  }

  @Public()
  /**
   * Brute force is stopped per account (`failedLoginAttempts` + `lockedUntil`),
   * which is what actually protects a password. This IP limit only smooths out
   * traffic, so it has to fit a whole office signing in from one NAT address
   * at the start of the day without locking anybody out, and it is tunable
   * through `AUTH_LOGIN_LIMIT` for networks that need more room.
   */
  @Throttle({ default: { limit: LOGIN_LIMIT, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Inicia sesion y devuelve el token de acceso' })
  async login(
    @Body(new ZodValidationPipe(loginSchema)) dto: LoginInput,
    @ClientIp() ip: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.login(dto, { ip, userAgent: req.headers['user-agent'] });
    this.setRefreshCookie(res, result.refreshToken);
    return this.present(result);
  }

  @Public()
  /**
   * Generous on purpose: every full page load refreshes, and a whole office
   * behind one NAT address shares this counter, so a tight limit would log
   * legitimate users out. Refresh tokens are single use and rotate on every
   * call, so guessing is what the limit has to deter, not normal traffic.
   */
  @Throttle({ default: { limit: REFRESH_LIMIT, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Rota el token de refresco y emite un nuevo acceso' })
  async refresh(
    @Req() req: Request,
    @ClientIp() ip: string,
    @Res({ passthrough: true }) res: Response,
    @Body() body: { refreshToken?: string },
  ) {
    const token = (req as any).cookies?.[REFRESH_COOKIE] ?? body?.refreshToken;
    const result = await this.auth.refresh(token ?? '', {
      ip,
      userAgent: req.headers['user-agent'],
    });
    this.setRefreshCookie(res, result.refreshToken);
    return this.present(result);
  }

  @Post('logout')
  @SkipTenant()
  @HttpCode(204)
  @ApiOperation({ summary: 'Cierra la sesion actual' })
  async logout(@Ctx() ctx: RequestContext, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(ctx.sessionId);
    res.clearCookie(REFRESH_COOKIE, { path: '/' });
  }

  @Get('me')
  @SkipTenant()
  @ApiOperation({ summary: 'Usuario, empresa activa, permisos efectivos y modulos visibles' })
  async me(@Ctx() ctx: RequestContext) {
    return this.auth.buildSessionUser(ctx.userId, ctx.companyId || null, ctx.impersonatedBy);
  }

  @Post('switch-company/:companyId')
  @SkipTenant()
  @HttpCode(200)
  @ApiOperation({ summary: 'Cambia la empresa activa de la sesion' })
  async switchCompany(
    @Ctx() ctx: RequestContext,
    @Param('companyId', new ZodValidationPipe(uuid)) companyId: string,
    @ClientIp() ip: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.switchCompany(ctx, companyId, {
      ip,
      userAgent: req.headers['user-agent'],
    });
    this.setRefreshCookie(res, result.refreshToken);
    return this.present(result);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 300_000 } })
  @Post('forgot-password')
  @HttpCode(204)
  @ApiOperation({ summary: 'Envia el enlace de recuperacion (respuesta siempre 204)' })
  async forgotPassword(@Body(new ZodValidationPipe(forgotPasswordSchema)) dto: { email: string }) {
    await this.auth.forgotPassword(dto.email);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 300_000 } })
  @Post('reset-password')
  @HttpCode(204)
  @ApiOperation({ summary: 'Define una nueva contrasena con el token recibido' })
  async resetPassword(
    @Body(new ZodValidationPipe(resetPasswordSchema)) dto: { token: string; password: string },
  ) {
    await this.auth.resetPassword(dto.token, dto.password);
  }

  @Post('change-password')
  @SkipTenant()
  @HttpCode(204)
  @ApiOperation({ summary: 'Cambia la contrasena del usuario autenticado' })
  async changePassword(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(changePasswordSchema))
    dto: { currentPassword: string; newPassword: string },
  ) {
    await this.auth.changePassword(ctx, dto.currentPassword, dto.newPassword);
  }

  @Get('sessions')
  @SkipTenant()
  @ApiOperation({ summary: 'Sesiones activas del usuario' })
  async sessions(@Ctx() ctx: RequestContext) {
    return this.auth.listSessions(ctx.userId);
  }

  @Delete('sessions')
  @SkipTenant()
  @ApiOperation({ summary: 'Cierra todas las demas sesiones' })
  async revokeSessions(@Ctx() ctx: RequestContext) {
    return { revoked: await this.auth.logoutAll(ctx.userId, ctx.sessionId) };
  }

  @Post('2fa/setup')
  @SkipTenant()
  @ApiOperation({ summary: 'Genera el secreto TOTP para activar doble factor' })
  async setupTwoFactor(@Ctx() ctx: RequestContext) {
    return this.auth.startTwoFactor(ctx);
  }

  @Post('2fa/verify')
  @SkipTenant()
  @ApiOperation({ summary: 'Confirma el doble factor y devuelve codigos de recuperacion' })
  async verifyTwoFactor(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(verifyTwoFactorSchema)) dto: { code: string },
  ) {
    return this.auth.confirmTwoFactor(ctx, dto.code);
  }

  @Post('2fa/disable')
  @SkipTenant()
  @HttpCode(204)
  @ApiOperation({ summary: 'Desactiva el doble factor' })
  async disableTwoFactor(
    @Ctx() ctx: RequestContext,
    @Body(new ZodValidationPipe(z.object({ password: z.string().min(1) })))
    dto: { password: string },
  ) {
    await this.auth.disableTwoFactor(ctx, dto.password);
  }

  @Post('impersonate/:userId')
  @HttpCode(200)
  @ApiOperation({ summary: 'Suplantacion segura de un usuario (auditada)' })
  async impersonate(
    @Ctx() ctx: RequestContext,
    @Param('userId', new ZodValidationPipe(uuid)) userId: string,
    @ClientIp() ip: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.impersonate(ctx, userId, {
      ip,
      userAgent: req.headers['user-agent'],
    });
    this.setRefreshCookie(res, result.refreshToken);
    return this.present(result);
  }
}
