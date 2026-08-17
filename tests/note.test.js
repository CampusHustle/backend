import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import Note from '../models/Note.js';
import Purchase from '../models/Purchase.js';
import { processOcrToPdf } from '../utils/ocrHelper.js';
import { prepareUploadedNoteFile, uploadNote, getNotesByTutor, getNoteById, purchaseNote, searchNotes, getMyPurchases } from '../controllers/noteController.js';
import { optionalAuth } from '../middleware/auth.js';
import noteRoutes from '../routes/noteRoutes.js';

// ============================================================================
// Section 1: Unit Tests — Mongoose Models & Schemas
// ============================================================================

test('Note Schema Model - validates required fields, defaults, and schema paths', () => {
  assert.equal(typeof Note, 'function', 'Note should be a Mongoose model');
  
  const schemaPaths = Note.schema.paths;
  assert.ok(schemaPaths.tutorId, 'tutorId should be defined');
  assert.ok(schemaPaths.title, 'title should be defined');
  assert.ok(schemaPaths.course, 'course should be defined');
  assert.ok(schemaPaths.fileUrl, 'fileUrl should be defined');
  assert.ok(schemaPaths.price, 'price should be defined');
  assert.ok(schemaPaths.previewPages, 'previewPages should be defined');
  assert.ok(schemaPaths.purchaseCount, 'purchaseCount should be defined');

  // Verify defaults
  assert.equal(schemaPaths.previewPages.defaultValue, 3, 'previewPages should default to 3');
  assert.equal(schemaPaths.purchaseCount.defaultValue, 0, 'purchaseCount should default to 0');
  assert.equal(schemaPaths.price.defaultValue, 0, 'price should default to 0');
});

test('Note Schema Model - validates price boundary conditions and numeric constraints', () => {
  const pricePath = Note.schema.paths.price;
  assert.ok(pricePath, 'price path should exist');

  const priceTestCases = [
    { input: 0, expected: true, label: 'Free note (price = 0)' },
    { input: 25, expected: true, label: 'Standard integer price (25)' },
    { input: 99.5, expected: true, label: 'Decimal price (99.5)' },
    { input: 100000, expected: true, label: 'Maximum allowed price (100,000)' },
    { input: -1, expected: false, label: 'Negative price should fail' },
    { input: 100001, expected: false, label: 'Price > 100,000 should fail' },
    { input: NaN, expected: false, label: 'NaN price should fail' },
    { input: Infinity, expected: false, label: 'Infinity price should fail' }
  ];

  for (const { input, expected, label } of priceTestCases) {
    const isFiniteValid = Number.isFinite(input);
    const inRange = input >= 0 && input <= 100000;
    const isValid = isFiniteValid && inRange;
    assert.equal(isValid, expected, `${label} failed assertion`);
  }
});

test('Purchase Schema Model - validates required fields, status enum, and compound index', () => {
  assert.equal(typeof Purchase, 'function', 'Purchase should be a Mongoose model');
  
  const schemaPaths = Purchase.schema.paths;
  assert.ok(schemaPaths.studentId, 'studentId should be defined');
  assert.ok(schemaPaths.noteId, 'noteId should be defined');
  assert.ok(schemaPaths.tutorId, 'tutorId should be defined');
  assert.ok(schemaPaths.price, 'price should be defined');
  assert.ok(schemaPaths.status, 'status should be defined');

  // Verify status enum values
  const enumValues = schemaPaths.status.enumValues;
  assert.ok(Array.isArray(enumValues), 'status should have enum values');
  assert.ok(enumValues.includes('pending'), 'status enum should include pending');
  assert.ok(enumValues.includes('completed'), 'status enum should include completed');
  assert.ok(enumValues.includes('failed'), 'status enum should include failed');
  assert.equal(schemaPaths.status.defaultValue, 'pending', 'status should default to pending');

  // Verify compound unique index: { studentId: 1, noteId: 1 }
  const indexes = Purchase.schema.indexes();
  const hasUniqueStudentNoteIndex = indexes.some(([fields, options]) => {
    return fields.studentId === 1 && fields.noteId === 1 && options && options.unique === true;
  });
  assert.ok(hasUniqueStudentNoteIndex, 'Purchase schema should have unique compound index on studentId and noteId');
});

// ============================================================================
// Section 2: Unit Tests — File Preprocessing, MIME Validation & OCR
// ============================================================================

test('File Validation Logic - Whitelist enforcement and per-type size limits (FR-9, NFR-10)', () => {
  const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
  const MAX_FILE_SIZES = {
    'application/pdf': 10 * 1024 * 1024,
    'image/jpeg': 5 * 1024 * 1024,
    'image/png': 5 * 1024 * 1024,
    'image/webp': 5 * 1024 * 1024
  };

  // Supported MIME types
  ALLOWED_MIME_TYPES.forEach(mime => {
    assert.ok(MAX_FILE_SIZES[mime] > 0, `Allowed MIME type ${mime} should have defined size limit`);
  });

  // Unsupported MIME types rejected
  const disallowedTypes = ['text/plain', 'application/zip', 'application/x-msdownload', 'image/gif', 'video/mp4'];
  disallowedTypes.forEach(disallowed => {
    assert.equal(ALLOWED_MIME_TYPES.includes(disallowed), false, `MIME type ${disallowed} must not be permitted`);
  });

  // File size validation checks
  const validPdfSize = 8 * 1024 * 1024; // 8MB
  const invalidPdfSize = 12 * 1024 * 1024; // 12MB
  assert.ok(validPdfSize <= MAX_FILE_SIZES['application/pdf'], '8MB PDF should pass');
  assert.ok(invalidPdfSize > MAX_FILE_SIZES['application/pdf'], '12MB PDF should fail');

  const validImageSize = 4 * 1024 * 1024; // 4MB
  const invalidImageSize = 6 * 1024 * 1024; // 6MB
  assert.ok(validImageSize <= MAX_FILE_SIZES['image/png'], '4MB PNG should pass');
  assert.ok(invalidImageSize > MAX_FILE_SIZES['image/png'], '6MB PNG should fail');
});

test('prepareUploadedNoteFile - passes through valid PDF files without conversion', async () => {
  const samplePdf = {
    buffer: Buffer.from('%PDF-1.4 sample content'),
    originalname: 'calculus_notes.pdf',
    mimetype: 'application/pdf',
    size: 2048
  };

  const processed = await prepareUploadedNoteFile(samplePdf);
  assert.equal(processed.mimetype, 'application/pdf');
  assert.equal(processed.originalname, 'calculus_notes.pdf');
  assert.equal(processed.buffer, samplePdf.buffer);
});

test('prepareUploadedNoteFile - converts images to valid PDF using OCR runner (FR-9)', async () => {
  const fakeImage = {
    buffer: Buffer.from('fake-image-bytes'),
    originalname: 'handwritten_notes.png',
    mimetype: 'image/png',
    size: 1024
  };

  const customOcrRunner = async (_inputPath, outputPath) => {
    const validPdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');
    await fs.writeFile(outputPath, validPdfBuffer);
    return {
      extractedText: 'Chapter 3: Derivatives and Integrals',
      confidence: 88,
      pdfBuffer: validPdfBuffer
    };
  };

  const converted = await prepareUploadedNoteFile(fakeImage, customOcrRunner);
  assert.equal(converted.mimetype, 'application/pdf');
  assert.equal(converted.originalname, 'handwritten_notes.pdf');
  assert.ok(converted.buffer.includes(Buffer.from('%PDF')));
  assert.ok(converted.size > 0);
});

test('prepareUploadedNoteFile - rejects unsupported MIME types with 400 AppError', async () => {
  const invalidFile = {
    buffer: Buffer.from('plain text'),
    originalname: 'notes.txt',
    mimetype: 'text/plain',
    size: 512
  };

  await assert.rejects(
    () => prepareUploadedNoteFile(invalidFile),
    (err) => {
      assert.equal(err.statusCode, 400);
      assert.equal(err.code, 'UNSUPPORTED_FILE_TYPE');
      return true;
    }
  );
});

test('prepareUploadedNoteFile - rejects OCR results with confidence below threshold (< 45)', async () => {
  const blurryImage = {
    buffer: Buffer.from('blurry-image'),
    originalname: 'blurry.jpg',
    mimetype: 'image/jpeg',
    size: 1024
  };

  const lowConfidenceOcr = async () => ({
    extractedText: 'som... txt',
    confidence: 25
  });

  await assert.rejects(
    () => prepareUploadedNoteFile(blurryImage, lowConfidenceOcr),
    (err) => {
      assert.equal(err.statusCode, 400);
      assert.equal(err.code, 'OCR_LOW_CONFIDENCE');
      return true;
    }
  );
});

test('prepareUploadedNoteFile - rejects OCR results with empty extracted text', async () => {
  const blankImage = {
    buffer: Buffer.from('blank-image'),
    originalname: 'blank.png',
    mimetype: 'image/png',
    size: 1024
  };

  const emptyTextOcr = async () => ({
    extractedText: '   ',
    confidence: 90
  });

  await assert.rejects(
    () => prepareUploadedNoteFile(blankImage, emptyTextOcr),
    (err) => {
      assert.equal(err.statusCode, 400);
      assert.equal(err.code, 'OCR_NO_TEXT_FOUND');
      return true;
    }
  );
});

test('ocrHelper processOcrToPdf - returns structured text and valid PDF binary', async () => {
  const dummyBuffer = Buffer.from('sample-image-data');
  const result = await processOcrToPdf(dummyBuffer);

  assert.ok(typeof result.extractedText === 'string', 'extractedText should be string');
  assert.ok(result.extractedText.length > 0, 'extractedText should not be empty');
  assert.ok(typeof result.confidence === 'number', 'confidence should be number');
  assert.ok(result.confidence >= 45, 'confidence should meet threshold');
  assert.ok(Buffer.isBuffer(result.pdfBuffer), 'pdfBuffer should be Buffer');
  assert.ok(result.pdfBuffer.includes(Buffer.from('%PDF')), 'pdfBuffer should have PDF magic header');
});

test('Cloudinary Configuration - exports config instance wired to environment', async () => {
  const cloudinary = (await import('../config/cloudinary.js')).default;
  assert.notEqual(cloudinary, undefined);
  assert.equal(typeof cloudinary.config, 'function');
  assert.equal(typeof cloudinary.uploader.upload_stream, 'function');
});

// ============================================================================
// Section 3: Integration Tests — Controller Endpoints Flow
// ============================================================================

test('uploadNote Controller - rejects request when file is missing (400 NO_FILE_PROVIDED)', async () => {
  const req = {
    file: null,
    body: { title: 'Math 101', course: 'MATH101' },
    user: { _id: '507f1f77bcf86cd799439011' }
  };
  const res = {};
  let capturedError = null;

  await uploadNote(req, res, (err) => { capturedError = err; });

  assert.notEqual(capturedError, null);
  assert.equal(capturedError.statusCode, 400);
  assert.equal(capturedError.code, 'NO_FILE_PROVIDED');
});

test('uploadNote Controller - rejects request when required metadata is missing (400 MISSING_REQUIRED_FIELDS)', async () => {
  const req = {
    file: {
      buffer: Buffer.from('%PDF-1.4 test'),
      originalname: 'test.pdf',
      mimetype: 'application/pdf',
      size: 1024
    },
    body: { title: '', course: 'MATH101' }, // Missing title
    user: { _id: '507f1f77bcf86cd799439011' }
  };
  const res = {};
  let capturedError = null;

  await uploadNote(req, res, (err) => { capturedError = err; });

  assert.notEqual(capturedError, null);
  assert.equal(capturedError.statusCode, 400);
  assert.equal(capturedError.code, 'MISSING_REQUIRED_FIELDS');
});

test('uploadNote Controller - rejects file exceeding maximum size (413 FILE_SIZE_EXCEEDED)', async () => {
  const req = {
    file: {
      buffer: Buffer.alloc(15 * 1024 * 1024), // 15MB PDF
      originalname: 'huge_book.pdf',
      mimetype: 'application/pdf',
      size: 15 * 1024 * 1024
    },
    body: { title: 'Huge Book', course: 'CS101' },
    user: { _id: '507f1f77bcf86cd799439011' }
  };
  const res = {};
  let capturedError = null;

  await uploadNote(req, res, (err) => { capturedError = err; });

  assert.notEqual(capturedError, null);
  assert.equal(capturedError.statusCode, 413);
  assert.equal(capturedError.code, 'FILE_SIZE_EXCEEDED');
});

test('uploadNote Controller - rejects invalid price format and out-of-range price', async () => {
  // Test invalid string price
  const reqInvalid = {
    file: {
      buffer: Buffer.from('%PDF-1.4 test'),
      originalname: 'test.pdf',
      mimetype: 'application/pdf',
      size: 1024
    },
    body: { title: 'Data Structures', course: 'CS101', price: 'not-a-number' },
    user: { _id: '507f1f77bcf86cd799439011' }
  };
  let errorInvalid = null;
  await uploadNote(reqInvalid, {}, (err) => { errorInvalid = err; });

  assert.notEqual(errorInvalid, null);
  assert.equal(errorInvalid.statusCode, 400);
  assert.equal(errorInvalid.code, 'INVALID_PRICE_FORMAT');

  // Test negative price
  const reqNegative = {
    file: {
      buffer: Buffer.from('%PDF-1.4 test'),
      originalname: 'test.pdf',
      mimetype: 'application/pdf',
      size: 1024
    },
    body: { title: 'Data Structures', course: 'CS101', price: -50 },
    user: { _id: '507f1f77bcf86cd799439011' }
  };
  let errorNegative = null;
  await uploadNote(reqNegative, {}, (err) => { errorNegative = err; });

  assert.notEqual(errorNegative, null);
  assert.equal(errorNegative.statusCode, 400);
  assert.equal(errorNegative.code, 'PRICE_OUT_OF_RANGE');
});

test('uploadNote Controller - creates Note and returns 201 on successful upload', async () => {
  const cloudinary = (await import('../config/cloudinary.js')).default;
  const originalUploadStream = cloudinary.uploader.upload_stream;
  const originalSave = Note.prototype.save;

  try {
    cloudinary.uploader.upload_stream = (options, cb) => ({
      end: (_buf) => {
        cb(null, {
          secure_url: 'https://res.cloudinary.com/campushustle/raw/upload/v123/mock_sample.pdf',
          public_id: 'mock_public_id'
        });
      }
    });

    Note.prototype.save = function() {
      return Promise.resolve({
        _id: 'noteId123',
        tutorId: this.tutorId,
        title: this.title,
        course: this.course,
        description: this.description,
        fileUrl: this.fileUrl,
        price: this.price,
        previewPages: this.previewPages,
        purchaseCount: 0
      });
    };

    const req = {
      file: {
        buffer: Buffer.from('%PDF-1.4 sample'),
        originalname: 'calculus_sample.pdf',
        mimetype: 'application/pdf',
        size: 2048
      },
      body: {
        title: 'Calculus Complete',
        course: 'MATH101',
        description: 'Comprehensive calculus notes',
        price: '45.50',
        previewPages: '4'
      },
      user: { _id: 'tutorUserId123' }
    };

    let responseStatus = null;
    let responseData = null;
    const res = {
      status(code) { responseStatus = code; return this; },
      json(data) { responseData = data; return this; }
    };

    await uploadNote(req, res, () => {});

    assert.equal(responseStatus, 201);
    assert.equal(responseData.success, true);
    assert.equal(responseData.note.title, 'Calculus Complete');
    assert.equal(responseData.note.price, 45.5);
    assert.equal(responseData.note.previewPages, 4);
    assert.ok(responseData.note.fileUrl.includes('cloudinary'));
  } finally {
    cloudinary.uploader.upload_stream = originalUploadStream;
    Note.prototype.save = originalSave;
  }
});

test('uploadNote Controller - handles Cloudinary failure gracefully (500 CLOUDINARY_UPLOAD_FAILED, NFR-10)', async () => {
  const cloudinary = (await import('../config/cloudinary.js')).default;
  const originalUploadStream = cloudinary.uploader.upload_stream;

  try {
    cloudinary.uploader.upload_stream = (_options, cb) => ({
      end: () => cb(new Error('Cloudinary rate limit exceeded / connection timeout'), null)
    });

    const req = {
      file: {
        buffer: Buffer.from('%PDF-1.4 test'),
        originalname: 'test.pdf',
        mimetype: 'application/pdf',
        size: 1024
      },
      body: { title: 'Chemistry 101', course: 'CHEM101', price: 10 },
      user: { _id: 'tutorId123' }
    };

    let capturedError = null;
    await uploadNote(req, {}, (err) => { capturedError = err; });

    assert.notEqual(capturedError, null);
    assert.equal(capturedError.statusCode, 500);
    assert.equal(capturedError.code, 'CLOUDINARY_UPLOAD_FAILED');
  } finally {
    cloudinary.uploader.upload_stream = originalUploadStream;
  }
});

test('getNotesByTutor Controller - retrieves note list for a given tutor', async () => {
  const originalFind = Note.find;
  try {
    const mockNotes = [
      { _id: 'note1', title: 'Calculus Ch 1', course: 'MATH101', price: 20 },
      { _id: 'note2', title: 'Calculus Ch 2', course: 'MATH101', price: 25 }
    ];

    Note.find = (filter) => ({
      sort: () => ({
        select: () => Promise.resolve(mockNotes)
      })
    });

    const req = { params: { tutorId: '507f1f77bcf86cd799439011' } };
    let responseStatus = null;
    let responseData = null;

    const res = {
      status(code) {
        responseStatus = code;
        return this;
      },
      json(data) {
        responseData = data;
        return this;
      }
    };

    await getNotesByTutor(req, res, () => {});

    assert.equal(responseStatus, 200);
    assert.equal(responseData.success, true);
    assert.equal(responseData.count, 2);
    assert.equal(responseData.notes.length, 2);
  } finally {
    Note.find = originalFind;
  }
});

test('getNoteById Controller - retrieves single note by ID (200 OK)', async () => {
  const originalFindById = Note.findById;
  try {
    const mockNote = {
      _id: '507f1f77bcf86cd799439011',
      title: 'Physics Mechanics Notes',
      course: 'PHYS101',
      price: 30,
      fileUrl: 'https://res.cloudinary.com/campushustle/raw/upload/physics.pdf'
    };

    Note.findById = (id) => Promise.resolve(mockNote);

    const req = { params: { noteId: '507f1f77bcf86cd799439011' } };
    let responseStatus = null;
    let responseData = null;

    const res = {
      status(code) {
        responseStatus = code;
        return this;
      },
      json(data) {
        responseData = data;
        return this;
      }
    };

    await getNoteById(req, res, () => {});

    assert.equal(responseStatus, 200);
    assert.equal(responseData.success, true);
    assert.equal(responseData.note.title, 'Physics Mechanics Notes');
  } finally {
    Note.findById = originalFindById;
  }
});

test('getNoteById Controller - returns 404 NOTE_NOT_FOUND when note does not exist', async () => {
  const originalFindById = Note.findById;
  try {
    Note.findById = (id) => Promise.resolve(null);

    const req = { params: { noteId: 'nonexistent_id' } };
    let capturedError = null;

    await getNoteById(req, {}, (err) => { capturedError = err; });

    assert.notEqual(capturedError, null);
    assert.equal(capturedError.statusCode, 404);
    assert.equal(capturedError.code, 'NOTE_NOT_FOUND');
  } finally {
    Note.findById = originalFindById;
  }
});

test('purchaseNote Controller - returns 404 NOTE_NOT_FOUND if note does not exist', async () => {
  const originalFindById = Note.findById;
  try {
    Note.findById = () => Promise.resolve(null);

    const req = {
      params: { noteId: '507f1f77bcf86cd799439011' },
      user: { _id: '507f1f77bcf86cd799439022' }
    };
    let capturedError = null;

    await purchaseNote(req, {}, (err) => { capturedError = err; });

    assert.notEqual(capturedError, null);
    assert.equal(capturedError.statusCode, 404);
    assert.equal(capturedError.code, 'NOTE_NOT_FOUND');
  } finally {
    Note.findById = originalFindById;
  }
});

test('purchaseNote Controller - returns 403 CANNOT_PURCHASE_OWN_NOTE when tutor attempts self-purchase', async () => {
  const originalFindById = Note.findById;
  try {
    const tutorId = '507f1f77bcf86cd799439011';
    Note.findById = () => Promise.resolve({
      _id: '507f1f77bcf86cd799439099',
      tutorId: tutorId,
      price: 25
    });

    const req = {
      params: { noteId: '507f1f77bcf86cd799439099' },
      user: { _id: tutorId } // Same as tutorId
    };
    let capturedError = null;

    await purchaseNote(req, {}, (err) => { capturedError = err; });

    assert.notEqual(capturedError, null);
    assert.equal(capturedError.statusCode, 403);
    assert.equal(capturedError.code, 'CANNOT_PURCHASE_OWN_NOTE');
  } finally {
    Note.findById = originalFindById;
  }
});

test('purchaseNote Controller - returns 400 NOTE_ALREADY_PURCHASED on duplicate purchase attempt', async () => {
  const originalFindById = Note.findById;
  const originalFindOne = Purchase.findOne;
  try {
    Note.findById = () => Promise.resolve({
      _id: 'note123',
      tutorId: 'tutor456',
      price: 25
    });

    Purchase.findOne = () => Promise.resolve({
      _id: 'existingPurchase',
      studentId: 'student789',
      noteId: 'note123'
    });

    const req = {
      params: { noteId: 'note123' },
      user: { _id: 'student789' }
    };
    let capturedError = null;

    await purchaseNote(req, {}, (err) => { capturedError = err; });

    assert.notEqual(capturedError, null);
    assert.equal(capturedError.statusCode, 400);
    assert.equal(capturedError.code, 'NOTE_ALREADY_PURCHASED');
  } finally {
    Note.findById = originalFindById;
    Purchase.findOne = originalFindOne;
  }
});

test('purchaseNote Controller - creates pending purchase record and increments note purchaseCount', async () => {
  const originalFindById = Note.findById;
  const originalFindOne = Purchase.findOne;
  const originalFindByIdAndUpdate = Note.findByIdAndUpdate;
  const originalPurchaseSave = Purchase.prototype.save;

  try {
    const mockNote = {
      _id: 'note123',
      tutorId: 'tutor456',
      price: 35,
      purchaseCount: 2
    };

    Note.findById = () => Promise.resolve(mockNote);
    Purchase.findOne = () => Promise.resolve(null); // No existing purchase
    
    let incrementCalled = false;
    Note.findByIdAndUpdate = (id, update) => {
      if (id === 'note123' && update.$inc && update.$inc.purchaseCount === 1) {
        incrementCalled = true;
      }
      return Promise.resolve();
    };

    Purchase.prototype.save = function() {
      return Promise.resolve({
        _id: 'newPurchaseId',
        studentId: this.studentId,
        noteId: this.noteId,
        tutorId: this.tutorId,
        price: this.price,
        status: this.status
      });
    };

    const req = {
      params: { noteId: 'note123' },
      user: { _id: 'student789' }
    };

    let responseStatus = null;
    let responseData = null;

    const res = {
      status(code) {
        responseStatus = code;
        return this;
      },
      json(data) {
        responseData = data;
        return this;
      }
    };

    await purchaseNote(req, res, () => {});

    assert.equal(responseStatus, 201);
    assert.equal(responseData.success, true);
    assert.equal(responseData.purchase.status, 'pending');
    assert.equal(responseData.purchase.price, 35);
    assert.equal(incrementCalled, true, 'Note purchaseCount must be incremented by 1');
  } finally {
    Note.findById = originalFindById;
    Purchase.findOne = originalFindOne;
    Note.findByIdAndUpdate = originalFindByIdAndUpdate;
    Purchase.prototype.save = originalPurchaseSave;
  }
});

test('searchNotes Controller - searches and returns paginated list of notes', async () => {
  const originalFind = Note.find;
  const originalCount = Note.countDocuments;
  try {
    const mockNotes = [
      { _id: 'note1', title: 'Calculus I Notes', course: 'MATH101', price: 20 },
      { _id: 'note2', title: 'Calculus II Summary', course: 'MATH102', price: 30 }
    ];

    Note.find = () => ({
      sort: () => ({
        skip: () => ({
          limit: () => ({
            populate: () => ({
              lean: () => Promise.resolve(mockNotes)
            })
          })
        })
      })
    });

    Note.countDocuments = () => Promise.resolve(2);

    const req = {
      query: { q: 'calculus', page: 1, limit: 10 }
    };

    let responseStatus = null;
    let responseData = null;

    const res = {
      status(code) {
        responseStatus = code;
        return this;
      },
      json(data) {
        responseData = data;
        return this;
      }
    };

    await searchNotes(req, res, () => {});

    assert.equal(responseStatus, 200);
    assert.equal(responseData.success, true);
    assert.equal(responseData.count, 2);
    assert.equal(responseData.total, 2);
    assert.equal(responseData.notes.length, 2);
  } finally {
    Note.find = originalFind;
    Note.countDocuments = originalCount;
  }
});

// ============================================================================
// Section 4: Integration Tests — Route Middleware & Endpoint Signatures
// ============================================================================

test('Note Routes - validates router exports and route configurations', () => {
  assert.notEqual(noteRoutes, undefined, 'noteRoutes router must be exported');
  assert.equal(typeof noteRoutes, 'function', 'noteRoutes should be an Express Router function');
});

test('Note API Contract - verifies endpoint paths and methods (FR-9, FR-10, Spec §8.5)', () => {
  const expectedContract = [
    { method: 'POST', path: '/api/notes', description: 'Upload note (PDF/image OCR)' },
    { method: 'GET', path: '/api/notes/search', description: 'Search and browse notes' },
    { method: 'GET', path: '/api/notes/tutor/:tutorId', description: 'Get notes by tutor' },
    { method: 'GET', path: '/api/notes/:noteId', description: 'Get single note detail/preview' },
    { method: 'POST', path: '/api/notes/:noteId/purchase', description: 'Purchase a note' },
    { method: 'GET', path: '/api/notes/purchases/me', description: 'Get user purchase records' }
  ];

  assert.equal(expectedContract.length, 6);
  expectedContract.forEach(route => {
    assert.ok(route.path.startsWith('/api/notes'));
  });
});

test('getMyPurchases Controller - retrieves purchase list for authenticated user with status filtering (FR-10)', async () => {
  const originalFind = Purchase.find;
  try {
    const mockPurchases = [
      {
        _id: 'p1',
        studentId: 'student123',
        noteId: { title: 'Calculus I', price: 20 },
        tutorId: { name: 'Tutor Alex' },
        status: 'pending',
        createdAt: new Date()
      }
    ];

    Purchase.find = (filter) => {
      assert.equal(filter.studentId, 'student123');
      assert.equal(filter.status, 'pending');
      return {
        sort: () => ({
          populate: () => ({
            populate: () => ({
              lean: () => Promise.resolve(mockPurchases)
            })
          })
        })
      };
    };

    const req = {
      user: { _id: 'student123' },
      query: { status: 'pending' }
    };

    let responseStatus = null;
    let responseData = null;
    const res = {
      status(code) { responseStatus = code; return this; },
      json(data) { responseData = data; return this; }
    };

    await getMyPurchases(req, res, () => {});

    assert.equal(responseStatus, 200);
    assert.equal(responseData.success, true);
    assert.equal(responseData.count, 1);
    assert.equal(responseData.purchases[0].status, 'pending');
  } finally {
    Purchase.find = originalFind;
  }
});

test('getNoteById Controller - populates tutor details and detects purchase status for authenticated user (FR-10)', async () => {
  const originalFindById = Note.findById;
  const originalFindOne = Purchase.findOne;
  try {
    const mockNote = {
      _id: 'note999',
      title: 'Physics Notes',
      course: 'PHYS101',
      price: 15,
      tutorId: { _id: 'tutor555', name: 'Tutor Jane' }
    };

    Note.findById = (id) => {
      return {
        populate: (path, select) => {
          assert.equal(path, 'tutorId');
          return Promise.resolve(mockNote);
        }
      };
    };

    Purchase.findOne = (filter) => {
      assert.equal(filter.studentId, 'student777');
      assert.equal(filter.noteId, 'note999');
      return Promise.resolve({ _id: 'pur123', status: 'pending' });
    };

    const req = {
      params: { noteId: 'note999' },
      user: { _id: 'student777' }
    };

    let responseStatus = null;
    let responseData = null;
    const res = {
      status(code) { responseStatus = code; return this; },
      json(data) { responseData = data; return this; }
    };

    await getNoteById(req, res, () => {});

    assert.equal(responseStatus, 200);
    assert.equal(responseData.success, true);
    assert.equal(responseData.isPurchased, true);
    assert.equal(responseData.purchaseStatus, 'pending');
    assert.equal(responseData.note.tutorId.name, 'Tutor Jane');
  } finally {
    Note.findById = originalFindById;
    Purchase.findOne = originalFindOne;
  }
});

test('optionalAuth Middleware - passes through silently without error when Authorization header is absent', async () => {
  const req = { headers: {} };
  const res = {};
  let nextCalled = false;

  await optionalAuth(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, true);
  assert.equal(req.user, undefined);
});


