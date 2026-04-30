import { mongoose } from '../db/mongo'

// Schema para Ride
const rideSchema = new mongoose.Schema({
  clientId: { type: String, required: true },
  driverId: { type: String },
  
  title: { type: String, required: true },
  description: { type: String, required: true },
  type: { 
    type: String, 
    enum: ['mudanza', 'electrodomesticos', 'muebles', 'productos', 'otros'],
    required: true 
  },
  
  // Imágenes del pedido
  images: [{
    url: { type: String, required: true },
    publicId: { type: String }
  }],
  
  // Locations con GeoJSON
  pickupLocation: {
    address: { type: String, required: true },
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true } // [lng, lat]
  },
  dropoffLocation: {
    address: { type: String, required: true },
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true }
  },
  
  // Precios
  estimatedPrice: { type: Number, required: true },
  finalPrice: { type: Number },
  
  // Información adicional
  packages: { type: Number }, // número de bultos
  weight: { type: Number }, // peso estimado
  notes: { type: String },
  preferredDate: { type: Date },
  
// Estado del ride
  status: {
    type: String,
    enum: ['requested', 'negotiating', 'accepted', 'in_progress', 'completed', 'paid', 'cancelled'],
    default: 'requested'
  },

   // Chat habilitado (negotiating o accepted)
  chatEnabled: {
    type: Boolean,
    default: false,
    set: function(this: any) {
      return this.status === 'negotiating' || this.status === 'accepted'
    }
  },

  // Última actividad de chat (para timeout de 1 minuto)
  chatActiveAt: { type: Date },

  // ClerkId de quien inició la negociación (driver que escribió primero)
  chatInitiatedBy: { type: String },
  
  // Foto de entrega
  deliveryPhoto: {
    url: String,
    publicId: String
  },
  
  // Cancelación
  cancellationReason: { type: String },
  
  // Pago - Stripe
  stripePaymentMethodId: { type: String }, // ID del método de pago guardado (obligatorio)
  paymentIntentId: { type: String }, // ID del PaymentIntent cuando se procesa
  paidAt: { type: Date }, // Fecha de pago automático
  
  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
})

// Índices - 2dsphere desactivado temporalmente
// rideSchema.index({ 'pickupLocation.coordinates': '2dsphere' })
rideSchema.index({ status: 1 })
rideSchema.index({ clientId: 1 })
rideSchema.index({ driverId: 1 })

export const Ride = mongoose.models.Ride || mongoose.model('Ride', rideSchema)