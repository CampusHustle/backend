import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: String,
      required: [true, 'Conversation ID is required'],
      index: true,
      trim: true
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Sender ID is required'],
      index: true
    },
    content: {
      type: String,
      required: [true, 'Message content is required'],
      trim: true,
      maxlength: [2000, 'Message cannot exceed 2000 characters']
    },
    // FR-8: flagged true when contact info is detected in content (audit trail, NFR-9)
    containsContactInfo: {
      type: Boolean,
      default: false
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true
    },
    readAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Index for efficient paginated history retrieval per conversation and unread queries
messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ conversationId: 1, senderId: 1, isRead: 1 });

export const Message = mongoose.model('Message', messageSchema);
