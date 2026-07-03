import { mock, describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { Hono } from 'hono';
import { db } from '../src/db/mongo';
import { setupTests, teardownTests, cleanupCollection, createTestUser, createTestDriver, createTestRide } from './setup';

// Mock Clerk's verifyToken to allow authMiddleware to pass during tests
// This avoids requiring a real Clerk JWT for HTTP route tests
mock.module('@clerk/clerk-sdk-node', () => ({
  verifyToken: () => Promise.resolve({ sub: 'auth_test_user' }),
}));

import ratings from '../src/routes/ratings';

function createApp() {
  const app = new Hono();
  app.route('/api/ratings', ratings);
  return app;
}

async function createTestRating(overrides: Partial<any> = {}): Promise<any> {
  const rating = {
    rideId: 'test_ride_id',
    raterId: 'test_rater',
    ratedId: 'test_rated',
    role: 'driver',
    rating: 5,
    comment: 'Great service',
    createdAt: new Date(),
    ...overrides,
  };
  await db.collection('ratings').insertOne(rating);
  return rating;
}

const authHeaders = { Authorization: 'Bearer test_token' };

describe('Ratings API', () => {
  beforeAll(async () => {
    await setupTests();
  });

  afterAll(async () => {
    await teardownTests();
  });

  beforeEach(async () => {
    await cleanupCollection('ratings');
    await cleanupCollection('users');
    await cleanupCollection('rides');
    await cleanupCollection('drivers');
    // Create the auth user that Clerk mock will resolve to
    await createTestUser('auth_test_user', 'client');
  });

  describe('GET /api/ratings/ride/:rideId', () => {
    it('should return empty array when no ratings exist for ride', async () => {
      const app = createApp();
      const res = await app.request('/api/ratings/ride/nonexistent_ride', { headers: authHeaders });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ratings).toEqual([]);
    });

    it('should return all ratings for a ride', async () => {
      const client = await createTestUser('rr_client_1', 'client');
      const driver = await createTestUser('rr_driver_1', 'driver');
      const ride = await createTestRide(client.clerkId, { status: 'paid', driverId: driver.clerkId });
      const rideId = ride._id.toString();

      await createTestRating({ rideId, raterId: client.clerkId, ratedId: driver.clerkId, role: 'driver', rating: 5, comment: 'Excellent' });
      await createTestRating({ rideId, raterId: driver.clerkId, ratedId: client.clerkId, role: 'client', rating: 4, comment: 'Good' });

      const app = createApp();
      const res = await app.request(`/api/ratings/ride/${rideId}`, { headers: authHeaders });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ratings).toHaveLength(2);
    });

    it('should return enriched rater data', async () => {
      const client = await createTestUser('re_client_1', 'client');
      const driver = await createTestUser('re_driver_1', 'driver');
      const ride = await createTestRide(client.clerkId, { status: 'paid', driverId: driver.clerkId });
      const rideId = ride._id.toString();

      await createTestRating({ rideId, raterId: client.clerkId, ratedId: driver.clerkId, role: 'driver', rating: 5 });

      const app = createApp();
      const res = await app.request(`/api/ratings/ride/${rideId}`, { headers: authHeaders });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ratings[0].rater).toBeDefined();
      expect(body.ratings[0].rater.firstName).toBe('Test');
      expect(body.ratings[0].rater.lastName).toBe('User');
    });
  });

  describe('GET /api/ratings/driver/:userId', () => {
    it('should return empty data when no driver ratings exist', async () => {
      const app = createApp();
      const res = await app.request('/api/ratings/driver/nonexistent_driver', { headers: authHeaders });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toEqual([]);
      expect(body.pagination.total).toBe(0);
      expect(body.pagination.pages).toBe(0);
    });

    it('should return only driver ratings', async () => {
      const client = await createTestUser('rd_client_1', 'client');
      const driver = await createTestUser('rd_driver_1', 'driver');
      const ride = await createTestRide(client.clerkId, { status: 'paid', driverId: driver.clerkId });
      const rideId = ride._id.toString();

      await createTestRating({ rideId, raterId: client.clerkId, ratedId: driver.clerkId, role: 'driver', rating: 5 });
      await createTestRating({ rideId, raterId: driver.clerkId, ratedId: client.clerkId, role: 'client', rating: 4 });

      const app = createApp();
      const res = await app.request(`/api/ratings/driver/${driver.clerkId}`, { headers: authHeaders });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toHaveLength(1);
      expect(body.pagination.total).toBe(1);
    });

    it('should return paginated results', async () => {
      const client = await createTestUser('rdp_client_1', 'client');
      const driver = await createTestUser('rdp_driver_1', 'driver');
      const ride1 = await createTestRide(client.clerkId, { status: 'paid', driverId: driver.clerkId });
      const ride2 = await createTestRide(client.clerkId, { status: 'paid', driverId: driver.clerkId });

      await createTestRating({ rideId: ride1._id.toString(), raterId: client.clerkId, ratedId: driver.clerkId, role: 'driver', rating: 5 });
      await createTestRating({ rideId: ride2._id.toString(), raterId: client.clerkId, ratedId: driver.clerkId, role: 'driver', rating: 4 });

      const app = createApp();
      const res = await app.request(`/api/ratings/driver/${driver.clerkId}?page=1&limit=1`, { headers: authHeaders });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toHaveLength(1);
      expect(body.pagination.page).toBe(1);
      expect(body.pagination.limit).toBe(1);
      expect(body.pagination.total).toBe(2);
      expect(body.pagination.pages).toBe(2);
    });

    it('should not return client ratings for the same rated user', async () => {
      const client = await createTestUser('rdn_client_1', 'client');
      const driver = await createTestUser('rdn_driver_1', 'driver');
      const ride = await createTestRide(client.clerkId, { status: 'paid', driverId: driver.clerkId });
      const rideId = ride._id.toString();

      // This rating has role='client' (driver rating the client)
      // The driver endpoint filters by role='driver', so this should NOT appear
      await createTestRating({ rideId, raterId: driver.clerkId, ratedId: client.clerkId, role: 'client', rating: 4 });

      const app = createApp();
      const res = await app.request(`/api/ratings/driver/${client.clerkId}`, { headers: authHeaders });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toHaveLength(0);
    });
  });

  describe('GET /api/ratings/client/:userId', () => {
    it('should return empty data when no client ratings exist', async () => {
      const app = createApp();
      const res = await app.request('/api/ratings/client/nonexistent_client', { headers: authHeaders });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toEqual([]);
      expect(body.pagination.total).toBe(0);
    });

    it('should return only client ratings', async () => {
      const client = await createTestUser('rc_client_1', 'client');
      const driver = await createTestUser('rc_driver_1', 'driver');
      const ride = await createTestRide(client.clerkId, { status: 'paid', driverId: driver.clerkId });
      const rideId = ride._id.toString();

      await createTestRating({ rideId, raterId: driver.clerkId, ratedId: client.clerkId, role: 'client', rating: 4 });
      await createTestRating({ rideId, raterId: client.clerkId, ratedId: driver.clerkId, role: 'driver', rating: 5 });

      const app = createApp();
      const res = await app.request(`/api/ratings/client/${client.clerkId}`, { headers: authHeaders });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toHaveLength(1);
      expect(body.pagination.total).toBe(1);
    });

    it('should return paginated results', async () => {
      const client = await createTestUser('rcp_client_1', 'client');
      const driver = await createTestUser('rcp_driver_1', 'driver');
      const ride1 = await createTestRide(client.clerkId, { status: 'paid', driverId: driver.clerkId });
      const ride2 = await createTestRide(client.clerkId, { status: 'paid', driverId: driver.clerkId });

      await createTestRating({ rideId: ride1._id.toString(), raterId: driver.clerkId, ratedId: client.clerkId, role: 'client', rating: 5 });
      await createTestRating({ rideId: ride2._id.toString(), raterId: driver.clerkId, ratedId: client.clerkId, role: 'client', rating: 4 });

      const app = createApp();
      const res = await app.request(`/api/ratings/client/${client.clerkId}?page=1&limit=1`, { headers: authHeaders });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toHaveLength(1);
      expect(body.pagination.page).toBe(1);
      expect(body.pagination.limit).toBe(1);
      expect(body.pagination.total).toBe(2);
      expect(body.pagination.pages).toBe(2);
    });
  });
});
