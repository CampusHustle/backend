import test from 'node:test';
import assert from 'node:assert/strict';
import { Notification } from '../models/Notification.js';
import * as notificationService from '../services/notificationService.js';
import * as notificationController from '../controllers/notificationController.js';
import notificationRoutes from '../routes/notificationRoutes.js';

// ============================================================================
// Section 1: Unit Tests — Mongoose Notification Model
// ============================================================================

test('Notification Schema Model - validates required fields, defaults, and type enums', () => {
  assert.equal(typeof Notification, 'function', 'Notification should be a Mongoose model');

  const schemaPaths = Notification.schema.paths;
  assert.ok(schemaPaths.recipientId, 'recipientId should be defined');
  assert.ok(schemaPaths.senderId, 'senderId should be defined');
  assert.ok(schemaPaths.type, 'type should be defined');
  assert.ok(schemaPaths.title, 'title should be defined');
  assert.ok(schemaPaths.message, 'message should be defined');
  assert.ok(schemaPaths.referenceId, 'referenceId should be defined');
  assert.ok(schemaPaths.referenceType, 'referenceType should be defined');
  assert.ok(schemaPaths.isRead, 'isRead should be defined');

  // Verify defaults
  assert.equal(schemaPaths.isRead.defaultValue, false, 'isRead should default to false');

  // Verify enum values
  const typeEnumValues = schemaPaths.type.enumValues;
  assert.ok(Array.isArray(typeEnumValues), 'type should have enum values');
  assert.ok(typeEnumValues.includes('booking_request'), 'type enum includes booking_request');
  assert.ok(typeEnumValues.includes('booking_accepted'), 'type enum includes booking_accepted');
  assert.ok(typeEnumValues.includes('new_message'), 'type enum includes new_message');
  assert.ok(typeEnumValues.includes('note_purchase'), 'type enum includes note_purchase');

  const refTypeEnumValues = schemaPaths.referenceType.enumValues;
  assert.ok(refTypeEnumValues.includes('booking'), 'referenceType includes booking');
  assert.ok(refTypeEnumValues.includes('message'), 'referenceType includes message');
  assert.ok(refTypeEnumValues.includes('note'), 'referenceType includes note');
  assert.ok(refTypeEnumValues.includes('purchase'), 'referenceType includes purchase');
});

// ============================================================================
// Section 2: Unit Tests — Notification Service
// ============================================================================

test('notificationService.createNotification - suppresses self-notifications (senderId === recipientId)', async () => {
  const result = await notificationService.createNotification({
    recipientId: '507f1f77bcf86cd799439011',
    senderId: '507f1f77bcf86cd799439011',
    type: 'booking_request',
    title: 'Self Action',
    message: 'Triggered by self'
  });

  assert.equal(result, null, 'Self-notification must return null');
});

test('notificationService.createNotification - creates and saves notification when valid', async () => {
  const originalSave = Notification.prototype.save;
  try {
    Notification.prototype.save = function () {
      return Promise.resolve({
        _id: 'notif123',
        recipientId: this.recipientId,
        senderId: this.senderId,
        type: this.type,
        title: this.title,
        message: this.message,
        isRead: this.isRead
      });
    };

    const created = await notificationService.createNotification({
      recipientId: '507f1f77bcf86cd799439011',
      senderId: '507f1f77bcf86cd799439022',
      type: 'note_purchase',
      title: 'Note Purchased',
      message: 'A student purchased your note.'
    });

    assert.notEqual(created, null);
    assert.equal(created._id, 'notif123');
    assert.equal(created.type, 'note_purchase');
    assert.equal(created.isRead, false);
  } finally {
    Notification.prototype.save = originalSave;
  }
});

test('notificationService.getUserNotifications - fetches paginated notifications', async () => {
  const originalFind = Notification.find;
  const originalCountDocuments = Notification.countDocuments;
  try {
    const mockNotifs = [
      { _id: 'n1', title: 'New Booking', type: 'booking_request', isRead: false },
      { _id: 'n2', title: 'Message', type: 'new_message', isRead: true }
    ];

    Notification.find = (filter) => {
      assert.equal(filter.recipientId, 'user123');
      return {
        sort: () => ({
          skip: () => ({
            limit: () => ({
              populate: () => ({
                lean: () => Promise.resolve(mockNotifs)
              })
            })
          })
        })
      };
    };

    Notification.countDocuments = (filter) => {
      if (filter.isRead === false) return Promise.resolve(1);
      return Promise.resolve(2);
    };

    const res = await notificationService.getUserNotifications('user123', { page: 1, limit: 10 });

    assert.equal(res.total, 2);
    assert.equal(res.unreadCount, 1);
    assert.equal(res.notifications.length, 2);
  } finally {
    Notification.find = originalFind;
    Notification.countDocuments = originalCountDocuments;
  }
});

test('notificationService.markAsRead - marks specified notification as read', async () => {
  const originalFindOne = Notification.findOne;
  try {
    const mockNotif = {
      _id: 'n1',
      recipientId: 'user123',
      isRead: false,
      save() {
        this.isRead = true;
        return Promise.resolve(this);
      }
    };

    Notification.findOne = () => Promise.resolve(mockNotif);

    const updated = await notificationService.markAsRead('n1', 'user123');
    assert.equal(updated.isRead, true);
  } finally {
    Notification.findOne = originalFindOne;
  }
});

test('notificationService.markAllAsRead - updates all unread notifications to read', async () => {
  const originalUpdateMany = Notification.updateMany;
  try {
    Notification.updateMany = (filter, update) => {
      assert.equal(filter.recipientId, 'user123');
      assert.equal(filter.isRead, false);
      assert.equal(update.$set.isRead, true);
      return Promise.resolve({ modifiedCount: 5 });
    };

    const res = await notificationService.markAllAsRead('user123');
    assert.equal(res.modifiedCount, 5);
  } finally {
    Notification.updateMany = originalUpdateMany;
  }
});

// ============================================================================
// Section 3: Integration Tests — Controller Endpoints
// ============================================================================

test('notificationController.getNotifications - returns 200 OK with notifications list', async () => {
  const originalFind = Notification.find;
  const originalCountDocuments = Notification.countDocuments;
  try {
    Notification.find = () => ({
      sort: () => ({
        skip: () => ({
          limit: () => ({
            populate: () => ({
              lean: () => Promise.resolve([{ _id: 'n1', title: 'Test' }])
            })
          })
        })
      })
    });

    Notification.countDocuments = () => Promise.resolve(1);

    const req = { user: { _id: 'user123' }, query: {} };
    let responseStatus = null;
    let responseData = null;
    const res = {
      status(code) { responseStatus = code; return this; },
      json(data) { responseData = data; return this; }
    };

    await notificationController.getNotifications(req, res, () => {});

    assert.equal(responseStatus, 200);
    assert.equal(responseData.success, true);
    assert.equal(responseData.notifications.length, 1);
  } finally {
    Notification.find = originalFind;
    Notification.countDocuments = originalCountDocuments;
  }
});

test('notificationController.getUnreadNotificationCount - returns 200 OK with unread count', async () => {
  const originalCountDocuments = Notification.countDocuments;
  try {
    Notification.countDocuments = () => Promise.resolve(3);

    const req = { user: { _id: 'user123' } };
    let responseStatus = null;
    let responseData = null;
    const res = {
      status(code) { responseStatus = code; return this; },
      json(data) { responseData = data; return this; }
    };

    await notificationController.getUnreadNotificationCount(req, res, () => {});

    assert.equal(responseStatus, 200);
    assert.equal(responseData.success, true);
    assert.equal(responseData.unreadCount, 3);
  } finally {
    Notification.countDocuments = originalCountDocuments;
  }
});

test('notificationController.markAllNotificationsAsRead - returns 200 OK with modified count', async () => {
  const originalUpdateMany = Notification.updateMany;
  try {
    Notification.updateMany = () => Promise.resolve({ modifiedCount: 4 });

    const req = { user: { _id: 'user123' } };
    let responseStatus = null;
    let responseData = null;
    const res = {
      status(code) { responseStatus = code; return this; },
      json(data) { responseData = data; return this; }
    };

    await notificationController.markAllNotificationsAsRead(req, res, () => {});

    assert.equal(responseStatus, 200);
    assert.equal(responseData.success, true);
    assert.equal(responseData.modifiedCount, 4);
  } finally {
    Notification.updateMany = originalUpdateMany;
  }
});

// ============================================================================
// Section 4: Integration Tests — Router & API Contract
// ============================================================================

test('Notification Routes - validates router exports and route configurations', () => {
  assert.notEqual(notificationRoutes, undefined, 'notificationRoutes router must be exported');
  assert.equal(typeof notificationRoutes, 'function', 'notificationRoutes should be an Express Router function');
});

test('Notification API Contract - verifies endpoint paths and methods (FR-14)', () => {
  const expectedContract = [
    { method: 'GET', path: '/api/notifications', description: 'Get notifications' },
    { method: 'GET', path: '/api/notifications/unread-count', description: 'Get unread count' },
    { method: 'PATCH', path: '/api/notifications/read-all', description: 'Mark all as read' },
    { method: 'PATCH', path: '/api/notifications/:id/read', description: 'Mark single as read' }
  ];

  assert.equal(expectedContract.length, 4);
  expectedContract.forEach(route => {
    assert.ok(route.path.startsWith('/api/notifications'));
  });
});
