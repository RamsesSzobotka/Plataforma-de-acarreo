import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { Hono } from 'hono';
import { db } from '../src/db/mongo';
import { setupTests, teardownTests, cleanupCollection, createTestUser, createTestDriver, createTestRide } from './setup';
import messages from '../src/routes/messages';

// ── App factories ──────────────────────────────────────────────

function createClientApp(clerkId: string) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    c.set('user', { clerkId, role: 'client', email: 'client@test.com' });
    await next();
  });
  app.route('/api/messages', messages);
  return app;
}

function createDriverApp(clerkId: string) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    c.set('user', { clerkId, role: 'driver', email: 'driver@test.com' });
    await next();
  });
  app.route('/api/messages', messages);
  return app;
}

// GET endpoint does not use authMiddleware
const publicApp = new Hono();
publicApp.route('/api/messages', messages);

// ── Helpers ────────────────────────────────────────────────────

async function createTestContact(driverId: string, rideId: string, overrides: Partial<any> = {}): Promise<any> {
  const contact = {
    driverId,
    rideId,
    isActive: true,
    clientId: 'test_client',
    proposalCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
  await db.collection('drivercontacts').insertOne(contact);
  return contact;
}

// ── Setup ──────────────────────────────────────────────────────

describe('Messages API', () => {
  beforeAll(async () => {
    await setupTests();
  });

  afterAll(async () => {
    await teardownTests();
  });

  beforeEach(async () => {
    await cleanupCollection('messages');
    await cleanupCollection('rides');
    await cleanupCollection('users');
    await cleanupCollection('drivers');
    await cleanupCollection('drivercontacts');
  });

  // ── GET /api/messages/ride/:rideId ──────────────────────────

  describe('GET /api/messages/ride/:rideId', () => {
    it('should return empty array when no messages exist', async () => {
      const res = await publicApp.request('/api/messages/ride/nonexistent_ride');

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toEqual([]);
      expect(body.pagination.total).toBe(0);
    });

    it('should return messages sorted by createdAt ascending', async () => {
      const client = await createTestUser('msg_sort_1', 'client');
      const ride = await createTestRide(client.clerkId, { status: 'accepted', driverId: 'msg_driver_sort' });
      const rideId = ride._id.toString();

      await db.collection('messages').insertMany([
        { rideId, senderId: client.clerkId, content: 'First message', read: false, createdAt: new Date(1) },
        { rideId, senderId: client.clerkId, content: 'Second message', read: false, createdAt: new Date(2) },
        { rideId, senderId: client.clerkId, content: 'Third message', read: false, createdAt: new Date(3) },
      ]);

      const res = await publicApp.request(`/api/messages/ride/${rideId}`);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toHaveLength(3);
      expect(body.data[0].content).toBe('First message');
      expect(body.data[1].content).toBe('Second message');
      expect(body.data[2].content).toBe('Third message');
    });

    it('should return paginated results with page and limit params', async () => {
      const client = await createTestUser('msg_page_1', 'client');
      const ride = await createTestRide(client.clerkId, { status: 'accepted', driverId: 'msg_driver_page' });
      const rideId = ride._id.toString();

      const messagesData = Array.from({ length: 10 }, (_, i) => ({
        rideId,
        senderId: client.clerkId,
        content: `Message ${i + 1}`,
        read: false,
        createdAt: new Date(i + 1),
      }));
      await db.collection('messages').insertMany(messagesData);

      // Page 1 with limit 3
      const res1 = await publicApp.request(`/api/messages/ride/${rideId}?page=1&limit=3`);

      expect(res1.status).toBe(200);
      const body1 = await res1.json();
      expect(body1.data).toHaveLength(3);
      expect(body1.data[0].content).toBe('Message 1');
      expect(body1.pagination.page).toBe(1);
      expect(body1.pagination.limit).toBe(3);
      expect(body1.pagination.total).toBe(10);
      expect(body1.pagination.pages).toBe(4);

      // Page 2 with limit 3
      const res2 = await publicApp.request(`/api/messages/ride/${rideId}?page=2&limit=3`);

      expect(res2.status).toBe(200);
      const body2 = await res2.json();
      expect(body2.data).toHaveLength(3);
      expect(body2.data[0].content).toBe('Message 4');
    });
  });

  // ── POST /api/messages ──────────────────────────────────────

  describe('POST /api/messages', () => {
    it('should return 404 when ride does not exist', async () => {
      const client = await createTestUser('msg_404_1', 'client');
      const app = createClientApp(client.clerkId);

      const res = await app.request('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rideId: 'nonexistent_id', senderId: client.clerkId, content: 'Hello' }),
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBeDefined();
    });

    it('should return 201 when client sends a message on their own ride (accepted status)', async () => {
      const client = await createTestUser('msg_client_own', 'client');
      const ride = await createTestRide(client.clerkId, {
        status: 'accepted',
        driverId: 'driver_own_ride',
      });
      const app = createClientApp(client.clerkId);

      const res = await app.request('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rideId: ride._id.toString(), senderId: client.clerkId, content: 'Hola conductor' }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.content).toBe('Hola conductor');
      expect(body.rideId).toBe(ride._id.toString());
      expect(body.senderId).toBe(client.clerkId);
    });

    it('should return 201 when driver sends a message on an assigned ride (accepted status)', async () => {
      const client = await createTestUser('msg_client_assigned', 'client');
      const driver = await createTestUser('msg_driver_assigned', 'driver');
      await createTestDriver(driver.clerkId);
      const ride = await createTestRide(client.clerkId, {
        status: 'accepted',
        driverId: driver.clerkId,
      });
      const app = createDriverApp(driver.clerkId);

      const res = await app.request('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rideId: ride._id.toString(), senderId: driver.clerkId, content: 'Recibido!' }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.content).toBe('Recibido!');
      expect(body.senderId).toBe(driver.clerkId);
    });

    it('should return 403 when non-owner non-driver sends message on requested ride', async () => {
      const client = await createTestUser('msg_client_owner', 'client');
      const stranger = await createTestUser('msg_stranger', 'client');
      const ride = await createTestRide(client.clerkId, { status: 'requested' });
      const app = createClientApp(stranger.clerkId);

      const res = await app.request('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rideId: ride._id.toString(), senderId: stranger.clerkId, content: 'Hola' }),
      });

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toBeDefined();
    });
  });

  // ── POST /api/messages/propose-price ────────────────────────

  describe('POST /api/messages/propose-price', () => {
    it('should return 403 when client tries to propose', async () => {
      const client = await createTestUser('prop_client_403', 'client');
      const ride = await createTestRide(client.clerkId, { status: 'requested' });
      const app = createClientApp(client.clerkId);

      const res = await app.request('/api/messages/propose-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rideId: ride._id.toString(), proposedPrice: 100 }),
      });

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toBe('Only drivers can propose prices');
    });

    it('should return 403 when driver has no active contact', async () => {
      const client = await createTestUser('prop_client_nc', 'client');
      const driver = await createTestUser('prop_driver_nc', 'driver');
      await createTestDriver(driver.clerkId);
      const ride = await createTestRide(client.clerkId, { status: 'requested' });
      const app = createDriverApp(driver.clerkId);

      const res = await app.request('/api/messages/propose-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rideId: ride._id.toString(), proposedPrice: 100 }),
      });

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toBe('You must first send a message to the client');
    });

    it('should return 400 when proposedPrice is 0', async () => {
      const client = await createTestUser('prop_client_zero', 'client');
      const driver = await createTestUser('prop_driver_zero', 'driver');
      await createTestDriver(driver.clerkId);
      const ride = await createTestRide(client.clerkId, { status: 'requested' });
      const rideId = ride._id.toString();
      await createTestContact(driver.clerkId, rideId, { clientId: client.clerkId });
      const app = createDriverApp(driver.clerkId);

      const res = await app.request('/api/messages/propose-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rideId, proposedPrice: 0 }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('Valid price required');
    });

    it('should return 400 when proposedPrice is negative', async () => {
      const client = await createTestUser('prop_client_neg', 'client');
      const driver = await createTestUser('prop_driver_neg', 'driver');
      await createTestDriver(driver.clerkId);
      const ride = await createTestRide(client.clerkId, { status: 'requested' });
      const rideId = ride._id.toString();
      await createTestContact(driver.clerkId, rideId, { clientId: client.clerkId });
      const app = createDriverApp(driver.clerkId);

      const res = await app.request('/api/messages/propose-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rideId, proposedPrice: -50 }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('Valid price required');
    });

    it('should return 200 when driver with active contact proposes valid price', async () => {
      const client = await createTestUser('prop_client_ok', 'client');
      const driver = await createTestUser('prop_driver_ok', 'driver');
      await createTestDriver(driver.clerkId);
      const ride = await createTestRide(client.clerkId, { status: 'requested' });
      const rideId = ride._id.toString();
      await createTestContact(driver.clerkId, rideId, { clientId: client.clerkId });
      const app = createDriverApp(driver.clerkId);

      const res = await app.request('/api/messages/propose-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rideId, proposedPrice: 150 }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.proposalCount).toBe(1);
      expect(body.remainingProposals).toBe(2);
    });

    it('should increment proposalCount on subsequent proposals', async () => {
      const client = await createTestUser('prop_client_inc', 'client');
      const driver = await createTestUser('prop_driver_inc', 'driver');
      await createTestDriver(driver.clerkId);
      const ride = await createTestRide(client.clerkId, { status: 'requested' });
      const rideId = ride._id.toString();
      await createTestContact(driver.clerkId, rideId, { clientId: client.clerkId });
      const app = createDriverApp(driver.clerkId);

      // First proposal
      const res1 = await app.request('/api/messages/propose-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rideId, proposedPrice: 100 }),
      });
      expect(res1.status).toBe(200);
      const body1 = await res1.json();
      expect(body1.proposalCount).toBe(1);

      // Second proposal
      const res2 = await app.request('/api/messages/propose-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rideId, proposedPrice: 120 }),
      });
      expect(res2.status).toBe(200);
      const body2 = await res2.json();
      expect(body2.proposalCount).toBe(2);
      expect(body2.remainingProposals).toBe(1);

      // Verify contact in DB
      const contact = await db.collection('drivercontacts').findOne({ driverId: driver.clerkId, rideId });
      expect(contact?.proposalCount).toBe(2);
    });
  });
});
