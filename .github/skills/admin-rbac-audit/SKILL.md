---
name: admin-rbac-audit
description: "Implementa modulos de back office admin con RBAC estricto y auditoria. Usar para gestion de users, drivers, rides, pagos, tarifas y trazabilidad de acciones criticas."
---

# Admin RBAC Audit

## Cuando usar

- Construir endpoints o vistas de admin.
- Agregar acciones de suspension, moderacion o cambios globales.
- Implementar bitacora de auditoria.

## Procedimiento

1. Asegurar acceso exclusivo rol admin en backend.
2. Implementar listados admin con paginacion, filtros y busqueda.
3. Implementar acciones criticas (suspender/reactivar/moderar/configurar).
4. Registrar auditoria con before y after en cada accion critica.
5. Exponer modulo de auditoria para consulta administrativa.
6. Validar que cambios admin no rompan portales cliente/conductor.

## Criterios de salida

- Endpoints admin protegidos.
- Auditoria completa y trazable.
- Listados optimizados con filtros e indices.
