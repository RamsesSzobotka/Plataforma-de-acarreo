/**
 * Email templates for platform notifications
 */

interface RideDetails {
  rideId: string
  title: string
  pickupAddress: string
  dropoffAddress: string
  finalPrice?: number
}

const baseStyles = `
  font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  max-width: 600px;
  margin: 0 auto;
  padding: 24px;
  background-color: #ffffff;
`

const headerStyles = `
  background: linear-gradient(135deg, #0D9488 0%, #0F766E 100%);
  color: white;
  padding: 32px 24px;
  border-radius: 12px 12px 0 0;
  text-align: center;
`

const contentStyles = `
  padding: 32px 24px;
  background-color: #F8FAFC;
`

const footerStyles = `
  padding: 24px;
  text-align: center;
  color: #64748B;
  font-size: 14px;
  border-top: 1px solid #E2E8F0;
`

const buttonStyles = `
  display: inline-block;
  background: #0D9488;
  color: white !important;
  padding: 14px 28px;
  border-radius: 8px;
  text-decoration: none;
  font-weight: 600;
  margin-top: 16px;
`

/**
 * Email sent to client when driver uploads delivery photo
 */
export function deliveryPhotoUploadedEmail(
  to: string,
  rideDetails: RideDetails
): { to: string; subject: string; html: string; text: string } {
  const { rideId, title, pickupAddress, dropoffAddress } = rideDetails

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Foto de entrega subida</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F1F5F9;">
  <div style="${baseStyles}">
    <div style="${headerStyles}">
      <h1 style="margin: 0; font-size: 24px; font-weight: 700;">
        📸 Foto de Entrega
      </h1>
      <p style="margin: 8px 0 0; opacity: 0.9; font-size: 16px;">
        Tu conductor ha subido la foto de entrega
      </p>
    </div>
    
    <div style="${contentStyles}">
      <p style="margin: 0 0 16px; color: #0F172A; font-size: 16px; line-height: 1.6;">
        Hola,
      </p>
      <p style="margin: 0 0 24px; color: #0F172A; font-size: 16px; line-height: 1.6;">
        Tu conductor ha subido la <strong>foto de entrega</strong> para tu pedido:
      </p>
      
      <div style="background: white; border-radius: 8px; padding: 20px; margin-bottom: 24px; border: 1px solid #E2E8F0;">
        <h3 style="margin: 0 0 12px; color: #0D9488; font-size: 18px;">${title}</h3>
        <p style="margin: 8px 0; color: #334155; font-size: 14px;">
          <strong>Recogida:</strong> ${pickupAddress}
        </p>
        <p style="margin: 8px 0; color: #334155; font-size: 14px;">
          <strong>Entrega:</strong> ${dropoffAddress}
        </p>
      </div>
      
      <p style="margin: 0 0 24px; color: #334155; font-size: 16px; line-height: 1.6;">
        Por favor, <strong>revisa la foto y confirma la entrega</strong> en la aplicación para completar el acarreo.
      </p>
      
      <div style="text-align: center;">
        <a href="${process.env.FRONTEND_URL || 'https://carglyn.com'}/ride/${rideId}" style="${buttonStyles}">
          Confirmar Entrega
        </a>
      </div>
    </div>
    
    <div style="${footerStyles}">
      <p style="margin: 0 0 8px;">
        ¿Preguntas? Escríbenos a <a href="mailto:soporte@carglyn.com" style="color: #0D9488;">soporte@carglyn.com</a>
      </p>
      <p style="margin: 0;">© ${new Date().getFullYear()} Carglyn. Todos los derechos reservados.</p>
    </div>
  </div>
</body>
</html>`

  const text = `
Foto de Entrega - Tu conductor ha subido la foto de entrega

Hola,

Tu conductor ha subido la foto de entrega para tu pedido "${title}".

Detalles del pedido:
- Recogida: ${pickupAddress}
- Entrega: ${dropoffAddress}

Por favor, revisa la foto y confirma la entrega en la aplicación para completar el acarreo.

Ir a la aplicación: ${process.env.FRONTEND_URL || 'https://carglyn.com'}/ride/${rideId}

¿Preguntas? Escríbenos a soporte@carglyn.com

© ${new Date().getFullYear()} Carglyn. Todos los derechos reservados.
`

  return {
    to,
    subject: '📸 Tu conductor subió la foto de entrega - Confirma la entrega',
    html,
    text,
  }
}

/**
 * Email sent to driver when payment is received
 */
export function paymentReceivedEmail(
  to: string,
  amount: number,
  rideDetails: RideDetails
): { to: string; subject: string; html: string; text: string } {
  const { rideId, title, pickupAddress, dropoffAddress } = rideDetails

  // Amount received by driver (after 10% commission)
  const driverReceived = (amount * 0.9).toFixed(2)

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>¡Pago recibido!</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F1F5F9;">
  <div style="${baseStyles}">
    <div style="${headerStyles}">
      <h1 style="margin: 0; font-size: 24px; font-weight: 700;">
        ✅ ¡Pago Recibido!
      </h1>
      <p style="margin: 8px 0 0; opacity: 0.9; font-size: 16px;">
        Se te ha transferido a tu cuenta Stripe Connect
      </p>
    </div>
    
    <div style="${contentStyles}">
      <p style="margin: 0 0 16px; color: #0F172A; font-size: 16px; line-height: 1.6;">
        ¡Felicitaciones!
      </p>
      
      <div style="background: white; border-radius: 8px; padding: 24px; margin-bottom: 24px; border: 1px solid #E2E8F0; text-align: center;">
        <p style="margin: 0 0 8px; color: #64748B; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">
          Monto recibido (después del 10% de comisión)
        </p>
        <p style="margin: 0; color: #22C55E; font-size: 36px; font-weight: 700; font-family: 'JetBrains Mono', monospace;">
          $${driverReceived}
        </p>
        <p style="margin: 8px 0 0; color: #64748B; font-size: 12px;">
          (Precio total: $${amount.toFixed(2)} - Comisión: $${(amount * 0.1).toFixed(2)})
        </p>
      </div>
      
      <div style="background: white; border-radius: 8px; padding: 20px; margin-bottom: 24px; border: 1px solid #E2E8F0;">
        <h3 style="margin: 0 0 12px; color: #0D9488; font-size: 18px;">${title}</h3>
        <p style="margin: 8px 0; color: #334155; font-size: 14px;">
          <strong>Recogida:</strong> ${pickupAddress}
        </p>
        <p style="margin: 8px 0; color: #334155; font-size: 14px;">
          <strong>Entrega:</strong> ${dropoffAddress}
        </p>
      </div>
      
      <p style="margin: 0 0 24px; color: #334155; font-size: 16px; line-height: 1.6;">
        El pago será reflejado en tu cuenta Stripe Connect en 2-3 días hábiles según las políticas de Stripe.
      </p>
      
      <p style="margin: 0; color: #334155; font-size: 16px; line-height: 1.6;">
        ¡Gracias por usar <strong>Carglyn</strong>!
      </p>
    </div>
    
    <div style="${footerStyles}">
      <p style="margin: 0 0 8px;">
        ¿Preguntas? Escríbenos a <a href="mailto:soporte@carglyn.com" style="color: #0D9488;">soporte@carglyn.com</a>
      </p>
      <p style="margin: 0;">© ${new Date().getFullYear()} Carglyn. Todos los derechos reservados.</p>
    </div>
  </div>
</body>
</html>`

  const text = `
¡Pago Recibido! - Se te ha transferido a tu cuenta Stripe Connect

¡Felicitaciones!

Monto recibido (después del 10% de comisión): $${driverReceived}
(Precio total: $${amount.toFixed(2)} - Comisión: $${(amount * 0.1).toFixed(2)})

Detalles del acarreo "${title}":
- Recogida: ${pickupAddress}
- Entrega: ${dropoffAddress}

El pago será reflejado en tu cuenta Stripe Connect en 2-3 días hábiles según las políticas de Stripe.

¡Gracias por usar Carglyn!

¿Preguntas? Escríbenos a soporte@carglyn.com

© ${new Date().getFullYear()} Carglyn. Todos los derechos reservados.
`

  return {
    to,
    subject: `✅ ¡Pago recibido! $${driverReceived} transferidos a tu cuenta`,
    html,
    text,
  }
}

/**
 * Email sent to client when a driver accepts their ride
 */
export function rideAcceptedEmail(
  to: string,
  rideDetails: RideDetails
): { to: string; subject: string; html: string; text: string } {
  const { rideId, title, pickupAddress, dropoffAddress } = rideDetails

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Conductor asignado</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F1F5F9;">
  <div style="${baseStyles}">
    <div style="${headerStyles}">
      <h1 style="margin: 0; font-size: 24px; font-weight: 700;">
        🚚 Conductor Asignado
      </h1>
      <p style="margin: 8px 0 0; opacity: 0.9; font-size: 16px;">
        Un conductor ha aceptado tu pedido
      </p>
    </div>
    
    <div style="${contentStyles}">
      <p style="margin: 0 0 16px; color: #0F172A; font-size: 16px; line-height: 1.6;">
        Hola,
      </p>
      <p style="margin: 0 0 24px; color: #0F172A; font-size: 16px; line-height: 1.6;">
        Un conductor ha aceptado tu pedido. Pronto comenzará el viaje.
      </p>
      
      <div style="background: white; border-radius: 8px; padding: 20px; margin-bottom: 24px; border: 1px solid #E2E8F0;">
        <h3 style="margin: 0 0 12px; color: #0D9488; font-size: 18px;">${title}</h3>
        <p style="margin: 8px 0; color: #334155; font-size: 14px;">
          <strong>Recogida:</strong> ${pickupAddress}
        </p>
        <p style="margin: 8px 0; color: #334155; font-size: 14px;">
          <strong>Entrega:</strong> ${dropoffAddress}
        </p>
      </div>
      
      <div style="text-align: center;">
        <a href="${process.env.FRONTEND_URL || 'https://carglyn.com'}/ride/${rideId}" style="${buttonStyles}">
          Ver detalles del acarreo
        </a>
      </div>
    </div>
    
    <div style="${footerStyles}">
      <p style="margin: 0 0 8px;">
        ¿Preguntas? Escríbenos a <a href="mailto:soporte@carglyn.com" style="color: #0D9488;">soporte@carglyn.com</a>
      </p>
      <p style="margin: 0;">© ${new Date().getFullYear()} Carglyn. Todos los derechos reservados.</p>
    </div>
  </div>
</body>
</html>`

  const text = `
Conductor Asignado - Un conductor ha aceptado tu pedido

Hola,

Un conductor ha aceptado tu pedido. Pronto comenzará el viaje.

Detalles del pedido "${title}":
- Recogida: ${pickupAddress}
- Entrega: ${dropoffAddress}

Ver detalles del acarreo: ${process.env.FRONTEND_URL || 'https://carglyn.com'}/ride/${rideId}

¿Preguntas? Escríbenos a soporte@carglyn.com

© ${new Date().getFullYear()} Carglyn. Todos los derechos reservados.
`

  return {
    to,
    subject: '🚚 Conductor asignado a tu acarreo',
    html,
    text,
  }
}

/**
 * Email sent to client when the trip starts (in_progress)
 */
export function rideInProgressEmail(
  to: string,
  rideDetails: RideDetails
): { to: string; subject: string; html: string; text: string } {
  const { rideId, title, pickupAddress, dropoffAddress } = rideDetails

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Acarreo en camino</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F1F5F9;">
  <div style="${baseStyles}">
    <div style="${headerStyles}">
      <h1 style="margin: 0; font-size: 24px; font-weight: 700;">
        📍 Acarreo en Camino
      </h1>
      <p style="margin: 8px 0 0; opacity: 0.9; font-size: 16px;">
        Tu conductor ha iniciado el viaje
      </p>
    </div>
    
    <div style="${contentStyles}">
      <p style="margin: 0 0 16px; color: #0F172A; font-size: 16px; line-height: 1.6;">
        Hola,
      </p>
      <p style="margin: 0 0 24px; color: #0F172A; font-size: 16px; line-height: 1.6;">
        Tu conductor ha iniciado el viaje. Puedes seguir su ubicación en tiempo real.
      </p>
      
      <div style="background: white; border-radius: 8px; padding: 20px; margin-bottom: 24px; border: 1px solid #E2E8F0;">
        <h3 style="margin: 0 0 12px; color: #0D9488; font-size: 18px;">${title}</h3>
        <p style="margin: 8px 0; color: #334155; font-size: 14px;">
          <strong>Recogida:</strong> ${pickupAddress}
        </p>
        <p style="margin: 8px 0; color: #334155; font-size: 14px;">
          <strong>Entrega:</strong> ${dropoffAddress}
        </p>
      </div>
      
      <div style="text-align: center;">
        <a href="${process.env.FRONTEND_URL || 'https://carglyn.com'}/ride/${rideId}" style="${buttonStyles}">
          Seguir en vivo
        </a>
      </div>
    </div>
    
    <div style="${footerStyles}">
      <p style="margin: 0 0 8px;">
        ¿Preguntas? Escríbenos a <a href="mailto:soporte@carglyn.com" style="color: #0D9488;">soporte@carglyn.com</a>
      </p>
      <p style="margin: 0;">© ${new Date().getFullYear()} Carglyn. Todos los derechos reservados.</p>
    </div>
  </div>
</body>
</html>`

  const text = `
Acarreo en Camino - Tu conductor ha iniciado el viaje

Hola,

Tu conductor ha iniciado el viaje. Puedes seguir su ubicación en tiempo real.

Detalles del pedido "${title}":
- Recogida: ${pickupAddress}
- Entrega: ${dropoffAddress}

Seguir en vivo: ${process.env.FRONTEND_URL || 'https://carglyn.com'}/ride/${rideId}

¿Preguntas? Escríbenos a soporte@carglyn.com

© ${new Date().getFullYear()} Carglyn. Todos los derechos reservados.
`

  return {
    to,
    subject: '📍 Tu acarreo está en camino',
    html,
    text,
  }
}

/**
 * Email sent to driver when payment is received (status changes to paid)
 */
export function rideCompletedPaidEmail(
  to: string,
  amount: number,
  rideDetails: RideDetails
): { to: string; subject: string; html: string; text: string } {
  const { rideId, title, pickupAddress, dropoffAddress } = rideDetails

  const driverReceived = (amount * 0.9).toFixed(2)

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pago recibido por acarreo</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F1F5F9;">
  <div style="${baseStyles}">
    <div style="${headerStyles}">
      <h1 style="margin: 0; font-size: 24px; font-weight: 700;">
        ✅ Pago Recibido
      </h1>
      <p style="margin: 8px 0 0; opacity: 0.9; font-size: 16px;">
        El pago del acarreo ha sido procesado
      </p>
    </div>
    
    <div style="${contentStyles}">
      <p style="margin: 0 0 16px; color: #0F172A; font-size: 16px; line-height: 1.6;">
        ¡Hola!
      </p>
      <p style="margin: 0 0 24px; color: #0F172A; font-size: 16px; line-height: 1.6;">
        El pago del acarreo ha sido procesado exitosamente.
      </p>
      
      <div style="background: white; border-radius: 8px; padding: 24px; margin-bottom: 24px; border: 1px solid #E2E8F0; text-align: center;">
        <p style="margin: 0 0 8px; color: #64748B; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">
          Monto recibido (después del 10% de comisión)
        </p>
        <p style="margin: 0; color: #22C55E; font-size: 36px; font-weight: 700; font-family: 'JetBrains Mono', monospace;">
          $${driverReceived}
        </p>
        <p style="margin: 8px 0 0; color: #64748B; font-size: 12px;">
          (Precio total: $${amount.toFixed(2)} - Comisión: $${(amount * 0.1).toFixed(2)})
        </p>
      </div>
      
      <div style="background: white; border-radius: 8px; padding: 20px; margin-bottom: 24px; border: 1px solid #E2E8F0;">
        <h3 style="margin: 0 0 12px; color: #0D9488; font-size: 18px;">${title}</h3>
        <p style="margin: 8px 0; color: #334155; font-size: 14px;">
          <strong>Recogida:</strong> ${pickupAddress}
        </p>
        <p style="margin: 8px 0; color: #334155; font-size: 14px;">
          <strong>Entrega:</strong> ${dropoffAddress}
        </p>
      </div>
      
      <div style="text-align: center; margin-bottom: 24px;">
        <a href="${process.env.FRONTEND_URL || 'https://carglyn.com'}/ride/${rideId}" style="${buttonStyles}">
          Ver detalles del acarreo
        </a>
      </div>
      
      <p style="margin: 0; color: #334155; font-size: 16px; line-height: 1.6;">
        ¡Gracias por usar <strong>Carglyn</strong>!
      </p>
    </div>
    
    <div style="${footerStyles}">
      <p style="margin: 0 0 8px;">
        ¿Preguntas? Escríbenos a <a href="mailto:soporte@carglyn.com" style="color: #0D9488;">soporte@carglyn.com</a>
      </p>
      <p style="margin: 0;">© ${new Date().getFullYear()} Carglyn. Todos los derechos reservados.</p>
    </div>
  </div>
</body>
</html>`

  const text = `
Pago Recibido - El pago del acarreo ha sido procesado

¡Hola!

El pago del acarreo ha sido procesado exitosamente.

Monto recibido (después del 10% de comisión): $${driverReceived}
(Precio total: $${amount.toFixed(2)} - Comisión: $${(amount * 0.1).toFixed(2)})

Detalles del acarreo "${title}":
- Recogida: ${pickupAddress}
- Entrega: ${dropoffAddress}

Ver detalles: ${process.env.FRONTEND_URL || 'https://carglyn.com'}/ride/${rideId}

¡Gracias por usar Carglyn!

¿Preguntas? Escríbenos a soporte@carglyn.com

© ${new Date().getFullYear()} Carglyn. Todos los derechos reservados.
`

  return {
    to,
    subject: `✅ Pago recibido por acarreo - $${driverReceived}`,
    html,
    text,
  }
}

/**
 * Email sent to the other party when a ride is cancelled
 */
export function rideCancelledEmail(
  to: string,
  rideDetails: RideDetails,
  cancelledBy: string,
  reason?: string
): { to: string; subject: string; html: string; text: string } {
  const { rideId, title, pickupAddress, dropoffAddress } = rideDetails

  const reasonHtml = reason ? `
        <div style="background: #FEF2F2; border-radius: 8px; padding: 16px; margin-bottom: 24px; border: 1px solid #FECACA;">
          <p style="margin: 0; color: #991B1B; font-size: 14px;">
            <strong>Motivo:</strong> ${reason}
          </p>
        </div>` : ''

  const reasonText = reason ? `\nMotivo: ${reason}` : ''

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Acarreo cancelado</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F1F5F9;">
  <div style="${baseStyles}">
    <div style="${headerStyles}">
      <h1 style="margin: 0; font-size: 24px; font-weight: 700;">
        ❌ Acarreo Cancelado
      </h1>
      <p style="margin: 8px 0 0; opacity: 0.9; font-size: 16px;">
        Tu acarreo ha sido cancelado por ${cancelledBy}
      </p>
    </div>
    
    <div style="${contentStyles}">
      <p style="margin: 0 0 16px; color: #0F172A; font-size: 16px; line-height: 1.6;">
        Hola,
      </p>
      <p style="margin: 0 0 24px; color: #0F172A; font-size: 16px; line-height: 1.6;">
        Tu acarreo ha sido cancelado por <strong>${cancelledBy}</strong>.
      </p>
      
      ${reasonHtml}
      
      <div style="background: white; border-radius: 8px; padding: 20px; margin-bottom: 24px; border: 1px solid #E2E8F0;">
        <h3 style="margin: 0 0 12px; color: #0D9488; font-size: 18px;">${title}</h3>
        <p style="margin: 8px 0; color: #334155; font-size: 14px;">
          <strong>Recogida:</strong> ${pickupAddress}
        </p>
        <p style="margin: 8px 0; color: #334155; font-size: 14px;">
          <strong>Entrega:</strong> ${dropoffAddress}
        </p>
      </div>
      
      <p style="margin: 0; color: #334155; font-size: 16px; line-height: 1.6;">
        Si tienes alguna pregunta, no dudes en contactarnos.
      </p>
    </div>
    
    <div style="${footerStyles}">
      <p style="margin: 0 0 8px;">
        ¿Preguntas? Escríbenos a <a href="mailto:soporte@carglyn.com" style="color: #0D9488;">soporte@carglyn.com</a>
      </p>
      <p style="margin: 0;">© ${new Date().getFullYear()} Carglyn. Todos los derechos reservados.</p>
    </div>
  </div>
</body>
</html>`

  const text = `
Acarreo Cancelado - Tu acarreo ha sido cancelado por ${cancelledBy}

Hola,

Tu acarreo ha sido cancelado por ${cancelledBy}.${reasonText}

Detalles del acarreo "${title}":
- Recogida: ${pickupAddress}
- Entrega: ${dropoffAddress}

Si tienes alguna pregunta, no dudes en contactarnos.

¿Preguntas? Escríbenos a soporte@carglyn.com

© ${new Date().getFullYear()} Carglyn. Todos los derechos reservados.
`

  return {
    to,
    subject: '❌ Acarreo cancelado',
    html,
    text,
  }
}