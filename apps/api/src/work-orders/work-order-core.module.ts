import { Module } from '@nestjs/common';
import { WorkOrderAccessService } from './application/work-order-access.service';
import { WorkOrderTransitionsService } from './application/work-order-transitions.service';
import { SubmissionEvaluator } from './application/submission-evaluator.service';
import { CounterRepository } from './infrastructure/counter.repository';
import { ExecutionMapper } from './application/execution.mapper';
import { WorkOrderQueries } from './application/queries/work-order.queries';

/** Núcleo reutilizable de OT (acceso, transiciones, consecutivos) sin dependencias de otros módulos. */
@Module({
  providers: [WorkOrderAccessService, WorkOrderTransitionsService, SubmissionEvaluator, CounterRepository, ExecutionMapper, WorkOrderQueries],
  exports: [WorkOrderAccessService, WorkOrderTransitionsService, SubmissionEvaluator, CounterRepository, ExecutionMapper, WorkOrderQueries],
})
export class WorkOrderCoreModule {}
