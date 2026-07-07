import { Hono } from 'hono/tiny'
import { Report } from '../models/report'
import { Ride } from '../models/ride'
import { authMiddleware } from '../middleware'
import type { AuthUser } from '../middleware'
import { logAudit } from '../services/audit'

const reports = new Hono()

// POST /api/reports - Create a report
reports.post('/', authMiddleware, async (c) => {
  const currentUser = (c as any).get('user') as AuthUser
  const { reportedId, reportedRole, rideId, comment } = await c.req.json()

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

  if (rideId) {
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
      details: { reportedId, reportedRole, rideId },
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
