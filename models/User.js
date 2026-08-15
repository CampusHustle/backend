import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true
    },
    email: {
      type: String,
      required: [true, 'University email is required'],
      unique: true,
      lowercase: true,
      trim: true
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
      select: false
    },
    role: {
      type: String,
      enum: ['student', 'tutor', 'admin'],
      default: 'student'
    },
    university: {
      type: String,
      required: [true, 'University is required'],
      trim: true
    },
    department: {
      type: String,
      default: '',
      trim: true
    },
    year: {
      type: Number,
      default: 1
    },
    bio: {
      type: String,
      default: '',
      trim: true
    },
    profilePicUrl: {
      type: String,
      default: ''
    },
    hourlyRate: {
      type: Number,
      default: 0,
      min: [0, 'Hourly rate cannot be negative']
    },
    skillsTeaching: {
      type: [String],
      default: []
    },
    skillsLearning: {
      type: [String],
      default: []
    },
    rating: {
      knowledge: { type: Number, default: 0 },
      communication: { type: Number, default: 0 },
      punctuality: { type: Number, default: 0 },
      count: { type: Number, default: 0 }
    },
    isEmailVerified: {
      type: Boolean,
      default: false
    },
    emailVerificationTokenHash: {
      type: String,
      default: null,
      select: false
    },
    emailVerificationExpires: {
      type: Date,
      default: null
    },
    isBlocked: {
      type: Boolean,
      default: false
    },
    refreshTokenHash: {
      type: String,
      default: null,
      select: false
    }
  },
  {
    timestamps: true
  }
);

// Compound and single field indexes for sub-millisecond search query performance (NFR-4)
userSchema.index({ skillsTeaching: 1 });
userSchema.index({ department: 1 });
userSchema.index({ hourlyRate: 1 });
userSchema.index({ 'rating.knowledge': -1 });
userSchema.index({ role: 1, isBlocked: 1 });

// Strip security hashes when serializing to JSON
userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.passwordHash;
    delete ret.refreshTokenHash;
    delete ret.emailVerificationTokenHash;
    delete ret.__v;
    return ret;
  }
});

/** Mongoose model for User entity. */
export const User = mongoose.model('User', userSchema);
