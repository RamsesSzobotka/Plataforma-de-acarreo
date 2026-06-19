# ISSUE-001: `clientName` / `driverName` nunca se poblan en `list_my_rides`

| Campo | Valor |
|-------|-------|
| **ID** | ISSUE-001 |
| **Tool** | `list_my_rides` |
| **Archivo handler** | `src/tools/list-my-rides.ts` |
| **Archivo backend** | `backend/src/routes/rides.ts` (GET /) |
| **Severidad** | Baja |
| **Estado** | ⏳ Pendiente |

## Descripción

La tool `list_my_rides` mapea los campos `clientName` y `driverName` en su respuesta (`list-my-rides.ts:36-37`), pero el backend (`rides.ts:53-86`) nunca los retorna.

El backend hace un `Ride.find()` simple sin ningún `.populate()` ni lookup a la colección `users`. El modelo `Ride` solo tiene los campos `clientId` y `driverId` (strings), no `clientName` ni `driverName`.

## Impacto

- La respuesta de la tool **nunca incluirá** `clientName` ni `driverName`
- El spec en `docs/ClientsTool.md` contempla estos campos como opcionales
- No hay crash ni error — los campos simplemente se omiten en la respuesta JSON

## Soluciones Propuestas

### Opción A — Populate en el backend (recomendada)
Modificar `GET /` en `backend/src/routes/rides.ts` para hacer un lookup de usuarios y retornar los nombres:

```typescript
// Enriquecer ridesList con nombres de usuario
const { User } = await import('../models/user')
const enriched = await Promise.all(
  ridesList.map(async (ride) => {
    const rideObj = ride.toObject ? ride.toObject() : ride
    const client = rideObj.clientId
      ? await User.findOne({ clerkId: rideObj.clientId }).select('firstName lastName').lean()
      : null
    const driver = rideObj.driverId
      ? await User.findOne({ clerkId: rideObj.driverId }).select('firstName lastName').lean()
      : null
    return {
      ...rideObj,
      clientName: client ? `${client.firstName} ${client.lastName}`.trim() : undefined,
      driverName: driver ? `${driver.firstName} ${driver.lastName}`.trim() : undefined,
    }
  })
)
```

### Opción B — Eliminar del MCP
Quitar `clientName` y `driverName` del `RideSummary` en `src/types.ts` y de la respuesta de la tool en `src/tools/list-my-rides.ts`.

## Notas Adicionales

- Este issue aplica solo a `list_my_rides`. La tool `get_ride_details` también podría tener el mismo problema si mapea nombres de usuario desde el backend.
- Se descubrió durante code review de la implementación inicial.
