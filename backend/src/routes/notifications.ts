import { Hono } from 'hono/tiny'
import { Notification } from '../models/notification'
import { authMiddleware } from '../middleware'

const notifications = new Hono()

notifications.get('/', authMiddleware, async (c) => {
  const user = c.get('user')
  const page = parseInt(c.req.query('page') || '1')
  const limit = parseInt(c.req.query('limit') || '20')
  const skip = (page - 1) * limit

  const [data, total] = await Promise.all([
    Notification.find({ userId: user.clerkId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Notification.countDocuments({ userId: user.clerkId })
  ])

  return c.json({
    data,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) }
  })
})

notifications.get('/unread-count', authMiddleware, async (c) => {
  const user = c.get('user')
  const count = await Notification.countDocuments({ userId: user.clerkId, read: false })
  return c.json({ count })
})

notifications.patch('/:id/read', authMiddleware, async (c) => {
  const id = c.req.param('id')
  const user = c.get('user')

  const result = await Notification.findOneAndUpdate(
    { _id: id, userId: user.clerkId },
    { read: true },
    { new: true }
  )

  if (!result) return c.json({ error: 'Notificacion no encontrada' }, 404)
  return c.json(result)
})

notifications.patch('/read-all', authMiddleware, async (c) => {
  const user = c.get('user')
  await Notification.updateMany(
    { userId: user.clerkId, read: false },
    { read: true }
  )
  return c.json({ success: true })
})

export default notifications
