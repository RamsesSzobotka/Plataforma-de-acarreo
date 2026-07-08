import mongoose from 'mongoose'

const reportSchema = new mongoose.Schema({
  reporterId: {
    type: String,
    required: true,
    index: true,
  },
  reportedId: {
    type: String,
    required: true,
    index: true,
  },
  reportedRole: {
    type: String,
    enum: ['client', 'driver'],
    required: true,
  },
  rideId: {
    type: String,
    index: true,
    default: null,
  },
  comment: {
    type: String,
    required: true,
    minlength: 10,
    maxlength: 1000,
  },
  status: {
    type: String,
    enum: ['pending', 'in_review', 'resolved'],
    default: 'pending',
  },
  // Category of the report
  category: {
    type: String,
    enum: ['payment_dispute', 'illicit_actions', 'other'],
    default: 'other',
  },
  // Resolution (only set when report is resolved)
  resolution: {
    type: String,
    enum: ['refunded', 'dismissed', 'warning', null],
    default: null,
  },
  // Admin who resolved the report
  resolvedBy: {
    type: String,
    default: null,
  },
  resolvedAt: {
    type: Date,
    default: null,
  },
}, { timestamps: true })

// Unique index: same reporter can't report the same ride twice
reportSchema.index({ reporterId: 1, rideId: 1 }, { unique: true })

export const Report = mongoose.models.Report || mongoose.model('Report', reportSchema)
