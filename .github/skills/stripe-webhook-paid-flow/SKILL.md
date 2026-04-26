---
name: stripe-webhook-paid-flow
description: "Implementa flujo de pagos con Stripe (PaymentIntent + webhook firmado + idempotencia). Usar para cobros de rides, conciliacion de pagos y transicion segura a estado paid."
---

# Stripe Webhook Paid Flow

## Cuando usar

- Creacion de PaymentIntent.
- Confirmacion de pagos por webhook.
- Correccion de inconsistencias ride/payment.

## Procedimiento

1. Calcular monto del ride en backend.
2. Crear PaymentIntent en Stripe desde backend.
3. Guardar referencia stripePaymentIntentId en Payments/Rides.
4. Exponer endpoint POST /stripe/webhook.
5. Validar firma con STRIPE_WEBHOOK_SECRET.
6. Aplicar idempotencia por event.id.
7. Actualizar Payment y Ride de forma atomica.
8. Cambiar a paid solo si evento Stripe oficial confirma pago.

## Reglas criticas

- No usar frontend como fuente de verdad de pago.
- Registrar trazabilidad de evento procesado.
- Rechazar eventos invalidos o repetidos.
