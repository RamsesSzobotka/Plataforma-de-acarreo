---
name: realtime-driver-tracking
description: "Implementa tiempo real para conductor y rides con WebSockets. Usar para ubicacion en vivo, notificaciones de ride y actualizacion de estados operativos."
---

# Realtime Driver Tracking

## Cuando usar

- Tracking de ubicacion de conductor.
- Notificaciones de nueva solicitud.
- Actualizaciones de estado del ride en vivo.

## Procedimiento

1. Configurar capa socket en backend.
2. Validar token antes de aceptar conexion.
3. Asociar socket con userId y role.
4. Implementar eventos:
   - driver:location:update
   - ride:new_request
   - ride:accepted
   - ride:status_update
5. Aplicar rate limit en canal de ubicacion.
6. Sincronizar estado del ride en frontend de cliente y conductor.
7. Manejar reconexion y estados transitorios.

## Validaciones minimas

- Solo driver emite ubicacion.
- Solo usuarios autorizados reciben eventos del ride.
- Los cambios de estado realtime respetan reglas del rides engine.
