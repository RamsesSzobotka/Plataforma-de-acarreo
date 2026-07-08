import { mock, describe, it, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { Hono } from 'hono';
import { db } from '../src/db/mongo';
import { setupTests, teardownTests, cleanupCollection, createTestUser, createTestDriver, createTestRide } from './setup';

let mockClerkId = 'cancel_test_user';

mock.module('@clerk/clerk-sdk-node', () => ({
  verifyToken: () => Promise.resolve({ sub: mockClerkId }),
}));

import rides from '../src/routes/rides';

const app = new Hono();
app.route('/api/rides', rides);

const authHeaders = { Authorization: 'Bearer test_token' };

describe('POST /api/rides/:id/cancel', () => {
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

  it('client can cancel their own ride in requested status', async () => {
    mockClerkId = 'cancel_client_1';
    await createTestUser('cancel_client_1', 'client');
    const ride = await createTestRide('cancel_client_1', { status: 'requested' });

    const res = await app.request(`/api/rides/${ride._id}/cancel`, {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Ya no necesito el servicio' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('cancelled');
    expect(body.cancellationReason).toContain('Ya no necesito');
  });

  it('client CANNOT cancel ride in accepted status', async () => {
    mockClerkId = 'cancel_client_2';
    await createTestUser('cancel_client_2', 'client');
    const ride = await createTestRide('cancel_client_2', { status: 'accepted', driverId: 'some_driver' });

    const res = await app.request(`/api/rides/${ride._id}/cancel`, {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it('driver can cancel ride in accepted status (unassign)', async () => {
    mockClerkId = 'cancel_driver_1';
    await createTestUser('cancel_driver_1', 'driver');
    await createTestDriver('cancel_driver_1');
    const ride = await createTestRide('client_for_driver', {
      status: 'accepted',
      driverId: 'cancel_driver_1',
    });

    const res = await app.request(`/api/rides/${ride._id}/cancel`, {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'No puedo realizar el viaje' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    // Driver unassign: ride goes back to 'requested', driverId is removed
    expect(body.status).toBe('requested');
    expect(body.driverId).toBeUndefined();
  });

  it('driver CANNOT cancel ride in requested status (no driver assigned)', async () => {
    mockClerkId = 'cancel_driver_2';
    await createTestUser('cancel_driver_2', 'driver');
    await createTestDriver('cancel_driver_2');
    const ride = await createTestRide('client_no_driver', { status: 'requested' });

    const res = await app.request(`/api/rides/${ride._id}/cancel`, {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(403);
  });

  it('client CANNOT cancel another client\'s ride', async () => {
    mockClerkId = 'cancel_client_3';
    await createTestUser('cancel_client_3', 'client');
    const ride = await createTestRide('other_client', { status: 'requested' });

    const res = await app.request(`/api/rides/${ride._id}/cancel`, {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('permiso');
  });

  it('admin can cancel any ride', async () => {
    mockClerkId = 'cancel_admin_1';
    await createTestUser('cancel_admin_1', 'admin');
    const ride = await createTestRide('some_client', { status: 'in_progress', driverId: 'some_driver' });

    const res = await app.request(`/api/rides/${ride._id}/cancel`, {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Admin override' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('cancelled');
  });

  it('cannot cancel when ride is in_progress', async () => {
    mockClerkId = 'cancel_client_4';
    await createTestUser('cancel_client_4', 'client');
    const ride = await createTestRide('cancel_client_4', { status: 'in_progress', driverId: 'some_driver' });

    const res = await app.request(`/api/rides/${ride._id}/cancel`, {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(403);
  });

  it('cancel with reason saves cancellationReason in DB', async () => {
    mockClerkId = 'cancel_client_5';
    await createTestUser('cancel_client_5', 'client');
    const ride = await createTestRide('cancel_client_5', { status: 'requested' });

    const res = await app.request(`/api/rides/${ride._id}/cancel`, {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Razón de prueba' }),
    });

    expect(res.status).toBe(200);
    // Verify in DB
    const updatedRide = await db.collection('rides').findOne({ _id: ride._id });
    expect(updatedRide?.cancellationReason).toBe('Razón de prueba');
    expect(updatedRide?.status).toBe('cancelled');
  });
});
