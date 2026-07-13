import { Hono } from 'hono/tiny'
import { authMiddleware } from '../middleware'
import type { AuthUser } from '../middleware'

const debug = new Hono()

/**
 * POST /api/debug/test-email
 * Envía un correo de prueba para verificar configuración SMTP.
 * Solo accesible para el usuario autenticado a su propio email.
 */
debug.post('/test-email', authMiddleware, async (c) => {
  const currentUser = c.get('user') as AuthUser

  const { sendEmail } = await import('../services/notifications/email')

  const smtpUser = process.env.SMTP_USER
  const smtpPass = process.env.SMTP_PASS

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
          <p style="color: #334155;">Si recibes esto, la configuración SMTP funciona correctamente.</p>
          <div style="background: #F1F5F9; border-radius: 8px; padding: 16px; margin-top: 16px; font-family: monospace; font-size: 12px;">
            <p style="margin: 4px 0;"><strong>SMTP_HOST:</strong> ${process.env.SMTP_HOST || 'no configurado'}</p>
            <p style="margin: 4px 0;"><strong>SMTP_PORT:</strong> ${process.env.SMTP_PORT || 'no configurado'}</p>
            <p style="margin: 4px 0;"><strong>SMTP_USER:</strong> ${smtpUser ? smtpUser.substring(0, 5) + '...' : 'no configurado'}</p>
            <p style="margin: 4px 0;"><strong>SMTP_PASS:</strong> ${smtpPass ? '✓ configurado' : 'no configurado'}</p>
            <p style="margin: 4px 0;"><strong>EMAIL_FROM:</strong> ${process.env.EMAIL_FROM || 'usando SMTP_USER'}</p>
          </div>
        </div>
      </div>
    `,
  })

  return c.json({
    success: true,
    message: `Correo de prueba enviado a ${currentUser.email}. Revisa tu bandeja de entrada.`,
    config: {
      host: process.env.SMTP_HOST || 'no configurado',
      port: process.env.SMTP_PORT || 'no configurado',
      user: smtpUser ? `${smtpUser.substring(0, 5)}...` : 'no configurado',
      passConfigured: !!smtpPass,
      emailFrom: process.env.EMAIL_FROM || 'usando SMTP_USER',
    },
  })
})

export default debug
