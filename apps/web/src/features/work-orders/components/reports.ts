import { reportsApi, workOrdersApi } from '@/lib/api/endpoints';

/** Abre un PDF protegido (requiere Authorization) en una pestaña nueva. */
async function openBlob(load: () => Promise<Blob>, fileName: string) {
  const tab = window.open('', '_blank');
  const blob = await load();
  const url = URL.createObjectURL(blob);
  if (tab) tab.location.href = url;
  else {
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export const openReportPdf = (reportId: string, fileName: string) => openBlob(() => reportsApi.pdf(reportId), fileName);
export const openReportPreview = (workOrderId: string, number: string) => openBlob(() => workOrdersApi.preview(workOrderId), `${number}-vista-previa.pdf`);
