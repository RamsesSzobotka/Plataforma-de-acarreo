# Issue F1-4: Detalle Completo del Pedido

## Descripción
Página de detalle completo del pedido para el conductor (imágenes, descripción, mapa, perfil del cliente).

---

## 1. Wireframe: Detalle del Pedido

```
┌─────────────────────────────────────────────────────────┐
│  ← Volver                                                 │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │                                                  │  │
│  │              [ CARRUSEL DE IMÁGENES ]            │  │
│  │                                                  │  │
│  │         [img1] [img2] [img3] [>]               │  │
│  │                                                  │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  📦 Mudanza - Apartamento 2 habitaciones              │
│  ────────────────────────────────────────────────────   │
│                                                         │
│  ┌─────────────────────┐ ┌─────────────────────┐   │
│  │ 📍 Origen           │ │ 📍 Destino          │   │
│  │ Panama Center      │ │ Bella Vista        │   │
│  │ [Ver en mapa]     │ │ [Ver en mapa]     │   │
│  └─────────────────────┘ └─────────────────────┘   │
│                                                         │
│  ────────────────────────────────────────────────────   │
│  Descripción:                                           │
│  Necesito Trasladar mobiliario de apartamento de        │
│  2 habitaciones. Incluye:                               │
│  - Sala completa (sofa, mesa, 2 sillas)              │
│  - Dormitorio (cama, gavetas, closet)                  │
│  - Cocina (electrodomésticos pequeños)               │
│  - No hay muebles体重 excesivamente pesados         │
│  ────────────────────────────────────────────────────   │
│                                                         │
│  ┌─────────────────────┐ ┌─────────────────────┐   │
│  │ 📦 Bultos          │ │ ⚖️ Peso            │   │
│  │ 5-7 estimados     │ │ ~50kg             │   │
│  └─────────────────────┘ └─────────────────────┘   │
│                                                         │
│  ┌─────────────────────┐ ┌─────────────────────┐   │
│  │ 📅 Fecha           │ │ 💰 Precio          │   │
│  │ Hoy, 10:00 AM    │ │ $150              │   │
│  └─────────────────────┘ └─────────────────────┘   │
│                                                         │
│  ────────────────────────────────────────────────────   │
│  ▸ Notas especiales:                                    │
│  Por favor tocar timbre al llegar. Hay estacionamiento      │
│  disponible en el edificio.                            │
│                                                         │
│  ────────────────────────────────────────────────────   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │ 👤 Cliente                                    │    │
│  │ 🖼️ Juan Pérez  ⭐ 4.5 (23 calif.)           │    │
│  │ 15 acarreos completados                       │    │
│  │ [Ver perfil completo]                       │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  ────────────────────────────────────────────────────   │
│                                                         │
│         ┌────────────────────────────────────┐       │
│         │         💰 $150                    │       │
│         │   [Aceptar pedido]                │       │
│         └────────────────────────────────────┘       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Componente ImageCarousel

```typescript
// frontend/src/components/ImageCarousel.tsx

interface ImageCarouselProps {
  images: { url: string; publicId?: string }[]
}

export default function ImageCarousel({ images }: ImageCarouselProps) {
  const [current, setCurrent] = useState(0)
  
  if (!images || images.length === 0) {
    return (
      <div className="card" style={{ 
        height: 250, 
        background: 'var(--bg-tertiary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <p style={{ color: 'var(--text-muted)' }}>Sin imágenes</p>
      </div>
    )
  }
  
  return (
    <div className="carousel">
      <div style={{ position: 'relative', height: 250, overflow: 'hidden' }}>
        <img 
          src={images[current].url} 
          alt={`Imagen ${current + 1}`}
          style={{ 
            width: '100%', 
            height: '100%', 
            objectFit: 'cover' 
          }}
        />
        
        {/* Navigation arrows */}
        {images.length > 1 && (
          <>
            <button
              onClick={() => setCurrent((current - 1 + images.length) % images.length)}
              style={{
                position: 'absolute',
                left: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'rgba(0,0,0,0.5)',
                color: 'white',
                border: 'none',
                borderRadius: '50%',
                width: 36,
                height: 36,
                cursor: 'pointer'
              }}
            >
              ‹
            </button>
            <button
              onClick={() => setCurrent((current + 1) % images.length)}
              style={{
                position: 'absolute',
                right: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'rgba(0,0,0,0.5)',
                color: 'white',
                border: 'none',
                borderRadius: '50%',
                width: 36,
                height: 36,
                cursor: 'pointer'
              }}
            >
              ›
            </button>
            
            {/* Dots */}
            <div style={{
              position: 'absolute',
              bottom: 8,
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              gap: 4
            }}>
              {images.map((_, i) => (
                <span
                  key={i}
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: i === current ? 'var(--primary)' : 'rgba(255,255,255,0.5)'
                  }}
                />
              ))}
            </div>
          </>
        )}
      </div>
      
      {/* Thumbnails */}
      {images.length > 1 && (
        <div style={{ 
          display: 'flex', 
          gap: 4, 
          marginTop: 8,
          overflowX: 'auto'
        }}>
          {images.map((img, i) => (
            <img
              key={i}
              src={img.url}
              onClick={() => setCurrent(i)}
              style={{
                width: 60,
                height: 60,
                objectFit: 'cover',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                border: i === current ? '2px solid var(--primary)' : '2px solid transparent'
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
```

---

## 3. RideDetails para conductor

```typescript
// frontend/src/pages/RideDetails.tsx

export default function RideDetails() {
  const { id } = useParams()
  const [ride, setRide] = useState<Ride | null>(null)
  const [client, setClient] = useState<Client | null>(null)
  
  useEffect(() => {
    // Load ride
    fetch(`/api/rides/${id}`)
      .then(res => res.json())
      .then(data => setRide(data.data))
    
    // Load client
    if (ride?.clientId) {
      fetch(`/api/users/${ride.clientId}`)
        .then(res => res.json())
        .then(data => setClient(data.data))
    }
  }, [id])
  
  if (!ride) return <div>Cargando...</div>
  
  return (
    <div className="container" style={{ maxWidth: 600, padding: '1rem' }}>
      {/* Back button */}
      <a href="/driver" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: '1rem' }}>
        <span>←</span> Volver
      </a>
      
      {/* Images */}
      <ImageCarousel images={ride.images} />
      
      {/* Title */}
      <h1 style={{ marginTop: '1rem', marginBottom: '0.5rem' }}>
        {ride.title}
      </h1>
      
      {/* Type badge */}
      <span style={{ 
        background: 'var(--secondary)',
        color: 'white',
        padding: '0.25rem 0.75rem',
        borderRadius: '999px',
        fontSize: '0.85rem'
      }}>
        {ride.type}
      </span>
      
      {/* Locations */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1.5rem' }}>
        <div className="card">
          <h4 style={{ color: 'var(--secondary)', marginBottom: '0.5rem' }}>📍 Origen</h4>
          {ride.pickupLocation.address}
        </div>
        <div className="card">
          <h4 style={{ color: 'var(--primary)', marginBottom: '0.5rem' }}>📍 Destino</h4>
          {ride.dropoffLocation.address}
        </div>
      </div>
      
      {/* Description */}
      <div className="card" style={{ marginTop: '1rem' }}>
        <h4>Descripción</h4>
        <p style={{ whiteSpace: 'pre-wrap' }}>{ride.description}</p>
      </div>
      
      {/* Info grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginTop: '1rem' }}>
        <div className="card">
          <h4>📦 Bultos</h4>
          <p>{ride.packages || 'No especificado'}</p>
        </div>
        <div className="card">
          <h4>⚖️ Peso</h4>
          <p>{ride.weight ? `~${ride.weight}kg` : 'No especificado'}</p>
        </div>
        <div className="card">
          <h4>📅 Fecha</h4>
          <p>{ride.preferredDate ? new Date(ride.preferredDate).toLocaleString() : 'A convenir'}</p>
        </div>
        <div className="card">
          <h4>💰 Precio</h4>
          <p style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '1.25rem' }}>
            ${ride.estimatedPrice}
          </p>
        </div>
      </div>
      
      {/* Notes */}
      {ride.notes && (
        <div className="card" style={{ marginTop: '1rem' }}>
          <h4>📝 Notas especiales</h4>
          <p>{ride.notes}</p>
        </div>
      )}
      
      {/* Client profile */}
      {client && <ClientProfile client={client} />}
      
      {/* Accept button */}
      {ride.status === 'requested' && (
        <div style={{ marginTop: '2rem' }}>
          <button className="btn btn-primary" style={{ width: '100%' }}>
            Aceptar pedido - ${ride.estimatedPrice}
          </button>
        </div>
      )}
    </div>
  )
}
```

---

## 4. Mapa (Google Maps)

```typescript
// Simple iframe embed - versión básica
<div style={{ marginTop: '1rem' }}>
  <iframe
    width="100%"
    height="200"
    style={{ border: 0, borderRadius: 'var(--radius)' }}
    loading="lazy"
    src={`https://www.google.com/maps/embed/v1/directions?key=YOUR_API_KEY&origin=${pickupAddress}&destination=${dropoffAddress}`}
  />
</div>
```

---

## 5. Criterios de aceptación

- [ ] Carrusel de imágenes (si hay imágenes)
- [ ] Título y tipo de pedido
- [ ] Mapa con origen y destino
- [ ] Descripción completa
- [ ] Grid de información (bultos, peso, fecha, precio)
- [ ] Notas especiales
- [ ] Perfil del cliente
- [ ] Botón "Aceptar pedido" en turquesa (si aplica)

---

## Labels
`Driver` `feature` `frontend`