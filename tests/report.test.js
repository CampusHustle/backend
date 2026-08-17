import test from 'node:test';
import assert from 'node:assert/strict';

// ─── Report Model & Service Tests (FR-13 & NFR-9) ────────────────────────────

test('Report Model - schema definitions and default values', async () => {
  const { Report } = await import('../models/Report.js');
  assert.equal(typeof Report, 'function');
  assert.equal(Report.modelName, 'Report');

  const paths = Report.schema.paths;
  assert.ok(paths.reporterId, 'reporterId path missing');
  assert.ok(paths.reportedUserId, 'reportedUserId path missing');
  assert.ok(paths.reason, 'reason path missing');
  assert.ok(paths.status, 'status path missing');
  assert.equal(paths.status.defaultValue, 'pending');
  assert.ok(paths.actionTaken, 'actionTaken path missing');
  assert.ok(paths.adminNotes, 'adminNotes path missing');
  assert.ok(paths.resolvedBy, 'resolvedBy path missing');
});

test('Report Service - exported functions check', async () => {
  const reportService = await import('../services/reportService.js');
  assert.equal(typeof reportService.createReport, 'function');
  assert.equal(typeof reportService.getReports, 'function');
  assert.equal(typeof reportService.updateReport, 'function');
});

test('Report Service - createReport validation for empty inputs', async () => {
  const reportService = await import('../services/reportService.js');

  await assert.rejects(
    () => reportService.createReport('507f1f77bcf86cd799439011', { reportedUserId: '', reason: 'test reason' }),
    (err) => {
      assert.equal(err.code, 'VALIDATION_ERROR');
      return true;
    }
  );

  await assert.rejects(
    () => reportService.createReport('507f1f77bcf86cd799439011', { reportedUserId: '507f1f77bcf86cd799439012', reason: '   ' }),
    (err) => {
      assert.equal(err.code, 'VALIDATION_ERROR');
      return true;
    }
  );

  await assert.rejects(
    () => reportService.createReport('507f1f77bcf86cd799439011', { reportedUserId: '507f1f77bcf86cd799439011', reason: 'self report reason' }),
    (err) => {
      assert.equal(err.code, 'VALIDATION_ERROR');
      assert.ok(err.message.includes('yourself'));
      return true;
    }
  );
});

test('User Service - peer block & admin block exports check', async () => {
  const userService = await import('../services/userService.js');
  assert.equal(typeof userService.blockUser, 'function');
  assert.equal(typeof userService.unblockUser, 'function');
  assert.equal(typeof userService.adminSetUserBlock, 'function');
});

test('User Service - blockUser rejects self-blocking and empty target', async () => {
  const userService = await import('../services/userService.js');

  await assert.rejects(
    () => userService.blockUser('507f1f77bcf86cd799439011', ''),
    (err) => {
      assert.equal(err.code, 'VALIDATION_ERROR');
      return true;
    }
  );

  await assert.rejects(
    () => userService.blockUser('507f1f77bcf86cd799439011', '507f1f77bcf86cd799439011'),
    (err) => {
      assert.equal(err.code, 'VALIDATION_ERROR');
      assert.ok(err.message.includes('yourself'));
      return true;
    }
  );
});

test('Report Controller - exported functions check', async () => {
  const reportController = await import('../controllers/reportController.js');
  assert.equal(typeof reportController.createReport, 'function');
  assert.equal(typeof reportController.getReports, 'function');
  assert.equal(typeof reportController.updateReport, 'function');
});

test('User Controller - block/unblock and admin status exports check', async () => {
  const userController = await import('../controllers/userController.js');
  assert.equal(typeof userController.blockUser, 'function');
  assert.equal(typeof userController.unblockUser, 'function');
  assert.equal(typeof userController.adminSetUserStatus, 'function');
});

test('Report Routes - router module exports router instance', async () => {
  const reportRoutes = await import('../routes/reportRoutes.js');
  assert.ok(reportRoutes.default, 'Default export for report routes missing');
});
