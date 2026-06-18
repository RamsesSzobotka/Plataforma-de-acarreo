# F1-9: Confirmar Entrega por el Cliente

## Rol
Frontend + Backend

## Descripción
El cliente confirma que la mercancía fue entregada correctamente. Esto cambia el estado a `completed`.

## Subtareas

### Backend
- [ ] Endpoint POST /api/rides/:id/confirm-delivery
- [ ] Validar ownership (solo cliente del ride)
- [ ] Validar estado actual (`in_progress`)
- [ ] Cambiar estado a `completed`

### Frontend
- [ ] Botón "Confirmar Entrega" en RideDetails
- [ ] Mostrar solo cuando status = `in_progress` y hay deliveryPhoto
- [ ] Modal de confirmación antes de confirmar
- [ ] Feedback visual después de confirmar

## Criterios de Aceptación
- Botón visible solo en estado `in_progress`
- Solo el cliente puede confirmar
- Estado cambia a `completed`
- Notificación al conductor