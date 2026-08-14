import { Schema, model } from 'mongoose';

const NoteSchema = new Schema({
  tutorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  course: { type: String, required: true },
  description: { type: String },
  fileUrl: { type: String, required: true }, 
  price: { type: Number, default: 0 },       
  previewPages: { type: Number, default: 3 },
  purchaseCount: { type: Number, default: 0 }
}, { timestamps: true });

export default model('Note', NoteSchema);
