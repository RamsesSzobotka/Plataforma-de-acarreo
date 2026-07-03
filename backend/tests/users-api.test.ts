import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { Hono } from 'hono';
import { db } from '../src/db/mongo';
import { setupTests, teardownTests, cleanupCollection, createTestUser, createTestDriver } from './setup';
import users from '../src/routes/users';

function createApp(mockUser: { clerkId: string; role: string; email?: string }) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    c.set('user', mockUser);
    await next();
  });
  app.route('/api/users', users);
  return app;
}

describe('Users API', () => {
  beforeAll(async () => {
    await setupTests();
  });

  afterAll(async () => {
    await teardownTests();
  });

  beforeEach(async () => {
    await cleanupCollection('users');
    await cleanupCollection('drivers');
  });

  describe('GET /api/users/:clerkId', () => {
    it('should return 404 for non-existent user', async () => {
      const res = await users.request('/api/users/nonexistent');
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toContain('no encontrado');
    });

    it('should return user data for existing user', async () => {
      const user = await createTestUser('get_user_1', 'client');

      const res = await users.request(`/api/users/${user.clerkId}`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.clerkId).toBe('get_user_1');
      expect(body.email).toBe('get_user_1@test.com');
      expect(body.role).toBe('client');
      expect(body.firstName).toBe('Test');
    });
  });

  describe('POST /api/users', () => {
    it('should create a new user when clerkId does not exist', async () => {
      const res = await users.request('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clerkId: 'new_user_1',
          email: 'new@test.com',
          firstName: 'New',
          lastName: 'User',
          role: 'client',
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.clerkId).toBe('new_user_1');
      expect(body.email).toBe('new@test.com');
      expect(body.role).toBe('client');

      // Verify it was persisted
      const saved = await db.collection('users').findOne({ clerkId: 'new_user_1' });
      expect(saved).not.toBeNull();
    });

    it('should update existing user when clerkId exists', async () => {
      await createTestUser('update_user_1', 'client');

      const res = await users.request('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clerkId: 'update_user_1',
          firstName: 'Updated',
          email: 'update_user_1@test.com',
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.clerkId).toBe('update_user_1');
      expect(body.firstName).toBe('Updated');
    });
  });

  describe('POST /api/users/register-driver', () => {
    it('should return 400 when required docs are missing', async () => {
      const client = await createTestUser('reg_driver_1', 'client');
      const app = createApp({ clerkId: client.clerkId, role: 'client' });

      const res = await app.request('/api/users/register-driver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicleType: 'camioneta' }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('Documentos requeridos faltantes');
    });

    it('should return 400 when vehicleType is invalid', async () => {
      const client = await createTestUser('reg_driver_2', 'client');
      const app = createApp({ clerkId: client.clerkId, role: 'client' });

      const res = await app.request('/api/users/register-driver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleType: 'helicoptero',
          plate: 'ABC-1234',
          capacityKg: 1000,
          phone: '+50760000000',
          vehicleImages: ['https://example.com/img.jpg'],
          licenseType: 'B',
          licenseImage: 'https://example.com/lic.jpg',
          cedulaFront: 'https://example.com/ced_f.jpg',
          cedulaBack: 'https://example.com/ced_b.jpg',
          ruvDocument: 'https://example.com/ruv.jpg',
          plateImage: 'https://example.com/plate.jpg',
          insurancePolicy: 'https://example.com/ins.jpg',
        }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('vehicleType debe ser uno de');
    });

    it('should return 400 when capacityKg is out of range', async () => {
      const client = await createTestUser('reg_driver_3', 'client');
      const app = createApp({ clerkId: client.clerkId, role: 'client' });

      const res = await app.request('/api/users/register-driver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleType: 'camioneta',
          plate: 'ABC-1234',
          capacityKg: 99999,
          phone: '+50760000000',
          vehicleImages: ['https://example.com/img.jpg'],
          licenseType: 'B',
          licenseImage: 'https://example.com/lic.jpg',
          cedulaFront: 'https://example.com/ced_f.jpg',
          cedulaBack: 'https://example.com/ced_b.jpg',
          ruvDocument: 'https://example.com/ruv.jpg',
          plateImage: 'https://example.com/plate.jpg',
          insurancePolicy: 'https://example.com/ins.jpg',
        }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('capacityKg debe estar entre');
    });

    it('should return 400 when plate format is invalid', async () => {
      const client = await createTestUser('reg_driver_4', 'client');
      const app = createApp({ clerkId: client.clerkId, role: 'client' });

      const res = await app.request('/api/users/register-driver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleType: 'camioneta',
          plate: 'BAD',
          capacityKg: 1000,
          phone: '+50760000000',
          vehicleImages: ['https://example.com/img.jpg'],
          licenseType: 'B',
          licenseImage: 'https://example.com/lic.jpg',
          cedulaFront: 'https://example.com/ced_f.jpg',
          cedulaBack: 'https://example.com/ced_b.jpg',
          ruvDocument: 'https://example.com/ruv.jpg',
          plateImage: 'https://example.com/plate.jpg',
          insurancePolicy: 'https://example.com/ins.jpg',
        }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('Formato de placa invalido');
    });

    it('should return 200 and create driver with verificationStatus pending when valid', async () => {
      const client = await createTestUser('reg_driver_5', 'client');
      const app = createApp({ clerkId: client.clerkId, role: 'client' });

      const res = await app.request('/api/users/register-driver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleType: 'camioneta',
          plate: 'ABC-1234',
          capacityKg: 1000,
          phone: '+50760000000',
          vehicleImages: ['https://example.com/img.jpg'],
          licenseType: 'B',
          licenseImage: 'https://example.com/lic.jpg',
          cedulaFront: 'https://example.com/ced_f.jpg',
          cedulaBack: 'https://example.com/ced_b.jpg',
          ruvDocument: 'https://example.com/ruv.jpg',
          plateImage: 'https://example.com/plate.jpg',
          insurancePolicy: 'https://example.com/ins.jpg',
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.driver.verificationStatus).toBe('pending');

      // Verify persisted in DB
      const savedDriver = await db.collection('drivers').findOne({ userId: client.clerkId });
      expect(savedDriver).not.toBeNull();
      expect(savedDriver?.verificationStatus).toBe('pending');
      expect(savedDriver?.vehicleType).toBe('camioneta');
    });
  });

  describe('GET /api/users/driver/me', () => {
    it('should return 404 when user has no driver profile', async () => {
      const client = await createTestUser('me_no_driver_1', 'client');
      const app = createApp({ clerkId: client.clerkId, role: 'client' });

      const res = await app.request('/api/users/driver/me');
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toContain('no encontrado');
    });

    it('should return driver data with user info when profile exists', async () => {
      const driverUser = await createTestUser('me_driver_1', 'driver');
      await createTestDriver(driverUser.clerkId);
      const app = createApp({ clerkId: driverUser.clerkId, role: 'driver' });

      const res = await app.request('/api/users/driver/me');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.userId).toBe(driverUser.clerkId);
      expect(body.vehicleType).toBe('camioneta');
      expect(body.plate).toBe('ABC123');
      expect(body.verificationStatus).toBe('verified');
      expect(body.user).toBeDefined();
      expect(body.user.firstName).toBe('Test');
    });
  });

  describe('GET /api/users/driver/:userId', () => {
    it('should return 404 for non-existent driver userId', async () => {
      const res = await users.request('/api/users/driver/nonexistent');
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toContain('no encontrado');
    });

    it('should return driver profile with user info', async () => {
      const driverUser = await createTestUser('pub_driver_1', 'driver');
      await createTestDriver(driverUser.clerkId);

      const res = await users.request(`/api/users/driver/${driverUser.clerkId}`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.userId).toBe(driverUser.clerkId);
      expect(body.vehicleType).toBe('camioneta');
      expect(body.plate).toBe('ABC123');
      expect(body.verificationStatus).toBe('verified');
      expect(body.user).toBeDefined();
      expect(body.user.firstName).toBe('Test');
    });
  });

  describe('PATCH /api/users/driver/:userId/availability', () => {
    it('should return 403 when non-owner tries to change', async () => {
      const owner = await createTestUser('avail_owner_1', 'driver');
      await createTestDriver(owner.clerkId);
      const other = await createTestUser('avail_other_1', 'driver');
      const app = createApp({ clerkId: other.clerkId, role: 'driver' });

      const res = await app.request(`/api/users/driver/${owner.clerkId}/availability`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAvailable: true }),
      });

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toContain('No tienes permiso');
    });

    it('should return 400 when driver is not verified', async () => {
      const driverUser = await createTestUser('avail_unverified_1', 'driver');
      await createTestDriver(driverUser.clerkId, { verificationStatus: 'pending', isVerified: false });
      const app = createApp({ clerkId: driverUser.clerkId, role: 'driver' });

      const res = await app.request(`/api/users/driver/${driverUser.clerkId}/availability`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAvailable: true }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('verificado');
    });

    it('should return 200 when driver toggles own availability', async () => {
      const driverUser = await createTestUser('avail_ok_1', 'driver');
      await createTestDriver(driverUser.clerkId, { verificationStatus: 'verified', isVerified: true });
      const app = createApp({ clerkId: driverUser.clerkId, role: 'driver' });

      const res = await app.request(`/api/users/driver/${driverUser.clerkId}/availability`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAvailable: true }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.isAvailable).toBe(true);

      // Verify in DB
      const saved = await db.collection('drivers').findOne({ userId: driverUser.clerkId });
      expect(saved?.isAvailable).toBe(true);
    });
  });
});
