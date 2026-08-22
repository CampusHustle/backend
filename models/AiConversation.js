import mongoose from 'mongoose';

const aiConversationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Conversation userId is required'],
      index: true
    },
    title: {
      type: String,
      required: [true, 'Conversation title is required'],
      trim: true,
      maxlength: [200, 'Conversation title cannot exceed 200 characters']
    }
  },
  { timestamps: true }
);

aiConversationSchema.index({ userId: 1, updatedAt: -1 });

export const AiConversation = mongoose.model('AiConversation', aiConversationSchema);
