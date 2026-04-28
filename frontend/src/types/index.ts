// Ride types
export interface Ride {
  _id: string
  clientId: string
  driverId?: string
  title: string
  description: string
  type: RideType
  images: RideImage[]
  pickupLocation: Location
  dropoffLocation: Location
  estimatedPrice: number
  finalPrice?: number
  packages?: number
  weight?: number
  notes?: string
  preferredDate?: string
  status: RideStatus
  chatEnabled: boolean
  deliveryPhoto?: RideImage
  cancellationReason?: string
  stripePaymentMethodId?: string  // NUEVO: Payment Method guardado
  paymentIntentId?: string         // NUEVO: PaymentIntent de Stripe
  paidAt?: string                  // NUEVO: Fecha de pago automático
  createdAt: string
  updatedAt: string
}

export type RideType = 'mudanza' | 'electrodomesticos' | 'muebles' | 'productos' | 'otros'

export type RideStatus = 
  | 'requested' 
  | 'negotiating' 
  | 'accepted' 
  | 'in_progress' 
  | 'completed' 
  | 'paid' 
  | 'cancelled'

export interface RideImage {
  url: string
  publicId?: string
}

export interface Location {
  address: string
  type?: string
  coordinates: [number, number]
}

// User types
export interface User {
  clerkId: string
  email: string
  firstName?: string
  lastName?: string
  imageUrl?: string
  role: UserRole
  isActive: boolean
  phone?: string
  createdAt: string
  updatedAt: string
}

export type UserRole = 'client' | 'driver' | 'admin'

// Driver types
export interface Driver {
  userId: string
  vehicleType: string
  plate: string
  capacityKg: number
  isAvailable: boolean
  currentLocation?: {
    type: string
    coordinates: [number, number]
  }
  rating: number
  totalRides: number
  isVerified: boolean
  createdAt: string
  updatedAt: string
}

// Message types
export interface Message {
  _id: string
  rideId: string
  senderId: string
  content: string
  read: boolean
  createdAt: string
}

// API Response types
export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}