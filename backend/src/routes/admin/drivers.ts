import { Hono } from 'hono/tiny'
import { Driver } from '../../models/driver'
import { User } from '../../models/user'

const app = new Hono()

app.get('/', async (c) => {
  try {
    const status = c.req.query('status')
    const page = parseInt(c.req.query('page') || '1')
    const limit = parseInt(c.req.query('limit') || '20')

    const query: Record<string, any> = {}
    if (status) query.verificationStatus = status

    const skip = (page - 1) * limit
    const [drivers, total] = await Promise.all([
      Driver.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Driver.countDocuments(query)
    ])

    // Obtener info de usuarios para cada driver
    const userIds = drivers.map(d => d.userId)
    const users = await User.find({ clerkId: { $in: userIds } }).select('email firstName lastName imageUrl')
    const usersMap = new Map(users.map(u => [u.clerkId, u]))

    const driversWithUser = drivers.map(d => ({
      ...d.toObject(),
      user: usersMap.get(d.userId) || null
    }))

    return c.json({
      drivers: driversWithUser,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching drivers:', error)
    return c.json({ error: 'Error fetching drivers' }, 500)
  }
})

app.get('/pending', async (c) => {
  try {
    const drivers = await Driver.find({ verificationStatus: 'pending' })
      .sort({ createdAt: -1 })

    const userIds = drivers.map(d => d.userId)
    const users = await User.find({ clerkId: { $in: userIds } }).select('email firstName lastName imageUrl')
    const usersMap = new Map(users.map(u => [u.clerkId, u]))

    const driversWithUser = drivers.map(d => ({
      ...d.toObject(),
      user: usersMap.get(d.userId) || null
    }))

    return c.json({ drivers: driversWithUser })
  } catch (error) {
    console.error('Error fetching pending drivers:', error)
    return c.json({ error: 'Error fetching pending drivers' }, 500)
  }
})

app.get('/:userId', async (c) => {
  try {
    const userId = c.req.param('userId')
    const driver = await Driver.findOne({ userId })
    if (!driver) {
      return c.json({ error: 'Driver not found' }, 404)
    }

    const user = await User.findOne({ clerkId: userId })

    return c.json({
      ...driver.toObject(),
      user: user || null
    })
  } catch (error) {
    console.error('Error fetching driver:', error)
    return c.json({ error: 'Error fetching driver' }, 500)
  }
})

app.patch('/verify/:userId', async (c) => {
  try {
    const userId = c.req.param('userId')
    const body = await c.req.json().catch(() => ({})) as { action: 'approve' | 'reject'; reason?: string }
    const { action, reason } = body

    const driver = await Driver.findOne({ userId })
    if (!driver) {
      return c.json({ error: 'Driver not found' }, 404)
    }

    if (action === 'approve') {
      driver.verificationStatus = 'verified'
      driver.isVerified = true
      driver.rejectionReason = undefined
    } else if (action === 'reject') {
      driver.verificationStatus = 'rejected'
      driver.rejectionReason = reason || 'Documentos no válidos'
    }

    driver.reviewedAt = new Date()
    await driver.save()

    return c.json(driver)
  } catch (error) {
    console.error('Error verifying driver:', error)
    return c.json({ error: 'Error verifying driver' }, 500)
  }
})

app.patch('/set-reviewing/:userId', async (c) => {
  try {
    const userId = c.req.param('userId')
    
    const driver = await Driver.findOneAndUpdate(
      { userId },
      { 
        $set: { 
          verificationStatus: 'in_review',
          reviewedAt: new Date()
        } 
      },
      { new: true }
    )

    if (!driver) {
      return c.json({ error: 'Driver not found' }, 404)
    }

    return c.json(driver)
  } catch (error) {
    console.error('Error setting driver to in_review:', error)
    return c.json({ error: 'Error setting driver to in_review' }, 500)
  }
})

app.patch('/suspend/:userId', async (c) => {
  try {
    const userId = c.req.param('userId')
    
    const driver = await Driver.findOne({ userId })
    if (!driver) {
      return c.json({ error: 'Driver not found' }, 404)
    }

    driver.verificationStatus = driver.verificationStatus === 'suspended' ? 'verified' : 'suspended'
    await driver.save()

    return c.json(driver)
  } catch (error) {
    console.error('Error suspending driver:', error)
    return c.json({ error: 'Error suspending driver' }, 500)
  }
})

export default app