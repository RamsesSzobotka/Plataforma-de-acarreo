import { Hono } from 'hono/tiny'
import { User } from '../../models/user'

const app = new Hono()

app.get('/', async (c) => {
  try {
    const role = c.req.query('role')
    const isActive = c.req.query('isActive')
    const search = c.req.query('search')
    const page = parseInt(c.req.query('page') || '1')
    const limit = parseInt(c.req.query('limit') || '20')

    const query: Record<string, unknown> = {}
    if (role) query.role = role
    if (isActive !== undefined) query.isActive = isActive === 'true'
    if (search) {
      query.$or = [
        { email: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } }
      ]
    }

    const skip = (page - 1) * limit
    const [users, total] = await Promise.all([
      User.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(query)
    ])

    return c.json({
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching users:', error)
    return c.json({ error: 'Error fetching users' }, 500)
  }
})

app.get('/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const user = await User.findOne({ clerkId: id })
    if (!user) {
      return c.json({ error: 'User not found' }, 404)
    }
    return c.json(user)
  } catch (error) {
    console.error('Error fetching user:', error)
    return c.json({ error: 'Error fetching user' }, 500)
  }
})

app.patch('/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const body = await c.req.json()

    const allowedFields = ['role', 'isActive', 'phone']
    const updateData: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    const user = await User.findOneAndUpdate(
      { clerkId: id },
      { $set: updateData },
      { new: true }
    )

    if (!user) {
      return c.json({ error: 'User not found' }, 404)
    }

    return c.json(user)
  } catch (error) {
    console.error('Error updating user:', error)
    return c.json({ error: 'Error updating user' }, 500)
  }
})

app.post('/toggle-active/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const user = await User.findOne({ clerkId: id })
    if (!user) {
      return c.json({ error: 'User not found' }, 404)
    }

    const newValue = !user.isActive
    user.isActive = newValue
    await user.save()

    return c.json(user)
  } catch (error) {
    console.error('Error toggling user active:', error)
    return c.json({ error: 'Error toggling user active' }, 500)
  }
})

export default app