import { Controller, Get, HttpCode, HttpStatus, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  type AuthResponse,
  type ForgotPasswordInput,
  type LoginInput,
  type ResetPasswordInput,
} from '@meca/shared';
import type { Request, Response } from 'express';
import { env } from '../../config/env';

/** Límite por IP para endpoints sensibles (configurable; ver .env.example). */
const authLimit = (factor = 1) => ({ default: { limit: () => env().AUTH_RATE_LIMIT_PER_MINUTE * factor, ttl: 60_000 } });
import { CurrentUser, Public } from '../../common/auth/decorators';
import type { AuthenticatedUser } from '../../common/auth/auth-user';
import { ApiZodBody, ZBody } from '../../common/zod/zod.decorators';
import { AuthService, type IssuedSession } from '../application/auth.service';
import { CsrfHeaderGuard } from './csrf.guard';

export const REFRESH_COOKIE = 'meca_rt';
const COOKIE_PATH = '/api/v1/auth';

@ApiTags('Autenticación')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle(authLimit())
  @ApiOperation({ summary: 'Iniciar sesión (devuelve access token y fija cookie de refresh)' })
  @ApiZodBody(loginSchema)
  async login(@ZBody(loginSchema) body: LoginInput, @Res({ passthrough: true }) res: Response): Promise<AuthResponse> {
    return this.respond(res, await this.auth.login(body));
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(CsrfHeaderGuard)
  @Throttle(authLimit(3))
  @ApiOperation({ summary: 'Renovar access token con la cookie de refresh (rotación)' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<AuthResponse> {
    try {
      return this.respond(res, await this.auth.refresh(readCookie(req)));
    } catch (error) {
      this.clearCookie(res);
      throw error;
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(CsrfHeaderGuard)
  @ApiOperation({ summary: 'Cerrar sesión y revocar la cadena de refresh tokens' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.logout(readCookie(req));
    this.clearCookie(res);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle(authLimit(0.5))
  @ApiOperation({ summary: 'Solicitar enlace de recuperación (respuesta idéntica exista o no la cuenta)' })
  @ApiZodBody(forgotPasswordSchema)
  async forgotPassword(@ZBody(forgotPasswordSchema) body: ForgotPasswordInput) {
    await this.auth.forgotPassword(body);
    return { message: 'Si el correo está registrado recibirá un enlace para restablecer la contraseña.' };
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle(authLimit())
  @ApiOperation({ summary: 'Definir nueva contraseña con el token de recuperación' })
  @ApiZodBody(resetPasswordSchema)
  async resetPassword(@ZBody(resetPasswordSchema) body: ResetPasswordInput) {
    await this.auth.resetPassword(body);
    return { message: 'La contraseña fue actualizada. Ya puede iniciar sesión.' };
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Usuario autenticado y sus permisos' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.toAuthUser(user);
  }

  private respond(res: Response, session: IssuedSession): AuthResponse {
    res.cookie(REFRESH_COOKIE, session.refreshToken, {
      httpOnly: true,
      secure: env().COOKIE_SECURE,
      sameSite: 'strict',
      path: COOKIE_PATH,
      expires: session.refreshExpiresAt,
    });
    return { accessToken: session.accessToken, expiresIn: session.expiresIn, user: session.user };
  }

  private clearCookie(res: Response) {
    res.clearCookie(REFRESH_COOKIE, { httpOnly: true, secure: env().COOKIE_SECURE, sameSite: 'strict', path: COOKIE_PATH });
  }
}

function readCookie(req: Request): string | undefined {
  const cookies = req.cookies as Record<string, string | undefined> | undefined;
  return cookies?.[REFRESH_COOKIE];
}
