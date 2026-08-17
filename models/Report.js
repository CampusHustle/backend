import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema(
  {
    reporterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Reporter user ID is required'],
      index: true
    },
    reportedUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Reported user ID is required'],
      index: true
    },
    reason: {
      type: String,
      required: [true, 'Report reason is required'],
      trim: true,
      minlength: [5, 'Reason must be at least 5 characters long'],
      maxlength: [1000, 'Reason cannot exceed 1000 characters']
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'reviewed', 'resolved', 'dismissed'],
        message: '{VALUE} is not a valid report status'
      },
      default: 'pending',
      index: true
    },
    actionTaken: {
      type: String,
      default: '',
      trim: true,
      maxlength: [500, 'Action taken description cannot exceed 500 characters']
    },
    adminNotes: {
      type: String,
      default: '',
      trim: true,
      maxlength: [1000, 'Admin notes cannot exceed 1000 characters']
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Indexes for fast admin filtering and user history lookups (NFR-9)
reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ reportedUserId: 1, createdAt: -1 });

export const Report = mongoose.model('Report', reportSchema);
