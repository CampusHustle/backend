import mongoose from 'mongoose';

const aiMessageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AiConversation',
      required: [true, 'Message conversationId is required'],
      index: true
    },
    role: {
      type: String,
      required: [true, 'Message role is required'],
      enum: ['user', 'assistant']
    },
    content: {
      type: String,
      required: [true, 'Message content is required'],
      trim: true,
      maxlength: [50000, 'Message content cannot exceed 50000 characters']
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }
  }
);

aiMessageSchema.index({ conversationId: 1, createdAt: 1 });

export const AiMessage = mongoose.model('AiMessage', aiMessageSchema);
