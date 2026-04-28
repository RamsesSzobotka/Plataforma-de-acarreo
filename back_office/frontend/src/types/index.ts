export interface User {
  clerkId: string
  email: string
  firstName?: string
  lastName?: string
  imageUrl?: string
  role: 'client' | 'driver' | 'admin'
  isActive: boolean
  phone?: string
  createdAt: string
  updatedAt: string
}

export interface Driver {
  _id: string
  userId: string
  vehicleType: string
  plate: string
  capacityKg: number
  vehicleImages?: string[]
  licenseType?: string
  licenseImage?: string
  cedulaFront?: string
  cedulaBack?: string
  ruvDocument?: string
  plateImage?: string
  insurancePolicy?: string
  phone?: string
  isAvailable: boolean
  rating: number
  totalRides: number
  verificationStatus: 'pending' | 'in_review' | 'verified' | 'rejected' | 'suspended'
  rejectionReason?: string
  reviewedAt?: string
  createdAt: string
  updatedAt: string
  user?: User | null
}

export interface Ride {
  _id: string
  clientId: string
  driverId?: string
  title: string
  description: string
  type: 'mudanza' | 'electrodomésticos' | 'muebles' | 'productos' | 'otros'
  images: { url: string; publicId?: string }[]
  pickupLocation: {
    address: string
    coordinates: { type: string; coordinates: number[] }
  }
  dropoffLocation: {
    address: string
    coordinates: { type: string; coordinates: number[] }
  }
  estimatedPrice: number
  finalPrice?: number
  packages?: number
  weight?: number
  notes?: string
  preferredDate?: string
  status: 'requested' | 'negotiating' | 'accepted' | 'in_progress' | 'completed' | 'paid' | 'cancelled'
  deliveryPhoto?: { url: string; publicId?: string }
  cancellationReason?: string
  createdAt: string
  updatedAt: string
  client?: User | null
  driver?: User | null
}

export interface Stats {
  stats: {
    totalUsers: number
    totalDrivers: number
    totalRides: number
    pendingDrivers: number
    completedRides: number
    paidRides: number
    totalRevenue: number
    platformRevenue: number
  }
  ridesByStatus: Record<string, number>
  ridesByMonth: { month: string; count: number; revenue: number }[]
  driversByStatus: Record<string, number>
}

export interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}