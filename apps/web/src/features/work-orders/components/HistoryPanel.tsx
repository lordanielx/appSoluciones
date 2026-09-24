import { useQuery } from '@tanstack/react-query';
import { workOrdersApi } from '@/lib/api/endpoints';
import { fmtShort } from '@/lib/format';
import { Panel, SkeletonRows, Timeline } from '@/ui';

const SUCCESS = new Set(['WORK_ORDER_APPROVED', 'WORK_ORDER_CLOSED', 'REPORT_GENERATED']);
const DANGER = new Set(['WORK_ORDER_REJECTED', 'CHANGES_REQUESTED', 'WORK_ORDER_CANCELLED']);
const ACCENT = new Set(['WORK_ORDER_STARTED', 'WORK_ORDER_SUBMITTED']);
/** Eventos detallados que se agrupan para no saturar el timeline. */
const DETAIL = new Set(['CHECKLIST_UPDATED', 'EVIDENCE_ADDED', 'EVIDENCE_REMOVED']);

/** Trazabilidad completa de la OT (§50), con agrupación de eventos repetitivos. */
export function HistoryPanel({ workOrderId }: { workOrderId: string }) {
  const q = useQuery({ queryKey: ['work-order', workOrderId, 'history'], queryFn: () => workOrdersApi.history(workOrderId) });
  const items = (q.data ?? []).reduce<{ id: string; time: string; title: string; actor: string | null; tone: 'default' | 'accent' | 'success' | 'danger'; count: number; action: string }[]>((acc, h) => {
    const last = acc[acc.length - 1];
    if (last && DETAIL.has(h.action) && last.action === h.action && last.actor === (h.actor?.fullName ?? null)) {
      last.count += 1;
      return acc;
    }
    acc.push({
      id: h.id,
      time: fmtShort(h.createdAt),
      title: h.description,
      actor: h.actor?.fullName ?? null,
      tone: SUCCESS.has(h.action) ? 'success' : DANGER.has(h.action) ? 'danger' : ACCENT.has(h.action) ? 'accent' : 'default',
      count: 1,
      action: h.action,
    });
    return acc;
  }, []);
  return (
    <Panel title="Historial y trazabilidad" as="aside">
      {q.isLoading ? (
        <SkeletonRows rows={5} />
      ) : (
        <Timeline
          items={items.map((i) => ({
            ...i,
            title: i.count > 1 ? `${i.action === 'EVIDENCE_ADDED' ? 'Evidencias agregadas' : i.action === 'CHECKLIST_UPDATED' ? 'Checklist actualizado' : i.title} (${i.count})` : i.title,
          }))}
        />
      )}
    </Panel>
  );
}
