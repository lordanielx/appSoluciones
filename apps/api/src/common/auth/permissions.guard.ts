import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Permission } from '@meca/shared';
import { AppException } from '../errors/app.exception';
import type { AuthenticatedUser } from './auth-user';
import { ANY_PERMISSIONS_KEY, IS_PUBLIC_KEY, PERMISSIONS_KEY } from './decorators';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;

    const all = this.reflector.getAllAndOverride<Permission[] | undefined>(PERMISSIONS_KEY, targets) ?? [];
    const any = this.reflector.getAllAndOverride<Permission[] | undefined>(ANY_PERMISSIONS_KEY, targets) ?? [];
    const user = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>().user;
    if (!user) return false;

    const granted = user.permissions;
    if (all.some((p) => !granted.includes(p))) throw AppException.forbidden();
    if (any.length > 0 && !any.some((p) => granted.includes(p))) throw AppException.forbidden();
    return true;
  }
}
