import { Schema, model } from 'mongoose';

/**
 * Notification Schema
 * FR-14: System shall notify users of bookings, messages, and purchases.
 */
const NotificationSchema = new Schema(
  {
    recipientId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User' },
    type: {
      type: String,
      required: true,
      enum: [
        'booking_request',
        'booking_accepted',
        'booking_declined',
        'booking_cancelled',
        'booking_completed',
        'new_message',
        'note_purchase'
      ]
    },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    referenceId: { type: Schema.Types.ObjectId },
    referenceType: {
      type: String,
      enum: ['booking', 'message', 'note', 'purchase']
    },
    isRead: { type: Boolean, default: false }
  },
  { timestamps: true }
);

NotificationSchema.index({ recipientId: 1, isRead: 1 });
NotificationSchema.index({ recipientId: 1, createdAt: -1 });

export const Notification = model('Notification', NotificationSchema);
export default Notification;
