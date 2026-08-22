import { Types } from 'mongoose';
import { User } from '../models/User.js';
import { Booking } from '../models/Booking.js';
import Note from '../models/Note.js';
import Purchase from '../models/Purchase.js';
import { Report } from '../models/Report.js';
import { Review } from '../models/Review.js';
import { Availability } from '../models/Availability.js';
import { Message } from '../models/Message.js';
import Notification from '../models/Notification.js';
import AdminAuditLog from '../models/AdminAuditLog.js';
import { AppError } from '../middleware/errorHandler.js';
import { escapeRegex } from './userService.js';

const ALLOWED_ROLES = ['student', 'tutor', 'admin'];
const ACTIVE_BOOKING_STATUSES = ['pending', 'confirmed'];
const MAX_ADMIN_USERS = 6;

function requireValidObjectId(id, label = 'ID') {
  if (!id || !Types.ObjectId.isValid(id)) {
    throw new AppError(`${label} must be a valid ObjectId.`, 400, 'VALIDATION_ERROR');
  }
}

function parsePagination({ page = 1, limit = 20 } = {}) {
  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  return { page: parsedPage, limit: parsedLimit, skip: (parsedPage - 1) * parsedLimit };
}

async function audit(adminId, targetUserId, action, reason = '', metadata = {}) {
  await AdminAuditLog.create({
    adminId,
    targetUserId: targetUserId || null,
    action,
    reason,
    metadata
  });
}

function normalizeUser(user) {
  if (!user) return user;
  const normalized = { ...user };
  normalized.status = user.isBlocked || user.banDetails?.isBanned ? 'suspended' : 'active';
  if (user.deletionRequested?.requested) normalized.status = 'deletion_requested';
  return normalized;
}

export async function getAdminStats() {
  const [
    totalUsers,
    totalStudents,
    totalTutors,
    totalAdmins,
    blockedUsers,
    deletionRequests,
    totalBookings,
    activeBookings,
    completedBookings,
    openReports,
    revenueResult
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ role: 'student' }),
    User.countDocuments({ role: 'tutor' }),
    User.countDocuments({ role: 'admin' }),
    User.countDocuments({ $or: [{ isBlocked: true }, { 'banDetails.isBanned': true }] }),
    User.countDocuments({ 'deletionRequested.requested': true }),
    Booking.countDocuments(),
    Booking.countDocuments({ status: { $in: ACTIVE_BOOKING_STATUSES } }),
    Booking.countDocuments({ status: 'completed' }),
    Report.countDocuments({ status: { $in: ['pending', 'reviewed'] } }),
    Purchase.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$price' }, count: { $sum: 1 } } }
    ])
  ]);

  return {
    users: {
      total: totalUsers,
      students: totalStudents,
      tutors: totalTutors,
      admins: totalAdmins,
      blocked: blockedUsers,
      deletionRequests
    },
    bookings: {
      total: totalBookings,
      active: activeBookings,
      completed: completedBookings
    },
    reports: {
      open: openReports
    },
    revenue: {
      total: revenueResult[0]?.total || 0,
      completedPurchaseCount: revenueResult[0]?.count || 0
    }
  };
}

export async function listUsers(queryParams = {}) {
  const { q, query, role, status, university, sortBy = 'newest' } = queryParams;
  const { page, limit, skip } = parsePagination(queryParams);

  const filter = {};
  const searchTerm = q || query;
  if (searchTerm && typeof searchTerm === 'string' && searchTerm.trim()) {
    const escaped = escapeRegex(searchTerm.trim());
    filter.$or = [
      { name: { $regex: escaped, $options: 'i' } },
      { email: { $regex: escaped, $options: 'i' } },
      { university: { $regex: escaped, $options: 'i' } },
      { department: { $regex: escaped, $options: 'i' } }
    ];
  }

  if (role && ALLOWED_ROLES.includes(role)) {
    filter.role = role;
  }

  if (university && typeof university === 'string' && university.trim()) {
    filter.university = { $regex: escapeRegex(university.trim()), $options: 'i' };
  }

  if (status === 'blocked' || status === 'banned' || status === 'suspended') {
    filter.$and = filter.$and || [];
    filter.$and.push({ $or: [{ isBlocked: true }, { 'banDetails.isBanned': true }] });
  } else if (status === 'active') {
    filter.isBlocked = false;
    filter['banDetails.isBanned'] = { $ne: true };
    filter['deletionRequested.requested'] = { $ne: true };
  } else if (status === 'deletion_requested') {
    filter['deletionRequested.requested'] = true;
  }

  const sort = sortBy === 'oldest'
    ? { createdAt: 1 }
    : sortBy === 'last_active'
      ? { lastActiveAt: -1 }
      : { createdAt: -1 };

  const [users, total, stats] = await Promise.all([
    User.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
    getAdminStats()
  ]);

  return {
    users: users.map(normalizeUser),
    total,
    page,
    totalPages: Math.ceil(total / limit) || 0,
    stats: stats.users
  };
}

export async function getUserActivity(targetUserId) {
  requireValidObjectId(targetUserId, 'User ID');

  const user = await User.findById(targetUserId).lean();
  if (!user) {
    throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
  }

  const userObjectId = new Types.ObjectId(targetUserId);
  const bookingFilter = { $or: [{ studentId: userObjectId }, { tutorId: userObjectId }] };

  const [
    bookings,
    activeBookingCount,
    completedBookingCount,
    notes,
    reportsAgainst,
    reportsSubmitted,
    reviewsReceived,
    purchases,
    availabilityCount,
    messagesSentCount
  ] = await Promise.all([
    Booking.find(bookingFilter)
      .sort({ updatedAt: -1 })
      .limit(25)
      .populate('studentId', 'name email role')
      .populate('tutorId', 'name email role')
      .lean(),
    Booking.countDocuments({ ...bookingFilter, status: { $in: ACTIVE_BOOKING_STATUSES } }),
    Booking.countDocuments({ ...bookingFilter, status: 'completed' }),
    Note.find({ tutorId: userObjectId }).sort({ createdAt: -1 }).limit(25).lean(),
    Report.find({ reportedUserId: userObjectId })
      .sort({ createdAt: -1 })
      .limit(25)
      .populate('reporterId', 'name email role')
      .lean(),
    Report.find({ reporterId: userObjectId })
      .sort({ createdAt: -1 })
      .limit(25)
      .populate('reportedUserId', 'name email role')
      .lean(),
    Review.find({ revieweeId: userObjectId }).sort({ createdAt: -1 }).limit(25).lean(),
    Purchase.find({ $or: [{ studentId: userObjectId }, { tutorId: userObjectId }] })
      .sort({ createdAt: -1 })
      .limit(25)
      .populate('noteId', 'title course price')
      .lean(),
    Availability.countDocuments({ tutorId: userObjectId }),
    Message.countDocuments({ senderId: userObjectId })
  ]);

  return {
    user: normalizeUser(user),
    summary: {
      activeBookings: activeBookingCount,
      completedBookings: completedBookingCount,
      publishedNotes: notes.length,
      reportsAgainst: reportsAgainst.length,
      openReportsAgainst: reportsAgainst.filter((report) => ['pending', 'reviewed'].includes(report.status)).length,
      reportsSubmitted: reportsSubmitted.length,
      reviewsReceived: reviewsReceived.length,
      purchases: purchases.length,
      availabilitySlots: availabilityCount,
      messagesSent: messagesSentCount,
      hasDeletionBlockers: activeBookingCount > 0
    },
    bookings,
    notes,
    reportsAgainst,
    reportsSubmitted,
    reviewsReceived,
    purchases
  };
}

export async function updateUserRole(adminId, targetUserId, role) {
  requireValidObjectId(targetUserId, 'User ID');
  if (!ALLOWED_ROLES.includes(role)) {
    throw new AppError(`Role must be one of: ${ALLOWED_ROLES.join(', ')}`, 400, 'VALIDATION_ERROR');
  }

  const user = await User.findById(targetUserId);
  if (!user) {
    throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
  }

  const previousRole = user.role;
  if (role === 'admin' && previousRole !== 'admin') {
    const adminCount = await User.countDocuments({ role: 'admin' });
    if (adminCount >= MAX_ADMIN_USERS) {
      throw new AppError(`Admin account limit reached. A maximum of ${MAX_ADMIN_USERS} admins is allowed.`, 409, 'ADMIN_LIMIT_REACHED');
    }
  }

  user.role = role;
  await user.save();

  await audit(adminId, targetUserId, 'user.role.updated', `Role changed from ${previousRole} to ${role}.`, {
    previousRole,
    role
  });

  return user;
}

export async function banUser(adminId, targetUserId, { reason = '', durationDays = null, bannedUntil = null } = {}) {
  requireValidObjectId(targetUserId, 'User ID');

  const trimmedReason = typeof reason === 'string' ? reason.trim() : '';
  if (!trimmedReason) {
    throw new AppError('Ban reason is required.', 400, 'VALIDATION_ERROR');
  }

  let until = null;
  if (bannedUntil) {
    const parsed = new Date(bannedUntil);
    if (Number.isNaN(parsed.getTime())) {
      throw new AppError('bannedUntil must be a valid date.', 400, 'VALIDATION_ERROR');
    }
    until = parsed;
  } else if (durationDays !== null && durationDays !== undefined && durationDays !== '') {
    const days = parseInt(durationDays, 10);
    if (!Number.isInteger(days) || days < 1 || days > 3650) {
      throw new AppError('durationDays must be between 1 and 3650.', 400, 'VALIDATION_ERROR');
    }
    until = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  const user = await User.findByIdAndUpdate(
    targetUserId,
    {
      isBlocked: true,
      refreshTokenHash: null,
      banDetails: {
        isBanned: true,
        reason: trimmedReason,
        bannedAt: new Date(),
        bannedUntil: until,
        bannedBy: adminId
      }
    },
    { new: true, runValidators: true }
  );

  if (!user) {
    throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
  }

  await audit(adminId, targetUserId, 'user.banned', trimmedReason, {
    bannedUntil: until,
    permanent: !until
  });

  return user;
}

export async function setUserBlocked(adminId, targetUserId, isBlocked, reason = '') {
  requireValidObjectId(targetUserId, 'User ID');
  if (typeof isBlocked !== 'boolean') {
    throw new AppError('isBlocked must be a boolean.', 400, 'VALIDATION_ERROR');
  }

  const update = isBlocked
    ? {
        isBlocked: true,
        refreshTokenHash: null,
        banDetails: {
          isBanned: true,
          reason: typeof reason === 'string' && reason.trim() ? reason.trim() : 'Suspended by administrator',
          bannedAt: new Date(),
          bannedUntil: null,
          bannedBy: adminId
        }
      }
    : {
        isBlocked: false,
        'banDetails.isBanned': false,
        'banDetails.reason': '',
        'banDetails.bannedAt': null,
        'banDetails.bannedUntil': null,
        'banDetails.bannedBy': null
      };

  const user = await User.findByIdAndUpdate(targetUserId, update, { new: true, runValidators: true });
  if (!user) {
    throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
  }

  await audit(
    adminId,
    targetUserId,
    isBlocked ? 'user.suspended' : 'user.unsuspended',
    reason,
    { isBlocked }
  );

  return user;
}

export async function requestAccountDeletion(userId, reason = '') {
  requireValidObjectId(userId, 'User ID');

  const user = await User.findByIdAndUpdate(
    userId,
    {
      deletionRequested: {
        requested: true,
        reason: typeof reason === 'string' ? reason.trim() : '',
        requestedAt: new Date(),
        reviewedAt: null,
        reviewedBy: null,
        rejectionReason: ''
      }
    },
    { new: true, runValidators: true }
  );

  if (!user) {
    throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
  }

  return user.deletionRequested;
}

export async function listDeletionRequests(queryParams = {}) {
  const { page, limit, skip } = parsePagination(queryParams);
  const query = { 'deletionRequested.requested': true };

  const [requests, total] = await Promise.all([
    User.find(query)
      .sort({ 'deletionRequested.requestedAt': 1 })
      .skip(skip)
      .limit(limit)
      .select('name email role university department isBlocked banDetails deletionRequested createdAt lastActiveAt')
      .lean(),
    User.countDocuments(query)
  ]);

  return {
    requests: requests.map(normalizeUser),
    total,
    page,
    totalPages: Math.ceil(total / limit) || 0
  };
}

export async function rejectDeletionRequest(adminId, targetUserId, reason = '') {
  requireValidObjectId(targetUserId, 'User ID');

  const trimmedReason = typeof reason === 'string' ? reason.trim() : '';
  if (!trimmedReason) {
    throw new AppError('Rejection reason is required.', 400, 'VALIDATION_ERROR');
  }

  const user = await User.findByIdAndUpdate(
    targetUserId,
    {
      deletionRequested: {
        requested: false,
        reason: '',
        requestedAt: null,
        reviewedAt: new Date(),
        reviewedBy: adminId,
        rejectionReason: trimmedReason
      }
    },
    { new: true, runValidators: true }
  );

  if (!user) {
    throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
  }

  await audit(adminId, targetUserId, 'deletion_request.rejected', trimmedReason);
  return user;
}

export async function approveDeletionRequest(adminId, targetUserId, { force = false, reason = '' } = {}) {
  requireValidObjectId(targetUserId, 'User ID');

  const user = await User.findById(targetUserId).select('deletionRequested');
  if (!user) {
    throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
  }

  if (!user.deletionRequested?.requested) {
    throw new AppError('This user does not have a pending deletion request.', 400, 'NO_DELETION_REQUEST');
  }

  return deleteUserAccount(adminId, targetUserId, {
    force,
    reason: reason || 'Deletion request approved by administrator.'
  });
}

export async function deleteUserAccount(adminId, targetUserId, { force = false, reason = '' } = {}) {
  requireValidObjectId(targetUserId, 'User ID');

  if (adminId?.toString() === targetUserId.toString()) {
    throw new AppError('Admins cannot delete their own account from the admin panel.', 400, 'SELF_DELETE_FORBIDDEN');
  }

  const user = await User.findById(targetUserId);
  if (!user) {
    throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
  }

  const userObjectId = new Types.ObjectId(targetUserId);
  const activeBookingCount = await Booking.countDocuments({
    $or: [{ studentId: userObjectId }, { tutorId: userObjectId }],
    status: { $in: ACTIVE_BOOKING_STATUSES }
  });

  if (activeBookingCount > 0 && !force) {
    throw new AppError(
      'User still has pending or confirmed bookings. Review activity before deleting, or pass force=true.',
      409,
      'ACTIVE_BOOKINGS_EXIST'
    );
  }

  const [notesResult, availabilityResult, notificationsResult, messagesResult, purchasesResult] = await Promise.all([
    Note.deleteMany({ tutorId: userObjectId }),
    Availability.deleteMany({ tutorId: userObjectId }),
    Notification.deleteMany({ $or: [{ recipientId: userObjectId }, { senderId: userObjectId }] }),
    Message.deleteMany({ senderId: userObjectId }),
    Purchase.deleteMany({ $or: [{ studentId: userObjectId }, { tutorId: userObjectId }] })
  ]);

  const [studentBookingResult, tutorBookingResult] = await Promise.all([
    Booking.updateMany(
      { studentId: userObjectId, status: { $in: ACTIVE_BOOKING_STATUSES } },
      { $set: { status: 'cancelled' } }
    ),
    Booking.updateMany(
      { tutorId: userObjectId, status: { $in: ACTIVE_BOOKING_STATUSES } },
      { $set: { status: 'declined' } }
    )
  ]);

  await Promise.all([
    Review.deleteMany({ $or: [{ reviewerId: userObjectId }, { revieweeId: userObjectId }] }),
    User.updateMany({ blockedUsers: userObjectId }, { $pull: { blockedUsers: userObjectId } }),
    Report.updateMany(
      { reportedUserId: userObjectId, status: { $in: ['pending', 'reviewed'] } },
      {
        $set: {
          status: 'dismissed',
          resolvedBy: adminId,
          actionTaken: 'Reported account was deleted.',
          adminNotes: 'Automatically dismissed during account deletion.'
        }
      }
    )
  ]);

  await User.deleteOne({ _id: userObjectId });

  const cleanup = {
    notesDeleted: notesResult.deletedCount || 0,
    availabilityDeleted: availabilityResult.deletedCount || 0,
    notificationsDeleted: notificationsResult.deletedCount || 0,
    messagesDeleted: messagesResult.deletedCount || 0,
    purchasesDeleted: purchasesResult.deletedCount || 0,
    studentBookingsCancelled: studentBookingResult.modifiedCount || 0,
    tutorBookingsDeclined: tutorBookingResult.modifiedCount || 0
  };

  await audit(adminId, targetUserId, 'user.deleted', reason, { cleanup, force });

  return {
    message: 'User account deleted successfully.',
    deletedUserId: targetUserId,
    cleanup
  };
}
