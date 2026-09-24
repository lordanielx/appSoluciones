import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import type { Report, WorkOrder } from '@prisma/client';
import {
  AuditAction,
  EntityType,
  ErrorCode,
  NumberPrefix,
  ReportStatus,
  WorkOrderStatus,
  type ReportDto,
} from '@meca/shared';
import { PrismaService, type Tx } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/application/audit.service';
import type { AuthenticatedUser } from '../../common/auth/auth-user';
import { AppException } from '../../common/errors/app.exception';
import { sha256 } from '../../common/util/crypto';
import { StorageArea, StorageService } from '../../storage/storage.service';
import { CounterRepository } from '../../work-orders/infrastructure/counter.repository';
import { WorkOrderAccessService } from '../../work-orders/application/work-order-access.service';
import { PdfRenderer } from '../infrastructure/pdf-renderer';
import { renderHeaderFooter, renderReportHtml } from '../infrastructure/report-template';
import { ReportDataLoader } from './report-data.loader';

const userRef = { select: { id: true, fullName: true } } as const;
type ReportRow = Report & {
  generatedBy: { id: string; fullName: string };
  approvedBy: { id: string; fullName: string } | null;
  brandProfile: { name: string };
};

/** Estados en los que puede generarse una nueva versión sin pasar por aprobación. */
const REGENERATE_STATUSES: readonly WorkOrderStatus[] = [WorkOrderStatus.APPROVED, WorkOrderStatus.CLOSED];

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly renderer: PdfRenderer,
    private readonly loader: ReportDataLoader,
    private readonly storage: StorageService,
    private readonly counters: CounterRepository,
    private readonly access: WorkOrderAccessService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Genera y almacena una nueva versión aprobada del informe. Las versiones anteriores
   * pasan a SUPERSEDED; ningún PDF almacenado se sobrescribe (RB-014).
   */
  async generate(tx: Tx, wo: WorkOrder, user: AuthenticatedUser, opts: { approvedAt: Date }): Promise<ReportDto> {
    const previous = await tx.report.findFirst({ where: { workOrderId: wo.id }, orderBy: { version: 'desc' } });
    const reportNumber = previous?.reportNumber ?? (await this.counters.next(tx, NumberPrefix.REPORT));
    const version = (previous?.version ?? 0) + 1;
    const generatedAt = new Date();

    const data = await this.loader.load(tx, wo.id, {
      reportNumber,
      version,
      preview: false,
      generatedAt,
      approvedAt: opts.approvedAt,
      approvedBy: user.fullName,
    });
    const pdf = await this.renderPdf(data);
    const pdfKey = this.storage.buildKey(StorageArea.REPORTS, wo.id, 'pdf', `-v${version}`);
    await this.storage.put(pdfKey, pdf, 'application/pdf');

    await tx.report.updateMany({
      where: { workOrderId: wo.id, status: ReportStatus.APPROVED },
      data: { status: ReportStatus.SUPERSEDED },
    });
    const report = await tx.report.create({
      data: {
        workOrderId: wo.id,
        reportNumber,
        version,
        status: ReportStatus.APPROVED,
        pdfKey,
        sizeBytes: pdf.length,
        sha256: sha256(pdf),
        brandProfileId: wo.representedCompanyId,
        generatedById: user.id,
        generatedAt,
        approvedById: user.id,
        approvedAt: opts.approvedAt,
      },
      include: { generatedBy: userRef, approvedBy: userRef, brandProfile: { select: { name: true } } },
    });
    await this.audit.record(
      {
        action: AuditAction.REPORT_GENERATED,
        entityType: EntityType.REPORT,
        entityId: report.id,
        workOrderId: wo.id,
        actorId: user.id,
        metadata: { reportNumber, version, sha256: report.sha256, sizeBytes: report.sizeBytes },
      },
      tx,
    );
    return toReportDto(report);
  }

  /** Nueva versión de un informe ya aprobado (p. ej. tras actualizar la empresa representada). */
  async regenerate(workOrderId: string, user: AuthenticatedUser): Promise<ReportDto> {
    return this.prisma.$transaction(
      async (tx) => {
        const wo = await this.access.lockForUpdate(tx, workOrderId, user);
        if (!REGENERATE_STATUSES.includes(wo.status)) {
          throw AppException.conflict(
            ErrorCode.WORK_ORDER_INVALID_STATE,
            'El informe definitivo se genera al aprobar la orden. Use la vista previa mientras está en revisión.',
          );
        }
        return this.generate(tx, wo, user, { approvedAt: wo.approvedAt ?? new Date() });
      },
      { timeout: 90_000, maxWait: 10_000 },
    );
  }

  /** Vista previa para revisión: se genera al vuelo, no se almacena. */
  async preview(workOrderId: string, user: AuthenticatedUser): Promise<{ pdf: Buffer; fileName: string }> {
    const wo = await this.access.loadReadable(workOrderId, user);
    const previous = await this.prisma.report.findFirst({ where: { workOrderId }, orderBy: { version: 'desc' } });
    const data = await this.prisma.$transaction(
      (tx) =>
        this.loader.load(tx, workOrderId, {
          reportNumber: previous?.reportNumber ?? 'INF-PENDIENTE',
          version: (previous?.version ?? 0) + 1,
          preview: true,
          generatedAt: new Date(),
          approvedAt: null,
          approvedBy: null,
        }),
      { timeout: 60_000 },
    );
    return { pdf: await this.renderPdf(data), fileName: `${wo.number}-vista-previa.pdf` };
  }

  async listForWorkOrder(workOrderId: string, user: AuthenticatedUser): Promise<ReportDto[]> {
    await this.access.loadReadable(workOrderId, user);
    const rows = await this.prisma.report.findMany({
      where: { workOrderId },
      orderBy: { version: 'desc' },
      include: { generatedBy: userRef, approvedBy: userRef, brandProfile: { select: { name: true } } },
    });
    return rows.map(toReportDto);
  }

  async get(id: string, user: AuthenticatedUser): Promise<ReportDto & { downloadUrl: string }> {
    const row = await this.prisma.report.findUnique({
      where: { id },
      include: { generatedBy: userRef, approvedBy: userRef, brandProfile: { select: { name: true } } },
    });
    if (!row) throw AppException.notFound('El informe');
    await this.access.loadReadable(row.workOrderId, user);
    return { ...toReportDto(row), downloadUrl: await this.downloadUrl(row) };
  }

  async pdf(id: string, user: AuthenticatedUser): Promise<{ body: Buffer; fileName: string }> {
    const row = await this.prisma.report.findUnique({ where: { id } });
    if (!row) throw AppException.notFound('El informe');
    await this.access.loadReadable(row.workOrderId, user);
    const obj = await this.storage.get(row.pdfKey);
    return { body: obj.body, fileName: fileName(row) };
  }

  private downloadUrl(row: Report) {
    return this.storage.signedUrl(row.pdfKey, fileName(row));
  }

  private async renderPdf(data: Parameters<typeof renderReportHtml>[0]): Promise<Buffer> {
    try {
      return await this.renderer.render(renderReportHtml(data), renderHeaderFooter(data));
    } catch (error) {
      this.logger.error({ err: error }, 'Fallo en la generación del PDF');
      throw new AppException(
        ErrorCode.REPORT_GENERATION_FAILED,
        'No fue posible generar el PDF del informe. La orden no se modificó; intente nuevamente.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}

const fileName = (r: Pick<Report, 'reportNumber' | 'version'>) => `${r.reportNumber}-v${r.version}.pdf`;

export function toReportDto(r: ReportRow): ReportDto {
  return {
    id: r.id,
    workOrderId: r.workOrderId,
    reportNumber: r.reportNumber,
    version: r.version,
    status: r.status,
    sizeBytes: r.sizeBytes,
    generatedBy: r.generatedBy,
    generatedAt: r.generatedAt.toISOString(),
    approvedBy: r.approvedBy,
    approvedAt: r.approvedAt?.toISOString() ?? null,
    brandProfileName: r.brandProfile.name,
  };
}
