import { describe, expect, test } from 'bun:test'
import { calculateDistance } from '../utils/haversine'

describe('Haversine Distance Calculator', () => {
  /**
   * Test cases based on real coordinates
   * Using public locations with known distances
   */

  test('should calculate distance between two identical points as 0', () => {
    const distance = calculateDistance(
      { lat: 8.9824, lng: -79.5199 },  // Panama City
      { lat: 8.9824, lng: -79.5199 },
    )
    expect(distance).toBeCloseTo(0, 2)
  })

  test('should calculate distance between Panama City and Colón (~80 km)', () => {
    const panamaCity = { lat: 8.9824, lng: -79.5199 }
    const colon = { lat: 9.3522, lng: -79.9033 }
    
    const distance = calculateDistance(panamaCity, colon)
    
    // Expected: ~81 km (source: Google Maps)
    // Allow 5% margin for rounding
    expect(distance).toBeGreaterThan(75)
    expect(distance).toBeLessThan(87)
  })

  test('should calculate distance between Panama City and David (~450 km)', () => {
    const panamaCity = { lat: 8.9824, lng: -79.5199 }
    const david = { lat: 8.4038, lng: -82.4282 }
    
    const distance = calculateDistance(panamaCity, david)
    
    // Expected: ~450 km (source: Google Maps)
    // Allow 10% margin for rounding
    expect(distance).toBeGreaterThan(400)
    expect(distance).toBeLessThan(500)
  })

  test('should calculate distance between New York and London (~5570 km)', () => {
    const newYork = { lat: 40.7128, lng: -74.006 }
    const london = { lat: 51.5074, lng: -0.1278 }
    
    const distance = calculateDistance(newYork, london)
    
    // Expected: ~5570 km (source: Google Maps)
    // Allow 10% margin for rounding
    expect(distance).toBeGreaterThan(5000)
    expect(distance).toBeLessThan(6200)
  })

  test('should return distance with 2 decimal places precision', () => {
    const distance = calculateDistance(
      { lat: 8.9824, lng: -79.5199 },
      { lat: 9.3522, lng: -79.9033 },
    )
    
    // Check if distance has at most 2 decimal places
    const decimalPlaces = distance.toString().split('.')[1]?.length || 0
    expect(decimalPlaces).toBeLessThanOrEqual(2)
  })

  test('should handle antipodal points (opposite sides of Earth) correctly', () => {
    const northPole = { lat: 90, lng: 0 }
    const southPole = { lat: -90, lng: 0 }
    
    const distance = calculateDistance(northPole, southPole)
    
    // Half Earth circumference: ~20,037 km
    // Allow 5% margin
    expect(distance).toBeGreaterThan(19000)
    expect(distance).toBeLessThan(21000)
  })

  test('should handle points crossing meridian correctly', () => {
    // Points on opposite sides of 180/-180 meridian
    const pointA = { lat: 0, lng: 179.5 }
    const pointB = { lat: 0, lng: -179.5 }
    
    const distance = calculateDistance(pointA, pointB)
    
    // Should be approximately 1 degree of longitude at equator (~111 km)
    expect(distance).toBeGreaterThan(1)
    expect(distance).toBeLessThan(200)
  })

  test('should handle negative latitude (Southern Hemisphere)', () => {
    const buenos Aires = { lat: -34.6037, lng: -58.3816 }
    const sao Paulo = { lat: -23.5505, lng: -46.6333 }
    
    const distance = calculateDistance(buenos Aires, sao Paulo)
    
    // Expected: ~1100 km
    expect(distance).toBeGreaterThan(1000)
    expect(distance).toBeLessThan(1200)
  })

  test('should be symmetric (distance A to B = distance B to A)', () => {
    const pointA = { lat: 8.9824, lng: -79.5199 }
    const pointB = { lat: 9.3522, lng: -79.9033 }
    
    const distanceAB = calculateDistance(pointA, pointB)
    const distanceBA = calculateDistance(pointB, pointA)
    
    expect(distanceAB).toBeCloseTo(distanceBA, 2)
  })

  test('should handle very small distances (10 meters)', () => {
    // Two points very close together
    const pointA = { lat: 8.9824, lng: -79.5199 }
    const pointB = { lat: 8.9824 + 0.0001, lng: -79.5199 }  // ~11 meters apart
    
    const distance = calculateDistance(pointA, pointB)
    
    expect(distance).toBeGreaterThan(0)
    expect(distance).toBeLessThan(0.02)  // Less than 20 meters
  })

  test('should handle radius parameter correctly (output in km)', () => {
    // This test verifies the default radius (Earth's mean radius)
    const distance = calculateDistance(
      { lat: 0, lng: 0 },
      { lat: 0, lng: 1 },  // 1 degree of longitude
    )
    
    // 1 degree of longitude at equator ≈ 111 km
    expect(distance).toBeGreaterThan(100)
    expect(distance).toBeLessThan(115)
  })

  test('should work with maximum latitude values', () => {
    const distance = calculateDistance(
      { lat: 85, lng: 0 },
      { lat: -85, lng: 0 },
    )
    
    // Should produce a valid distance
    expect(distance).toBeGreaterThan(0)
    expect(distance).toBeLessThan(20000)
  })

  test('should work with maximum longitude values', () => {
    const distance = calculateDistance(
      { lat: 0, lng: 170 },
      { lat: 0, lng: -170 },
    )
    
    // Should produce a valid distance
    expect(distance).toBeGreaterThan(0)
    expect(distance).toBeLessThan(500)
  })
})
