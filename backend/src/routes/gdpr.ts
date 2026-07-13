import { Hono } from 'hono/tiny'
import { authMiddleware } from '../middleware/auth'
import { User } from '../models/user'
import { Driver } from '../models/driver'
import { Ride } from '../models/ride'
import { Message } from '../models/message'
import { Rating } from '../models/rating'
import { Consent } from '../models/consent'
import { AuditLog } from '../models/auditLog'
import { logAudit } from '../services/audit'
import crypto from 'crypto'

const gdpr = new Hono()

// All routes require authentication
gdpr.use('*', authMiddleware)

// POST /api/gdpr/consent — Save user consent to a terms version
gdpr.post('/consent', async (c) => {
  const user = c.get('user') as { clerkId: string }
  const { version } = await c.req.json()

  if (!version) {
    return c.json({ error: 'version is required' }, 400)
  }

  await Consent.create({
    userId: user.clerkId,
    version,
    ipAddress: c.req.header('x-forwarded-for') || '',
    userAgent: c.req.header('user-agent') || '',
  })

  return c.json({ status: 'ok' })
})

// GET /api/gdpr/export — Export all personal data for the user
gdpr.get('/export', async (c) => {
  const user = c.get('user') as { clerkId: string }
  const clerkId = user.clerkId

  const [
    profile,
    driver,
    ridesAsClient,
    ridesAsDriver,
    messages,
    ratingsGiven,
    ratingsReceived,
    consentHistory,
  ] = await Promise.all([
    User.findOne({ clerkId }).lean(),
    Driver.findOne({ userId: clerkId }).lean(),
    Ride.find({ clientId: clerkId }).lean(),
    Ride.find({ driverId: clerkId }).lean(),
    Message.find({ senderId: clerkId }).lean(),
    Rating.find({ raterId: clerkId }).lean(),
    Rating.find({ ratedId: clerkId }).lean(),
    Consent.find({ userId: clerkId }).sort({ acceptedAt: -1 }).lean(),
  ])

  const date = new Date().toISOString().split('T')[0]
  c.header('Content-Type', 'application/json')
  c.header('Content-Disposition', `attachment; filename="mis-datos-carglyn-${date}.json"`)

  return c.json({
    profile,
    driver,
    ridesAsClient,
    ridesAsDriver,
    messages,
    ratingsGiven,
    ratingsReceived,
    consentHistory,
  })
})

// DELETE /api/gdpr/account — Anonymize all personal data and delete the account
gdpr.delete('/account', async (c) => {
  const user = c.get('user') as { clerkId: string; role: string }
  const clerkId = user.clerkId

  const hash = crypto.createHash('md5').update(clerkId).digest('hex')

  // Anonymize user profile
  await User.updateOne({ clerkId }, {
    $set: {
      firstName: 'Usuario eliminado',
      lastName: null,
      email: `${hash}@anon.local`,
      imageUrl: null,
      phone: null,
      isActive: false,
    }
  })

  // Anonymize driver document fields (if driver exists)
  await Driver.updateOne({ userId: clerkId }, {
    $set: {
      vehicleImages: [],
      licenseImage: null,
      cedulaFront: null,
      cedulaBack: null,
      ruvDocument: null,
      plateImage: null,
      insurancePolicy: null,
      carneBlanco: null,
      carneVerde: null,
      carneTransporteCarga: null,
      fumigationCertificate: null,
      phone: null,
    }
  })

  // Anonymize messages sent by the user
  await Message.updateMany(
    { senderId: clerkId },
    { $set: { content: '[mensaje eliminado por GDPR]' } }
  )

  // Anonymize audit log references
  await AuditLog.updateMany(
    { userId: clerkId },
    { $set: { userId: `anon-${hash}` } }
  )

  // Delete driver record entirely
  await Driver.deleteOne({ userId: clerkId })

  // Log the GDPR deletion
  await logAudit({
    action: 'gdpr.account_deleted',
    entityType: 'user',
    entityId: clerkId,
    userId: clerkId,
    userRole: user.role,
    details: { message: 'Cuenta eliminada por GDPR' },
  })

  return c.json({ status: 'ok', message: 'Cuenta eliminada exitosamente' })
})

export default gdpr
