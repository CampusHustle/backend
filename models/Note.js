import { Schema, model } from 'mongoose';

const NoteSchema = new Schema({
  tutorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  course: { type: String, required: true },
  description: { type: String },
  fileUrl: { type: String, required: true }, 
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

export default model('Note', NoteSchema);
