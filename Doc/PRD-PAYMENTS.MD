📄 PRD — Implementación Stripe Connect Marketplace (Split 90/10)
1. Propósito

Corregir el flujo actual de pagos para que:

El cliente continúe pagando con método guardado.
El pago se divida automáticamente:
90% al conductor
10% a la plataforma
Se implemente correctamente Stripe Connect Express.
Todas las solicitudes estén protegidas con JWT de Clerk.
Los estados de pago se sincronicen vía Webhooks.
2. Problema Actual

Estado actual:

El cliente paga correctamente.
El dinero llega a la cuenta principal de Stripe.
No se transfiere al conductor.

Causa técnica:

Se están utilizando PaymentIntents estándar, sin:

transfer_data.destination
application_fee_amount

Por lo tanto, no es un marketplace real.

3. Objetivos
Objetivo Principal

Convertir el sistema de pagos en un Marketplace Stripe Connect usando Destination Charges.

Objetivos Secundarios
Registrar conductores en Stripe Connect Express.
Validar que el conductor tenga payouts_enabled = true.
Automatizar split 90/10.
Implementar webhooks obligatorios.
Garantizar idempotencia.
Asegurar autenticación con Clerk en todos los endpoints.
4. Alcance
Incluye
Onboarding Connect Express
Verificación de estado de cuenta
Modificación de PaymentIntent existente
Webhooks
Actualizaciones en base de datos
No Incluye (Fase 2)
Retención manual de fondos
Payouts manuales
Reembolsos parciales
Split dinámico configurable
5. Arquitectura Técnica
Modelo de Pago

Destination Charges

Cliente → Plataforma (charge)
Stripe:
   90% → Cuenta Connect del conductor
   10% → Plataforma (application_fee)
6. Requerimientos Funcionales
6.1 Onboarding Conductor (Stripe Connect Express)
Trigger

Botón:

"Activar cuenta para recibir pagos"

Endpoint
POST /api/payments/connect/create-account
Authorization: Bearer <clerk_jwt>
Lógica Backend
Validar usuario autenticado.
Confirmar que rol = driver.
Crear cuenta Express:
stripe.accounts.create({
  type: 'express',
  country: 'PA',
  email: user.email
})
Guardar en DB:
stripeAccountId
payoutsEnabled = false
Crear account onboarding link:
stripe.accountLinks.create({
  account,
  refresh_url,
  return_url,
  type: 'account_onboarding'
})
Retornar onboardingUrl.
6.2 Verificar Estado de Cuenta
Endpoint
GET /api/payments/connect/status
Authorization: Bearer <clerk_jwt>
Lógica
Obtener stripeAccountId

Consultar Stripe:

stripe.accounts.retrieve(accountId)
Actualizar:
payoutsEnabled = account.payouts_enabled
6.3 Agregar Método de Pago (Cliente)

Actualmente el cliente ya guarda método.
Debe mantenerse el flujo basado en SetupIntent.

Endpoint
POST /api/payments/setup-intent
Authorization: Bearer <clerk_jwt>
Lógica Backend
Crear o reutilizar Stripe Customer.
Crear SetupIntent:
stripe.setupIntents.create({
  customer,
  automatic_payment_methods: { enabled: true }
})
Retornar clientSecret.

Frontend:

Confirmar SetupIntent con Stripe Elements.
Guardar paymentMethodId en DB.
6.4 Modificación Crítica del Pago (Split 90/10)
Endpoint
POST /api/payments/charge
Authorization: Bearer <clerk_jwt>
Validaciones Previas

Antes de crear PaymentIntent:

Driver tiene stripeAccountId
Driver tiene payoutsEnabled === true
Cliente tiene stripeCustomerId
Cliente tiene paymentMethodId
Nueva Implementación de PaymentIntent
stripe.paymentIntents.create({
  amount: rideAmount,
  currency: 'usd',
  customer: stripeCustomerId,
  payment_method: paymentMethodId,
  confirm: true,
  off_session: true,

  application_fee_amount: platformFee,   // 10%
  transfer_data: {
    destination: driver.stripeAccountId
  }
})
Cálculo
platformFee = rideAmount * 0.10
driverAmount = rideAmount - platformFee
Resultado

Stripe automáticamente:

Cobra al cliente
Transfiere 90% al conductor
Retiene 10% en la plataforma
6.5 Webhooks Obligatorios
Endpoint Público
POST /api/webhooks/stripe
Validación de Firma
stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
Eventos Requeridos
Evento	Acción
payment_intent.succeeded	Ride → paid
payment_intent.payment_failed	Ride → failed
account.updated	Actualizar payoutsEnabled
payout.paid	Log payout exitoso
Sin Webhook → No se considera producción válida.
7. Cambios en Base de Datos
Tabla users
stripeCustomerId
paymentMethodId
Tabla drivers
stripeAccountId
payoutsEnabled (boolean)
Tabla rides
paymentIntentId
status
platformFee
driverAmount
8. Requisitos No Funcionales
Todos los endpoints protegidos con requireAuth() de Clerk.
No exponer stripeAccountId en frontend.
No exponer secret keys.
Uso obligatorio de idempotency keys.
Logs estructurados.
Manejo de errores Stripe tipificado.
9. Flujo Completo Final
Conductor
Presiona "Activar pagos"
Se crea cuenta Connect Express
Completa onboarding
Stripe habilita payouts
Puede recibir 90%
Cliente
Agrega método de pago
Se guarda PaymentMethod
Pago se ejecuta off-session
Ride Finaliza
Backend crea PaymentIntent con:
application_fee_amount = 10%
transfer_data.destination = stripeAccountId
Stripe divide automáticamente
Webhook confirma
Ride cambia a "paid"
10. Criterios de Aceptación

✔ Driver puede completar onboarding
✔ Driver obtiene payouts_enabled = true
✔ Cliente puede guardar tarjeta
✔ Pago divide 90/10 automáticamente
✔ Plataforma recibe comisión
✔ Webhooks actualizan estado correctamente
✔ Endpoints protegidos con Clerk
✔ Idempotencia implementada

11. Riesgos Técnicos
Driver no completa onboarding.
payouts_enabled permanece false.
Webhook mal configurado.
Uso incorrecto de modo test/live.
País con restricciones regulatorias.
12. Métricas de Éxito
% de conductores con Connect activo.
% de pagos exitosos.
Comisión correctamente reflejada en balance de plataforma.
0 pagos donde conductor no reciba fondos.
Resultado Esperado

La plataforma pasa de ser un sistema de cobro simple a un Marketplace Stripe Connect funcional, donde el dinero fluye correctamente:

Cliente → Stripe → 90% Conductor / 10% Plataforma