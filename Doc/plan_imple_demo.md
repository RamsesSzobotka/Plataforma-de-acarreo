# Plan: Demostración / Boceto - Flujo Básico Cliente-Conductor

**Objetivo**: Tener un demo funcional para presentación con el flujo mínimo viable.  
**Fecha**: --/--/2026  
**Usuario**: --

---

## 📊 Estado Actual del Proyecto

| Paso | Estado | Componente | Notas |
|------|--------|-----------|--------|
| 1. Cliente sube pedido | ✅ HECHO | CreateRide.tsx + backend POST /rides | Funcional |
| 2. Conductor ve pedido | ✅ HECHO | DriverDashboard.tsx con geolocalización | Lista coordenadas |
| 3. Conductor acepta | ✅ HECHO | backend accept + frontend | Funcional |
| 4. Cliente ve aceptación | ⚠️ PARCIAL | RideDetails.tsx - polling 2s | Faltan datos del conductor |
| 5. Cliente paga | ❌ FALTA | payments.ts TODO | Solo comentario, no funcional |

---

## 🎯 Scope: Demostración Mínima

### Flujo a demostrar:

```
1. Cliente crea pedido (ya funciona)
       ↓
2. Conductor ve pedidos cercanos (ya funciona)
       ↓
3. Conductor acepta pedido (ya funciona)
       ↓
4. Cliente ve aceptación + datos conductor (A IMPLEMENTAR)
       ↓
5. Cliente paga (PAGO SIMULADO - luego se conecta Stripe real)
       ↓
6. Confirmación visual (A IMPLEMENTAR)
```

---

## 📋 Tasks de Implementación

### [FASE 1] Mostrar datos del conductor en aceptación

| # | Task | Archivo | Esfuerzo | Estado |
|----|------|--------|----------|--------|
| 1.1 | Agregar endpoint GET /rides/:id devuelve datos del driver | backend/src/routes/rides.ts | Bajo | ❌ |
| 1.2 | API: get() devuelve anche `driver` object | frontend/src/services/api.ts | Bajo | ⚠️ |
| 1.3 | RideDetails muestra nombre/foto del conductor | frontend/src/pages/RideDetails.tsx | Bajo | ❌ |

### [FASE 2] Refresh automático + feedback

| # | Task | Archivo | Esfuerzo | Estado |
|----|------|--------|----------|--------|
| 2.1 | Polling cada 3s en RideDetails | frontend/src/pages/RideDetails.tsx | Bajo | ⚠️已有的 |
| 2.2 | Notificación visual "conductor aceptó" | frontend/src/pages/RideDetails.tsx | Bajo | ❌ |
| 2.3 | Botón "Ver perfil conductor" | frontend/src/pages/RideDetails.tsx | Bajo | ❌ |

### [FASE 3] Pago básico (simulado)

| # | Task | Archivo | Esfuerzo | Estado |
|----|------|--------|----------|--------|
| 3.1 | Backend: POST /payments/confirm actualiza estado a "paid" | backend/src/routes/payments.ts | Bajo | ❌ |
| 3.2 | Frontend: botón "Pagar" con estimado | frontend/src/pages/RideDetails.tsx | Bajo | ❌ |
| 3.3 | Frontend UI: loading state mientras procesa | frontend/src/pages/RideDetails.tsx | Bajo | ❌ |
| 3.4 | On success: actualizar UI + estado "pagado" | frontend/src/pages/RideDetails.tsx | Bajo | ❌ |

### [FASE 4] (opcional) Stripe real

| # | Task | Estado |
|----|------|--------|
| 4.1 | Integrar Stripe SDK real | ❌ |
| 4.2 | Crear PaymentIntent backend | ❌ |
| 4.3 | Frontend Elements para cartão | ❌ |

**Nota**: La fase 4 es para después del demo. Por ahora usamos pago simulado.

---

## 🛠️ Detalle de Implementación

### Task 1.1: Backend - GET /rides/:id con datos del driver

```typescript
// backend/src/routes/rides.ts - endpoint GET /:id ya existe
// Solo hay que agregar la búsqueda del driver cuando hay driverId

rides.get('/:id', async (c) => {
  // ...código existente...
  
  // Agregar: si hay driverId, buscar datos del driver
  let driver = null
  if (ride.driverId) {
    driver = await Driver.findOne({ userId: ride.driverId })
  }
  
  return c.json({
    success: true,
    ride: ride.toObject(),
    driver: driver ? {
      firstName: driver.firstName,
      lastName: driver.lastName,
      imageUrl: driver.imageUrl,
      rating: driver.rating,
      vehicleType: driver.vehicleType,
    } : null
  })
})
```

### Task 1.2: Frontend API - get() devuelve driver

```typescript
// frontend/src/services/api.ts - ya existe get()
// Solo asegurar que devuelve { ride, driver }

export const ridesAPI = {
  get: async (id: string) => {
    // Ya devuelve el ride, agregar tipado
    const response = await fetchAPI<{ success: boolean; ride: Ride; driver?: any }>(...)
    return response
  }
}
```

### Task 1.3: RideDetails - Mostrar conductor

```tsx
// frontend/src/pages/RideDetails.tsx

// En el render, agregar después de status === 'accepted':
{ride?.driverId && (
  <div className="driver-card">
    <h3>Conductor asignado</h3>
    <p>{ride.driver?.firstName} {ride.driver?.lastName}</p>
    <p>⭐ {ride.driver?.rating}</p>
    <p>🚗 {ride.driver?.vehicleType}</p>
  </div>
)}
```

### Task 3.1: Backend - Pago simulado

```typescript
// backend/src/routes/payments.ts

payments.post('/confirm', async (c) => {
  const { rideId } = await c.req.json()
  
  // Validar ride existe
  const ride = await Ride.findById(rideId)
  if (!ride) {
    return c.json({ error: 'Ride no encontrado' }, 404)
  }
  
  // Validar estado permite pago (solo 'completed')
  if (ride.status !== 'completed') {
    return c.json({ error: 'Ride debe estar en estado completed para pagar' }, 400)
  }
  
  // SIMULADO: solo actualizar estado (luego validar con Stripe)
  const updated = await Ride.findByIdAndUpdate(
    rideId,
    { status: 'paid', updatedAt: new Date() },
    { new: true }
  )
  
  return c.json({
    success: true,
    ride: updated,
    message: 'Pago confirmado'
  })
})
```

### Task 3.2-3.4: Frontend - UI de pago

```tsx
// frontend/src/pages/RideDetails.tsx

// Agregar estado
const [paying, setPaying] = useState(false)

// Función handlePayment
async function handlePayment() {
  setPaying(true)
  try {
    const updated = await ridesAPI.pay(ride!._id)
    setRide(updated)
  } catch (err) {
    alert('Error al procesar pago')
  } finally {
    setPaying(false)
  }
}

// En el render, botón cuando status === 'completed':
{ride?.status === 'completed' && (
  <button 
    onClick={handlePayment}
    disabled={paying}
    className="btn btn-primary"
  >
    {paying ? 'Procesando...' : `Pagar $${ride.finalPrice}`}
  </button>
)}

// Cuando status === 'paid':
{ride?.status === 'paid' && (
  <div className="success-banner">
    ✅ Pago confirmado - Gracias por usar Plataforma de Acarreos
  </div>
)}
```

---

## 📦 Entregables

Al final de la implementación, el demo tener:

✅ **Cliente puede**:
- Crear pedido con descripción, fotos, direcciones, precio
- Ver sus pedidos en lista
- Ver detalle del pedido
- Ver cuando conductor aceptó (con datos del conductor)
- Ver botón "Pagar" cuando estado = completed
- Confirmar pago (simulado)
- Ver estado "pagado"

✅ **Conductor puede**:
- Ver pedidos cercanos por distancia
- Aceptar pedido
- Iniciar viaje
- Subir foto de entrega

---

## 🚀 Orden de Implementación Sugerido

```
DÍA 1 (2-3 horas):
├── [1.1] Backend - Ride con driver
├── [1.2] Frontend API - driver en response
├── [1.3] RideDetails - Mostrar conductor
└── [2.1] Probar手动
    │
DÍA 2 (2-3 horas):
├── [3.1] Backend - Pago simulado
├── [3.2] Frontend - Botón pagar
├── [3.3] Frontend - Loading state
├── [3.4] Frontend - Success state
└── [TEST] Demo completo
```

---

## 🔧 Dependencias técnicas

| Paquete | Versión | Uso |
|---------|--------|-----|
| @stripe/stripe-js | ^2.0.0 | Frontend - cargar Stripe |
| stripe | ^14.0.0 | Backend - procesar pagos |

---

## 📝 Notas

- El modo "pago simulado" tiene un comentario claro: `// TODO: Conectar Stripe real antes de producción`
- Los datos del conductor se leen del modelo User/Driver de MongoDB
- El flujo completo: ~100 líneas de código nuevo

---

## ⚡预估 Tiempo

| Fase | Tiempo |
|------|--------|
| [1.1-1.2] Backend + API | 30 min |
| [1.3-2.1] Frontend | 45 min |
| [3.1-3.4] Pago | 45 min |
| **Total** | **~2 horas** |

---

*Documento creado para el demo/boceto - se actualiza mientras se implementa*