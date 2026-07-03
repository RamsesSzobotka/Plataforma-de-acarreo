import { mock, describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { Hono } from 'hono';
import { db } from '../src/db/mongo';
import { setupTests, teardownTests, cleanupCollection, createTestUser, createTestDriver, createTestRide } from './setup';

let mockClerkId = 'msg_test_user';

mock.module('@clerk/clerk-sdk-node', () => ({
  verifyToken: () => Promise.resolve({ sub: mockClerkId }),
}));

import messages from '../src/routes/messages';

const app = new Hono();
app.route('/api/messages', messages);

const authHeaders = { Authorization: 'Bearer test_token' };

// Helper to create a DriverContact in DB
async function createTestContact(driverId: string, rideId: string, overrides: Partial<any> = {}): Promise<any> {
  const contact = {
    driverId,
    rideId,
    isActive: true,
    clientId: 'msg_client',
    proposalCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
  await db.collection('drivercontacts').insertOne(contact);
  return contact;
}

describe('GET /api/messages/ride/:rideId', () => {
  beforeAll(async () => { await setupTests(); });
  afterAll(async () => { await teardownTests(); });
  beforeEach(async () => {
    await cleanupCollection('messages');
    await cleanupCollection('rides');
    await cleanupCollection('users');
  });

  it('returns empty array when no messages exist', async () => {
    const res = await app.request('/api/messages/ride/nonexistent_ride');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([]);
  });

  it('returns messages sorted by createdAt ascending', async () => {
    const rideId = 'test_ride_msg';
    await db.collection('messages').insertMany([
      { rideId, senderId: 'user1', content: 'First', read: false, createdAt: new Date(1) },
      { rideId, senderId: 'user1', content: 'Second', read: false, createdAt: new Date(2) },
    ]);
    const res = await app.request(`/api/messages/ride/${rideId}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(2);
    expect(body.data[0].content).toBe('First');
    expect(body.data[1].content).toBe('Second');
  });

  it('returns paginated results', async () => {
    const rideId = 'test_ride_pag';
    const msgs = Array.from({ length: 5 }, (_, i) => ({
      rideId, senderId: 'user1', content: `Msg ${i}`, read: false, createdAt: new Date(i),
    }));
    await db.collection('messages').insertMany(msgs);
    const res = await app.request(`/api/messages/ride/${rideId}?page=1&limit=2`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(2);
    expect(body.pagination.total).toBe(5);
  });
});

describe('POST /api/messages', () => {
  beforeAll(async () => { await setupTests(); });
  afterAll(async () => { await teardownTests(); });
  beforeEach(async () => {
    await cleanupCollection('messages');
    await cleanupCollection('rides');
    await cleanupCollection('users');
    await cleanupCollection('drivers');
    await cleanupCollection('drivercontacts');
  });

  it('returns 404 when ride does not exist', async () => {
    mockClerkId = 'msg_sender';
    await createTestUser('msg_sender', 'client');
    const res = await app.request('/api/messages', {
      method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ rideId: 'nonexistent', senderId: 'msg_sender', content: 'Hello' }),
    });
    expect(res.status).toBe(404);
  });

  it('returns 201 when client sends message on own accepted ride', async () => {
    mockClerkId = 'msg_client_1';
    await createTestUser('msg_client_1', 'client');
    const ride = await createTestRide('msg_client_1', { status: 'accepted', driverId: 'msg_driver_1' });
    const res = await app.request('/api/messages', {
      method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ rideId: ride._id.toString(), senderId: 'msg_client_1', content: 'Hola!' }),
    });
    expect(res.status).toBe(201);
  });

  it('returns 201 when driver sends message on assigned ride', async () => {
    mockClerkId = 'msg_driver_2';
    await createTestUser('msg_driver_2', 'driver');
    const ride = await createTestRide('msg_client_2', { status: 'accepted', driverId: 'msg_driver_2' });
    const res = await app.request('/api/messages', {
      method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ rideId: ride._id.toString(), senderId: 'msg_driver_2', content: 'Hola!' }),
    });
    expect(res.status).toBe(201);
  });
});

describe('POST /api/messages/propose-price', () => {
  beforeAll(async () => { await setupTests(); });
  afterAll(async () => { await teardownTests(); });
  beforeEach(async () => {
    await cleanupCollection('messages');
    await cleanupCollection('rides');
    await cleanupCollection('users');
    await cleanupCollection('drivers');
    await cleanupCollection('drivercontacts');
  });

  it('returns 403 when client tries to propose', async () => {
    mockClerkId = 'pp_client';
    await createTestUser('pp_client', 'client');
    const ride = await createTestRide('pp_client', { status: 'requested' });
    const res = await app.request('/api/messages/propose-price', {
      method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ rideId: ride._id.toString(), proposedPrice: 100 }),
    });
    expect(res.status).toBe(403);
  });

  it('returns 400 when proposedPrice is invalid', async () => {
    mockClerkId = 'pp_driver';
    await createTestUser('pp_driver', 'driver');
    const ride = await createTestRide('pp_client_2', { status: 'requested' });
    const res = await app.request('/api/messages/propose-price', {
      method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ rideId: ride._id.toString(), proposedPrice: 0 }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 403 when driver has no active contact', async () => {
    mockClerkId = 'pp_driver_2';
    await createTestUser('pp_driver_2', 'driver');
    await createTestDriver('pp_driver_2');
    const ride = await createTestRide('pp_client_3', { status: 'requested' });
    const res = await app.request('/api/messages/propose-price', {
      method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ rideId: ride._id.toString(), proposedPrice: 150 }),
    });
    expect(res.status).toBe(403);
  });

  it('returns 200 when driver with contact proposes valid price', async () => {
    mockClerkId = 'pp_driver_3';
    await createTestUser('pp_driver_3', 'driver');
    await createTestDriver('pp_driver_3');
    const ride = await createTestRide('pp_client_4', { status: 'requested' });
    const rideId = ride._id.toString();
    await createTestContact('pp_driver_3', rideId, { clientId: 'pp_client_4' });
    const res = await app.request('/api/messages/propose-price', {
      method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ rideId, proposedPrice: 150 }),
    });
    expect(res.status).toBe(200);
  });

  it('increments proposalCount on subsequent proposals', async () => {
    mockClerkId = 'pp_driver_4';
    await createTestUser('pp_driver_4', 'driver');
    await createTestDriver('pp_driver_4');
    const ride = await createTestRide('pp_client_5', { status: 'requested' });
    const rideId = ride._id.toString();
    await createTestContact('pp_driver_4', rideId, { clientId: 'pp_client_5', proposalCount: 1 });
    const res = await app.request('/api/messages/propose-price', {
      method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ rideId, proposedPrice: 200 }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.proposalCount).toBe(2);
  });
});
