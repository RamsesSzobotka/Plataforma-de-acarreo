import { Hono } from 'hono/tiny'
import { Report } from '../models/report'
import { Ride } from '../models/ride'
import { authMiddleware } from '../middleware'
import type { AuthUser } from '../middleware'
import { logAudit } from '../services/audit'

const reports = new Hono()

// GET /api/reports - List user's own reports
reports.get('/', authMiddleware, async (c) => {
  const currentUser = (c as any).get('user') as AuthUser
  const status = c.req.query('status')
  const page = parseInt(c.req.query('page') || '1')
  const limit = parseInt(c.req.query('limit') || '10')

  const query: any = { reporterId: currentUser.clerkId }
  if (status && ['pending', 'in_review', 'resolved'].includes(status)) {
    query.status = status
  }

  const skip = (page - 1) * limit

  const [reportsList, total] = await Promise.all([
    Report.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Report.countDocuments(query),
  ])

  return c.json({
    data: reportsList,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  })
})

// GET /api/reports/:id - Get single report (reporter or admin)
reports.get('/:id', authMiddleware, async (c) => {
  const currentUser = (c as any).get('user') as AuthUser
  const id = c.req.param('id')

  const report = await Report.findById(id)
  if (!report) {
    return c.json({ error: 'Reporte no encontrado' }, 404)
  }

  // Only reporter or admin can view
  if (report.reporterId !== currentUser.clerkId && currentUser.role !== 'admin') {
    return c.json({ error: 'No tienes permiso para ver este reporte' }, 403)
  }

  return c.json(report)
})

// POST /api/reports - Create a report
reports.post('/', authMiddleware, async (c) => {
  const currentUser = (c as any).get('user') as AuthUser
  const { reportedId, reportedRole, rideId, comment, category } = await c.req.json()

  if (!reportedId || !reportedRole || !comment) {
    return c.json({ error: 'reportedId, reportedRole y comment son requeridos' }, 400)
  }

  if (!['client', 'driver'].includes(reportedRole)) {
    return c.json({ error: 'reportedRole debe ser client o driver' }, 400)
  }

  if (comment.length < 10) {
    return c.json({ error: 'El comentario debe tener al menos 10 caracteres' }, 400)
  }

  if (comment.length > 1000) {
    return c.json({ error: 'El comentario no puede exceder 1000 caracteres' }, 400)
  }

  if (reportedId === currentUser.clerkId) {
    return c.json({ error: 'No puedes reportarte a ti mismo' }, 400)
  }

  // Validate category if provided
  const validCategories = ['payment_dispute', 'illicit_actions', 'other']
  if (category && !validCategories.includes(category)) {
    return c.json({ error: `category debe ser uno de: ${validCategories.join(', ')}` }, 400)
  }

  const reportCategory = category || 'other'

  // payment_dispute requires rideId and paymentIntentId
  if (reportCategory === 'payment_dispute') {
    if (!rideId) {
      return c.json({ error: 'rideId es requerido para disputas de pago' }, 400)
    }

    const ride = await Ride.findById(rideId)
    if (!ride) {
      return c.json({ error: 'Acarreo no encontrado' }, 404)
    }

    if (!ride.paymentIntentId) {
      return c.json({ error: 'Este acarreo no tiene un pago asociado' }, 400)
    }

    // User must be involved in the ride (client or driver)
    const isClient = ride.clientId === currentUser.clerkId
    const isDriver = ride.driverId === currentUser.clerkId

    if (!isClient && !isDriver) {
      return c.json({ error: 'No estás involucrado en este acarreo' }, 403)
    }

    // For client reporting a driver, or driver reporting a client
    if (reportedRole === 'driver' && !isClient) {
      return c.json({ error: 'Solo el cliente puede reportar al conductor por disputas de pago' }, 403)
    }

    if (reportedRole === 'client' && !isDriver) {
      return c.json({ error: 'Solo el conductor puede reportar al cliente por disputas de pago' }, 403)
    }
  } else if (rideId) {
    // For non-payment_dispute categories, validate ride if provided
    const ride = await Ride.findById(rideId)
    if (!ride) {
      return c.json({ error: 'Acarreo no encontrado' }, 404)
    }

    if (reportedRole === 'driver' && !ride.driverId) {
      return c.json({ error: 'Este acarreo no tiene conductor asignado' }, 400)
    }

    if (reportedRole === 'client' && ride.driverId !== currentUser.clerkId) {
      return c.json({ error: 'No eres el conductor asignado a este acarreo' }, 403)
    }

    if (reportedRole === 'driver' && ride.clientId !== currentUser.clerkId) {
      return c.json({ error: 'No eres el cliente de este acarreo' }, 403)
    }

    const existing = await Report.findOne({ reporterId: currentUser.clerkId, rideId })
    if (existing) {
      return c.json({ error: 'Ya has reportado este acarreo anteriormente' }, 409)
    }
  }

  try {
    const report = new Report({
      reporterId: currentUser.clerkId,
      reportedId,
      reportedRole,
      rideId: rideId || null,
      comment,
      category: reportCategory,
      status: 'pending',
    })

    await report.save()

    const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'
    const userAgent = c.req.header('user-agent') || ''
    await logAudit({
      action: 'report.created',
      entityType: 'report',
      entityId: report._id.toString(),
      userId: currentUser?.clerkId || null,
      userRole: currentUser?.role,
      details: { reportedId, reportedRole, rideId, category: reportCategory },
      ip,
      userAgent,
    })

    return c.json({ success: true, message: 'Reporte enviado correctamente', report }, 201)
  } catch (error: any) {
    console.error('Error creating report:', error)
    return c.json({ error: 'Error al crear el reporte: ' + error.message }, 500)
  }
})

export default reports