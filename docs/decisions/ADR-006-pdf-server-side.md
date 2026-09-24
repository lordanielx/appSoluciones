# ADR-006 · Informe PDF generado en el servidor

- **Estado:** aceptada · 2026-09-24

## Decisión
Plantilla HTML/CSS renderizada en la API y convertida a PDF con Chromium
(playwright-core). Encabezado y pie nativos de Chromium (página X de Y, número de
informe, versión, fecha). Imágenes, logo y fuente IBM Plex embebidos como `data:`;
JavaScript y red deshabilitados durante el render.

## Razones
Documento definitivo idéntico para todos, independiente del dispositivo;
branding por `BrandProfile`; control de versiones y hash SHA-256 del archivo
almacenado; vista previa no almacenada para la revisión.

## Consecuencias
La imagen de la API incluye Chromium (imagen oficial de Playwright). La
aprobación y el PDF ocurren en la misma transacción (timeout 90 s): si el render
falla la OT no cambia. A mayor volumen, el render puede moverse a un worker.
