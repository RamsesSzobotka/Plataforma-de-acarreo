import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { Hono } from 'hono';
import { db, mongoose } from '../src/db/mongo';
import { setupTests, teardownTests, cleanupCollection, createTestUser, createTestDriver, createTestRide } from './setup';
import rides from '../src/routes/rides';

const app = new Hono();
app.use('*', async (c, next) => {
  c.set('user', { clerkId: 'test_client_1', role: 'client', email: 'client@test.com' });
  await next();
});
app.route('/api/rides', rides);

const driverApp = new Hono();
driverApp.use('*', async (c, next) => {
  c.set('user', { clerkId: 'test_driver_1', role: 'driver', email: 'driver@test.com' });
  await next();
});
driverApp.route('/api/rides', rides);

const adminApp = new Hono();
adminApp.use('*', async (c, next) => {
  c.set('user', { clerkId: 'test_admin_1', role: 'admin', email: 'admin@test.com' });
  await next();
});
adminApp.route('/api/rides', rides);

describe('GET /api/rides', () => {
  beforeAll(async () => {
    await setupTests();
  });

  afterAll(async () => {
    await teardownTests();
  });

  beforeEach(async () => {
    await cleanupCollection('rides');
    await cleanupCollection('users');
    await cleanupCollection('drivers');
    await cleanupCollection('drivercontacts');
  });

  it('returns rides for the authenticated client (ownership filter)', async () => {
    await createTestUser('test_client_1', 'client');
    await createTestRide('test_client_1');
    await createTestRide('test_client_1');
    await createTestRide('other_client');

    const res = await app.request('/api/rides');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.length).toBe(2);
    expect(body.data.every((r: any) => r.clientId === 'test_client_1')).toBe(true);
  });

  it('returns filtered by status when query param is passed', async () => {
    await createTestUser('test_client_1', 'client');
    await createTestRide('test_client_1', { status: 'requested' });
    await createTestRide('test_client_1', { status: 'accepted' });
    await createTestRide('test_client_1', { status: 'completed' });

    const res = await app.request('/api/rides?status=requested');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.length).toBe(1);
    expect(body.data[0].status).toBe('requested');
  });

  it('returns paginated results (page/limit params)', async () => {
    await createTestUser('test_client_1', 'client');
    for (let i = 0; i < 5; i++) {
      await createTestRide('test_client_1');
    }

    const res = await app.request('/api/rides?page=1&limit=2');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.length).toBe(2);
    expect(body.pagination.page).toBe(1);
    expect(body.pagination.limit).toBe(2);
    expect(body.pagination.total).toBe(5);
    expect(body.pagination.pages).toBe(3);
  });

  it('returns 200 with data and pagination', async () => {
    await createTestUser('test_client_1', 'client');
    await createTestRide('test_client_1');

    const res = await app.request('/api/rides');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('pagination');
    expect(body.pagination).toHaveProperty('page');
    expect(body.pagination).toHaveProperty('limit');
    expect(body.pagination).toHaveProperty('total');
    expect(body.pagination).toHaveProperty('pages');
  });
});

describe('GET /api/rides/:id', () => {
  beforeAll(async () => {
    await setupTests();
  });

  afterAll(async () => {
    await teardownTests();
  });

  beforeEach(async () => {
    await cleanupCollection('rides');
    await cleanupCollection('users');
    await cleanupCollection('drivers');
    await cleanupCollection('drivercontacts');
  });

  it('returns 404 for non-existent ride', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await app.request(`/api/rides/${fakeId}`);
    expect(res.status).toBe(404);
  });

  it('returns 403 for client trying to access another client\'s ride', async () => {
    await createTestUser('other_client', 'client');
    const ride = await createTestRide('other_client');

    const res = await app.request(`/api/rides/${ride._id}`);
    expect(res.status).toBe(403);
  });

  it('returns the ride for the owner client', async () => {
    await createTestUser('test_client_1', 'client');
    const ride = await createTestRide('test_client_1');

    const res = await app.request(`/api/rides/${ride._id}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body._id).toBe(ride._id.toString());
  });

  it('returns the ride for admin', async () => {
    await createTestUser('other_client', 'client');
    const ride = await createTestRide('other_client');

    const res = await adminApp.request(`/api/rides/${ride._id}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body._id).toBe(ride._id.toString());
  });
});

describe('GET /api/rides/available', () => {
  beforeAll(async () => {
    await setupTests();
  });

  afterAll(async () => {
    await teardownTests();
  });

  beforeEach(async () => {
    await cleanupCollection('rides');
    await cleanupCollection('users');
    await cleanupCollection('drivers');
    await cleanupCollection('drivercontacts');
  });

  it('returns 403 for client role', async () => {
    const res = await app.request('/api/rides/available');
    expect(res.status).toBe(403);
  });

  it('returns only requested rides for driver', async () => {
    await createTestUser('test_driver_1', 'driver');
    await createTestDriver('test_driver_1');
    await createTestRide('client_a', { status: 'requested' });
    await createTestRide('client_a', { status: 'accepted' });
    await createTestRide('client_a', { status: 'in_progress' });

    const res = await driverApp.request('/api/rides/available');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.length).toBe(1);
    expect(body.data.every((r: any) => r.status === 'requested')).toBe(true);
  });

  it('returns 200 with data for driver role', async () => {
    await createTestUser('test_driver_1', 'driver');
    await createTestDriver('test_driver_1');
    await createTestRide('client_a', { status: 'requested' });
    await createTestRide('client_b', { status: 'requested' });

    const res = await driverApp.request('/api/rides/available');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.length).toBe(2);
    expect(body).toHaveProperty('pagination');
  });
});

describe('GET /api/rides/:id/contacts', () => {
  beforeAll(async () => {
    await setupTests();
  });

  afterAll(async () => {
    await teardownTests();
  });

  beforeEach(async () => {
    await cleanupCollection('rides');
    await cleanupCollection('users');
    await cleanupCollection('drivers');
    await cleanupCollection('drivercontacts');
  });

  it('returns 404 for non-existent ride', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await app.request(`/api/rides/${fakeId}/contacts`);
    expect(res.status).toBe(404);
  });

  it('returns 403 for non-owner client', async () => {
    await createTestUser('other_client', 'client');
    const ride = await createTestRide('other_client');

    const res = await app.request(`/api/rides/${ride._id}/contacts`);
    expect(res.status).toBe(403);
  });

  it('returns contacts for the ride owner', async () => {
    await createTestUser('test_client_1', 'client');
    const ride = await createTestRide('test_client_1');

    await db.collection('drivercontacts').insertOne({
      driverId: 'some_driver',
      clientId: 'test_client_1',
      rideId: ride._id.toString(),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await app.request(`/api/rides/${ride._id}/contacts`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.length).toBe(1);
    expect(body.data[0].driverId).toBe('some_driver');
  });

  it('returns empty array when no contacts exist', async () => {
    await createTestUser('test_client_1', 'client');
    const ride = await createTestRide('test_client_1');

    const res = await app.request(`/api/rides/${ride._id}/contacts`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([]);
  });
});
