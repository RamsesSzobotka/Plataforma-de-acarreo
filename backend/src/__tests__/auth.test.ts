import { describe, expect, test, beforeAll, afterAll } from 'bun:test'
import { Hono } from 'hono'
import { authMiddleware, requireRole, requireDriver, requireClient, requireAdmin } from '../middleware'

// Mock clerk verification
const mockVerifyToken = async () => ({ sub: 'user_123' })

describe('Auth Middleware', () => {
  const app = new Hono()
  
  app.use('*', authMiddleware)
  app.get('/test', (c) => c.json({ success: true }))
  
  test('should return 401 without Authorization header', async () => {
    const res = await app.request('/test')
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Authorization header required')
  })
  
  test('should return 401 without Bearer prefix', async () => {
    const res = await app.request('/test', {
      headers: { Authorization: 'Basic abc123' }
    })
    expect(res.status).toBe(401)
  })
  
  test('should return 401 without token after Bearer', async () => {
    const res = await app.request('/test', {
      headers: { Authorization: 'Bearer ' }
    })
    expect(res.status).toBe(401)
  })
})

describe('Role Middleware', () => {
  test('requireRole should return 401 without user', async () => {
    const app = new Hono()
    
    app.use('*', requireRole('driver'))
    app.get('/test', (c) => c.json({ success: true }))
    
    const res = await app.request('/test')
    expect(res.status).toBe(401)
  })
  
  test('requireRole should return 403 with wrong role', async () => {
    const app = new Hono()
    
    // Mock user con rol incorrecto
    app.use('*', (c, next) => {
      c.set('user', { clerkId: '123', role: 'client', email: 'test@test.com' })
      return next()
    })
    app.use('*', requireRole('driver', 'admin'))
    app.get('/test', (c) => c.json({ success: true }))
    
    const res = await app.request('/test')
    expect(res.status).toBe(403)
  })
  
  test('requireRole should allow correct role', async () => {
    const app = new Hono()
    
    // Mock user con rol correcto
    app.use('*', (c, next) => {
      c.set('user', { clerkId: '123', role: 'driver', email: 'test@test.com' })
      return next()
    })
    app.use('*', requireRole('driver', 'admin'))
    app.get('/test', (c) => c.json({ success: true }))
    
    const res = await app.request('/test')
    expect(res.status).toBe(200)
  })
  
  test('requireDriver should allow driver and admin', async () => {
    const app = new Hono()
    app.use('*', requireDriver())
    app.get('/test', (c) => c.json({ success: true }))
    
    // Test con driver
    const driverApp = new Hono()
    driverApp.use('*', (c, next) => {
      c.set('user', { clerkId: '1', role: 'driver', email: 'driver@test.com' })
      return next()
    })
    driverApp.use('*', requireDriver())
    driverApp.get('/test', (c) => c.json({ success: true }))
    expect((await driverApp.request('/test')).status).toBe(200)
    
    // Test con admin
    const adminApp = new Hono()
    adminApp.use('*', (c, next) => {
      c.set('user', { clerkId: '2', role: 'admin', email: 'admin@test.com' })
      return next()
    })
    adminApp.use('*', requireDriver())
    adminApp.get('/test', (c) => c.json({ success: true }))
    expect((await adminApp.request('/test')).status).toBe(200)
  })
  
  test('requireClient should block driver', async () => {
    const app = new Hono()
    app.use('*', (c, next) => {
      c.set('user', { clerkId: '1', role: 'driver', email: 'driver@test.com' })
      return next()
    })
    app.use('*', requireClient())
    app.get('/test', (c) => c.json({ success: true }))
    
    const res = await app.request('/test')
    expect(res.status).toBe(403)
  })
  
  test('requireAdmin should only allow admin', async () => {
    const app = new Hono()
    app.use('*', (c, next) => {
      c.set('user', { clerkId: '1', role: 'client', email: 'client@test.com' })
      return next()
    })
    app.use('*', requireAdmin())
    app.get('/test', (c) => c.json({ success: true }))
    
    const res = await app.request('/test')
    expect(res.status).toBe(403)
  })
})