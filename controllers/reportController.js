import * as reportService from '../services/reportService.js';
import { AppError } from '../middleware/errorHandler.js';

/**
 * POST /api/reports
 * Submit a report about another user (FR-13).
 */
export async function createReport(req, res, next) {
  try {
    const { reportedUserId, reason } = req.body;
    const report = await reportService.createReport(req.user._id, { reportedUserId, reason });

    res.status(201).json({
      success: true,
      message: 'Report submitted successfully. Administrators will review the issue.',
      report
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/reports
 * Admin: List reports with filtering and pagination (NFR-9).
 */
export async function getReports(req, res, next) {
  try {
    const result = await reportService.getReports(req.query);

    res.status(200).json({
      success: true,
      ...result
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/reports/:id
 * Admin: Update report status / take moderation action.
 */
export async function updateReport(req, res, next) {
  try {
    const { id } = req.params;
    const { status, adminNotes, actionTaken, blockReportedUser } = req.body;

    if (!id) {
      throw new AppError('Report ID parameter is required.', 400, 'VALIDATION_ERROR');
    }

    const report = await reportService.updateReport(req.user._id, id, {
      status,
      adminNotes,
      actionTaken,
      blockReportedUser
    });

    res.status(200).json({
      success: true,
      message: 'Report updated successfully.',
      report
    });
  } catch (err) {
    next(err);
  }
}
