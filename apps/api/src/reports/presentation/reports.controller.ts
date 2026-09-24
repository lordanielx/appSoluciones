import { Controller, Get, Param, ParseUUIDPipe, Post, Res, StreamableFile } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { Permission } from '@meca/shared';
import type { Response } from 'express';
import { CurrentUser, RequireAnyPermission, RequirePermissions } from '../../common/auth/decorators';
import type { AuthenticatedUser } from '../../common/auth/auth-user';
import { ReportsService } from '../application/reports.service';

@ApiTags('Informes')
@ApiBearerAuth()
@Controller()
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Post('work-orders/:id/reports/generate')
  @RequirePermissions(Permission.REPORTS_GENERATE)
  @ApiOperation({ summary: 'Generar nueva versión del informe de una OT aprobada/cerrada (no sobrescribe versiones)' })
  generate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.reports.regenerate(id, user);
  }

  @Get('work-orders/:id/reports')
  @RequireAnyPermission(Permission.REPORTS_READ, Permission.WORK_ORDERS_READ_ALL)
  @ApiOperation({ summary: 'Versiones del informe de la OT' })
  list(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.reports.listForWorkOrder(id, user);
  }

  @Get('work-orders/:id/report-preview')
  @RequirePermissions(Permission.WORK_ORDERS_REVIEW)
  @ApiProduces('application/pdf')
  @ApiOperation({ summary: 'Vista previa del informe (no se almacena)' })
  async preview(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { pdf, fileName } = await this.reports.preview(id, user);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    res.setHeader('Cache-Control', 'no-store');
    return new StreamableFile(pdf);
  }

  @Get('reports/:id')
  @RequireAnyPermission(Permission.REPORTS_READ, Permission.WORK_ORDERS_READ_ALL)
  @ApiOperation({ summary: 'Metadatos del informe y URL firmada de descarga' })
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.reports.get(id, user);
  }

  @Get('reports/:id/pdf')
  @RequireAnyPermission(Permission.REPORTS_READ, Permission.WORK_ORDERS_READ_ALL)
  @ApiProduces('application/pdf')
  @ApiOperation({ summary: 'Descargar el PDF almacenado' })
  async pdf(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { body, fileName } = await this.reports.pdf(id, user);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    return new StreamableFile(body);
  }
}
