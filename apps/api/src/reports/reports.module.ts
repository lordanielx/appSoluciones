import { Module } from '@nestjs/common';
import { WorkOrderCoreModule } from '../work-orders/work-order-core.module';
import { ReportsService } from './application/reports.service';
import { ReportDataLoader } from './application/report-data.loader';
import { PdfRenderer } from './infrastructure/pdf-renderer';
import { ReportsController } from './presentation/reports.controller';

@Module({
  imports: [WorkOrderCoreModule],
  providers: [ReportsService, ReportDataLoader, PdfRenderer],
  controllers: [ReportsController],
  exports: [ReportsService],
})
export class ReportsModule {}
