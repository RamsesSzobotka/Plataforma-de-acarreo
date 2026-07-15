import { mock, describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { Hono } from 'hono';
import mongoose from 'mongoose';
import { db } from '../src/db/mongo';
import { setupTests, teardownTests, cleanupCollection, createTestUser, createTestDriver, createTestRide } from './setup';

// Mutable mock - change this between tests to authenticate as different users
let mockClerkId = 'auth_test_user';

mock.module('@clerk/clerk-sdk-node', () => ({
  verifyToken: () => Promise.resolve({ sub: mockClerkId }),
}));

import rides from '../src/routes/rides';

const app = new Hono();
app.route('/api/rides', rides);

const authHeaders = { Authorization: 'Bearer test_token' };

describe('GET /api/rides', () => {
  beforeAll(async () => { await setupTests(); });
  afterAll(async () => { await teardownTests(); });
  beforeEach(async () => {
    await cleanupCollection('rides');
    await cleanupCollection('users');
    await cleanupCollection('drivers');
    await cleanupCollection('drivercontacts');
    mockClerkId = 'test_client_1';
    await createTestUser('test_client_1', 'client');
  });

  it('returns rides for the authenticated client (ownership filter)', async () => {
    await createTestRide('test_client_1');
    await createTestRide('test_client_1');
    await createTestRide('other_client');

    const res = await app.request('/api/rides', { headers: authHeaders });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.length).toBe(2);
    expect(body.data.every((r: any) => r.clientId === 'test_client_1')).toBe(true);
  });

  it('returns filtered by status when query param is passed', async () => {
    await createTestRide('test_client_1', { status: 'requested' });
    await createTestRide('test_client_1', { status: 'accepted' });
    await createTestRide('test_client_1', { status: 'completed' });

    const res = await app.request('/api/rides?status=requested', { headers: authHeaders });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.length).toBe(1);
    expect(body.data[0].status).toBe('requested');
  });

  it('returns paginated results (page/limit params)', async () => {
    for (let i = 0; i < 5; i++) {
      await createTestRide('test_client_1');
    }

    const res = await app.request('/api/rides?page=1&limit=2', { headers: authHeaders });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.length).toBe(2);
    expect(body.pagination.page).toBe(1);
    expect(body.pagination.limit).toBe(2);
    expect(body.pagination.total).toBe(5);
    expect(body.pagination.pages).toBe(3);
  });

  it('returns 200 with data and pagination', async () => {
    await createTestRide('test_client_1');

    const res = await app.request('/api/rides', { headers: authHeaders });
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
  beforeAll(async () => { await setupTests(); });
  afterAll(async () => { await teardownTests(); });
  beforeEach(async () => {
    await cleanupCollection('rides');
    await cleanupCollection('users');
    await cleanupCollection('drivers');
    mockClerkId = 'test_client_1';
    await createTestUser('test_client_1', 'client');
  });

  it('returns 404 for non-existent ride', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await app.request(`/api/rides/${fakeId}`, { headers: authHeaders });
    expect(res.status).toBe(404);
  });

  it('returns 403 for client trying to access another client\'s ride', async () => {
    const ride = await createTestRide('other_client');
    const res = await app.request(`/api/rides/${ride._id}`, { headers: authHeaders });
    expect(res.status).toBe(403);
  });

  it('returns the ride for the owner client', async () => {
    const ride = await createTestRide('test_client_1');
    const res = await app.request(`/api/rides/${ride._id}`, { headers: authHeaders });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body._id).toBe(ride._id.toString());
  });

  it('returns the ride for admin', async () => {
    mockClerkId = 'test_admin_1';
    await createTestUser('test_admin_1', 'admin');
    const ride = await createTestRide('other_client');
    const res = await app.request(`/api/rides/${ride._id}`, { headers: authHeaders });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body._id).toBe(ride._id.toString());
  });
});

describe('GET /api/rides/available', () => {
  beforeAll(async () => { await setupTests(); });
  afterAll(async () => { await teardownTests(); });
  beforeEach(async () => {
    await cleanupCollection('rides');
    await cleanupCollection('users');
    await cleanupCollection('drivers');
  });

  it('returns 403 for client role', async () => {
    mockClerkId = 'test_client_1';
    await createTestUser('test_client_1', 'client');
    const res = await app.request('/api/rides/available', { headers: authHeaders });
    expect(res.status).toBe(403);
  });

  it('returns only requested rides for driver', async () => {
    mockClerkId = 'test_driver_1';
    await createTestUser('test_driver_1', 'driver');
    await createTestDriver('test_driver_1');
    await createTestRide('client_a', { status: 'requested' });
    await createTestRide('client_a', { status: 'accepted' });
    await createTestRide('client_a', { status: 'in_progress' });

    const res = await app.request('/api/rides/available', { headers: authHeaders });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.length).toBe(1);
    expect(body.data.every((r: any) => r.status === 'requested')).toBe(true);
  });

  it('returns 200 with data for driver role', async () => {
    mockClerkId = 'test_driver_1';
    await createTestUser('test_driver_1', 'driver');
    await createTestDriver('test_driver_1');
    await createTestRide('client_a', { status: 'requested' });
    await createTestRide('client_b', { status: 'requested' });

    const res = await app.request('/api/rides/available', { headers: authHeaders });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.length).toBe(2);
    expect(body).toHaveProperty('pagination');
  });
});

describe('GET /api/rides/:id/contacts', () => {
  beforeAll(async () => { await setupTests(); });
  afterAll(async () => { await teardownTests(); });
  beforeEach(async () => {
    await cleanupCollection('rides');
    await cleanupCollection('users');
    await cleanupCollection('drivers');
    await cleanupCollection('drivercontacts');
    mockClerkId = 'test_client_1';
    await createTestUser('test_client_1', 'client');
  });

  it('returns 404 for non-existent ride', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await app.request(`/api/rides/${fakeId}/contacts`, { headers: authHeaders });
    expect(res.status).toBe(404);
  });

  it('returns 403 for non-owner client', async () => {
    const ride = await createTestRide('other_client');
    const res = await app.request(`/api/rides/${ride._id}/contacts`, { headers: authHeaders });
    expect(res.status).toBe(403);
  });

  it('returns contacts for the ride owner', async () => {
    const ride = await createTestRide('test_client_1');
    await db.collection('drivercontacts').insertOne({
      driverId: 'some_driver',
      clientId: 'test_client_1',
      rideId: ride._id.toString(),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await app.request(`/api/rides/${ride._id}/contacts`, { headers: authHeaders });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.length).toBe(1);
    expect(body.data[0].driverId).toBe('some_driver');
  });

  it('returns empty array when no contacts exist', async () => {
    const ride = await createTestRide('test_client_1');
    const res = await app.request(`/api/rides/${ride._id}/contacts`, { headers: authHeaders });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([]);
  });
});
