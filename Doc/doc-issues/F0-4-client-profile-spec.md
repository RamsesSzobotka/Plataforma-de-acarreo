# Issue F0-4: Ver Perfil del Cliente

## Descripción
Habilitar visualización del perfil del cliente por parte del conductor antes de aceptar un pedido.

---

## 1. Ubicación de archivos

### Archivos a modificar
```
backend/src/routes/users.ts      # Endpoint existente
frontend/src/pages/RideDetails.tsx  # Mostrar perfil
```

---

## 2. Backend - Endpoint

### GET /api/users/:clerkId

El endpoint ya existe. Asegurar que retorna:

```typescript
// backend/src/routes/users.ts
users.get('/:clerkId', async (c) => {
  const { clerkId } = c.req.param()
  
  const user = await db.collection('users').findOne({ clerkId })
  
  if (!user) {
    return c.json({ error: 'User not found' }, 404)
  }
  
  // Calcular rating promedio
  const ratings = await db.collection('ratings')
    .find({ ratedId: clerkId })
    .toArray()
  
  const avgRating = ratings.length > 0
    ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
    : 0
  
  // Contar rides completados
  const totalRides = await db.collection('rides')
    .countDocuments({ 
      $or: [
        { clientId: clerkId, status: { $in: ['completed', 'paid'] } },
        { driverId: clerkId, status: { $in: ['completed', 'paid'] } }
      ]
    })
  
  return c.json({
    data: {
      clerkId: user.clerkId,
      firstName: user.firstName,
      lastName: user.lastName,
      imageUrl: user.imageUrl,
      rating: Math.round(avgRating * 10) / 10,
      totalRatings: ratings.length,
      totalRides,
      memberSince: user.createdAt
    }
  })
})
```

---

## 3. Frontend - Componente

### RideDetails.tsx - Agregar perfil del cliente

```typescript
// frontend/src/pages/RideDetails.tsx
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

interface Client {
  clerkId: string
  firstName: string
  lastName: string
  imageUrl?: string
  rating: number
  totalRatings: number
  totalRides: number
}

function ClientProfile({ clientId }: { clientId: string }) {
  const [client, setClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    fetch(`/api/users/${clientId}`)
      .then(res => res.json())
      .then(data => setClient(data.data))
      .finally(() => setLoading(false))
  }, [clientId])
  
  if (loading) return <div>Cargando perfil...</div>
  if (!client) return null
  
  return (
    <div className="card" style={{ marginTop: '1rem' }}>
      <h3 style={{ marginBottom: '1rem' }}>Cliente</h3>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {client.imageUrl ? (
          <img 
            src={client.imageUrl} 
            alt={client.firstName}
            style={{ 
              width: 64, 
              height: 64, 
              borderRadius: '50%',
              objectFit: 'cover'
            }}
          />
        ) : (
          <div style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'var(--bg-tertiary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <span className="material-symbols-rounded" style={{ fontSize: 32 }}>
              person
            </span>
          </div>
        )}
        <div>
          <p style={{ fontWeight: 600, fontSize: '1.1rem' }}>
            {client.firstName} {client.lastName}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="material-symbols-rounded" style={{ color: 'var(--warning)' }}>
              star
            </span>
            <span>
              {client.rating > 0 
                ? `${client.rating}/5 (${client.totalRatings} calificaciones)`
                : 'Sin calificaciones'}
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {client.totalRides} acarreos completados
          </p>
        </div>
      </div>
    </div>
  )
}
```

---

## 4. Criterios de aceptación

Backend:
- [ ] GET /api/users/:clerkId retorna firstName, lastName, imageUrl
- [ ] Incluye rating promedio
- [ ] Incluye total de rides completados

Frontend:
- [ ] Cliente puede ver perfil del cliente en RideDetails
- [ ] Muestra foto o iniciales
- [ ] Muestra rating si existe
- [ ] Muestra total de rides
- [ ] Diseño con turquesa

---

## Labels
`Driver` `Auth` `backend` `frontend`