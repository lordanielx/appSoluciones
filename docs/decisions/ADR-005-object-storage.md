# ADR-005 · Object storage para binarios

- **Estado:** aceptada · 2026-09-24

## Decisión
Fotografías, thumbnails, firmas (PNG + SVG), logos y PDF van a un bucket S3
compatible privado (MinIO en desarrollo). PostgreSQL guarda solo claves y
metadatos. Interfaz `StorageDriver` con drivers `s3` y `local` (disco + URLs
firmadas HMAC) para desarrollo/CI sin Docker.

## Consecuencias
Base de datos liviana y backups rápidos; descargas directas con URL firmada de
15 min; claves aleatorias por área/año/mes/entidad; nunca se usa el nombre
original del archivo.
