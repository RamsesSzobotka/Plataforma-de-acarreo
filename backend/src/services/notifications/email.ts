/**
 * Email notification service using Gmail SMTP with Nodemailer
 */

import nodemailer from 'nodemailer'

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

interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

/**
 * Send email via Gmail SMTP
 * Fire-and-forget: logs errors but doesn't throw
 */
export async function sendEmail(options: EmailOptions): Promise<void> {
  const smtpConfigured = process.env.SMTP_USER && process.env.SMTP_PASS

  if (!smtpConfigured) {
    console.warn('[Email] SMTP not configured (SMTP_USER/SMTP_PASS missing), skipping email send')
    return
  }

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'noreply@carglyn.com',
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    })
  } catch (error) {
    // Log but don't throw - email failure shouldn't break the main flow
    console.error('[Email] Failed to send email:', error)
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