import { Hono } from 'hono/tiny'
import { authMiddleware } from '../middleware'
import type { AuthUser } from '../middleware'

const debug = new Hono()

/**
 * POST /api/debug/test-email
 * Envía un correo de prueba para verificar configuración de email (Brevo API).
 * Solo accesible para el usuario autenticado a su propio email.
 */
debug.post('/test-email', authMiddleware, async (c) => {
  const currentUser = c.get('user') as AuthUser

  const { sendEmail } = await import('../services/notifications/email')

  const apiKey = process.env.BREVO_API_KEY

  await sendEmail({
    to: currentUser.email,
    subject: '🔧 Correo de prueba - Carglyn',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <div style="background: linear-gradient(135deg, #0D9488 0%, #0F766E 100%); color: white; padding: 32px; border-radius: 12px; text-align: center;">
          <h1 style="margin: 0;">🔧 Correo de Prueba</h1>
        </div>
        <div style="padding: 32px; background: #F8FAFC;">
          <p style="color: #334155;">Este es un correo de prueba desde Carglyn.</p>
          <p style="color: #334155;">Si recibes esto, la configuración de email funciona correctamente.</p>
          <div style="background: #F1F5F9; border-radius: 8px; padding: 16px; margin-top: 16px; font-family: monospace; font-size: 12px;">
            <p style="margin: 4px 0;"><strong>BREVO_API_KEY:</strong> ${apiKey ? apiKey.substring(0, 12) + '...' : 'no configurado'}</p>
            <p style="margin: 4px 0;"><strong>EMAIL_FROM:</strong> ${process.env.EMAIL_FROM || 'Carglyn.noreply@gmail.com'}</p>
          </div>
        </div>
      </div>
    `,
  })

  return c.json({
    success: true,
    message: `Correo de prueba enviado a ${currentUser.email}. Revisa tu bandeja de entrada.`,
    config: {
      brevoConfigured: !!apiKey,
      emailFrom: process.env.EMAIL_FROM || 'Carglyn.noreply@gmail.com',
    },
  })
})

/**
 * POST /api/debug/trigger-nearby-rides
 * Ejecuta manualmente checkNearbyRides() para probar notificaciones de pedidos cercanos.
 * Solo funciona con debug mode activado en Settings > Modo Debug.
 * Requiere un driver conectado via WS con ubicación en Redis y rides disponibles < 20km.
 */
debug.post('/trigger-nearby-rides', authMiddleware, async (c) => {
  const { getDebugMode } = await import('../utils/debugLogger')
  if (!getDebugMode()) {
    return c.json({ success: false, message: 'Activa Modo Debug en Settings > Modo Debug primero' }, 400)
  }

  const { checkNearbyRides } = await import('../services/nearbyRidesNotifier')
  await checkNearbyRides()

  return c.json({
    success: true,
    message: 'checkNearbyRides() ejecutado. Revisa los logs del servidor para ver el resultado.',
  })
})

export default debug
