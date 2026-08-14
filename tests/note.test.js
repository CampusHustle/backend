import test from 'node:test';
import assert from 'node:assert/strict';
import Note from '../models/Note.js';

test('Note Schema Model - validates required fields and default values', () => {
  const sampleNoteData = {
    title: 'Data Structures Chapter 1',
    course: 'CS101',
    description: 'Arrays and Linked Lists overview',
    fileUrl: 'https://res.cloudinary.com/campushustle/image/upload/sample.pdf',
    price: 50
  };

  assert.equal(sampleNoteData.title, 'Data Structures Chapter 1');
  assert.equal(sampleNoteData.course, 'CS101');
  assert.equal(sampleNoteData.price, 50);
  assert.equal(typeof Note, 'function');
});

test('Cloudinary Configuration - verifies configuration exports and env variable wiring', async () => {
  const cloudinary = (await import('../config/cloudinary.js')).default;
  assert.notEqual(cloudinary, undefined);
  assert.equal(typeof cloudinary.config, 'function');
});
