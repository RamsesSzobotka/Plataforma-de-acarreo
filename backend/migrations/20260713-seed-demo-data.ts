import type { Connection } from 'mongoose'

const CLIENTS = [
  { clerkId: 'demo_client_1', email: 'maria@email.com', firstName: 'María', lastName: 'García' },
  { clerkId: 'demo_client_2', email: 'carlos@email.com', firstName: 'Carlos', lastName: 'López' },
  { clerkId: 'demo_client_3', email: 'ana@email.com', firstName: 'Ana', lastName: 'Martínez' },
  { clerkId: 'demo_client_4', email: 'jorge@email.com', firstName: 'Jorge', lastName: 'Rodríguez' },
  { clerkId: 'demo_client_5', email: 'laura@email.com', firstName: 'Laura', lastName: 'Hernández' },
]

const DRIVERS = [
  { userId: 'demo_driver_1', email: 'pedro@email.com', firstName: 'Pedro', lastName: 'Sánchez', plate: 'ABC-123', vehicleType: 'camioneta' },
  { userId: 'demo_driver_2', email: 'luis@email.com', firstName: 'Luis', lastName: 'Ramírez', plate: 'DEF-456', vehicleType: 'camion' },
  { userId: 'demo_driver_3', email: 'sofia@email.com', firstName: 'Sofía', lastName: 'Torres', plate: 'GHI-789', vehicleType: 'camioneta' },
  { userId: 'demo_driver_4', email: 'diego@email.com', firstName: 'Diego', lastName: 'Flores', plate: 'JKL-012', vehicleType: 'panel' },
  { userId: 'demo_driver_5', email: 'valeria@email.com', firstName: 'Valeria', lastName: 'Morales', plate: 'MNO-345', vehicleType: 'camion' },
]

const PICKUPS = [
  { address: 'Calle 50, Ciudad de Panamá', lng: -79.5188, lat: 8.9943 },
  { address: 'Vía España, Ciudad de Panamá', lng: -79.5150, lat: 8.9875 },
  { address: 'Albrook, Ciudad de Panamá', lng: -79.5550, lat: 8.9733 },
  { address: 'Tocumen, Panamá', lng: -79.3847, lat: 9.0758 },
  { address: 'San Miguelito, Panamá', lng: -79.5100, lat: 9.0333 },
  { address: 'David, Chiriquí', lng: -82.4300, lat: 8.4333 },
  { address: 'Colón, Panamá', lng: -79.9000, lat: 9.3500 },
  { address: 'Santiago, Veraguas', lng: -80.9773, lat: 8.1075 },
  { address: 'Penonomé, Coclé', lng: -80.3567, lat: 8.5194 },
  { address: 'Chitré, Herrera', lng: -80.4340, lat: 7.9620 },
]

const DROPOFFS = [
  { address: 'Costa del Este, Ciudad de Panamá', lng: -79.4568, lat: 8.9928 },
  { address: 'Paitilla, Ciudad de Panamá', lng: -79.5058, lat: 8.9758 },
  { address: 'El Cangrejo, Ciudad de Panamá', lng: -79.5100, lat: 8.9800 },
  { address: 'Obarrio, Ciudad de Panamá', lng: -79.5080, lat: 8.9880 },
  { address: 'Pueblo Libre, Panamá', lng: -79.5200, lat: 9.0000 },
  { address: 'Boquete, Chiriquí', lng: -82.4500, lat: 8.7500 },
  { address: 'Portobelo, Colón', lng: -79.6833, lat: 9.5500 },
  { address: 'Santa Fe, Veraguas', lng: -81.0750, lat: 8.5083 },
  { address: 'Aguadulce, Coclé', lng: -80.2667, lat: 8.2500 },
  { address: 'Parita, Herrera', lng: -80.5167, lat: 7.9833 },
]

const TYPES = ['mudanza', 'electrodomesticos', 'muebles', 'productos', 'otros'] as const
const STATUSES = ['paid', 'completed', 'cancelled'] as const

export async function up(db: Connection): Promise<void> {
  const mongoDb = db.db
  if (!mongoDb) throw new Error('Database connection is not available')

  // Check if demo data already exists
  const existingRides = await mongoDb.collection('rides').countDocuments({ demo: true })
  if (existingRides > 0) {
    console.log('📦 Datos demo ya existen — saltando migración')
    return
  }

  const now = new Date()
  const userIds = CLIENTS.map(c => c.clerkId)
  const driverIds = DRIVERS.map(d => d.userId)
  const allUserIds = [...userIds, ...driverIds]

  // ── Insert demo users ──────────────────────────────────────────
  const users: any[] = []
  for (const c of CLIENTS) {
    users.push({
      clerkId: c.clerkId,
      email: c.email,
      firstName: c.firstName,
      lastName: c.lastName,
      role: 'client',
      isActive: true,
      createdAt: new Date(now.getFullYear() - 5, 0, 1),
      updatedAt: new Date(now.getFullYear() - 5, 0, 1),
    })
  }
  for (const d of DRIVERS) {
    users.push({
      clerkId: d.userId,
      email: d.email,
      firstName: d.firstName,
      lastName: d.lastName,
      role: 'driver',
      isActive: true,
      createdAt: new Date(now.getFullYear() - 5, 0, 1),
      updatedAt: new Date(now.getFullYear() - 5, 0, 1),
    })
  }

  // Clear previous demo data if it exists from a reset
  for (const id of allUserIds) {
    await mongoDb.collection('users').deleteOne({ clerkId: id })
  }
  await mongoDb.collection('users').insertMany(users)
  console.log(`✅ ${users.length} usuarios demo insertados`)

  // ── Insert demo drivers ────────────────────────────────────────
  const drivers: any[] = DRIVERS.map(d => ({
    userId: d.userId,
    vehicleType: d.vehicleType,
    plate: d.plate,
    capacityKg: 500 + Math.floor(Math.random() * 2000),
    phone: `+507 6${String(Math.floor(10000000 + Math.random() * 9000000)).slice(0, 8)}`,
    verificationStatus: 'verified',
    isAvailable: true,
    rating: 4.0 + Math.random(),
    totalRides: 0,
  }))
  for (const d of drivers) {
    await mongoDb.collection('drivers').deleteOne({ userId: d.userId })
  }
  await mongoDb.collection('drivers').insertMany(drivers)
  console.log(`✅ ${drivers.length} conductores demo insertados`)

  // ── Generate 60 months of rides ────────────────────────────────
  const rides: any[] = []
  const ratings: any[] = []
  let rideCounter = 0

  for (let monthOffset = 59; monthOffset >= 0; monthOffset--) {
    const baseDate = new Date(now.getFullYear(), now.getMonth() - monthOffset, 1)

    // More rides and higher revenue in recent months — growth trend
    const growthFactor = (60 - monthOffset) / 60 // 0 → 1
    const ridesThisMonth = Math.floor(2 + growthFactor * 4 + Math.random() * 2) // 2-8 rides
    const basePrice = 30 + growthFactor * 70 + Math.random() * 50 // grows $30→$150 avg

    for (let r = 0; r < ridesThisMonth; r++) {
      const clientId = userIds[Math.floor(Math.random() * userIds.length)]
      const driverId = driverIds[Math.floor(Math.random() * driverIds.length)]
      const pickupIdx = Math.floor(Math.random() * PICKUPS.length)
      const dropoffIdx = Math.floor(Math.random() * DROPOFFS.length)
      const typeIdx = Math.floor(Math.random() * TYPES.length)

      // Random day in month
      const daysInMonth = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0).getDate()
      const day = 1 + Math.floor(Math.random() * daysInMonth)
      const createdAt = new Date(baseDate.getFullYear(), baseDate.getMonth(), day,
        6 + Math.floor(Math.random() * 14), Math.floor(Math.random() * 60))

      const finalPrice = Math.round((basePrice + Math.random() * 80) * 100) / 100
      const platformFee = Math.round(finalPrice * 0.10 * 100) / 100
      const driverAmount = Math.round((finalPrice - platformFee) * 100) / 100

      // Random status weighted toward paid
      const statusRoll = Math.random()
      const status: string = statusRoll < 0.6 ? 'paid' : statusRoll < 0.85 ? 'completed' : 'cancelled'

      const ride: any = {
        demo: true,
        clientId,
        driverId: status !== 'cancelled' ? driverId : undefined,
        title: `Acarreo ${TYPES[typeIdx]} #${++rideCounter}`,
        description: `Servicio de acarreo de ${TYPES[typeIdx]} desde ${PICKUPS[pickupIdx].address} hasta ${DROPOFFS[dropoffIdx].address}`,
        type: TYPES[typeIdx],
        images: [{ url: 'https://res.cloudinary.com/demo/image/upload/v1/demo/cargo.jpg', publicId: 'demo/cargo' }],
        pickupLocation: {
          address: PICKUPS[pickupIdx].address,
          type: 'Point',
          coordinates: [PICKUPS[pickupIdx].lng, PICKUPS[pickupIdx].lat],
        },
        dropoffLocation: {
          address: DROPOFFS[dropoffIdx].address,
          type: 'Point',
          coordinates: [DROPOFFS[dropoffIdx].lng, DROPOFFS[dropoffIdx].lat],
        },
        estimatedPrice: finalPrice,
        finalPrice: status !== 'cancelled' ? finalPrice : undefined,
        packages: 1 + Math.floor(Math.random() * 10),
        status,
        createdAt,
        updatedAt: createdAt,
      }

      if (status === 'paid') {
        ride.paidAt = new Date(createdAt.getTime() + 3600000 * (2 + Math.floor(Math.random() * 48)))
        ride.platformFee = platformFee
        ride.driverAmount = driverAmount
        ride.paymentIntentId = `pi_demo_${rideCounter}`
      }

      rides.push(ride)

      // Generate ratings for paid rides (both client→driver and driver→client)
      if (status === 'paid') {
        ratings.push({
          rideId: `demo_ride_${rideCounter}`,
          raterId: clientId,
          ratedId: driverId,
          role: 'driver',
          rating: 3 + Math.floor(Math.random() * 3),
          comment: ['Buen servicio', 'Llegó a tiempo', 'Excelente', 'Muy profesional', 'Todo bien'][Math.floor(Math.random() * 5)],
          createdAt: new Date(ride.paidAt!.getTime() + 3600000),
        })
        ratings.push({
          rideId: `demo_ride_${rideCounter}`,
          raterId: driverId,
          ratedId: clientId,
          role: 'client',
          rating: 3 + Math.floor(Math.random() * 3),
          comment: undefined,
          createdAt: new Date(ride.paidAt!.getTime() + 3600000),
        })
      }

      // Assign _id for reference
      ride._id = `demo_ride_${rideCounter}`
    }
  }

  // Insert rides in batches to avoid huge single inserts
  const BATCH = 50
  for (let i = 0; i < rides.length; i += BATCH) {
    await mongoDb.collection('rides').insertMany(rides.slice(i, i + BATCH))
  }
  console.log(`✅ ${rides.length} acarreos demo insertados (60 meses)`)

  // ── Insert ratings ─────────────────────────────────────────────
  if (ratings.length > 0) {
    await mongoDb.collection('ratings').insertMany(ratings)
    console.log(`✅ ${ratings.length} calificaciones demo insertadas`)
  }

  console.log('🎉 Datos demo listos — las gráficas ya muestran tendencias')
}

export async function down(db: Connection): Promise<void> {
  const mongoDb = db.db
  if (!mongoDb) throw new Error('Database connection is not available')

  // Remove demo data only (not real user data)
  const demoUserIds = [...CLIENTS.map(c => c.clerkId), ...DRIVERS.map(d => d.userId)]
  for (const id of demoUserIds) {
    await mongoDb.collection('users').deleteOne({ clerkId: id })
  }
  for (const d of DRIVERS) {
    await mongoDb.collection('drivers').deleteOne({ userId: d.userId })
  }
  await mongoDb.collection('rides').deleteMany({ demo: true })
  await mongoDb.collection('ratings').deleteMany({ rideId: { $regex: /^demo_ride_/ } })

  console.log('⏪ Datos demo eliminados')
}
