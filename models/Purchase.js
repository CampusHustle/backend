import { Schema, model } from 'mongoose';

/**
 * Purchase Schema
 * Tracks note purchases by students.
 * 
 * FR-10: Supports preview, pricing, and purchase of notes.
 * Day 6: Purchase record creation (Chapa integration deferred to Day 9).
 */
const PurchaseSchema = new Schema(
  {
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    noteId: { type: Schema.Types.ObjectId, ref: 'Note', required: true },
    tutorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    price: { type: Number, required: true }, // Price at time of purchase
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'pending'
    },
    chapaTxRef: { type: String }, // Chapa transaction reference (populated on Day 9)
  },
  { timestamps: true }
);

// Ensure a student can only purchase a note once
PurchaseSchema.index({ studentId: 1, noteId: 1 }, { unique: true });

export default model('Purchase', PurchaseSchema);
