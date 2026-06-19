export type RideType = 'mudanza' | 'electrodomesticos' | 'muebles' | 'productos' | 'otros';

export type RideStatus =
  | 'requested'
  | 'negotiating'
  | 'accepted'
  | 'in_progress'
  | 'completed'
  | 'paid'
  | 'cancelled';

export type UserRole = 'client' | 'driver' | 'admin';

export interface GeoLocation {
  address: string;
  coordinates: [number, number];
}

export interface RideSummary {
  id: string;
  title: string;
  type: RideType;
  status: RideStatus;
  estimatedPrice: number;
  finalPrice?: number;
  pickupAddress: string;
  dropoffAddress: string;
  createdAt: string;
  driverName?: string;
  clientName?: string;
}

export interface Ride {
  id: string;
  clientId: string;
  driverId?: string;
  title: string;
  description: string;
  type: RideType;
  images: { url: string }[];
  pickupLocation: GeoLocation;
  dropoffLocation: GeoLocation;
  estimatedPrice: number;
  finalPrice?: number;
  packages?: number;
  notes?: string;
  preferredDate?: string;
  status: RideStatus;
  deliveryPhoto?: { url: string };
  cancellationReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Offer {
  id: string;
  rideId: string;
  driverId: string;
  price: number;
  message?: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}

export interface OfferWithDriver extends Offer {
  driverName: string;
  driverRating: number;
  driverImageUrl?: string;
  driverTotalRides: number;
}

export interface ClientProfile {
  name: string;
  imageUrl?: string;
  rating: number;
  totalRides: number;
}

export interface AvailableRide extends RideSummary {
  distanceKm: number;
  clientRating: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
