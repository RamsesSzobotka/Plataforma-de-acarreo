# Issue F1-5: Aceptar Pedido (Negociación)

## Descripción
Implementar función de aceptar pedido desde el lado del conductor con opción de negociar precio.

---

## 1. Wireframe: Modal de Aceptación

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │  ✓ Confirmar aceptación                        │    │
│  ├─────────────────────────────────────────────────┤    │
│  │                                          │    │
│  │  Mudanza - Apartamento 2 hab              │
│  │  📍 Panama Center → Bella Vista           │
│  │                                          │    │
│  │  ─────────────────────────────────────   │    │
│  │                                          │    │
│  │  Precio sugerido: $150                   │
│  │                                          │    │
│  │  ┌────────────────────────────────┐    │    │
│  │  │ Precio acordado: [$150      ]   │    │    │
│  │  └────────────────────────────────┘    │    │
│  │  *Puedes negociar un precio diferente    │    │
│  │                                          │    │
│  │  ─────────────────────────────────────   │    │
│  │                                          │    │
│  │  Al aceptar, te comprometes a realizar   │    │
│  │  el servicio. Puedes cancelar después   │    │
│  │  solo si el cliente no ha confirmado.     │    │
│  │                                          │    │
│  │  ┌──────────────┐  ┌──────────────┐   │    │
│  │  │ Cancelar   │  │ ✓ Aceptar   │   │    │
│  │  │           │  │           │   │    │
│  │  └──────────────┘  └──────────────┘   │    │
│  │                                          │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Backend - Endpoint

```typescript
// backend/src/routes/rides.ts

/**
 * Aceptar un pedido (PATCH /api/rides/:id/accept)
 */
rides.patch('/:id/accept', authMiddleware, requireDriver(), async (c) => {
  const { id } = c.req.param()
  const user = c.get('user')
  const body = await c.req.json()
  
  const { agreedPrice } = body
  
  // 1. Verificar que el ride existe
  const ridesCollection = db.collection('rides')
  const ride = await ridesCollection.findOne({ _id: new ObjectId(id) })
  
  if (!ride) {
    return c.json({ error: 'Ride not found' }, 404)
  }
  
  // 2. Verificar que está en status correcto
  if (ride.status !== 'requested') {
    return c.json({ 
      error: 'Ride no está disponible',
      currentStatus: ride.status,
      message: 'Solo se pueden aceptar pedidos en status "requested"'
    }, 400)
  }
  
  // 3. Verificar que no tenga driver asignado
  if (ride.driverId) {
    return c.json({ error: 'Ride ya fue aceptado por otro conductor' }, 400)
  }
  
  // 4. Verificar precio
  const finalPrice = agreedPrice || ride.estimatedPrice
  
  // 5. Actualizar ride
  await ridesCollection.updateOne(
    { _id: new ObjectId(id) },
    {
      $set: {
        driverId: user.clerkId,
        finalPrice,
        status: 'accepted',
        chatEnabled: true,
        updatedAt: new Date()
      }
    }
  )
  
  // 6. Notificar al cliente (via WebSocket - implementación futura)
  
  return c.json({
    success: true,
    message: 'Pedido aceptado',
    ride: {
      _id: id,
      status: 'accepted',
      finalPrice,
      driverId: user.clerkId
    }
  })
})
```

---

## 3. Frontend - Modal de Aceptación

```typescript
// frontend/src/components/AcceptRideModal.tsx

interface AcceptRideModalProps {
  ride: {
    _id: string
    title: string
    pickupLocation: { address: string }
    dropoffLocation: { address: string }
    estimatedPrice: number
  }
  isOpen: boolean
  onClose: () => void
  onAccept: (agreedPrice: number) => void
}

export default function AcceptRideModal({ 
  ride, 
  isOpen, 
  onClose, 
  onAccept 
}: AcceptRideModalProps) {
  const [price, setPrice] = useState(ride.estimatedPrice)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  if (!isOpen) return null
  
  const handleAccept = async () => {
    setLoading(true)
    setError('')
    
    try {
      const res = await fetch(`/api/rides/${ride._id}/accept`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agreedPrice: price })
      })
      
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error al aceptar')
      }
      
      onAccept(price)
      onClose()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          ✓ Confirmar aceptación
        </h2>
        
        <p style={{ marginTop: '1rem' }}>
          {ride.title}
        </p>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          📍 {ride.pickupLocation.address} → 📍 {ride.dropoffLocation.address}
        </p>
        
        <div style={{ marginTop: '1.5rem' }}>
          <p>Precio sugerido: <strong>${ride.estimatedPrice}</strong></p>
          
          <label style={{ 
            display: 'block', 
            marginTop: '0.75rem',
            marginBottom: '0.25rem'
          }}>
            Precio acordado:
          </label>
          <input
            type="number"
            className="input"
            value={price}
            onChange={(e) => setPrice(parseInt(e.target.value))}
            min={1}
          />
          <small style={{ color: 'var(--text-muted)' }}>
            *Puedes negociar un precio diferente
          </small>
        </div>
        
        <div style={{ 
          marginTop: '1rem', 
          padding: '0.75rem',
          background: 'var(--bg-tertiary)',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.85rem'
        }}>
          <p>ℹ️ Al aceptar, te comprometes a realizar el servicio.</p>
          <p style={{ marginTop: '0.25rem' }}>
            Puedes cancelar después solo si el cliente no ha confirmado.
          </p>
        </div>
        
        {error && (
          <div className="alert alert-error" style={{ marginTop: '1rem' }}>
            {error}
          </div>
        )}
        
        <div style={{ 
          display: 'flex', 
          gap: '0.75rem', 
          marginTop: '1.5rem'
        }}>
          <button 
            className="btn btn-outline" 
            onClick={onClose}
            disabled={loading}
          >
            Cancelar
          </button>
          <button 
            className="btn btn-primary" 
            onClick={handleAccept}
            disabled={loading}
            style={{ flex: 1 }}
          >
            {loading ? 'Aceptando...' : '✓ Aceptar'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

---

## 4. Estilos del Modal

```css
/* Modal overlay */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

/* Modal */
.modal {
  background: var(--bg-primary);
  border-radius: var(--radius);
  padding: 1.5rem;
  max-width: 400px;
  width: 100%;
  box-shadow: var(--shadow-lg);
}

/* Alerts */
.alert-error {
  background: #fef2f2;
  border: 1px solid var(--error);
  color: var(--error);
  padding: 0.75rem;
  border-radius: var(--radius-sm);
}
```

---

## 5. Flujo de uso

```
1. Conductor ve lista de pedidos disponibles
2. Click en "Aceptar pedido" en un ride
3. Se abre modal de confirmación
4. Puede mantener precio o negociar diferente
5. Click en "Aceptar"
6. Backend valida y actualiza status → "accepted"
7. Ride aparece en "Mis Acarreos" del conductor
8. Chat se habilita automáticamente
```

---

## 6. Criterios de aceptación

Backend:
- [ ] Endpoint PATCH /api/:id/accept
- [ ] Valida status === "requested"
- [ ] Verifica que no tenga driver asignado
- [ ] Guarda agreedPrice (si es diferente)
- [ ] Cambia status a "accepted"
- [ ] Habilita chat (chatEnabled: true)

Frontend:
- [ ] Modal de confirmación
- [ ] Input de precio negociable
- [ ] Info del ride mostrada
- [ ] Botones Aceptar/Cancelar
- [ ] Feedback visual de éxito/error
- [ ] Diseño con turquesa

---

## Labels
`Driver` `feature` `backend` `frontend`