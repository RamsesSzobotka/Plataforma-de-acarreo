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
  distance?: number  // Calculated distance in km
  createdAt: string
  updatedAt: string
}

export type RideType = 'mudanza' | 'electrodomésticos' | 'muebles' | 'productos' | 'otros'

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
  coordinates: {
    type: string
    coordinates: [number, number]
  }
}

export interface RideWithDistance extends Ride {
  distance: number
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
  verificationStatus?: 'pending' | 'in_review' | 'verified' | 'rejected' | 'suspended'
  rejectionReason?: string
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

// Geospatial API Response
export interface GeospatialRidesResponse {
  success: boolean
  data: RideWithDistance[]
  pagination: {
    total: number
    limit: number
    skip: number
    hasMore: boolean
  }
  metadata: {
    searchedAt: string
    driverLocation: { lat: number; lng: number }
    radiusKm: number
  }
}