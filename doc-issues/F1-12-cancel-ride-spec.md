# F1-12: Cancelar Pedido

## Rol
Frontend + Backend

## Descripción
El cliente puede cancelar un pedido según las reglas de estado definidas en AGENTS.md.

## Reglas de Cancelación (AGENTS.md sección 4)
- `requested` y `negotiating`: Cliente puede cancelar libremente
- `accepted`: Cliente NO puede cancelar (solo conductor)
- `in_progress`, `completed`, `paid`: Ninguna parte puede cancelar

## Subtareas

### Backend
- [ ] Endpoint POST /api/rides/:id/cancel
- [ ] Validar estado según reglas
- [ ] Validar ownership (cliente solo puede cancelar en requested/negotiating)
- [ ] Guardar cancellationReason

### Frontend
- [ ] Botón "Cancelar Pedido" en RideDetails
- [ ] Modal de confirmación antes de cancelar
- [ ] Input para motivo de cancelación (opcional)
- [ ] Mostrar/ocultar botón según estado
- [ ] Feedback "Pedido cancelado"

## Criterios de Aceptación
- Botón visible solo en estados `requested` o `negotiating`
- Modal de confirmación obligatorio
- Estado cambia a `cancelled`
- Notificación al conductor si aplica