---
description: "Usar cuando se construyan pantallas React del portal cliente, conductor o admin, incluyendo integracion con API y estados por rol."
name: "Frontend Portales por Rol"
applyTo: "**/*.{tsx,ts,css}"
---
# Instrucciones frontend

- Mantener separacion por portal: client, driver y admin.
- Proteger rutas por autenticacion y rol.
- Consumir solo endpoints versionados /api/v1.
- Manejar errores de API de forma centralizada y consistente.
- No asumir permisos desde UI: backend es la fuente de verdad.
- Cliente debe cubrir: crear ride, seguimiento, historial, pago.
- Conductor debe cubrir: disponibilidad, aceptar ride, actualizar estado, tracking.
- Admin debe cubrir: dashboard, gestion users/drivers/rides/payments y auditoria.
- No mergear UI desconectada: cada vista debe apuntar a backend real.
