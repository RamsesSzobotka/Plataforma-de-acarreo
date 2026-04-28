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
- [x] Componente RideDetails.tsx existente - adaptar para cliente
- [x] Mostrar estado con badge y colors
- [x] Información del conductor asignado (cuando accepted/in_progress)
- [x] Foto de entrega (cuando completed/paid)
- [ ] Tracking (cuando in_progress) - integrar F1-7 (feature separada)
- [x] Chat button (cuando negotiating/accepted/in_progress)
- [x] Botón "Confirmar Entrega" (cuando in_progress) - integrar F1-9
- [x] Botón "Pagar" (cuando completed) - integrar F1-10
- [x] Rating (cuando paid, no calificado) - integrar F1-11
- [x] Botón "Cancelar" (cuando requested/negotiating) - integrar F1-12
- [x] Perfil del conductor
- [x] Mostrar imágenes del pedido

### Backend
- [x] Endpoint GET /api/rides/:id incluir driver info
- [x] Endpoint GET /api/users/driver/:driverId
- [x] Endpoint POST /api/rides/:id/rate para calificaciones
- [x] Crear modelo Rating
- [x] Hacer endpoint GET /api/users/:clerkId público
- [x] Hacer endpoint GET /api/users/driver/:userId público

## Criterios de Aceptación
- [x] Todas las acciones según estado (F1-9 a F1-12)
- [x] Foto de entrega visible
- [ ] Tracking visible cuando in_progress (integración con F1-7 - feature separada)
- [x] Perfil del conductor cuando accepted+
- [x] Navegabilidad: botón volver
- [x] Imágenes del pedido visibles
- [x] Rating component para calificar cuando paid