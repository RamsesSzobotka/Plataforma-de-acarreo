import { describe, expect, test, beforeAll, afterAll } from 'bun:test'
import { connect, disconnect } from '../db/mongo'
import { Ride } from '../models/ride'
import { User } from '../models/user'

/**
 * Integration tests for Rides API
 * 
 * Tests geospatial queries, acceptance flow, cancellation logic
 */
describe('Rides API - Geospatial and Acceptance', () => {
  beforeAll(async () => {
    // Connect to test database
    await connect()
  })

  afterAll(async () => {
    // Cleanup
    await Ride.deleteMany({})
    await User.deleteMany({})
    await disconnect()
  })

  describe('Geospatial queries with $near', () => {
    beforeAll(async () => {
      // Create test rides with different locations
      await Ride.create([
        {
          clientId: 'client_1',
          title: 'Mudanza pequeña',
          description: 'Pequeña mudanza de apartamento',
          type: 'mudanza',
          images: [],
          pickupLocation: {
            address: 'Cinta Costera, Panama',
            coordinates: {
              type: 'Point',
              coordinates: [-79.52, 8.98], // Panama City
            },
          },
          dropoffLocation: {
            address: 'San Miguelito, Panama',
            coordinates: {
              type: 'Point',
              coordinates: [-79.51, 9.05], // ~8 km away
            },
          },
          estimatedPrice: 50,
          status: 'requested',
          chatEnabled: false,
        },
        {
          clientId: 'client_2',
          title: 'Mudanza mediana',
          description: 'Mudanza de oficina',
          type: 'mudanza',
          images: [],
          pickupLocation: {
            address: 'El Dorado, Panama',
            coordinates: {
              type: 'Point',
              coordinates: [-79.5, 8.97], // ~3 km away
            },
          },
          dropoffLocation: {
            address: 'Paitilla, Panama',
            coordinates: {
              type: 'Point',
              coordinates: [-79.53, 8.99],
            },
          },
          estimatedPrice: 75,
          status: 'requested',
          chatEnabled: false,
        },
        {
          clientId: 'client_3',
          title: 'Transporte de mercancía',
          description: 'Transporte a Colón',
          type: 'productos',
          images: [],
          pickupLocation: {
            address: 'Curundu, Panama',
            coordinates: {
              type: 'Point',
              coordinates: [-79.55, 8.96], // ~10 km away
            },
          },
          dropoffLocation: {
            address: 'Colón, Panama',
            coordinates: {
              type: 'Point',
              coordinates: [-79.9, 9.35], // ~80 km away - different ride
            },
          },
          estimatedPrice: 150,
          status: 'requested',
          chatEnabled: false,
        },
      ])
    })

    test('should find rides within 5 km radius', async () => {
      const driverLocation = { lat: 8.98, lng: -79.52 }
      const radiusKm = 5
      const radiusMeters = radiusKm * 1000

      // Query rides near driver location
      const ridesInRadius = await Ride.find({
        'pickupLocation.coordinates': {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [driverLocation.lng, driverLocation.lat],
            },
            $maxDistance: radiusMeters,
          },
        },
        status: 'requested',
      })

      // Should find rides close to Panama City
      expect(ridesInRadius.length).toBeGreaterThan(0)
      expect(ridesInRadius.length).toBeLessThanOrEqual(2) // El Dorado and Cinta Costera
    })

    test('should find rides within 100 km radius', async () => {
      const driverLocation = { lat: 8.98, lng: -79.52 }
      const radiusKm = 100
      const radiusMeters = radiusKm * 1000

      const ridesInRadius = await Ride.find({
        'pickupLocation.coordinates': {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [driverLocation.lng, driverLocation.lat],
            },
            $maxDistance: radiusMeters,
          },
        },
        status: 'requested',
      })

      // Should find all 3 rides (including the one to Colón)
      expect(ridesInRadius.length).toBe(3)
    })

    test('should respect status filter in geospatial query', async () => {
      const driverLocation = { lat: 8.98, lng: -79.52 }
      const radiusKm = 100
      const radiusMeters = radiusKm * 1000

      // Mark one ride as accepted
      await Ride.updateOne({ title: 'Transporte de mercancía' }, { status: 'accepted' })

      const ridesAvailable = await Ride.find({
        'pickupLocation.coordinates': {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [driverLocation.lng, driverLocation.lat],
            },
            $maxDistance: radiusMeters,
          },
        },
        status: 'requested',
      })

      // Should find only 2 requested rides
      expect(ridesAvailable.length).toBe(2)
    })
  })

  describe('Ride acceptance flow', () => {
    let rideId: string
    let driverId: string

    beforeAll(async () => {
      // Create a test ride
      const ride = await Ride.create({
        clientId: 'client_test',
        title: 'Test ride for acceptance',
        description: 'Testing acceptance flow',
        type: 'mudanza',
        images: [],
        pickupLocation: {
          address: 'Test pickup',
          coordinates: {
            type: 'Point',
            coordinates: [-79.52, 8.98],
          },
        },
        dropoffLocation: {
          address: 'Test dropoff',
          coordinates: {
            type: 'Point',
            coordinates: [-79.53, 8.99],
          },
        },
        estimatedPrice: 50,
        status: 'requested',
        chatEnabled: false,
      })

      rideId = ride._id.toString()
      driverId = 'driver_test_1'
    })

    test('should transition from requested to accepted', async () => {
      const finalPrice = 60

      const updatedRide = await Ride.findByIdAndUpdate(
        rideId,
        {
          $set: {
            status: 'accepted',
            driverId,
            finalPrice,
            chatEnabled: true,
          },
        },
        { new: true },
      )

      expect(updatedRide).not.toBeNull()
      expect(updatedRide?.status).toBe('accepted')
      expect(updatedRide?.driverId).toBe(driverId)
      expect(updatedRide?.finalPrice).toBe(finalPrice)
      expect(updatedRide?.chatEnabled).toBe(true)
    })

    test('should allow cancellation from accepted state', async () => {
      const cancellationReason = 'Driver had emergency'

      const updatedRide = await Ride.findByIdAndUpdate(
        rideId,
        {
          $set: {
            status: 'cancelled',
            cancellationReason,
            driverId: null,
            finalPrice: null,
            chatEnabled: false,
          },
        },
        { new: true },
      )

      expect(updatedRide?.status).toBe('cancelled')
      expect(updatedRide?.cancellationReason).toBe(cancellationReason)
      expect(updatedRide?.driverId).toBeNull()
      expect(updatedRide?.finalPrice).toBeNull()
    })
  })

  describe('Ride state transitions', () => {
    let rideId: string

    beforeAll(async () => {
      const ride = await Ride.create({
        clientId: 'client_test_2',
        title: 'Test state transitions',
        description: 'Testing all state transitions',
        type: 'productos',
        images: [],
        pickupLocation: {
          address: 'Pickup point',
          coordinates: {
            type: 'Point',
            coordinates: [-79.52, 8.98],
          },
        },
        dropoffLocation: {
          address: 'Dropoff point',
          coordinates: {
            type: 'Point',
            coordinates: [-79.53, 8.99],
          },
        },
        estimatedPrice: 100,
        status: 'requested',
        chatEnabled: false,
      })

      rideId = ride._id.toString()
    })

    test('should transition: requested → negotiating', async () => {
      const updated = await Ride.findByIdAndUpdate(
        rideId,
        { $set: { status: 'negotiating', chatEnabled: true } },
        { new: true },
      )

      expect(updated?.status).toBe('negotiating')
      expect(updated?.chatEnabled).toBe(true)
    })

    test('should transition: negotiating → accepted', async () => {
      const updated = await Ride.findByIdAndUpdate(
        rideId,
        {
          $set: {
            status: 'accepted',
            driverId: 'driver_123',
            finalPrice: 110,
          },
        },
        { new: true },
      )

      expect(updated?.status).toBe('accepted')
      expect(updated?.driverId).toBe('driver_123')
    })

    test('should transition: accepted → in_progress', async () => {
      const updated = await Ride.findByIdAndUpdate(
        rideId,
        { $set: { status: 'in_progress' } },
        { new: true },
      )

      expect(updated?.status).toBe('in_progress')
    })

    test('should transition: in_progress → completed', async () => {
      const updated = await Ride.findByIdAndUpdate(
        rideId,
        {
          $set: {
            status: 'completed',
            deliveryPhoto: {
              url: 'https://example.com/photo.jpg',
              publicId: 'photo_123',
            },
          },
        },
        { new: true },
      )

      expect(updated?.status).toBe('completed')
      expect(updated?.deliveryPhoto?.url).toBeDefined()
    })

    test('should transition: completed → paid', async () => {
      const updated = await Ride.findByIdAndUpdate(
        rideId,
        { $set: { status: 'paid' } },
        { new: true },
      )

      expect(updated?.status).toBe('paid')
    })
  })
})
