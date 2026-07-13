/**
 * Email notification service using Brevo (Sendinblue) REST API
 * Uses HTTPS (port 443) — works on Render free tier unlike SMTP
 */

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

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email'

/**
 * Send email via Brevo REST API
 * Fire-and-forget: logs errors but doesn't throw
 */
export async function sendEmail(options: EmailOptions): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY
  const configured = !!apiKey

  console.log(`[Email] sendEmail: to="${options.to}", subject="${options.subject}", brevoConfigured=${configured}`)

  if (!configured) {
    console.warn(`[Email] BREVO_API_KEY no configurado, saltando envío a ${options.to}`)
    return
  }

  const fromEmail = process.env.EMAIL_FROM || 'Carglyn.noreply@gmail.com'

  const payload: Record<string, any> = {
    sender: { name: 'Carglyn', email: fromEmail },
    to: [{ email: options.to }],
    subject: options.subject,
    htmlContent: options.html,
  }

  if (options.text) {
    payload.textContent = options.text
  }

  if (options.attachments?.length) {
    payload.attachment = options.attachments.map(a => ({
      name: a.filename,
      content: Buffer.isBuffer(a.content) ? a.content.toString('base64') : a.content,
    }))
  }

  try {
    const res = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'content-type': 'application/json',
        'accept': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const body = await res.text()

    if (!res.ok) {
      console.error(`[Email] ❌ Brevo error ${res.status} enviando a ${options.to}: ${body}`)
    } else {
      console.log(`[Email] ✅ Correo enviado a ${options.to}: ${body}`)
    }
  } catch (error: any) {
    console.error(`[Email] ❌ Error enviando correo a ${options.to}:`, error?.message || error)
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