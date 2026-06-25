export interface Coordinates {
  lat: number
  lng: number
}

export interface RouteResult {
  coordinates: [number, number][]  // [lat, lng] for Leaflet
  distanceKm: number
  durationMin: number
  isFallback: boolean
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

function haversineDistance(a: Coordinates, b: Coordinates): number {
  const R = 6371 // Earth radius in km
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)

  const sinHalfDLat = Math.sin(dLat / 2)
  const sinHalfDLng = Math.sin(dLng / 2)
  const aVal =
    sinHalfDLat * sinHalfDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinHalfDLng * sinHalfDLng
  const c = 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal))

  return R * c
}

export function getCacheKey(pickup: Coordinates, dropoff: Coordinates): string {
  const pLat = pickup.lat.toFixed(6)
  const pLng = pickup.lng.toFixed(6)
  const dLat = dropoff.lat.toFixed(6)
  const dLng = dropoff.lng.toFixed(6)
  return `osrm-route-${pLng}-${pLat}-${dLng}-${dLat}`
}

export function haversineFallback(
  pickup: Coordinates,
  dropoff: Coordinates,
  numPoints: number = 20,
): RouteResult {
  const distanceKm = haversineDistance(pickup, dropoff)

  // Same point — return single coordinate
  if (distanceKm === 0) {
    return {
      coordinates: [[pickup.lat, pickup.lng]],
      distanceKm: 0,
      durationMin: 0,
      isFallback: true,
    }
  }

  const R = 6371 // Earth radius in km
  const lat1 = toRad(pickup.lat)
  const lat2 = toRad(dropoff.lat)
  const lng1 = toRad(pickup.lng)
  const lng2 = toRad(dropoff.lng)
  const centralAngle = distanceKm / R

  const coordinates: [number, number][] = []

  for (let i = 0; i < numPoints; i++) {
    const fraction = i / (numPoints - 1)

    // Spherical (great-circle) interpolation
    const A = Math.sin((1 - fraction) * centralAngle) / Math.sin(centralAngle)
    const B = Math.sin(fraction * centralAngle) / Math.sin(centralAngle)

    const x = A * Math.cos(lat1) * Math.cos(lng1) + B * Math.cos(lat2) * Math.cos(lng2)
    const y = A * Math.cos(lat1) * Math.sin(lng1) + B * Math.cos(lat2) * Math.sin(lng2)
    const z = A * Math.sin(lat1) + B * Math.sin(lat2)

    const interpLat = Math.atan2(z, Math.sqrt(x * x + y * y))
    const interpLng = Math.atan2(y, x)

    coordinates.push([(interpLat * 180) / Math.PI, (interpLng * 180) / Math.PI])
  }

  // Estimate 50 km/h average speed for fallback duration
  const estimatedSpeedKmh = 50
  const durationMin = (distanceKm / estimatedSpeedKmh) * 60

  return {
    coordinates,
    distanceKm,
    durationMin,
    isFallback: true,
  }
}

export async function getRoute(
  pickup: Coordinates,
  dropoff: Coordinates,
): Promise<RouteResult> {
  // Edge case: same coordinates
  if (pickup.lat === dropoff.lat && pickup.lng === dropoff.lng) {
    return {
      coordinates: [[pickup.lat, pickup.lng]],
      distanceKm: 0,
      durationMin: 0,
      isFallback: false,
    }
  }

  // Try cache first
  const cacheKey = getCacheKey(pickup, dropoff)
  try {
    const cached = sessionStorage.getItem(cacheKey)
    if (cached) {
      return JSON.parse(cached) as RouteResult
    }
  } catch {
    // sessionStorage unavailable — skip cache
  }

  try {
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${pickup.lng},${pickup.lat};${dropoff.lng},${dropoff.lat}` +
      `?geometries=geojson&overview=full`

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)

    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timeout)

    if (!response.ok) {
      throw new Error(`OSRM responded with ${response.status}`)
    }

    const data = await response.json()

    if (!data.routes || data.routes.length === 0) {
      throw new Error('OSRM returned no routes')
    }

    const route = data.routes[0]
    const coordinates: [number, number][] = route.geometry.coordinates.map(
      ([lng, lat]: number[]): [number, number] => [lat, lng],
    )

    const result: RouteResult = {
      coordinates,
      distanceKm: route.distance / 1000,
      durationMin: route.duration / 60,
      isFallback: false,
    }

    // Cache the result
    try {
      sessionStorage.setItem(cacheKey, JSON.stringify(result))
    } catch {
      // sessionStorage full or unavailable — skip cache write
    }

    return result
  } catch {
    // Network error, timeout, or invalid response — use fallback
    return haversineFallback(pickup, dropoff)
  }
}
