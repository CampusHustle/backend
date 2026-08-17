import test from 'node:test';
import assert from 'node:assert/strict';
import { containsContactInfo } from '../utils/contactInfoDetector.js';
import { buildConversationId } from '../socket/socketServer.js';

// ─── Contact Info Detector (FR-8) ─────────────────────────────────────────────

test('contactInfoDetector - detects Ethiopian phone number', () => {
  assert.equal(containsContactInfo('call me on 0912345678'), true);
  assert.equal(containsContactInfo('my number is +251912345678'), true);
  assert.equal(containsContactInfo('reach me at 00251911223344'), true);
});

test('contactInfoDetector - detects Telegram handle', () => {
  assert.equal(containsContactInfo('find me on @daniel_gidey'), true);
  assert.equal(containsContactInfo('telegram: @campushustle'), true);
});

test('contactInfoDetector - detects email address', () => {
  assert.equal(containsContactInfo('email me at daniel@aau.edu.et'), true);
  assert.equal(containsContactInfo('contact: test@gmail.com'), true);
});

test('contactInfoDetector - detects Telegram link', () => {
  assert.equal(containsContactInfo('chat at t.me/myhandle'), true);
  assert.equal(containsContactInfo('https://telegram.me/username'), true);
});

test('contactInfoDetector - detects WhatsApp mention', () => {
  assert.equal(containsContactInfo('message me on WhatsApp'), true);
});

test('contactInfoDetector - passes clean messages', () => {
  assert.equal(containsContactInfo('Can you help me with calculus?'), false);
  assert.equal(containsContactInfo('I will be available Tuesday at 3pm'), false);
  assert.equal(containsContactInfo(''), false);
  assert.equal(containsContactInfo(null), false);
});

// ─── buildConversationId ──────────────────────────────────────────────────────

test('buildConversationId - is deterministic regardless of order', () => {
  const id1 = '507f1f77bcf86cd799439011';
  const id2 = '507f1f77bcf86cd799439012';

  const ab = buildConversationId(id1, id2);
  const ba = buildConversationId(id2, id1);

  assert.equal(ab, ba);
  assert.ok(ab.includes('_'));
});

test('buildConversationId - contains both user IDs', () => {
  const id1 = '507f1f77bcf86cd799439011';
  const id2 = '507f1f77bcf86cd799439012';

  const conv = buildConversationId(id1, id2);
  const parts = conv.split('_');

  assert.equal(parts.length, 2);
  assert.ok(parts.includes(id1));
  assert.ok(parts.includes(id2));
});

// ─── Message Model ────────────────────────────────────────────────────────────

test('Message model - module exports correctly', async () => {
  const { Message } = await import('../models/Message.js');
  assert.equal(typeof Message, 'function'); // Mongoose model is a constructor
  assert.equal(Message.modelName, 'Message');
});

test('Message model - schema has required fields', async () => {
  const { Message } = await import('../models/Message.js');
  const paths = Message.schema.paths;

  assert.ok(paths.conversationId, 'conversationId field missing');
  assert.ok(paths.senderId, 'senderId field missing');
  assert.ok(paths.content, 'content field missing');
  assert.ok(paths.containsContactInfo, 'containsContactInfo field missing');
});

test('Message model - containsContactInfo defaults to false', async () => {
  const { Message } = await import('../models/Message.js');
  const defaultValue = Message.schema.paths.containsContactInfo.defaultValue;
  assert.equal(defaultValue, false);
});

// ─── Socket Server ────────────────────────────────────────────────────────────

test('socketServer - initSocketServer and buildConversationId are exported', async () => {
  const mod = await import('../socket/socketServer.js');
  assert.equal(typeof mod.initSocketServer, 'function');
  assert.equal(typeof mod.buildConversationId, 'function');
});

// ─── Message Routes / Controller ─────────────────────────────────────────────

test('messageController - getMessages and getMessagesByUser are exported', async () => {
  const mod = await import('../controllers/messageController.js');
  assert.equal(typeof mod.getMessages, 'function');
  assert.equal(typeof mod.getMessagesByUser, 'function');
});
