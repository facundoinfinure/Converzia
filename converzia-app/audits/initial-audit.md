## Auditoría inicial — Converzia

Resumen rápido (ejecuciones iniciales):
- `npm run lint`: warnings importantes (uso de `<img>` en lugar de `next/image`, hooks con dependencias faltantes).
- `npm run typecheck`: 534 errores TS — build no pasa. Errores críticos: import con distinto casing (`Button.tsx` vs `button.tsx`), tipos de props inconsistentes (`leftIcon`, `variant`, `size`), muchos `any` e índices `{}` usados como datos.
- `npm run test:run`: tests unitarios pasan; E2E fallan por falta de variables de entorno (SUPABASE keys).

Hallazgos principales y riesgos:
- Build-blockers (TypeScript): impiden despliegue/CI. Prioridad: Alta.
- Seguridad: variables sensibles (service_role/secret keys) referenciadas desde server code — OK; revisar que no se expongan en bundle ni en logs. Prioridad: Alta.
- Calidad de UI: uso de `<img>` y falta de optimización de imágenes; hooks con deps faltantes que pueden causar bugs intermitentes. Prioridad: Media.
- Code smell: muchos `console.log`/`console.error` en servicios — sustituir por `logger`. `TODO` y `FIXME` presentes. Prioridad: Baja/Med.
- Arquitectura: varios `export *` y re-exportaciones que generan conflictos; revisar `src/components/ui/index.ts` y entradas duplicadas. Prioridad: Medium.

Recomendaciones inmediatas (ordenadas):
1) Corregir casing/import conflict de `Button` (consolidar nombre y actualizar imports). Tiempo estimado: 0.5-1h.
2) Resolver errores TS críticos que bloquean build (prop types, firmas de servicios). Tiempo estimado: 4-8h (iterativo).
3) Reemplazar `console.*` por el `logger` central y eliminar logs que puedan contener PII. Tiempo estimado: 2-4h.
4) Forzar `typecheck` en CI (ya existe script; asegurar que `npm run ci` pase). Tiempo estimado: 0.5h.
5) Revisar reglas RLS y asegurar que `SUPABASE_SERVICE_ROLE_KEY` nunca se publique al cliente; añadir pruebas para boundaries de RLS. Tiempo estimado: 4h.
6) UX: reemplazar `<img>` por `next/image` donde importe para LCP; arreglar hooks con deps faltantes. Tiempo estimado: 3-6h.
7) Tests: facilitar E2E locales mediante `.env.test` con credenciales seguras en CI secrets; documentar cómo ejecutar E2E. Tiempo estimado: 1-2h.

Próximos pasos propuestos (puedo empezar ahora):
- A. Arreglar el conflicto de casing del `Button` y limpiar re-exports duplicados en `src/components/ui/index.ts`.
- B. Aplicar cambios de tipo en `Button`/`Badge` para concordar `variant`, `size` y `leftIcon`.
- C. Ejecutar `npm run typecheck` iterativamente hasta dejar errores críticos resueltos.

Solicito tu confirmación para comenzar por la acción A (casing + re-exports). Si prefieres otra prioridad, indícalo.

Archivo generado automáticamente por auditoría inicial. Más análisis (seguridad, performance por página, duplicados, código muerto) continuará tras tu confirmación.
