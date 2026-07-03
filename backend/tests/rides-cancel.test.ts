import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { Hono } from 'hono';
import { db } from '../src/db/mongo';
import { setupTests, teardownTests, cleanupCollection, createTestUser, createTestRide } from './setup';
import rides from '../src/routes/rides';

function createApp(mockUser: { clerkId: string; role: string; email?: string }) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    c.set('user', mockUser);
    await next();
  });
  app.route('/api/rides', rides);
  return app;
}

describe('Ride Cancellation', () => {
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
  });

  describe('Cancel Ride Endpoint', () => {
    it('should cancel own ride when client in requested status', async () => {
      const client = await createTestUser('cancel_client_own', 'client');
      const ride = await createTestRide(client.clerkId, { status: 'requested' });

      const app = createApp({ clerkId: client.clerkId, role: 'client' });
      const res = await app.request(`/api/rides/${ride._id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Ya no necesito el servicio' }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('cancelled');
    });

    it('should return 403 when client tries to cancel in accepted status', async () => {
      const client = await createTestUser('cancel_client_acc', 'client');
      const driver = await createTestUser('cancel_driver_acc', 'driver');
      const ride = await createTestRide(client.clerkId, {
        status: 'accepted',
        driverId: driver.clerkId,
      });

      const app = createApp({ clerkId: client.clerkId, role: 'client' });
      const res = await app.request(`/api/rides/${ride._id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Quiero cancelar' }),
      });

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toContain('conductor');
    });

    it('should cancel when driver in accepted status', async () => {
      const client = await createTestUser('cancel_acc_client', 'client');
      const driver = await createTestUser('cancel_acc_driver', 'driver');
      const ride = await createTestRide(client.clerkId, {
        status: 'accepted',
        driverId: driver.clerkId,
      });

      const app = createApp({ clerkId: driver.clerkId, role: 'driver' });
      const res = await app.request(`/api/rides/${ride._id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'No puedo realizar el viaje' }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('cancelled');
    });

    it('should return 403 when driver tries to cancel in requested status', async () => {
      const client = await createTestUser('cancel_req_client', 'client');
      const driver = await createTestUser('cancel_req_driver', 'driver');
      const ride = await createTestRide(client.clerkId, { status: 'requested' });

      const app = createApp({ clerkId: driver.clerkId, role: 'driver' });
      const res = await app.request(`/api/rides/${ride._id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Quiero cancelar' }),
      });

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toContain('cliente');
    });

    it('should return 403 when client tries to cancel another client ride', async () => {
      const owner = await createTestUser('cancel_owner', 'client');
      const other = await createTestUser('cancel_other', 'client');
      const ride = await createTestRide(owner.clerkId, { status: 'requested' });

      const app = createApp({ clerkId: other.clerkId, role: 'client' });
      const res = await app.request(`/api/rides/${ride._id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Quiero cancelar' }),
      });

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toContain('permiso');
    });

    it('should allow admin to cancel in any status', async () => {
      const client = await createTestUser('cancel_admin_client', 'client');
      const driver = await createTestUser('cancel_admin_driver', 'driver');
      const admin = await createTestUser('cancel_admin', 'admin');

      // Admin cancels in requested
      const rideRequested = await createTestRide(client.clerkId, { status: 'requested' });
      let app = createApp({ clerkId: admin.clerkId, role: 'admin' });
      let res = await app.request(`/api/rides/${rideRequested._id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Admin cancela' }),
      });
      expect(res.status).toBe(200);

      // Admin cancels in accepted
      const rideAccepted = await createTestRide(client.clerkId, {
        status: 'accepted',
        driverId: driver.clerkId,
      });
      app = createApp({ clerkId: admin.clerkId, role: 'admin' });
      res = await app.request(`/api/rides/${rideAccepted._id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Admin cancela' }),
      });
      expect(res.status).toBe(200);

      // Admin cancels in in_progress
      const rideInProgress = await createTestRide(client.clerkId, {
        status: 'in_progress',
        driverId: driver.clerkId,
      });
      app = createApp({ clerkId: admin.clerkId, role: 'admin' });
      res = await app.request(`/api/rides/${rideInProgress._id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Admin cancela' }),
      });
      expect(res.status).toBe(200);
    });

    it('should return 403 when trying to cancel in in_progress status', async () => {
      const client = await createTestUser('cancel_prog_client', 'client');
      const driver = await createTestUser('cancel_prog_driver', 'driver');
      const ride = await createTestRide(client.clerkId, {
        status: 'in_progress',
        driverId: driver.clerkId,
      });

      const app = createApp({ clerkId: client.clerkId, role: 'client' });
      const res = await app.request(`/api/rides/${ride._id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Quiero cancelar' }),
      });

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toContain('No se puede cancelar');
    });

    it('should save cancellationReason when canceling with reason', async () => {
      const client = await createTestUser('cancel_reason_client', 'client');
      const ride = await createTestRide(client.clerkId, { status: 'requested' });

      const app = createApp({ clerkId: client.clerkId, role: 'client' });
      const res = await app.request(`/api/rides/${ride._id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Cliente ya no necesita el servicio' }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('cancelled');
      expect(body.cancellationReason).toBe('Cliente ya no necesita el servicio');

      // Verify in DB
      const savedRide = await db.collection('rides').findOne({ _id: ride._id });
      expect(savedRide?.cancellationReason).toBe('Cliente ya no necesita el servicio');
    });
  });
});
