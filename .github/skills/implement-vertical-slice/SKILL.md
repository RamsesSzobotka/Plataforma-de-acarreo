---
name: implement-vertical-slice
description: "Implementa una historia completa en vertical slice (backend y frontend) para la plataforma de acarreos. Usar para nuevos modulos o features end-to-end con contrato API, seguridad y pruebas."
---

# Implement Vertical Slice

## Cuando usar

- Nueva funcionalidad que requiera backend y frontend.
- Modulos del PRD M01-M10.
- Entregas que deban quedar integradas sin mocks.

## Procedimiento

1. Definir alcance de la historia y criterios de aceptacion.
2. Diseñar contrato API en /api/v1 (request, response, errores).
3. Implementar backend por capas: route, controller, service, repository.
4. Aplicar seguridad: auth, RBAC, ownership, validacion de payload.
5. Implementar frontend por portal (client/driver/admin) consumiendo API real.
6. Agregar paginacion/filtros si es listado.
7. Probar caso feliz y negativo.
8. Verificar que no se rompen contratos existentes.

## Checklist de salida

- API funcional y versionada.
- UI conectada a backend real.
- Seguridad aplicada.
- Pruebas minimas incluidas.
