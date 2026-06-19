/**
 * Interfaces TypeScript compartidas para el MCP Server.
 * Reflejan los modelos del backend de la Plataforma de Acarreos.
 */

// === Tipos básicos ===
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

// === Ubicación ===
export interface GeoLocation {
  address: string;
  coordinates: [number, number]; // [lng, lat]
}

// === Ride (resumen para listas) ===
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

// === Ride (completo) ===
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

// === Oferta ===
export interface Offer {
  id: string;
  rideId: string;
  driverId: string;
  price: number;
  message?: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}

// === Oferta con perfil del conductor (para vista del cliente) ===
export interface OfferWithDriver extends Offer {
  driverName: string;
  driverRating: number;
  driverImageUrl?: string;
  driverTotalRides: number;
}

// === Perfil del cliente (público) ===
export interface ClientProfile {
  name: string;
  imageUrl?: string;
  rating: number;
  totalRides: number;
}

// === Acarreo disponible (para conductores) ===
export interface AvailableRide extends RideSummary {
  distanceKm: number;
  clientRating: number;
}

// === Respuestas paginadas ===
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
