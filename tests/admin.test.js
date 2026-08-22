import test from 'node:test';
import assert from 'node:assert/strict';

test('Admin Service - exported functions check', async () => {
  const adminService = await import('../services/adminService.js');

  assert.equal(typeof adminService.getAdminStats, 'function');
  assert.equal(typeof adminService.listUsers, 'function');
  assert.equal(typeof adminService.getUserActivity, 'function');
  assert.equal(typeof adminService.updateUserRole, 'function');
  assert.equal(typeof adminService.banUser, 'function');
  assert.equal(typeof adminService.setUserBlocked, 'function');
  assert.equal(typeof adminService.requestAccountDeletion, 'function');
  assert.equal(typeof adminService.listDeletionRequests, 'function');
  assert.equal(typeof adminService.approveDeletionRequest, 'function');
  assert.equal(typeof adminService.rejectDeletionRequest, 'function');
  assert.equal(typeof adminService.deleteUserAccount, 'function');
});

test('Admin Controller - exported functions check', async () => {
  const adminController = await import('../controllers/adminController.js');

  assert.equal(typeof adminController.getStats, 'function');
  assert.equal(typeof adminController.getUsers, 'function');
  assert.equal(typeof adminController.getUserActivity, 'function');
  assert.equal(typeof adminController.updateUserRole, 'function');
  assert.equal(typeof adminController.banUser, 'function');
  assert.equal(typeof adminController.setUserStatus, 'function');
  assert.equal(typeof adminController.deleteUser, 'function');
  assert.equal(typeof adminController.getDeletionRequests, 'function');
  assert.equal(typeof adminController.approveDeletionRequest, 'function');
  assert.equal(typeof adminController.rejectDeletionRequest, 'function');
});

test('Admin Routes - router module exports router instance', async () => {
  const adminRoutes = await import('../routes/adminRoutes.js');
  assert.ok(adminRoutes.default, 'Default export for admin routes missing');
});

test('User Model - admin moderation fields exist', async () => {
  const { User } = await import('../models/User.js');

  assert.ok(User.schema.path('banDetails.isBanned'), 'banDetails.isBanned path missing');
  assert.ok(User.schema.path('banDetails.reason'), 'banDetails.reason path missing');
  assert.ok(User.schema.path('banDetails.bannedUntil'), 'banDetails.bannedUntil path missing');
  assert.ok(User.schema.path('deletionRequested.requested'), 'deletionRequested.requested path missing');
  assert.ok(User.schema.path('deletionRequested.reason'), 'deletionRequested.reason path missing');
  assert.ok(User.schema.path('deletionRequested.reviewedBy'), 'deletionRequested.reviewedBy path missing');
});
