---
description: "Usar cuando se implemente autenticacion SSO, autorizacion RBAC, ownership anti-IDOR, Stripe PaymentIntent o webhook de pagos."
name: "Seguridad y Pagos"
applyTo: "**/*.ts"
---
# Instrucciones de seguridad y pagos

- Endpoints protegidos: validar token, usuario activo y rol autorizado.
- Ownership obligatorio: propietario o admin.
- Aplicar rate limiting en auth/callback, creacion de rides y acciones admin sensibles.
- Sanitizar payloads y validar tipos/rangos.
- Stripe:
  - crear PaymentIntent desde backend,
  - validar firma del webhook,
  - idempotencia por event.id,
  - actualizar estado paid solo por evento oficial.
- Nunca confiar en estado de pago enviado por frontend.
- Registrar eventos criticos para trazabilidad.
