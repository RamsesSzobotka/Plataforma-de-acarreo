# Issue F1-3: Historial de Acarreos del Conductor

## Descripción
Mostrar historial de acarreos del conductor (aceptados, en progreso, completados).

---

## 1. Wireframe: Mis Acarreos

```
┌─────────────────────────────────────────────────────────┐
│  Panel del Conductor                    [Perfil 🔔]         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌────────────────────────┐ ┌────────────────────────┐  │
│  │ 📍 Pedidos Cercanos │ │ 🚛 Mis Acarreos    │  │
│  │ (12)               │ │ (5) ✓              │  │
│  └────────────────────────┘ └────────────────────────┘  │
│                                                         │
│  ──────────────────────────────────────────────────────  │
│  Filtros: [En curso ▼] [Completados] [Todos]              │
│  ──────────────────────────────────────────────────────  │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │ ✅ Entrega completada                            │    │
│  │ 👤 Empresa XYZ                                  │    │
│  │ 📍 Panama Centro → 📍 Costa del Este          │    │
│  │ 💰 $200 • 📦 10 bultos                          │    │
│  │ ⭐ Calificación pendiente                       │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │ 🚛 En proceso                                  │    │
│  │ 👤 Juan Pérez                                  │    │
│  │ 📍 San Miguelito → 📍 Bella Vista             │    │
│  │ 📍 Ubicación actual: ...                       │    │
│  │ 💰 $120 • 📦 3 bultos                         │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │ ⏳ Aceptado                                    │    │
│  │ 👤 Maria Garcia                                │    │
│  │ 📍 Casa de máquinas → 📍 Deposito Central    │    │
│  │ 💰 $80 • 📦 1 equipo                         │    │
│  │ [Iniciar viaje]  [Cancelar]                    │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Estados visuales

| Estado | Badge Color | Icono |
|-------|-----------|------|
| `accepted` | Naranja (#F97316) | ⏳ |
| `in_progress` | Turquesa (#0D9488) | 🚛 |
| `completed` | Verde (#22C55E) | ✅ |
| `paid` | Verde (#22C55E) | 💵 |
| `cancelled` | Rojo (#EF4444) | ❌ |

---

## 3.Componente MyRideCard

```typescript
// frontend/src/components/MyRideCard.tsx

interface MyRideCardProps {
  ride: {
    _id: string
    title: string
    status: 'accepted' | 'in_progress' | 'completed' | 'paid' | 'cancelled'
    clientId: string
    clientName?: string
    estimatedPrice: number
    finalPrice?: number
    pickupLocation: { address: string }
    dropoffLocation: { address: string }
    packages?: number
    createdAt: string
  }
  onStart?: () => void
  onCancel?: () => void
  onViewDetails?: () => void
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  accepted: { label: 'Aceptado', color: '#F97316', icon: '⏳' },
  in_progress: { label: 'En camino', color: '#0D9488', icon: '🚛' },
  completed: { label: 'Completado', color: '#22C55E', icon: '✅' },
  paid: { label: 'Pagado', color: '#22C55E', icon: '💵' },
  cancelled: { label: 'Cancelado', color: '#EF4444', icon: '❌' }
}

export default function MyRideCard({ ride, onStart, onCancel, onViewDetails }: MyRideCardProps) {
  const status = STATUS_CONFIG[ride.status] || { label: ride.status, color: '#64748B', icon: '?' }
  const price = ride.finalPrice || ride.estimatedPrice
  
  return (
    <div 
      className="card" 
      onClick={onViewDetails}
      style={{ cursor: onViewDetails ? 'pointer' : 'default' }}
    >
      {/* Header con estado */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between',
        marginBottom: '0.75rem'
      }}>
        <span style={{ 
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.25rem 0.75rem',
          borderRadius: '999px',
          background: status.color,
          color: 'white',
          fontSize: '0.85rem',
          fontWeight: 600
        }}>
          {status.icon} {status.label}
        </span>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          {new Date(ride.createdAt).toLocaleDateString()}
        </span>
      </div>
      
      {/* Título y cliente */}
      <h3 style={{ marginBottom: '0.25rem' }}>
        {ride.title}
      </h3>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
        👤 {ride.clientName || 'Cliente'}
      </p>
      
      {/* Ruta */}
      <div style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
        <span>📍</span> {ride.pickupLocation.address}
        <span style={{ margin: '0 0.5rem' }}>→</span>
        <span>📍</span> {ride.dropoffLocation.address}
      </div>
      
      {/* Precio y bultos */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: '0.75rem',
        paddingTop: '0.75rem',
        borderTop: '1px solid var(--border)'
      }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
          ${price}
        </span>
        {ride.packages && <span>📦 {ride.packages} bultos</span>}
      </div>
      
      {/* Acciones según estado */}
      {ride.status === 'accepted' && (
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
          <button className="btn btn-primary" onClick={onStart}>
            Iniciar viaje
          </button>
          <button className="btn btn-outline" onClick={onCancel} style={{ color: 'var(--error)' }}>
            Cancelar
          </button>
        </div>
      )}
    </div>
  )
}
```

---

## 4. Filtros de estado

```typescript
const [statusFilter, setStatusFilter] = useState<string>('all')

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'accepted', label: 'Pendientes' },
  { value: 'in_progress', label: 'En curso' },
  { value: 'completed', label: 'Completados' },
]

const displayedRides = useMemo(() => {
  if (statusFilter === 'all') return myRides
  if (statusFilter === 'accepted') {
    return myRides.filter(r => r.status === 'accepted')
  }
  return myRides.filter(r => r.status === statusFilter)
}, [myRides, statusFilter])
```

---

## 5. Criterios de aceptación

- [ ] Lista de mis pedidos aceptados
- [ ] Badge de estado con color correcto
- [ ]Mostrar nombre del cliente
- [ ] Acciones: "Iniciar viaje", "Cancelar" en estado accepted
- [ ] Filtros por estado
- [ ] Diseño consistente con turquesa

---

## Labels
`Driver` `feature` `frontend`