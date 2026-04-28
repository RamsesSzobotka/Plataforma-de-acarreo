# F1-10: Pago con Stripe

## Rol
Frontend + Backend

## Descripción
El cliente realiza el pago después de confirmar entrega. Stripe PaymentIntent con comisión del 10%.

## Subtareas

### Backend
- [ ] Endpoint POST /api/payments/create-intent
- [ ] Calcular 10% comisión
- [ ] Webhook POST /api/payments/webhook para confirmar pago
- [ ] Cambiar estado del ride a `paid` automáticamente

### Frontend
- [ ] Integrar Stripe Elements (Card input)
- [ ] Botón "Pagar $X.XX" en RideDetails
- [ ] Validar estado: visible solo cuando `completed`
- [ ] Loading state durante procesamiento
- [ ] Success/Error feedback
- [ ] Receipt/desarga de comprobante

## Criterios de Aceptación
- Visible solo cuando status = `completed`
- Comisión del 10% aplicada correctamente
- Estado cambia a `paid` vía webhook
- Notificación en tiempo real