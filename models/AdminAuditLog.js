import mongoose from 'mongoose';

const adminAuditLogSchema = new mongoose.Schema(
  {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    targetUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    action: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    reason: {
      type: String,
      default: '',
      trim: true,
      maxlength: [1000, 'Audit reason cannot exceed 1000 characters']
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  { timestamps: true }
);

adminAuditLogSchema.index({ createdAt: -1 });

export const AdminAuditLog =
  mongoose.models.AdminAuditLog || mongoose.model('AdminAuditLog', adminAuditLogSchema);

export default AdminAuditLog;
