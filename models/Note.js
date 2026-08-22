import { Schema, model } from 'mongoose';

const NoteSchema = new Schema({
  tutorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  course: { type: String, required: true },
  department: { type: String, default: '' },
  description: { type: String, default: '' },
  contentType: { type: String, default: 'PDF Notes' },
  fileUrl: { type: String, required: true }, 
  coverImageUrl: { type: String, default: '' },
  price: {
    type: Number,
    default: 0,
    min: [0, 'Price cannot be negative'],
    max: [100000, 'Price cannot exceed 100,000'],
    validate: {
      validator: (value) => Number.isFinite(value),
      message: 'Price must be a valid number'
    }
  },
  previewPages: { type: Number, default: 3 },
  purchaseCount: { type: Number, default: 0 }
}, { timestamps: true });

NoteSchema.index({ tutorId: 1, createdAt: -1 });
NoteSchema.index({ course: 1 });
NoteSchema.index({ department: 1 });
NoteSchema.index({ price: 1 });

export default model('Note', NoteSchema);

