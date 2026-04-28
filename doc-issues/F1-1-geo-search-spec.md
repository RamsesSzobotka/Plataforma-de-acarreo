# Issue F1-1: Búsqueda Geoespacial de Rides

## Descripción
Implementar búsqueda de pedidos cercanos a la ubicación del conductor usando GeoJSON.

---

## 1. Ubicación de archivos

### Archivos a modificar
```
backend/src/routes/rides.ts    # Agregar filtros geoespaciales
frontend/src/pages/DriverDashboard.tsx  # Actualizar con mapa
```

---

## 2. Backend - Búsqueda geoespacial

### GET /api/rides con filtros

```typescript
// backend/src/routes/rides.ts
rides.get('/', async (c) => {
  const { status, clientId, driverId, lat, lng, radius } = c.req.query()
  
  const query: any = {}
  
  // Filtros básicos
  if (status) query.status = status
  if (clientId) query.clientId = clientId
  if (driverId) query.driverId = driverId
  
  let ridesList
  
  // Búsqueda geoespacial
  if (lat && lng && radius) {
    const latitude = parseFloat(lat)
    const longitude = parseFloat(lng)
    const radiusKm = parseFloat(radius) || 25 // Default 25km
    
    // Convert km to radians for MongoDB (Earth radius ~6371km)
    const radiusRad = radiusKm / 6371
    
    ridesList = await db.collection('rides')
      .find({
        ...query,
        'pickupLocation.coordinates': {
          $geoWithin: {
            $centerSphere: [
              [longitude, latitude],
              radiusRad
            ]
          }
        }
      })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray()
      
    // Calcular distancia para cada ride
    ridesList = ridesList.map(ride => ({
      ...ride,
      distance: calculateDistance(
        latitude, longitude,
        ride.pickupLocation.coordinates[1],
        ride.pickupLocation.coordinates[0]
      )
    }))
  } else {
    ridesList = await db.collection('rides')
      .find(query)
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray()
  }
  
  return c.json({ data: ridesList })
})

// Helper para calcular distancia (Haversine)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371 // Radio terrestre en km
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return Math.round(R * c * 10) / 10 // Redondear a 1 decimal
}
```

---

## 3. Frontend - Diseño

### Wireframe: DriverDashboard

```
┌─────────────────────────────────────────────────────────┐
│  Panel del Conductor                    [Mis datos 🔔]  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────────┐  ┌──────────────────┐            │
│  │ 📍 Pedidos       │  │  🚛 Mis Acarreos │            │
│  │ Cercanos (12)    │  │  (3)             │            │
│  └──────────────────┘  └──────────────────┘            │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │ 📍 Mostrar en mapa  │ Todos │ 5km │ 10km │ 25km │  │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │                                                 │   │
│  │              MAPA (Google Maps)                  │   │
│  │         📍 markers de pedidos cercanos           │   │
│  │                                                 │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  Cards de pedidos debajo del mapa...                      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### RideCard Component

```
┌─────────────────────────────────────────────────────────┐
│ ┌──────────┐                                           │
│ │ [IMG]    │  Mudanza - Apartamento 2 habitaciones    │
│ │  2x2    │  📍 Centro, Ciudad → 📍 Bella Vista   │
│ └──────────┘  📦 5 bultos • ~50kg                     │
│                                                         │
│                              ┌──────────────────────┐    │
│                              │        $150        │    │
│                              │  [Aceptar pedido]  │    │
│                              └──────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

### Colores según sistema de diseño

| Elemento | Color | Variable |
|---------|-------|----------|
| Botón "Aceptar" | Turquesa | `--primary: #0D9488` |
| Icono ubicación | Naranja | `--secondary: #F97316` |
| Badge de distancia | Turquesa claro | `#14b8a6` |
| Fondo Card | Blanco | `--bg-primary: #FFFFFF` |
| Texto precio | Negro azulado | `--text-primary: #0F172A` |

---

## 4. Código Frontend

```typescript
// frontend/src/pages/DriverDashboard.tsx (actualizado)
import { useState, useEffect } from 'react'

const DISTANCE_OPTIONS = [
  { value: 5, label: '5km' },
  { value: 10, label: '10km' },
  { value: 25, label: '25km' },
  { value: 50, label: '50km' },
]

interface Ride {
  _id: string
  title: string
  type: string
  status: string
  estimatedPrice: number
  pickupLocation: { address: string; coordinates: { coordinates: number[] } }
  dropoffLocation: { address: string }
  description: string
  distance?: number // km desde el conductor
}

export default function DriverDashboard() {
  const [rides, setRides] = useState<Ride[]>([])
  const [loading, setLoading] = useState(true)
  const [radius, setRadius] = useState(25)
  const [userLocation, setUserLocation] = useState<{lat: number; lng: number} | null>(null)
  const [showMap, setShowMap] = useState(true)
  
  useEffect(() => {
    // Obtener ubicación del conductor
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          })
        },
        (err) => console.error('Geolocation error:', err)
      )
    }
  }, [])
  
  useEffect(() => {
    loadRides()
  }, [radius, userLocation])
  
  const loadRides = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ status: 'requested' })
      if (userLocation) {
        params.append('lat', userLocation.lat.toString())
        params.append('lng', userLocation.lng.toString())
        params.append('radius', radius.toString())
      }
      
      const res = await fetch(`/api/rides?${params}`)
      const data = await res.json()
      setRides(data.data || [])
    } catch (err) {
      console.error('Error loading rides:', err)
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <div className="container">
      <h1 style={{ marginBottom: '1.5rem' }}>Panel del Conductor</h1>
      
      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: '1.5rem' }}>
        <button className="tab active">📍 Pedidos Cercanos ({rides.length})</button>
        <button className="tab">🚛 Mis Acarreos</button>
      </div>
      
      {/* Filtro de distancia */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '0.5rem',
        marginBottom: '1rem'
      }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input 
            type="checkbox" 
            checked={showMap}
            onChange={(e) => setShowMap(e.target.checked)}
          />
          📍 Mostrar en mapa
        </label>
        
        <div style={{ display: 'flex', marginLeft: 'auto', gap: '0.25rem' }}>
          {DISTANCE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              className={`btn ${radius === opt.value ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setRadius(opt.value)}
              style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      
      {/* Mapa opcional */}
      {showMap && userLocation && (
        <div className="card" style={{ 
          height: 300, 
          marginBottom: '1rem',
          background: 'var(--bg-tertiary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <p style={{ color: 'var(--text-muted)' }}>
            [Mapa de Google Maps - {rides.length} pedidos]
          </p>
        </div>
      )}
      
      {/* Lista de pedidos */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          Cargando pedidos...
        </div>
      ) : rides.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: 'var(--text-muted)' }}>
            No hay pedidos disponibles en {radius}km
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {rides.map(ride => (
            <RideCard 
              key={ride._id} 
              ride={ride} 
              onAccept={() => handleAccept(ride._id, ride.estimatedPrice)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
```

---

## 5. Criterios de aceptación

Backend:
- [ ] GET /api/rides acepta lat, lng, radius
- [ ] Retorna pedidos dentro del radio
- [ ] Incluye campo distance en cada ride

Frontend:
- [ ] Selector de radio (5/10/25/50km)
- [ ] Botón para mostrar/ocultar mapa
- [ ] Cards con diseño turquesa
- [ ] Distancia mostrada en card

---

## 6. Comandos

```bash
# Probar endpoint
curl "http://localhost:3000/api/rides?status=requested&lat=-8.1&lng=-79.1&radius=25"
```

---

## Labels
`Driver` `feature` `backend` `frontend`