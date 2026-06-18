# Issue F1-2: Lista de Pedidos Disponibles

## Descripción
Mostrar lista de pedidos disponibles en el Dashboard del conductor con filtros y diseño profesional.

---

## 1. Wireframe: Vista de Pedidos Disponibles

```
┌─────────────────────────────────────────────────────────┐
│  Panel del Conductor                    [Perfil 🔔]         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌────────────────────────┐ ┌────────────────────────┐  │
│  │ 📍 Pedidos Cercanos   │ │ 🚛 Mis Acarreos       │  │
│  │ (12)                │ │ (3)                  │  │
│  └────────────────────────┘ └────────────────────────┘  │
│                                                         │
│  ──────────────────────────────────────────────────────  │
│                                                         │
│  [🔍 Buscar...] [📦 Tipo: Todos ▼] [💰 Precio: Todos ▼]  │
│                                                         │
│  ──────────────────────────────────────────────────────  │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │ 🏠 Mudanza - Apartamento 2 hab                   │    │
│  │ 📍 Panama Centro → 📍 Bella Vista               │    │
│  │ 📦 5 bultos • ~50kg • 🛒 Mudanza             │    │
│  │                                    ┌─────────┐ │    │
│  │                                    │   $150 │ │    │
│  │ 📍 3.2km                          │[Aceptar]│ │    │
│  └────────────────────────────────────┴─────────┘ │    │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │ 📺 Entrega electrodomésticos                            │    │
│  │ 📍 San Miguelito → 📍 Costa del Este          │    │
│  │ 📦 2 paquetes • ~30kg • 🛒 Electrónica        │    │
│  │                                    ┌─────────┐ │    │
│  │                                    │    $80 │ │    │
│  │                                    │[Aceptar]│    │
│  │ 📍 5.8km                          └─────────┘ │    │
│  └──────────────────────────────────────────────┴──┘    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Componente RideCard

```typescript
// frontend/src/components/RideCard.tsx
interface RideCardProps {
  ride: {
    _id: string
    title: string
    type: string
    estimatedPrice: number
    pickupLocation: { address: string }
    dropoffLocation: { address: string }
    packages?: number
    weight?: number
    distance?: number
  }
  onAccept: () => void
}

const TYPE_ICONS: Record<string, string> = {
  mudanza: 'home',
  electrodomesticos: 'kitchen',
  muebles: 'chair',
  productos: 'inventory_2',
  otros: 'category'
}

const TYPE_LABELS: Record<string, string> = {
  mudanza: 'Mudanza',
  electrodomesticos: 'Electrodomésticos',
  muebles: 'Muebles',
  productos: 'Productos',
  otros: 'Otros'
}

export default function RideCard({ ride, onAccept }: RideCardProps) {
  return (
    <div className="card" style={{ transition: 'box-shadow 0.2s' }}>
      <div style={{ display: 'flex', gap: '1rem' }}>
        {/* Info Principal */}
        <div style={{ flex: 1 }}>
          <h3 style={{ marginBottom: '0.5rem' }}>
            <span className="material-symbols-rounded" style={{ 
              verticalAlign: 'middle', 
              marginRight: '0.5rem',
              color: 'var(--secondary)'
            }}>
              {TYPE_ICONS[ride.type] || 'category'}
            </span>
            {ride.title}
          </h3>
          
          <div style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
            <span style={{ color: 'var(--secondary)' }}>📍</span> {ride.pickupLocation.address}
            <span style={{ margin: '0 0.5rem' }}>→</span>
            <span style={{ color: 'var(--primary)' }}>📍</span> {ride.dropoffLocation.address}
          </div>
          
          <div style={{ display: 'flex', gap: '1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {ride.packages && <span>📦 {ride.packages} bultos</span>}
            {ride.weight && <span>⚖️ ~{ride.weight}kg</span>}
            <span>🛒 {TYPE_LABELS[ride.type] || ride.type}</span>
          </div>
        </div>
        
        {/* Precio y Acción */}
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'flex-end',
          justifyContent: 'space-between'
        }}>
          {ride.distance && (
            <span style={{ 
              fontSize: '0.8rem',
              color: 'var(--primary)',
              background: '#ccfbf1',
              padding: '0.25rem 0.5rem',
              borderRadius: 'var(--radius-sm)'
            }}>
              📍 {ride.distance}km
            </span>
          )}
          <p style={{ 
            fontFamily: 'var(--font-mono)',
            fontSize: '1.5rem',
            fontWeight: 700,
            color: 'var(--text-primary)'
          }}>
            ${ride.estimatedPrice}
          </p>
          <button 
            className="btn btn-primary"
            onClick={onAccept}
          >
            Aceptar pedido
          </button>
        </div>
      </div>
    </div>
  )
}
```

---

## 3. Filtros

```typescript
// Agregar en DriverDashboard
const [filters, setFilters] = useState({
  search: '',
  type: '',
  minPrice: '',
  maxPrice: ''
})

// Aplicar filtros en loadRides
const filteredRides = rides.filter(ride => {
  if (filters.search && !ride.title.toLowerCase().includes(filters.search.toLowerCase())) {
    return false
  }
  if (filters.type && ride.type !== filters.type) {
    return false
  }
  if (filters.minPrice && ride.estimatedPrice < parseInt(filters.minPrice)) {
    return false
  }
  if (filters.maxPrice && ride.estimatedPrice > parseInt(filters.maxPrice)) {
    return false
  }
  return true
})
```

---

## 4. Sistema de diseño aplicado

| Elemento | Color | CSS |
|---------|-------|-----|
| Botón "Aceptar" | Turquesa | `--primary: #0D9488` |
| Iconos de tipo | Naranja terracotta | `--secondary: #F97316` |
| Badge distancia | Turquesa claro | `bg: #ccfbf1` |
| Card | Blanco | `--bg-primary: #FFFFFF` |
| Título ride | Negro | `--text-primary: #0F172A` |
| Dirección | Gris | `--text-secondary: #334155` |
| Hover card | shadow-lg | `--shadow-lg` |

---

## 5. Criterios de aceptación

- [ ] Lista de pedidos con cards
- [ ] Información: título, tipo, origen, destino, bultos, peso
- [ ] Badge de distancia (si aplica)
- [ ] Precio en JetBrains Mono
- [ ] Botón "Aceptar pedido" en turquesa
- [ ] Filtros opcionales
- [ ] Hover con shadow

---

## Labels
`Driver` `feature` `frontend`