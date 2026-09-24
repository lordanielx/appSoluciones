import { Injectable } from '@nestjs/common';
import type { Prisma, User } from '@prisma/client';
import {
  AuditAction,
  EntityType,
  ErrorCode,
  type CreateUserInput,
  type Paginated,
  type UpdateUserInput,
  type UserDto,
  type UserListQuery,
} from '@meca/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/application/audit.service';
import { PasswordService } from '../../auth/application/password.service';
import { AppException } from '../../common/errors/app.exception';
import { paginated, skipTake } from '../../common/util/pagination';
import { iso } from '../../common/util/dates';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly audit: AuditService,
  ) {}

  async list(q: UserListQuery): Promise<Paginated<UserDto>> {
    const where: Prisma.UserWhereInput = {
      role: q.role,
      active: q.active,
      ...(q.q
        ? {
            OR: [
              { fullName: { contains: q.q, mode: 'insensitive' } },
              { email: { contains: q.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({ where, orderBy: { fullName: 'asc' }, ...skipTake(q) }),
      this.prisma.user.count({ where }),
    ]);
    return paginated(rows.map(toUserDto), total, q);
  }

  async get(id: string): Promise<UserDto> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw AppException.notFound('El usuario');
    return toUserDto(user);
  }

  async create(input: CreateUserInput, actorId: string): Promise<UserDto> {
    const exists = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (exists) throw AppException.conflict(ErrorCode.DUPLICATE, 'Ya existe un usuario con ese correo.');
    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        fullName: input.fullName,
        role: input.role,
        phone: input.phone,
        jobTitle: input.jobTitle,
        passwordHash: await this.passwords.hash(input.password),
      },
    });
    await this.audit.record({
      action: AuditAction.USER_CREATED,
      entityType: EntityType.USER,
      entityId: user.id,
      actorId,
      metadata: { email: user.email, role: user.role },
    });
    return toUserDto(user);
  }

  async update(id: string, input: UpdateUserInput, actorId: string): Promise<UserDto> {
    await this.get(id);
    if (id === actorId && input.role && input.role !== 'ADMIN') {
      throw AppException.badRequest(ErrorCode.VALIDATION_ERROR, 'No puede quitarse a sí mismo el rol de administrador.');
    }
    const { password, ...rest } = input;
    const user = await this.prisma.user.update({
      where: { id },
      data: { ...rest, ...(password ? { passwordHash: await this.passwords.hash(password) } : {}) },
    });
    if (password) {
      await this.prisma.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    await this.audit.record({
      action: AuditAction.USER_UPDATED,
      entityType: EntityType.USER,
      entityId: id,
      actorId,
      metadata: { fields: Object.keys(input).filter((k) => k !== 'password'), passwordChanged: Boolean(password) },
    });
    return toUserDto(user);
  }

  async setStatus(id: string, active: boolean, actorId: string): Promise<UserDto> {
    if (id === actorId && !active) {
      throw AppException.badRequest(ErrorCode.VALIDATION_ERROR, 'No puede desactivar su propia cuenta.');
    }
    await this.get(id);
    const user = await this.prisma.user.update({ where: { id }, data: { active } });
    if (!active) {
      await this.prisma.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    await this.audit.record({
      action: AuditAction.USER_STATUS_CHANGED,
      entityType: EntityType.USER,
      entityId: id,
      actorId,
      metadata: { active },
    });
    return toUserDto(user);
  }

  /** Técnicos activos (selector de asignación). */
  async technicians() {
    return this.prisma.user.findMany({
      where: { role: 'TECHNICIAN', active: true },
      select: { id: true, fullName: true, phone: true, jobTitle: true },
      orderBy: { fullName: 'asc' },
    });
  }
}

export function toUserDto(u: User): UserDto {
  return {
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    role: u.role,
    phone: u.phone,
    jobTitle: u.jobTitle,
    active: u.active,
    lastLoginAt: iso(u.lastLoginAt),
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
  };
}
