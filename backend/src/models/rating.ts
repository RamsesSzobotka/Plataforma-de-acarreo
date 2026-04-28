import mongoose from 'mongoose'

const ratingSchema = new mongoose.Schema({
  rideId: {
    type: String,
    required: true,
    index: true,
  },
  raterId: {
    type: String,
    required: true,
    index: true,
  },
  ratedId: {
    type: String,
    required: true,
    index: true,
  },
  role: {
    type: String,
    enum: ['client', 'driver'],
    required: true,
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
  },
  comment: {
    type: String,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
})

export const Rating = mongoose.model('Rating', ratingSchema)
