# F1-14: Detalles del Pedido (Cliente)

## Rol
Frontend

## Descripción
Página de detalle del pedido para el cliente con toda la información, estado actual, y acciones disponibles según el estado del ride.

## Diferencias vs RideDetails del conductor
- Muestra: precio final, estado actual, foto de entrega, acciones del cliente
- No muestra: botón aceptar, perfil básico del cliente

## Subtareas

### Frontend
- [ ] Componente RideDetails.tsx existente - adaptar para cliente
- [ ] Mostrar estado con badge y colors
- [ ] Información del conductor asignado (cuando accepted/in_progress)
- [ ] Foto de entrega (cuando completed/paid)
- [ ] Tracking (cuando in_progress) - integrar F1-7
- [ ] Chat button (cuando negotiating/accepted/in_progress)
- [ ] Botón "Confirmar Entrega" (cuando in_progress) - integrar F1-9
- [ ] Botón "Pagar" (cuando completed) - integrar F1-10
- [ ] Rating (cuando paid, no calificado) - integrar F1-11
- [ ] Botón "Cancelar" (cuando requested/negotiating) - integrar F1-12
- [ ] Perfil del conductor

### Backend
- [ ] Endpoint GET /api/rides/:id incluir driver info
- [ ] Endpoint GET /api/users/driver/:driverId

## Criterios de Aceptación
- Todas las acciones según estado (F1-9 a F1-12)
- Foto de entrega visible
- Tracking visible cuando in_progress
- Perfil del conductor cuando accepted+
- Navegabilidad: botón volver