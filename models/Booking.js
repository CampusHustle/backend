import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Student ID is required'],
      index: true
    },
    tutorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Tutor ID is required'],
      index: true
    },
    availabilityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Availability',
      required: [true, 'Availability slot ID is required'],
      index: true
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'completed', 'cancelled'],
      default: 'pending'
    }
  },
  {
    timestamps: true
  }
);

// Indexes for querying a user's bookings efficiently
bookingSchema.index({ studentId: 1, status: 1 });
bookingSchema.index({ tutorId: 1, status: 1 });

export const Booking = mongoose.model('Booking', bookingSchema);
