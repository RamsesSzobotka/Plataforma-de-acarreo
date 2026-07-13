/**
 * Email notification service using Gmail SMTP with Nodemailer
 */

import nodemailer from 'nodemailer'

console.log(`[Email] Inicializando transporter SMTP: host=${process.env.SMTP_HOST}, port=${process.env.SMTP_PORT}, user=${process.env.SMTP_USER ? process.env.SMTP_USER.substring(0, 5) + '...' : 'NO CONFIGURADO'}`)

// Create transporter from env vars
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

// Verify SMTP connection on startup (fire-and-forget, logs result)
transporter.verify()
  .then(() => console.log(`[Email] ✅ Transporter SMTP verificado correctamente: ${process.env.SMTP_USER}`))
  .catch(err => console.error(`[Email] ❌ Transporter SMTP falló verificación:`, err))

interface Attachment {
  filename: string
  content: Buffer | string
  contentType?: string
}

interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
  attachments?: Attachment[]
}

/**
 * Send email via Gmail SMTP
 * Fire-and-forget: logs errors but doesn't throw
 */
export async function sendEmail(options: EmailOptions): Promise<void> {
  const smtpUser = process.env.SMTP_USER
  const smtpPass = process.env.SMTP_PASS
  const smtpConfigured = smtpUser && smtpPass

  console.log(`[Email] sendEmail llamado: to="${options.to}", subject="${options.subject}", smtpConfigured=${smtpConfigured}`)

  if (!smtpConfigured) {
    console.warn(`[Email] SMTP no configurado (SMTP_USER=${!!smtpUser}, SMTP_PASS=${!!smtpPass}), saltando envío a ${options.to}`)
    return
  }

  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'noreply@carglyn.com',
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      attachments: options.attachments,
    })
    console.log(`[Email] ✅ Correo enviado exitosamente a ${options.to}: messageId=${info.messageId}, accepted=${JSON.stringify(info.accepted)}, rejected=${JSON.stringify(info.rejected)}`)
    if (info.rejected?.length > 0) {
      console.warn(`[Email] ⚠️  Correo rechazado para: ${JSON.stringify(info.rejected)}`)
    }
  } catch (error: any) {
    // Log but don't throw - email failure shouldn't break the main flow
    console.error(`[Email] ❌ Error enviando correo a ${options.to}:`, error?.message || error)
    if (error?.code) console.error(`[Email] Código de error: ${error.code}`)
    if (error?.response) console.error(`[Email] Respuesta SMTP: ${error.response}`)
    if (error?.command) console.error(`[Email] Comando SMTP: ${error.command}`)
  }
}

/**
 * Get user email from MongoDB by clerkId
 */
export async function getUserEmail(clerkId: string): Promise<string | null> {
  const { User } = await import('../../models/user')
  const user = await User.findOne({ clerkId })
  return user?.email || null
}

/**
 * Re-export template functions for convenience
 * These are used by rides.ts and stripeMarketplace.ts
 */
export { deliveryPhotoUploadedEmail, paymentReceivedEmail } from './templates'