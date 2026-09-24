import { type CanActivate, type ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ErrorCode, permissionsFor, type Role } from '@meca/shared';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../errors/app.exception';
import { RequestContext } from '../context/request-context';
import type { AuthenticatedUser } from './auth-user';
import { IS_PUBLIC_KEY } from './decorators';

interface AccessTokenPayload {
  sub: string;
  role: Role;
}

/**
 * Guard global: exige Bearer token válido salvo en endpoints @Public().
 * Consulta el usuario en cada request para que desactivar una cuenta tenga efecto inmediato.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (!token) throw this.unauthenticated();

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
    } catch {
      throw new AppException(ErrorCode.SESSION_EXPIRED, 'La sesión expiró. Inicie sesión nuevamente.', HttpStatus.UNAUTHORIZED);
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, fullName: true, role: true, active: true },
    });
    if (!user || !user.active) throw this.unauthenticated();

    req.user = { ...user, permissions: permissionsFor(user.role) };
    RequestContext.setUser(user.id);
    return true;
  }

  private unauthenticated() {
    return new AppException(ErrorCode.UNAUTHENTICATED, 'Debe iniciar sesión para continuar.', HttpStatus.UNAUTHORIZED);
  }
}
