import { Hono } from 'hono/tiny'
import mongoose from 'mongoose'
import { getRedis } from '../services/redis'

const health = new Hono()

const startTime = Date.now()
const VERSION = '1.0.0'

health.get('/', async (c) => {
  // MongoDB check
  let mongoStatus = 'disconnected'
  try {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.db?.admin().ping()
      mongoStatus = 'connected'
    }
  } catch {
    mongoStatus = 'error'
  }

  // Redis check
  let redisStatus = 'disconnected'
  try {
    const redis = getRedis()
    if (redis.status === 'ready') {
      await redis.ping()
      redisStatus = 'connected'
    }
  } catch {
    redisStatus = 'error'
  }

  const isHealthy = mongoStatus === 'connected'

  return c.json({
    status: isHealthy ? 'healthy' : 'degraded',
    version: VERSION,
    uptime: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
    checks: {
      mongo: mongoStatus,
      redis: redisStatus,
    },
  }, isHealthy ? 200 : 503)
})

export default health
