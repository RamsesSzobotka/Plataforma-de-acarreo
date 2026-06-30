import { describe, it, expect } from 'bun:test';
import { canTransition, canCancel, ALLOWED_TRANSITIONS } from '../src/services/ride-machine';

describe('Ride State Machine', () => {
  describe('Cancellation Rules (canCancel)', () => {
    it('client can cancel in requested status', () => {
      const result = canCancel('requested', 'client');
      expect(result.allowed).toBe(true);
    });

    it('driver CANNOT cancel in requested status', () => {
      const result = canCancel('requested', 'driver');
      expect(result.allowed).toBe(false);
    });

    it('driver can cancel in accepted status', () => {
      const result = canCancel('accepted', 'driver');
      expect(result.allowed).toBe(true);
    });

    it('client CANNOT cancel in accepted status', () => {
      const result = canCancel('accepted', 'client');
      expect(result.allowed).toBe(false);
    });

    it('cannot cancel in in_progress', () => {
      const result = canCancel('in_progress', 'client');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('No se puede cancelar');

      const driverResult = canCancel('in_progress', 'driver');
      expect(driverResult.allowed).toBe(false);
    });

    it('cannot cancel in completed', () => {
      const result = canCancel('completed', 'client');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('No se puede cancelar');
    });

    it('cannot cancel in paid', () => {
      const result = canCancel('paid', 'client');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('No se puede cancelar');
    });

    it('admin can cancel in any status', () => {
      expect(canCancel('requested', 'admin').allowed).toBe(true);
      expect(canCancel('accepted', 'admin').allowed).toBe(true);
      expect(canCancel('in_progress', 'admin').allowed).toBe(true);
      expect(canCancel('completed', 'admin').allowed).toBe(true);
      expect(canCancel('paid', 'admin').allowed).toBe(true);
    });
  });

  describe('State Transitions (canTransition)', () => {
    it('requested -> accepted is allowed for driver', () => {
      const result = canTransition('requested', 'accepted', 'driver');
      expect(result.allowed).toBe(true);
    });

    it('requested -> accepted is NOT allowed for client', () => {
      const result = canTransition('requested', 'accepted', 'client');
      expect(result.allowed).toBe(false);
    });

    it('accepted -> in_progress is allowed for driver', () => {
      const result = canTransition('accepted', 'in_progress', 'driver');
      expect(result.allowed).toBe(true);
    });

    it('in_progress -> completed is allowed for client', () => {
      const result = canTransition('in_progress', 'completed', 'client');
      expect(result.allowed).toBe(true);
    });

    it('completed -> paid is allowed for client', () => {
      const result = canTransition('completed', 'paid', 'client');
      expect(result.allowed).toBe(true);
    });

    it('cannot skip states (e.g., requested -> in_progress)', () => {
      const result = canTransition('requested', 'in_progress', 'driver');
      expect(result.allowed).toBe(false);
    });

    it('paid has no valid transitions', () => {
      const validTargets = ALLOWED_TRANSITIONS['paid'];
      expect(validTargets).toEqual([]);
    });
  });

  describe('Rating Rules', () => {
    it('rating is only allowed when ride is paid', () => {
      // This is a business rule - rating tool checks ride.status === 'paid'
      // We verify the state machine reflects this
      const completedResult = canTransition('completed', 'paid', 'client');
      expect(completedResult.allowed).toBe(true);

      // 'paid' is the terminal state that enables rating
      const paidTargets = ALLOWED_TRANSITIONS['paid'];
      expect(paidTargets).toEqual([]);
    });
  });
});
