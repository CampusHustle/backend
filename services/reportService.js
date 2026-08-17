import { Report } from '../models/Report.js';
import { User } from '../models/User.js';
import { AppError } from '../middleware/errorHandler.js';

/**
 * Creates a new user report (FR-13).
 * Validates reporter and reportedUser, prevents self-reporting.
 *
 * @param {string} reporterId
 * @param {Object} reportData
 * @param {string} reportData.reportedUserId
 * @param {string} reportData.reason
 */
export async function createReport(reporterId, { reportedUserId, reason }) {
  if (!reportedUserId || typeof reportedUserId !== 'string') {
    throw new AppError('reportedUserId is required.', 400, 'VALIDATION_ERROR');
  }

  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    throw new AppError('Reason is required and cannot be blank.', 400, 'VALIDATION_ERROR');
  }

  const trimmedReason = reason.trim();
  if (trimmedReason.length < 5) {
    throw new AppError('Reason must be at least 5 characters long.', 400, 'VALIDATION_ERROR');
  }
  if (trimmedReason.length > 1000) {
    throw new AppError('Reason cannot exceed 1000 characters.', 400, 'VALIDATION_ERROR');
  }

  const reporterStr = reporterId.toString();
  if (reporterStr === reportedUserId) {
    throw new AppError('You cannot report yourself.', 400, 'VALIDATION_ERROR');
  }

  // Ensure reported user exists
  const reportedUser = await User.findById(reportedUserId);
  if (!reportedUser) {
    throw new AppError('The user you are trying to report does not exist.', 404, 'USER_NOT_FOUND');
  }

  const report = await Report.create({
    reporterId,
    reportedUserId,
    reason: trimmedReason,
    status: 'pending'
  });

  return report;
}

/**
 * Retrieves paginated list of reports for platform administrators (NFR-9).
 *
 * @param {Object} queryParams
 * @param {string} [queryParams.status] - Filter by status ('pending' | 'reviewed' | 'resolved' | 'dismissed')
 * @param {number|string} [queryParams.page=1]
 * @param {number|string} [queryParams.limit=20]
 */
export async function getReports(queryParams = {}) {
  const { status, page = 1, limit = 20 } = queryParams;

  const query = {};
  if (status && ['pending', 'reviewed', 'resolved', 'dismissed'].includes(status)) {
    query.status = status;
  }

  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (parsedPage - 1) * parsedLimit;

  const [reports, total] = await Promise.all([
    Report.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parsedLimit)
      .populate('reporterId', 'name email role university department')
      .populate('reportedUserId', 'name email role university department isBlocked')
      .populate('resolvedBy', 'name email role')
      .lean(),
    Report.countDocuments(query)
  ]);

  return {
    reports,
    total,
    page: parsedPage,
    totalPages: Math.ceil(total / parsedLimit) || 0
  };
}

/**
 * Updates a report's status and optionally applies a platform ban on the reported user (FR-13, NFR-9).
 *
 * @param {string} adminId
 * @param {string} reportId
 * @param {Object} updateData
 * @param {string} updateData.status
 * @param {string} [updateData.adminNotes]
 * @param {string} [updateData.actionTaken]
 * @param {boolean} [updateData.blockReportedUser] - If true, sets isBlocked: true on the reported user
 */
export async function updateReport(adminId, reportId, updateData = {}) {
  const { status, adminNotes, actionTaken, blockReportedUser } = updateData;

  const allowedStatuses = ['pending', 'reviewed', 'resolved', 'dismissed'];
  if (status && !allowedStatuses.includes(status)) {
    throw new AppError(`Invalid status. Must be one of: ${allowedStatuses.join(', ')}`, 400, 'VALIDATION_ERROR');
  }

  const report = await Report.findById(reportId);
  if (!report) {
    throw new AppError('Report not found.', 404, 'REPORT_NOT_FOUND');
  }

  if (status) report.status = status;
  if (adminNotes !== undefined) report.adminNotes = String(adminNotes).trim();
  if (actionTaken !== undefined) report.actionTaken = String(actionTaken).trim();
  report.resolvedBy = adminId;

  await report.save();

  // If moderation action includes banning/suspending user
  if (blockReportedUser === true) {
    await User.findByIdAndUpdate(report.reportedUserId, {
      isBlocked: true,
      refreshTokenHash: null // revoke active sessions
    });
  } else if (blockReportedUser === false) {
    await User.findByIdAndUpdate(report.reportedUserId, {
      isBlocked: false
    });
  }

  return report;
}
