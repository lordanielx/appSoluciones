import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileDown, RefreshCw } from 'lucide-react';
import { Permission, REPORT_STATUS_LABELS, WorkOrderStatus, type WorkOrderDetail } from '@meca/shared';
import { workOrdersApi } from '@/lib/api/endpoints';
import { errorMessage } from '@/lib/api/errors';
import { useAuth } from '@/lib/auth/AuthProvider';
import { fmtBytes, fmtDateTime } from '@/lib/format';
import { Button, Panel, Tag, useToast } from '@/ui';
import { openReportPdf } from './reports';

/** Versiones del informe PDF (§23). Una versión aprobada nunca se sobrescribe. */
export function ReportsPanel({ wo }: { wo: WorkOrderDetail }) {
  const { can } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['work-order', wo.id, 'reports'], queryFn: () => workOrdersApi.reports(wo.id) });
  const regenerate = useMutation({
    mutationFn: () => workOrdersApi.regenerateReport(wo.id),
    onSuccess: (r) => {
      toast.success(`Se generó la versión ${r.version} del informe ${r.reportNumber}.`);
      void qc.invalidateQueries({ queryKey: ['work-order', wo.id] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const canRegenerate = can(Permission.REPORTS_GENERATE) && (wo.status === WorkOrderStatus.APPROVED || wo.status === WorkOrderStatus.CLOSED);
  if (!q.data?.length && !canRegenerate) return null;

  return (
    <Panel
      title="Informe técnico"
      flush
      actions={
        canRegenerate && (
          <Button size="sm" variant="secondary" icon={<RefreshCw className="h-4 w-4" />} loading={regenerate.isPending} onClick={() => regenerate.mutate()}>
            Nueva versión
          </Button>
        )
      }
    >
      <ul className="divide-y divide-border">
        {q.data?.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="font-medium">
                <span className="code mr-2">{r.reportNumber}</span>Versión {r.version}
              </p>
              <p className="text-xs text-text-muted">
                {fmtDateTime(r.generatedAt)} · {r.approvedBy?.fullName ?? r.generatedBy.fullName} · {r.brandProfileName} · {fmtBytes(r.sizeBytes)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Tag tone={r.status === 'APPROVED' ? 'success' : 'neutral'}>{REPORT_STATUS_LABELS[r.status]}</Tag>
              <Button size="sm" variant={r.status === 'APPROVED' ? 'primary' : 'secondary'} icon={<FileDown className="h-4 w-4" />} onClick={() => void openReportPdf(r.id, `${r.reportNumber}-v${r.version}.pdf`).catch((e) => toast.error(errorMessage(e)))}>
                PDF
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
