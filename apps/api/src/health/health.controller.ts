import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '../common/auth/decorators';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

@ApiTags('Salud')
@SkipThrottle()
@Public()
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Liveness: el proceso responde' })
  live() {
    return { status: 'ok', uptime: Math.round(process.uptime()), timestamp: new Date().toISOString() };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness: base de datos y storage disponibles' })
  async ready(@Res({ passthrough: true }) res: Response) {
    const checks = { database: 'ok', storage: 'ok' };
    await this.prisma.$queryRaw`SELECT 1`.catch(() => (checks.database = 'error'));
    await this.storage.ping().catch(() => (checks.storage = 'error'));
    const ok = Object.values(checks).every((v) => v === 'ok');
    res.status(ok ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return { status: ok ? 'ok' : 'degraded', checks };
  }
}
