import { Hono } from 'hono/tiny'
import { mongoose } from '../db/mongo'

const health = new Hono()

health.get('/', (c) => {
  const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      api: 'ok',
      mongodb: mongoStatus
    }
  })
})

health.get('/ready', (c) => c.json({ ready: true }))

export default health