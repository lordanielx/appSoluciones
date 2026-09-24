import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import {
  AuditAction,
  EntityType,
  ErrorCode,
  permissionsFor,
  type AuthResponse,
  type AuthUser,
  type ForgotPasswordInput,
  type LoginInput,
  type ResetPasswordInput,
} from '@meca/shared';
import type { User } from '@prisma/client';
import { env } from '../../config/env';
import { AppException } from '../../common/errors/app.exception';
import { randomToken, sha256 } from '../../common/util/crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/application/audit.service';
import { MailService } from '../../mail/mail.service';
import { RequestContext } from '../../common/context/request-context';
import { PasswordService } from './password.service';

export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;
const RESET_TOKEN_TTL_MINUTES = 60;
/** Ventana en la que un refresh token recién rotado no se considera reutilización (pestañas concurrentes). */
const ROTATION_GRACE_MS = 20_000;

export interface IssuedSession extends AuthResponse {
  refreshToken: string;
  refreshExpiresAt: Date;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly passwords: PasswordService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
  ) {}

  async login(input: LoginInput): Promise<IssuedSession> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (!user) {
      await this.passwords.verifyDummy(input.password);
      throw this.invalidCredentials();
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new AppException(
        ErrorCode.ACCOUNT_LOCKED,
        `La cuenta está bloqueada temporalmente por intentos fallidos. Intente de nuevo en ${LOCK_MINUTES} minutos.`,
        HttpStatus.LOCKED,
      );
    }
    const valid = await this.passwords.verify(user.passwordHash, input.password);
    if (!valid) {
      const failed = user.failedLoginCount + 1;
      const lock = failed >= MAX_FAILED_LOGINS;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: lock ? 0 : failed,
          lockedUntil: lock ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
        },
      });
      await this.audit.record({
        action: AuditAction.AUTH_LOGIN_FAILED,
        entityType: EntityType.USER,
        entityId: user.id,
        actorId: user.id,
        metadata: { locked: lock },
      });
      throw this.invalidCredentials();
    }
    if (!user.active) {
      throw new AppException(ErrorCode.ACCOUNT_DISABLED, 'La cuenta está desactivada. Contacte al administrador.', HttpStatus.FORBIDDEN);
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    });
    await this.audit.record({
      action: AuditAction.AUTH_LOGIN,
      entityType: EntityType.USER,
      entityId: user.id,
      actorId: user.id,
    });
    return this.issueSession(user, randomUUID());
  }

  async refresh(refreshToken: string | undefined): Promise<IssuedSession> {
    if (!refreshToken) throw this.sessionExpired();
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: sha256(refreshToken) },
      include: { user: true },
    });
    if (!session) throw this.sessionExpired();

    if (session.revokedAt) {
      const recentlyRotated =
        session.replacedById && Date.now() - session.revokedAt.getTime() < ROTATION_GRACE_MS;
      if (!recentlyRotated) {
        // Reutilización de un token ya rotado: posible robo. Se revoca toda la familia.
        await this.prisma.session.updateMany({
          where: { familyId: session.familyId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        await this.audit.record({
          action: AuditAction.AUTH_REFRESH_REUSE_DETECTED,
          entityType: EntityType.USER,
          entityId: session.userId,
          actorId: session.userId,
          metadata: { familyId: session.familyId },
        });
        this.logger.warn({ userId: session.userId }, 'Reutilización de refresh token detectada');
      }
      throw this.sessionExpired();
    }
    if (session.expiresAt < new Date() || !session.user.active) throw this.sessionExpired();

    const issued = await this.issueSession(session.user, session.familyId);
    await this.prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date(), replacedById: issued.sessionId },
    });
    return issued;
  }

  async logout(refreshToken: string | undefined, userId?: string): Promise<void> {
    if (!refreshToken) return;
    const session = await this.prisma.session.findUnique({ where: { tokenHash: sha256(refreshToken) } });
    if (!session) return;
    await this.prisma.session.updateMany({
      where: { familyId: session.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.audit.record({
      action: AuditAction.AUTH_LOGOUT,
      entityType: EntityType.USER,
      entityId: session.userId,
      actorId: userId ?? session.userId,
    });
  }

  /** Siempre responde igual, exista o no el correo (evita enumeración de usuarios). */
  async forgotPassword(input: ForgotPasswordInput): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (!user || !user.active) return;
    const token = randomToken(32);
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60_000),
      },
    });
    await this.audit.record({
      action: AuditAction.AUTH_PASSWORD_RESET_REQUESTED,
      entityType: EntityType.USER,
      entityId: user.id,
      actorId: user.id,
    });
    const link = `${env().APP_PUBLIC_URL}/reset-password?token=${encodeURIComponent(token)}`;
    await this.mail.send({
      to: user.email,
      subject: 'Restablecer contraseña — Mecaelectric Operaciones',
      text: `Hola ${user.fullName},\n\nPara definir una nueva contraseña abra el siguiente enlace (válido por ${RESET_TOKEN_TTL_MINUTES} minutos):\n\n${link}\n\nSi no solicitó el cambio, ignore este mensaje.`,
    });
  }

  async resetPassword(input: ResetPasswordInput): Promise<void> {
    const record = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash: sha256(input.token) } });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw AppException.badRequest(
        ErrorCode.INVALID_RESET_TOKEN,
        'El enlace de recuperación no es válido o ya expiró. Solicite uno nuevo.',
      );
    }
    const passwordHash = await this.passwords.hash(input.password);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash, failedLoginCount: 0, lockedUntil: null },
      }),
      this.prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      // Cerrar todas las sesiones existentes tras un cambio de contraseña.
      this.prisma.session.updateMany({ where: { userId: record.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    await this.audit.record({
      action: AuditAction.AUTH_PASSWORD_RESET,
      entityType: EntityType.USER,
      entityId: record.userId,
      actorId: record.userId,
    });
  }

  toAuthUser(user: Pick<User, 'id' | 'email' | 'fullName' | 'role'>): AuthUser {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      permissions: [...permissionsFor(user.role)],
    };
  }

  private async issueSession(user: User, familyId: string): Promise<IssuedSession & { sessionId: string }> {
    const config = env();
    const refreshToken = randomToken();
    const refreshExpiresAt = new Date(Date.now() + config.REFRESH_TOKEN_TTL_DAYS * 86_400_000);
    const ctx = RequestContext.get();
    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: sha256(refreshToken),
        familyId,
        expiresAt: refreshExpiresAt,
        ip: ctx.ip ?? null,
        userAgent: ctx.userAgent ?? null,
      },
    });
    const accessToken = await this.jwt.signAsync({ sub: user.id, role: user.role });
    return {
      sessionId: session.id,
      accessToken,
      expiresIn: config.ACCESS_TOKEN_TTL_SECONDS,
      user: this.toAuthUser(user),
      refreshToken,
      refreshExpiresAt,
    };
  }

  private invalidCredentials() {
    return new AppException(ErrorCode.INVALID_CREDENTIALS, 'Correo o contraseña incorrectos.', HttpStatus.UNAUTHORIZED);
  }

  private sessionExpired() {
    return new AppException(ErrorCode.SESSION_EXPIRED, 'La sesión expiró. Inicie sesión nuevamente.', HttpStatus.UNAUTHORIZED);
  }
}
