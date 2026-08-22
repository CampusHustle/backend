import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
  {
    reviewerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Reviewer ID is required'],
      index: true
    },
    revieweeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Reviewee ID is required'],
      index: true
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: [true, 'Booking ID is required']
    },
    // Three-axis rating (1–5 each) matching the User.rating schema (FR-12)
    rating: {
      knowledge: {
        type: Number,
        required: [true, 'Knowledge rating is required'],
        min: [1, 'Rating must be at least 1'],
        max: [5, 'Rating cannot exceed 5']
      },
      communication: {
        type: Number,
        required: [true, 'Communication rating is required'],
        min: [1, 'Rating must be at least 1'],
        max: [5, 'Rating cannot exceed 5']
      },
      punctuality: {
        type: Number,
        required: [true, 'Punctuality rating is required'],
        min: [1, 'Rating must be at least 1'],
        max: [5, 'Rating cannot exceed 5']
      }
    },
    comment: {
      type: String,
      default: '',
      trim: true,
      maxlength: [500, 'Review comment cannot exceed 500 characters']
    }
  },
  {
    timestamps: true
  }
);

// One review per booking — prevents duplicate submissions
reviewSchema.index({ bookingId: 1 }, { unique: true });

// Efficient fetching of all reviews for a given user
reviewSchema.index({ revieweeId: 1, createdAt: -1 });

export const Review = mongoose.model('Review', reviewSchema);
