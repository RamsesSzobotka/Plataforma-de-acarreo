/**
 * Haversine formula to calculate distance between two points on Earth
 * 
 * Reference: https://en.wikipedia.org/wiki/Haversine_formula
 * Formula: a = sin²(Δφ/2) + cos φ1 ⋅ cos φ2 ⋅ sin²(Δλ/2)
 *          c = 2 ⋅ atan2(√a, √(1−a))
 *          d = R ⋅ c
 * where R is Earth's radius (6,371 km)
 */

const EARTH_RADIUS_KM = 6371

/**
 * Calculate distance between two geographic coordinates using the Haversine formula
 * 
 * @param lat1 - Latitude of first point (degrees, -90 to 90)
 * @param lng1 - Longitude of first point (degrees, -180 to 180)
 * @param lat2 - Latitude of second point (degrees, -90 to 90)
 * @param lng2 - Longitude of second point (degrees, -180 to 180)
 * @returns Distance in kilometers, rounded to 2 decimal places
 * 
 * @example
 * const distKm = calculateDistance(8.9824, -79.5199, 9.3520, -79.5199)
 * console.log(distKm) // ~51.42 km (Panama City to Colón)
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  // Validate coordinates
  if (
    !Number.isFinite(lat1) ||
    !Number.isFinite(lng1) ||
    !Number.isFinite(lat2) ||
    !Number.isFinite(lng2)
  ) {
    throw new Error('Invalid coordinates: all values must be finite numbers')
  }

  if (lat1 < -90 || lat1 > 90 || lat2 < -90 || lat2 > 90) {
    throw new Error('Invalid latitude: must be between -90 and 90')
  }

  if (lng1 < -180 || lng1 > 180 || lng2 < -180 || lng2 > 180) {
    throw new Error('Invalid longitude: must be between -180 and 180')
  }

  // Convert to radians
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lng2 - lng1) * Math.PI) / 180

  // Haversine formula
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  const distance = EARTH_RADIUS_KM * c

  // Round to 2 decimal places
  return Math.round(distance * 100) / 100
}

/**
 * Calculate distance from a point to a GeoJSON Point
 * 
 * @param lat - Driver latitude
 * @param lng - Driver longitude
 * @param geoJsonCoordinates - GeoJSON coordinates array [lng, lat]
 * @returns Distance in kilometers
 */
export function calculateDistanceToGeoJSON(
  lat: number,
  lng: number,
  geoJsonCoordinates: [number, number],
): number {
  const [targetLng, targetLat] = geoJsonCoordinates
  return calculateDistance(lat, lng, targetLat, targetLng)
}
