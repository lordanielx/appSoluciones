import {
  APP_TIME_ZONE,
  PRIORITY_LABELS,
  ResponseType,
  STATUS_VALUE_LABELS,
  StatusValue,
  isOutOfRange,
  type ChecklistValue,
} from '@meca/shared';
import type { ReportChecklistRow, ReportData, ReportSignature } from '../domain/report-data';
import { embeddedFontCss } from './fonts';

const esc = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const multiline = (value: string | null | undefined) => (value ? esc(value).replace(/\n/g, '<br>') : '—');

const dateFmt = new Intl.DateTimeFormat('es-CO', {
  timeZone: APP_TIME_ZONE,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});
const dayFmt = new Intl.DateTimeFormat('es-CO', { timeZone: APP_TIME_ZONE, day: '2-digit', month: 'long', year: 'numeric' });

export const formatDateTime = (d: Date | null | undefined) => (d ? dateFmt.format(d) : '—');
const formatDay = (d: Date | null | undefined) => (d ? dayFmt.format(d) : '—');

const STATUS_CLASS: Record<string, string> = {
  GOOD: 'ok',
  FAIR: 'warn',
  NEEDS_INTERVENTION: 'alert',
  CRITICAL: 'crit',
  NOT_APPLICABLE: 'na',
};

function renderValue(row: ReportChecklistRow): string {
  const v: ChecklistValue = row.value;
  if (v === null || v === undefined || (Array.isArray(v) && v.length === 0) || v === '') return '<span class="muted">Sin respuesta</span>';
  switch (row.responseType) {
    case ResponseType.BOOLEAN:
      return v ? 'Sí' : 'No';
    case ResponseType.NUMBER: {
      const range =
        row.minValue !== null || row.maxValue !== null
          ? `<div class="range">Rango: ${row.minValue ?? '—'} a ${row.maxValue ?? '—'}${row.unit ? ` ${esc(row.unit)}` : ''}</div>`
          : '';
      const flag = isOutOfRange(row, v) ? ' <span class="tag crit">Fuera de rango</span>' : '';
      return `<strong>${esc(v)}${row.unit ? ` ${esc(row.unit)}` : ''}</strong>${flag}${range}`;
    }
    case ResponseType.STATUS: {
      const label = STATUS_VALUE_LABELS[v as StatusValue] ?? String(v);
      return `<span class="tag ${STATUS_CLASS[String(v)] ?? ''}">${esc(label)}</span>`;
    }
    case ResponseType.MULTISELECT:
      return (v as string[]).map(esc).join(', ');
    default:
      return multiline(String(v));
  }
}

function field(label: string, value: string | null | undefined, raw = false) {
  return `<div class="field"><span class="label">${esc(label)}</span><span class="value">${raw ? (value ?? '—') : value ? esc(value) : '—'}</span></div>`;
}

function signatureBlock(title: string, sig: ReportSignature | null, fallback: string) {
  return `<div class="sig">
    <div class="sig-title">${esc(title)}</div>
    <div class="sig-img">${sig ? `<img src="${sig.pngDataUri}" alt="Firma">` : `<span class="muted">${esc(fallback)}</span>`}</div>
    <div class="sig-line"></div>
    ${field('Nombre', sig?.signerName)}
    ${field('Cargo', sig?.signerRole)}
    ${field('Fecha y hora', sig ? formatDateTime(sig.signedAt) : null)}
  </div>`;
}

function checklistTable(rows: ReportChecklistRow[]) {
  let currentSection: string | null | undefined;
  const body = rows
    .map((r) => {
      let sectionRow = '';
      if (r.section !== currentSection) {
        currentSection = r.section;
        sectionRow = r.section ? `<tr class="section"><td colspan="4">${esc(r.section)}</td></tr>` : '';
      }
      const photos = r.photoNumbers.length ? `<div class="photo-ref">Fotos: ${r.photoNumbers.join(', ')}</div>` : '';
      return `${sectionRow}<tr>
        <td class="num">${String(r.order).padStart(2, '0')}</td>
        <td>${esc(r.label)}${photos}</td>
        <td>${renderValue(r)}</td>
        <td>${multiline(r.observation)}</td>
      </tr>`;
    })
    .join('');
  return `<table class="checklist">
    <thead><tr><th class="num">#</th><th>Actividad</th><th>Resultado / medición</th><th>Observación</th></tr></thead>
    <tbody>${body}</tbody>
  </table>`;
}

export function renderReportHtml(d: ReportData): string {
  const b = d.brand;
  const wo = d.workOrder;
  const clientLocation = [d.client.address, d.client.city, d.client.department].filter(Boolean).join(', ');
  const nit = `${d.client.nit}${d.client.dv ? `-${d.client.dv}` : ''}`;
  const photos = d.photos
    .map(
      (p) => `<figure class="photo">
        <img src="${p.dataUri}" alt="Fotografía ${p.number}">
        <figcaption><strong>Foto ${p.number}.</strong> ${p.activity ? `${esc(p.activity)}. ` : ''}${p.caption ? esc(p.caption) : ''}
        ${p.capturedAt ? `<span class="muted"> · ${formatDateTime(p.capturedAt)}</span>` : ''}</figcaption>
      </figure>`,
    )
    .join('');

  return `<!doctype html>
<html lang="es-CO">
<head>
<meta charset="utf-8">
<title>${esc(d.reportNumber)} — ${esc(wo.number)}</title>
<style>
${embeddedFontCss()}
:root { --primary: ${b.primaryColor}; --secondary: ${b.secondaryColor}; --text: #17212B; --muted: #5B6670; --line: #D5DADE; --soft: #F4F6F7; }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; font-family: 'IBM Plex Sans', sans-serif; font-variant-numeric: tabular-nums; color: var(--text); font-size: 9.5pt; line-height: 1.4; }
.muted { color: var(--muted); }
header.doc { display: grid; grid-template-columns: 1fr auto; gap: 16px; align-items: start; padding-bottom: 10px; border-bottom: 2px solid var(--primary); }
.brand { display: flex; gap: 14px; align-items: center; }
.brand img { max-height: 56px; max-width: 180px; object-fit: contain; }
.brand .name { font-size: 13pt; font-weight: 700; letter-spacing: .02em; color: var(--primary); }
.brand .meta { font-size: 8pt; color: var(--muted); }
.docbox { border: 1px solid var(--line); border-top: 3px solid var(--secondary); min-width: 210px; }
.docbox .title { background: var(--primary); color: #fff; font-weight: 600; font-size: 8.5pt; letter-spacing: .08em; text-transform: uppercase; padding: 5px 10px; }
.docbox .row { display: flex; justify-content: space-between; gap: 12px; padding: 3px 10px; border-top: 1px solid var(--line); font-size: 8.5pt; }
.docbox .row span:first-child { color: var(--muted); }
.docbox .row strong { font-variant-numeric: tabular-nums; }
.status { margin-top: 8px; font-size: 8pt; padding: 4px 10px; border: 1px solid var(--line); background: var(--soft); }
.preview { color: #B42318; border-color: #B42318; font-weight: 600; letter-spacing: .04em; }
h2 { font-size: 9pt; text-transform: uppercase; letter-spacing: .1em; color: var(--primary); margin: 16px 0 6px; padding-bottom: 3px; border-bottom: 1px solid var(--line); break-after: avoid; }
h2 .idx { display: inline-block; min-width: 22px; color: var(--secondary); }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 20px; }
.grid.three { grid-template-columns: 1fr 1fr 1fr; }
.field { display: flex; gap: 8px; padding: 3px 0; border-bottom: 1px dotted var(--line); break-inside: avoid; }
.field .label { flex: 0 0 110px; color: var(--muted); font-size: 8.5pt; }
.field .value { flex: 1; font-weight: 500; }
.block { padding: 6px 0; }
.block .label { color: var(--muted); font-size: 8.5pt; display: block; margin-bottom: 2px; }
table.checklist { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
table.checklist th { text-align: left; background: var(--soft); border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); padding: 5px 6px; font-weight: 600; color: var(--muted); font-size: 8pt; text-transform: uppercase; letter-spacing: .04em; }
table.checklist td { border-bottom: 1px solid var(--line); padding: 5px 6px; vertical-align: top; }
table.checklist tr { break-inside: avoid; }
table.checklist td.num, table.checklist th.num { width: 28px; color: var(--muted); font-variant-numeric: tabular-nums; }
table.checklist tr.section td { background: #fff; font-weight: 700; color: var(--primary); padding-top: 9px; border-bottom: 1px solid var(--primary); font-size: 8.5pt; text-transform: uppercase; letter-spacing: .05em; }
table.checklist td:nth-child(2) { width: 36%; }
table.checklist td:nth-child(3) { width: 24%; }
.range, .photo-ref { font-size: 7.5pt; color: var(--muted); margin-top: 2px; }
.tag { display: inline-block; padding: 1px 6px; border: 1px solid currentColor; border-radius: 2px; font-size: 7.5pt; font-weight: 600; text-transform: uppercase; letter-spacing: .03em; }
.tag.ok { color: #287A4B; } .tag.warn { color: #B7791F; } .tag.alert { color: #C2410C; } .tag.crit { color: #B42318; } .tag.na { color: #5D6873; }
.photos { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.photo { margin: 0; border: 1px solid var(--line); break-inside: avoid; }
.photo img { display: block; width: 100%; height: 62mm; object-fit: cover; background: var(--soft); }
.photo figcaption { padding: 4px 6px; font-size: 7.8pt; border-top: 1px solid var(--line); }
.notes { border: 1px solid var(--line); border-left: 3px solid var(--secondary); padding: 8px 10px; white-space: normal; }
.sigs { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; break-inside: avoid; }
.sig { border: 1px solid var(--line); padding: 8px 10px; }
.sig-title { font-weight: 600; font-size: 8pt; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); }
.sig-img { height: 26mm; display: flex; align-items: center; justify-content: center; }
.sig-img img { max-height: 25mm; max-width: 100%; }
.sig-line { border-top: 1px solid var(--text); margin-bottom: 4px; }
.legal { font-size: 7.5pt; color: var(--muted); margin-top: 10px; }
section { break-inside: auto; }
</style>
</head>
<body>
<header class="doc">
  <div class="brand">
    ${b.logoDataUri ? `<img src="${b.logoDataUri}" alt="${esc(b.name)}">` : ''}
    <div>
      <div class="name">${esc(b.name)}</div>
      <div class="meta">${esc(b.legalName)} · NIT ${esc(b.nit)}</div>
      <div class="meta">${[b.address, b.phone, b.email, b.website].filter(Boolean).map(esc).join(' · ')}</div>
    </div>
  </div>
  <div>
    <div class="docbox">
      <div class="title">Informe técnico de servicio</div>
      <div class="row"><span>Informe</span><strong>${esc(d.reportNumber)}</strong></div>
      <div class="row"><span>Orden de trabajo</span><strong>${esc(wo.number)}</strong></div>
      <div class="row"><span>Versión</span><strong>${d.version}</strong></div>
      <div class="row"><span>Fecha del servicio</span><strong>${formatDay(wo.startedAt ?? wo.scheduledStart)}</strong></div>
    </div>
    ${
      d.preview
        ? '<div class="status preview">VISTA PREVIA — DOCUMENTO NO APROBADO</div>'
        : `<div class="status">Aprobado por ${esc(d.approvedBy)} · ${formatDateTime(d.approvedAt)}</div>`
    }
  </div>
</header>

<section>
  <h2><span class="idx">01</span>Datos del cliente</h2>
  <div class="grid">
    ${field('Cliente', d.client.legalName)}
    ${field('NIT', nit)}
    ${field('Nombre comercial', d.client.tradeName)}
    ${field('Ubicación', clientLocation || null)}
    ${field('Sitio del servicio', wo.address)}
    ${field('Contacto', [wo.contactName, wo.contactPhone].filter(Boolean).join(' · ') || null)}
  </div>
</section>

<section>
  <h2><span class="idx">02</span>Datos del equipo</h2>
  ${
    d.equipment
      ? `<div class="grid">
    ${field('Código', d.equipment.code)}
    ${field('Descripción', d.equipment.name)}
    ${field('Marca', d.equipment.brand)}
    ${field('Modelo', d.equipment.model)}
    ${field('Serial', d.equipment.serial)}
    ${field('Categoría', d.equipment.category)}
    ${field('Ubicación en planta', d.equipment.location)}
  </div>`
      : '<p class="muted">Servicio no asociado a un equipo específico.</p>'
  }
</section>

<section>
  <h2><span class="idx">03</span>Servicio</h2>
  <div class="grid">
    ${field('Tipo de servicio', wo.serviceType)}
    ${field('Prioridad', PRIORITY_LABELS[wo.priority])}
    ${field('Técnico', wo.technician)}
    ${field('Programado', formatDateTime(wo.scheduledStart))}
    ${field('Inicio', formatDateTime(wo.startedAt))}
    ${field('Finalización', formatDateTime(wo.submittedAt))}
  </div>
  <div class="block"><span class="label">Título</span>${esc(wo.title)}</div>
  ${wo.serviceScope ? `<div class="block"><span class="label">Alcance</span>${multiline(wo.serviceScope)}</div>` : ''}
  ${wo.description ? `<div class="block"><span class="label">Descripción</span>${multiline(wo.description)}</div>` : ''}
</section>

<section>
  <h2><span class="idx">04</span>Checklist de actividades</h2>
  ${checklistTable(d.checklist)}
</section>

${
  d.photos.length
    ? `<section>
  <h2><span class="idx">05</span>Registro fotográfico</h2>
  <div class="photos">${photos}</div>
</section>`
    : ''
}

<section>
  <h2><span class="idx">${d.photos.length ? '06' : '05'}</span>Observaciones y conclusiones técnicas</h2>
  <div class="notes">${multiline(wo.technicianNotes)}</div>
</section>

<section>
  <h2><span class="idx">${d.photos.length ? '07' : '06'}</span>Firmas de conformidad</h2>
  <div class="sigs">
    ${signatureBlock('Técnico responsable', d.technicianSignature, 'Sin firma')}
    ${signatureBlock(
      'Responsable del cliente',
      d.clientSignature,
      wo.clientSignatureWaived
        ? `Firma no capturada — excepción autorizada por ${wo.clientSignatureWaivedBy ?? 'la coordinación'}: ${wo.clientSignatureWaiverReason ?? ''}`
        : 'Sin firma',
    )}
  </div>
  <p class="legal">Firmas electrónicas capturadas en el sitio del servicio mediante la plataforma Mecaelectric Operaciones. El responsable del cliente declaró que la información registrada corresponde al servicio realizado y autorizó el uso de su firma en este informe.</p>
</section>
</body>
</html>`;
}

/** Encabezado/pie de Chromium: estilos en línea obligatorios, sin recursos externos. */
export function renderHeaderFooter(d: ReportData) {
  const style = "font-family:'IBM Plex Sans',sans-serif;font-variant-numeric:tabular-nums;font-size:7pt;color:#5B6670;width:100%;padding:0 14mm;display:flex;justify-content:space-between;";
  // Encabezado y pie de Chromium no heredan las fuentes del documento: se embebe IBM Plex Sans.
  const font = `<style>${embeddedFontCss([400])}</style>`;
  const headerTemplate = `${font}<div style="${style}"><span>${esc(d.brand.name)}</span><span>${esc(d.reportNumber)} · ${esc(d.workOrder.number)}</span></div>`;
  const footerTemplate = `${font}<div style="${style}border-top:0.5pt solid #D5DADE;padding-top:4px;">
    <span>${esc(d.brand.footerText ?? d.brand.legalName)}</span>
    <span>Informe ${esc(d.reportNumber)} · Versión ${d.version} · Generado ${esc(formatDateTime(d.generatedAt))}</span>
    <span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span>
  </div>`;
  return { headerTemplate, footerTemplate };
}
