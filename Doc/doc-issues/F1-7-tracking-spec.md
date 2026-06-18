# F1-7: Tracking en Tiempo Real del Conductor

## Rol
Frontend + Backend

## Descripción
Mostrar ubicación del conductor en tiempo real cuando el ride está en estado `in_progress`.

## Subtareas

### Backend
- [ ] Actualizar ubicación del driver cada X segundos
- [ ] Endpoint PATCH /api/users/driver/:userId/location (driver)
- [ ] Guardar location en modelo Driver

### Frontend
- [ ] Integrar Google Maps API o Mapbox
- [ ] Mostrar ruta pickup → dropoff
- [ ] Mostrar marker del conductor en movimiento
- [ ] Actualizar posición cada 5 segundos
- [ ] Panel con info del conductor y tiempo estimado

## Criterios de Aceptación
- Mapa visible solo cuando status = `in_progress`
- Posición actualizada cada 5 segundos
- Ruta visual entre pickup y dropoff
- Info del conductor visible (nombre, foto, rating)