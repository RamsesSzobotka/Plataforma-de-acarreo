import { Hono } from 'hono/tiny'
import { User } from '../models/user'
import { Driver } from '../models/driver'
import { authMiddleware, requireRole } from '../middleware'
import type { AuthUser } from '../middleware'

const users = new Hono()

// === DOCUMENTOS OBLIGATORIOS REQUERIDOS ===
const REQUIRED_DOCS = [
  'vehicleImages',
  'licenseType',
  'licenseImage',
  'cedulaFront',
  'cedulaBack',
  'ruvDocument',
  'plateImage',
  'insurancePolicy',
  'phone',
]

// Validar documentos requeridos
function validateRequiredDocs(data: any): string[] {
  const missing: string[] = []
  for (const doc of REQUIRED_DOCS) {
    if (!data[doc]) {
      missing.push(doc)
    }
  }
  // vehicleImages debe tener al menos 1
  if (!data.vehicleImages || !Array.isArray(data.vehicleImages) || data.vehicleImages.length < 1) {
    missing.push('vehicleImages (minimo 1)')
  }
  return missing
}

// === ENDPOINTS ===

// Listar usuarios (solo admin)
users.get('/', authMiddleware, requireRole(['admin']), async (c) => {
  const role = c.req.query('role')
  const query = role ? { role } : {}
  
  const usersList = await User.find(query).sort({ createdAt: -1 })
  return c.json({ data: usersList })
})

// Obtener usuario por ID de Clerk
users.get('/:clerkId', async (c) => {
  const clerkId = c.req.param('clerkId')
  const user = await User.findOne({ clerkId })
  
  if (!user) {
    return c.json({ error: 'Usuario no encontrado' }, 404)
  }
  
  return c.json(user)
})

// Crear/actualizar usuario (desde webhook de Clerk)
users.post('/', async (c) => {
  const body = await c.req.json()
  
  const user = await User.findOneAndUpdate(
    { clerkId: body.clerkId },
    { ...body, updatedAt: new Date() },
    { upsert: true, new: true }
  )
  
  return c.json(user)
})

// Registrar como driver - CON DOCUMENTOS REQUERIDOS
users.post('/register-driver', authMiddleware, async (c) => {
  const currentUser = c.get('user') as AuthUser
  const body = await c.req.json()
  
  // Verificar que el usuario existe
  const user = await User.findOne({ clerkId: currentUser.clerkId })
  if (!user) {
    return c.json({ error: 'Usuario no encontrado' }, 404)
  }
  
  // Verificar que no es driver ya
  if (user.role === 'driver') {
    const existingDriver = await Driver.findOne({ userId: currentUser.clerkId })
    if (existingDriver) {
      return c.json({ error: 'Ya eres conductor registrado. Edita tu perfil si necesitas actualizar documentos.' }, 400)
    }
  }
  
  // Validar documentos requeridos
  const missingDocs = validateRequiredDocs(body)
  if (missingDocs.length > 0) {
    return c.json({ 
      error: 'Documentos requeridos faltantes',
      missing: missingDocs 
    }, 400)
  }
  
  // Validar vehicleType
  const validTypes = ['camioneta', 'camion', 'furgon', 'grua', 'otro']
  if (!body.vehicleType || !validTypes.includes(body.vehicleType)) {
    return c.json({ error: `vehicleType debe ser uno de: ${validTypes.join(', ')}` }, 400)
  }
  
  // Validar capacidad
  if (!body.capacityKg || body.capacityKg < 1 || body.capacityKg > 50000) {
    return c.json({ error: 'capacityKg debe estar entre 1 y 50000' }, 400)
  }
  
  // Normalizar placa
  const normalizedPlate = body.plate.toUpperCase().replace(/\s+/g, '').replace(/([A-Z]{3})([0-9]{4})/, '$1-$2')
  const plateRegex = /^[A-Z]{3}-?[0-9]{3,4}$/
  if (!plateRegex.test(normalizedPlate)) {
    return c.json({ error: 'Formato de placa invalido. Ejemplo: ABC-1234' }, 400)
  }
  
  // Verificar placa único
  const existingPlate = await Driver.findOne({ plate: normalizedPlate })
  if (existingPlate) {
    return c.json({ error: 'Ya existe un conductor con esta placa' }, 400)
  }
  
  // Actualizar rol
  await User.findOneAndUpdate(
    { clerkId: currentUser.clerkId },
    { role: 'driver', updatedAt: new Date() }
  )
  
  // Crear driver con documents
  const driver = await Driver.findOneAndUpdate(
    { userId: currentUser.clerkId },
    {
      // Info básica
      vehicleType: body.vehicleType,
      plate: normalizedPlate,
      capacityKg: body.capacityKg,
      
      // Docs obligatorios
      vehicleImages: body.vehicleImages,
      licenseType: body.licenseType,
      licenseImage: body.licenseImage,
      cedulaFront: body.cedulaFront,
      cedulaBack: body.cedulaBack,
      ruvDocument: body.ruvDocument,
      plateImage: body.plateImage,
      insurancePolicy: body.insurancePolicy,
      
      // Docs opcionales
      carneBlanco: body.carneBlanco || undefined,
      carneVerde: body.carneVerde || undefined,
      carneTransporteCarga: body.carneTransporteCarga || undefined,
      fumigationCertificate: body.fumigationCertificate || undefined,
      
      // Contacto
      phone: body.phone,
      
      // Verificación
      verificationStatus: 'pending',
      isAvailable: false,
      rating: 0,
      totalRides: 0,
      
      updatedAt: new Date()
    },
    { upsert: true, new: true }
  )
  
  return c.json({
    success: true,
    message: 'Registro enviado para verificación',
    driver: {
      _id: driver._id,
      verificationStatus: driver.verificationStatus,
      vehicleType: driver.vehicleType,
      plate: driver.plate,
    }
  })
})

// Obtener mi perfil de conductor
users.get('/driver/me', authMiddleware, async (c) => {
  const currentUser = c.get('user') as AuthUser
  
  const driver = await Driver.findOne({ userId: currentUser.clerkId })
  if (!driver) {
    return c.json({ error: 'Driver no encontrado. Primero regístrate como conductor.' }, 404)
  }
  
  const user = await User.findOne({ clerkId: currentUser.clerkId })
  
  return c.json({
    ...driver.toObject(),
    user: user ? {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      imageUrl: user.imageUrl,
    } : null
  })
})

// Obtener perfil de driver (otros usuarios)
users.get('/driver/:userId', async (c) => {
  const userId = c.req.param('userId')
  
  const driver = await Driver.findOne({ userId })
  if (!driver) {
    return c.json({ error: 'Driver no encontrado' }, 404)
  }
  
  const user = await User.findOne({ clerkId: userId })
  
  return c.json({
    ...driver.toObject(),
    user: user ? {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      imageUrl: user.imageUrl,
    } : null
  })
})

// Actualizar perfil de driver
users.patch('/driver/profile', authMiddleware, async (c) => {
  const currentUser = c.get('user') as AuthUser
  const body = await c.req.json()
  
  const driver = await Driver.findOne({ userId: currentUser.clerkId })
  if (!driver) {
    return c.json({ error: 'Driver no encontrado. Regístrate primero.' }, 404)
  }
  
  // No puede editar si está verificado (solo admin puede)
  if (driver.verificationStatus === 'verified') {
    return c.json({ error: 'Tu cuenta ya está verificada. Contacta al admin para editar.' }, 400)
  }
  
  // Preparar updates
  const updateData: any = { updatedAt: new Date() }
  
  // Campos que pueden actualizar
  if (body.vehicleType) updateData.vehicleType = body.vehicleType
  if (body.plate) {
    const normalizedPlate = body.plate.toUpperCase().replace(/\s+/g, '').replace(/([A-Z]{3})([0-9]{4})/, '$1-$2')
    updateData.plate = normalizedPlate
  }
  if (body.capacityKg) updateData.capacityKg = body.capacityKg
  if (body.vehicleImages) updateData.vehicleImages = body.vehicleImages
  if (body.licenseType) updateData.licenseType = body.licenseType
  if (body.licenseImage) updateData.licenseImage = body.licenseImage
  if (body.cedulaFront) updateData.cedulaFront = body.cedulaFront
  if (body.cedulaBack) updateData.cedulaBack = body.cedulaBack
  if (body.ruvDocument) updateData.ruvDocument = body.ruvDocument
  if (body.plateImage) updateData.plateImage = body.plateImage
  if (body.insurancePolicy) updateData.insurancePolicy = body.insurancePolicy
  if (body.carneBlanco !== undefined) updateData.carneBlanco = body.carneBlanco
  if (body.carneVerde !== undefined) updateData.carneVerde = body.carneVerde
  if (body.carneTransporteCarga !== undefined) updateData.carneTransporteCarga = body.carneTransporteCarga
  if (body.fumigationCertificate !== undefined) updateData.fumigationCertificate = body.fumigationCertificate
  if (body.phone) updateData.phone = body.phone
  
  // Actualizar
  const updated = await Driver.findOneAndUpdate(
    { userId: currentUser.clerkId },
    updateData,
    { new: true }
  )
  
  return c.json({
    success: true,
    driver: updated
  })
})

// Reenviar a verificación (después de rechazado)
users.patch('/driver/resubmit', authMiddleware, async (c) => {
  const currentUser = c.get('user') as AuthUser
  const body = await c.req.json()
  
  const driver = await Driver.findOne({ userId: currentUser.clerkId })
  if (!driver) {
    return c.json({ error: 'Driver no encontrado. Regístrate primero.' }, 404)
  }
  
  // Solo puede reenviar si está rejected
  if (driver.verificationStatus !== 'rejected') {
    return c.json({ error: 'Solo puedes reenviar si fuiste rechazado anteriormente.' }, 400)
  }
  
  // Validar documentos requeridos
  if (body.vehicleImages) {
    body.vehicleImages = [...(driver.vehicleImages || []), ...body.vehicleImages]
  }
  
  const updateData: any = {
    vehicleImages: body.vehicleImages || driver.vehicleImages,
    licenseType: body.licenseType || driver.licenseType,
    licenseImage: body.licenseImage || driver.licenseImage,
    cedulaFront: body.cedulaFront || driver.cedulaFront,
    cedulaBack: body.cedulaBack || driver.cedulaBack,
    ruvDocument: body.ruvDocument || driver.ruvDocument,
    plateImage: body.plateImage || driver.plateImage,
    insurancePolicy: body.insurancePolicy || driver.insurancePolicy,
    phone: body.phone || driver.phone,
    verificationStatus: 'pending',
    rejectionReason: undefined,
    updatedAt: new Date()
  }
  
  const updated = await Driver.findOneAndUpdate(
    { userId: currentUser.clerkId },
    updateData,
    { new: true }
  )
  
  return c.json({
    success: true,
    message: 'Perfil reenviado para verificación',
    driver: {
      _id: updated._id,
      verificationStatus: updated.verificationStatus,
    }
  })
})

// Actualizar disponibilidad
users.patch('/driver/:userId/availability', authMiddleware, async (c) => {
  const userId = c.req.param('userId')
  const { isAvailable } = await c.req.json()
  
  // Solo el propio driver o admin puede cambiar disponibilidad
  const currentUser = c.get('user') as AuthUser
  const driver = await Driver.findOne({ userId })
  
  if (!driver) {
    return c.json({ error: 'Driver no encontrado' }, 404)
  }
  
  // Solo puede cambiar disponibilidad si está verificado
  if (driver.verificationStatus !== 'verified') {
    return c.json({ error: 'Debes estar verificado para aceptar pedidos.' }, 400)
  }
  
  if (currentUser.clerkId !== userId && currentUser.role !== 'admin') {
    return c.json({ error: 'No tienes permiso' }, 403)
  }
  
  const updated = await Driver.findOneAndUpdate(
    { userId },
    { isAvailable, updatedAt: new Date() },
    { new: true }
  )
  
  return c.json(updated)
})

// Actualizar ubicación
users.patch('/driver/:userId/location', authMiddleware, async (c) => {
  const userId = c.req.param('userId')
  const { coordinates } = await c.req.json()
  
  const currentUser = c.get('user') as AuthUser
  
  // Solo el propio driver puede actualizar su ubicación
  if (currentUser.clerkId !== userId) {
    return c.json({ error: 'No tienes permiso' }, 403)
  }
  
  const driver = await Driver.findOneAndUpdate(
    { userId },
    { currentLocation: { type: 'Point', coordinates }, updatedAt: new Date() },
    { new: true }
  )
  
  if (!driver) {
    return c.json({ error: 'Driver no encontrado' }, 404)
  }
  
  return c.json(driver)
})

// === ENDPOINTS DE ADMIN ===

// Listar drivers (admin)
users.get('/drivers', authMiddleware, requireRole(['admin']), async (c) => {
  const status = c.req.query('status')
  const query = status ? { verificationStatus: status } : {}
  
  const drivers = await Driver.find(query).sort({ createdAt: -1 })
  
  // Agregar info de usuario
  const driversWithUser = await Promise.all(
    drivers.map(async (driver) => {
      const user = await User.findOne({ clerkId: driver.userId })
      return {
        ...driver.toObject(),
        user: user ? {
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          imageUrl: user.imageUrl,
        } : null
      }
    })
  )
  
  return c.json({ data: driversWithUser })
})

// Aprobar/rechazar driver (admin)
users.patch('/driver/:userId/verify', authMiddleware, requireRole(['admin']), async (c) => {
  const userId = c.req.param('userId')
  const { status, rejectionReason } = await c.req.json()
  
  const validStatuses = ['in_review', 'verified', 'rejected']
  if (!status || !validStatuses.includes(status)) {
    return c.json({ error: `Status debe ser uno de: ${validStatuses.join(', ')}` }, 400)
  }
  
  const currentUser = c.get('user') as AuthUser
  
  const updateData: any = {
    verificationStatus: status,
    reviewedBy: currentUser.clerkId,
    reviewedAt: new Date(),
    updatedAt: new Date(),
  }
  
  if (status === 'rejected') {
    updateData.rejectionReason = rejectionReason || 'No especificado'
  }
  
  const driver = await Driver.findOneAndUpdate(
    { userId },
    updateData,
    { new: true }
  )
  
  if (!driver) {
    return c.json({ error: 'Driver no encontrado' }, 404)
  }
  
  return c.json({
    success: true,
    driver: {
      _id: driver._id,
      verificationStatus: driver.verificationStatus,
      rejectionReason: driver.rejectionReason,
    }
  })
})

export default users