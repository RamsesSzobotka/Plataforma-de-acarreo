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
  stripePaymentMethodId?: string
  paymentIntentId?: string
  platformFee?: number
  driverAmount?: number
  paidAt?: string
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
  | 'failed'

export interface RideImage {
  url: string
  publicId?: string
}

export interface Location {
  address: string
  type?: string
  coordinates: [number, number]
}

export interface User {
  clerkId: string
  email: string
  firstName?: string
  lastName?: string
  imageUrl?: string
  role: UserRole
  isActive: boolean
  phone?: string
  stripeCustomerId?: string
  paymentMethodId?: string
  createdAt: string
  updatedAt: string
}

export type UserRole = 'client' | 'driver' | 'admin'

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
  vehicleImages?: string[]
  licenseType?: string
  licenseImage?: string
  cedulaFront?: string
  cedulaBack?: string
  ruvDocument?: string
  plateImage?: string
  insurancePolicy?: string
  phone?: string
  carneBlanco?: string
  carneVerde?: string
  carneTransporteCarga?: string
  fumigationCertificate?: string
  stripeAccountId?: string
  payoutsEnabled?: boolean
  createdAt: string
  updatedAt: string
}

export interface Message {
  _id: string
  rideId: string
  senderId: string
  content: string
  read: boolean
  createdAt: string
}

export interface DriverContact {
  _id: string
  driverId: string
  createdAt: string
  driver: {
    firstName?: string
    lastName?: string
    imageUrl?: string
    email?: string
  } | null
}

export interface RatingWithRater {
  _id: string
  rideId: string
  raterId: string
  ratedId: string
  role: 'client' | 'driver'
  rating: number
  comment?: string
  createdAt: string
  rater: {
    firstName?: string
    lastName?: string
    imageUrl?: string
  } | null
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

export interface Report {
  _id: string
  reporterId: string
  reportedId: string
  reportedRole: 'client' | 'driver'
  rideId?: string
  comment: string
  status: 'pending' | 'in_review' | 'resolved'
  createdAt: string
  updatedAt: string
}

export interface AppNotification {
  _id: string
  userId: string
  type: 'report_response' | 'ride_message' | 'offer_accepted' | 'offer_received' | 'ride_status'
  title: string
  body: string
  read: boolean
  link?: string
  metadata?: { rideId?: string; reportId?: string; offerId?: string }
  createdAt: string
}