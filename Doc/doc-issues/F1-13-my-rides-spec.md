# F1-13: Mi Lista de Pedidos (Cliente)

## Rol
Frontend

## Descripción
El cliente ve su historial de pedidos creados, filtrable por estado y paginado.

## Subtareas

### Frontend
- [ ] Componente MyRides.tsx existente - mejorar filtros
- [ ] Lista demis pedidos (filtrados por clientId del usuario actual)
- [ ] Filtros por estado: todos, requested, negotiating, accepted, in_progress, completed, paid, cancelled
- [ ] Paginación (10 por página)
- [ ] Ordenar por fecha (más recientes primero)
- [ ] Badge de estado con colores según AGENTS.md
- [ ] Click conduce a RideDetails del cliente

### Backend
- [ ] Endpoint GET /api/rides con filtro clientId
- [ ] Soporte paginación

## Criterios de Aceptación
- Solo pedidos del cliente logueado
- Filtros de estado funcionales
- Paginación visible
- Badge de estado con colores correctos
- Click abre detalles