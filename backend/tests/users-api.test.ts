import { mock, describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { Hono } from 'hono';
import { db } from '../src/db/mongo';
import { setupTests, teardownTests, cleanupCollection, createTestUser, createTestDriver } from './setup';

let mockClerkId = 'user_test_user';

mock.module('@clerk/clerk-sdk-node', () => ({
  verifyToken: () => Promise.resolve({ sub: mockClerkId }),
}));

import users from '../src/routes/users';

const app = new Hono();
app.route('/api/users', users);

const authHeaders = { Authorization: 'Bearer test_token' };

describe('GET /api/users/:clerkId', () => {
  beforeAll(async () => { await setupTests(); });
  afterAll(async () => { await teardownTests(); });
  beforeEach(async () => { await cleanupCollection('users'); await cleanupCollection('drivers'); });

  it('returns 404 for non-existent user', async () => {
    const res = await app.request('/api/users/nonexistent_user');
    expect(res.status).toBe(404);
  });

  it('returns user data for existing user', async () => {
    await createTestUser('existing_user_1', 'client');
    const res = await app.request('/api/users/existing_user_1');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.clerkId).toBe('existing_user_1');
    expect(body.role).toBe('client');
  });
});

describe('POST /api/users', () => {
  beforeAll(async () => { await setupTests(); });
  afterAll(async () => { await teardownTests(); });
  beforeEach(async () => { await cleanupCollection('users'); });

  it('creates a new user when clerkId does not exist', async () => {
    const res = await app.request('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clerkId: 'new_user_1', email: 'new@test.com', firstName: 'New', role: 'client' }),
    });
    expect(res.status).toBe(200);
    const inDb = await db.collection('users').findOne({ clerkId: 'new_user_1' });
    expect(inDb).toBeDefined();
  });

  it('updates existing user when clerkId already exists', async () => {
    await createTestUser('existing_user_2', 'client');
    const res = await app.request('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clerkId: 'existing_user_2', email: 'updated@test.com', firstName: 'Updated' }),
    });
    expect(res.status).toBe(200);
  });
});

describe('POST /api/users/register-driver', () => {
  const validBody = {
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
  };

  beforeAll(async () => { await setupTests(); });
  afterAll(async () => { await teardownTests(); });
  beforeEach(async () => {
    await cleanupCollection('users'); await cleanupCollection('drivers');
    mockClerkId = 'reg_driver_user';
    await createTestUser('reg_driver_user', 'client');
  });

  it('returns 400 when required docs are missing', async () => {
    const res = await app.request('/api/users/register-driver', {
      method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ vehicleType: 'camioneta' }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 when vehicleType is invalid', async () => {
    const res = await app.request('/api/users/register-driver', {
      method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validBody, vehicleType: 'helicoptero' }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 when plate format is invalid', async () => {
    const res = await app.request('/api/users/register-driver', {
      method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validBody, plate: 'INVALID' }),
    });
    expect(res.status).toBe(400);
  });

  it('creates driver with verificationStatus pending when valid', async () => {
    const res = await app.request('/api/users/register-driver', {
      method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validBody, plate: 'XYZ-5678' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.driver.verificationStatus).toBe('pending');
  });
});

describe('GET /api/users/driver/me', () => {
  beforeAll(async () => { await setupTests(); });
  afterAll(async () => { await teardownTests(); });
  beforeEach(async () => {
    await cleanupCollection('users'); await cleanupCollection('drivers');
    mockClerkId = 'driver_me_user';
    await createTestUser('driver_me_user', 'driver');
  });

  it('returns 404 when user has no driver profile', async () => {
    mockClerkId = 'no_profile_user';
    await createTestUser('no_profile_user', 'client');
    const res = await app.request('/api/users/driver/me', { headers: authHeaders });
    expect(res.status).toBe(404);
  });

  it('returns driver data with user info when profile exists', async () => {
    await createTestDriver('driver_me_user', { plate: 'DRV-999' });
    const res = await app.request('/api/users/driver/me', { headers: authHeaders });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.userId).toBe('driver_me_user');
    expect(body.user).toBeDefined();
  });
});

describe('GET /api/users/driver/:userId', () => {
  beforeAll(async () => { await setupTests(); });
  afterAll(async () => { await teardownTests(); });
  beforeEach(async () => { await cleanupCollection('users'); await cleanupCollection('drivers'); });

  it('returns 404 for non-existent driver userId', async () => {
    const res = await app.request('/api/users/driver/nonexistent_driver');
    expect(res.status).toBe(404);
  });

  it('returns driver profile with user info', async () => {
    await createTestUser('driver_profile_1', 'driver');
    await createTestDriver('driver_profile_1', { plate: 'PRF-001' });
    const res = await app.request('/api/users/driver/driver_profile_1');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.userId).toBe('driver_profile_1');
    expect(body.user).toBeDefined();
  });
});

describe('PATCH /api/users/driver/:userId/availability', () => {
  beforeAll(async () => { await setupTests(); });
  afterAll(async () => { await teardownTests(); });
  beforeEach(async () => {
    await cleanupCollection('users'); await cleanupCollection('drivers');
    mockClerkId = 'avail_driver';
    await createTestUser('avail_driver', 'driver');
  });

  it('returns 403 when non-owner tries to change', async () => {
    await createTestDriver('avail_driver', { verificationStatus: 'verified', isAvailable: false });
    mockClerkId = 'other_user';
    await createTestUser('other_user', 'client');
    const res = await app.request('/api/users/driver/avail_driver/availability', {
      method: 'PATCH', headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ isAvailable: true }),
    });
    expect(res.status).toBe(403);
  });

  it('returns 400 when driver is not verified', async () => {
    await createTestDriver('avail_driver', { verificationStatus: 'pending', isAvailable: false });
    const res = await app.request('/api/users/driver/avail_driver/availability', {
      method: 'PATCH', headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ isAvailable: true }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 200 when driver toggles own availability', async () => {
    await createTestDriver('avail_driver', { verificationStatus: 'verified', isAvailable: false });
    const res = await app.request('/api/users/driver/avail_driver/availability', {
      method: 'PATCH', headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ isAvailable: true }),
    });
    expect(res.status).toBe(200);
  });
});
