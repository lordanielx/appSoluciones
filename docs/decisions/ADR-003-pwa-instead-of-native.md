# ADR-003 · PWA en lugar de app nativa

- **Estado:** aceptada · 2026-09-24

## Decisión
Una sola PWA React instalable para administración y técnicos, con experiencia
adaptada por rol (sidebar en escritorio, navegación inferior en móvil).

## Razones
Sin tiendas ni ciclos de publicación; un solo código; cámara (`capture`),
IndexedDB, service worker e instalación disponibles en Android/Chrome y iOS
Safari ≥ 16.4; actualización controlada desde el servidor.

## Consecuencias
- iOS puede purgar almacenamiento de sitios no instalados: se pide
  `navigator.storage.persist()` y se recomienda instalar la PWA.
- Sin sincronización en segundo plano con la app cerrada (Background Sync no es
  universal): se sincroniza al abrir, al recuperar red y periódicamente.
- Una app nativa podría construirse luego sobre la misma API.
