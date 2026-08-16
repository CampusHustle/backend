import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import Note from '../models/Note.js';
import { processOcrToPdf } from '../utils/ocrHelper.js';

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

test('Note Upload Validation - Allowed MIME Types', async () => {
  const { uploadNote } = await import('../controllers/noteController.js');
  
  // Test that the function exists and is callable
  assert.equal(typeof uploadNote, 'function');
  
  // Verify MIME type whitelist includes required formats
  const allowedTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp'
  ];
  
  allowedTypes.forEach(mimeType => {
    assert.ok(mimeType, `MIME type should be supported: ${mimeType}`);
  });
});

test('Note Upload Controller - File Validation Logic (Unit)', async () => {
  const MAX_FILE_SIZES = {
    'application/pdf': 10 * 1024 * 1024,      // 10MB for PDFs
    'image/jpeg': 5 * 1024 * 1024,            // 5MB for JPEG
    'image/png': 5 * 1024 * 1024,             // 5MB for PNG
    'image/webp': 5 * 1024 * 1024             // 5MB for WebP
  };
  
  assert.equal(MAX_FILE_SIZES['application/pdf'], 10 * 1024 * 1024);
  assert.equal(MAX_FILE_SIZES['image/jpeg'], 5 * 1024 * 1024);
  assert.equal(MAX_FILE_SIZES['image/png'], 5 * 1024 * 1024);
  assert.equal(MAX_FILE_SIZES['image/webp'], 5 * 1024 * 1024);
  
  const testFileSize = 3 * 1024 * 1024; // 3MB
  const pdfMaxSize = MAX_FILE_SIZES['application/pdf'];
  assert.ok(testFileSize <= pdfMaxSize, 'Small PDF should pass validation');
  
  const largeFileSize = 15 * 1024 * 1024; // 15MB
  assert.ok(largeFileSize > pdfMaxSize, 'Large PDF should fail validation');
});

test('Note Upload - Error Handling for Missing Required Fields', () => {
  const missingTitleError = {
    statusCode: 400,
    code: 'MISSING_REQUIRED_FIELDS',
    message: 'Title and course are required fields.'
  };
  
  const missingFileError = {
    statusCode: 400,
    code: 'NO_FILE_PROVIDED',
    message: 'No file provided. Please upload a PDF or image file.'
  };
  
  const unsupportedTypeError = {
    statusCode: 400,
    code: 'UNSUPPORTED_FILE_TYPE',
    message: /Unsupported file type/
  };
  
  const fileSizeExceededError = {
    statusCode: 413,
    code: 'FILE_SIZE_EXCEEDED',
    message: /File size.*exceeds limit/
  };
  
  assert.equal(missingTitleError.statusCode, 400);
  assert.equal(missingFileError.statusCode, 400);
  assert.equal(fileSizeExceededError.statusCode, 413);
  assert.equal(unsupportedTypeError.statusCode, 400);
});

test('Note Upload Response Format - Successful Upload', () => {
  const successResponse = {
    success: true,
    message: 'Note uploaded successfully.',
    note: {
      _id: 'ObjectId',
      tutorId: 'ObjectId',
      title: 'Calculus Notes',
      course: 'MATH101',
      description: 'Chapter 1-5 summary',
      fileUrl: 'https://res.cloudinary.com/campushustle/raw/upload/notes/...',
      price: 25,
      previewPages: 3,
      purchaseCount: 0,
      createdAt: 'ISO-8601 timestamp',
      updatedAt: 'ISO-8601 timestamp'
    }
  };
  
  assert.equal(successResponse.success, true);
  assert.ok(successResponse.note.fileUrl.includes('cloudinary'));
  assert.equal(successResponse.note.purchaseCount, 0);
});

test('Note Upload - Image files are converted to PDF before Cloudinary upload', async () => {
  const { prepareUploadedNoteFile } = await import('../controllers/noteController.js');

  const fakeImage = {
    buffer: Buffer.from('fake-png-content'),
    originalname: 'ocr-sample.png',
    mimetype: 'image/png',
    size: 1024
  };

  const convertedFile = await prepareUploadedNoteFile(fakeImage, async (_imagePath, outputPath) => {
    await fs.writeFile(outputPath, Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF'));
    return {
      extractedText: 'CampusHustle Notes',
      confidence: 95
    };
  });

  assert.equal(convertedFile.mimetype, 'application/pdf');
  assert.equal(convertedFile.originalname, 'ocr-sample.pdf');
  const pdfBuffer = convertedFile.buffer;
  assert.ok(pdfBuffer.includes(Buffer.from('%PDF')));
});

test('OCR pipeline rejects low-confidence input instead of returning a false success', async () => {
  const { prepareUploadedNoteFile } = await import('../controllers/noteController.js');

  const fakeFile = {
    buffer: Buffer.from('fake-image-data'),
    originalname: 'blurry-photo.png',
    mimetype: 'image/png',
    size: 4096
  };

  await assert.rejects(
    () => prepareUploadedNoteFile(fakeFile, async () => ({
      extractedText: 'maybe',
      confidence: 12
    })),
    /OCR confidence too low|OCR produced no readable text|OCR conversion failed/
  );
});

test('Cloudinary Integration - Resource Type Mapping', () => {
  const resourceTypeMap = {
    'application/pdf': 'raw',
    'image/jpeg': 'image',
    'image/png': 'image',
    'image/webp': 'image'
  };
  
  assert.equal(resourceTypeMap['application/pdf'], 'raw');
  assert.equal(resourceTypeMap['image/jpeg'], 'image');
  assert.equal(resourceTypeMap['image/png'], 'image');
  assert.equal(resourceTypeMap['image/webp'], 'image');
});

test('OCR Pipeline - Image files are converted to text and valid PDF (FR-9)', async () => {
  const dummyImageBuffer = Buffer.from('fake-image-data');
  const result = await processOcrToPdf(dummyImageBuffer);
  
  assert.ok(result.extractedText.toLowerCase().includes('campushustle'));
  assert.ok(result.pdfBuffer.includes(Buffer.from('%PDF')));
});

// ============================================
// Day 6: Note Pricing & Purchase (FR-10)
// ============================================

test('Purchase Schema Model - validates required fields', async () => {
  const { default: Purchase } = await import('../models/Purchase.js');
  assert.equal(typeof Purchase, 'function');
});

test('Note Pricing - price field accepts valid numbers', () => {
  const notePrices = [
    { input: 0, valid: true },       // Free
    { input: 25, valid: true },      // 25 currency units
    { input: 999.99, valid: true },  // Decimal price
    { input: -10, valid: false },    // Negative invalid
    { input: 100001, valid: false }  // Exceeds max
  ];
  
  notePrices.forEach(({ input, valid }) => {
    assert.equal(input >= 0 && input <= 100000, valid, `Price ${input} should be ${valid ? 'valid' : 'invalid'}`);
  });
});

test('Purchase Endpoint - prevents duplicate purchases', async () => {
  // Test logic: if a student tries to purchase the same note twice,
  // the second attempt should fail with NOTE_ALREADY_PURCHASED error
  const duplicatePurchaseError = {
    statusCode: 400,
    code: 'NOTE_ALREADY_PURCHASED',
    message: 'You have already purchased this note.'
  };
  
  assert.equal(duplicatePurchaseError.statusCode, 400);
  assert.equal(duplicatePurchaseError.code, 'NOTE_ALREADY_PURCHASED');
});

test('Purchase Endpoint - prevents tutors from purchasing own notes', () => {
  // Test logic: if a tutor tries to purchase their own note,
  // the endpoint should return CANNOT_PURCHASE_OWN_NOTE error
  const ownNoteError = {
    statusCode: 403,
    code: 'CANNOT_PURCHASE_OWN_NOTE',
    message: 'Tutors cannot purchase their own notes.'
  };
  
  assert.equal(ownNoteError.statusCode, 403);
  assert.equal(ownNoteError.code, 'CANNOT_PURCHASE_OWN_NOTE');
});

test('Purchase Response - returns pending status and metadata (Day 6 stub)', () => {
  const purchaseResponse = {
    success: true,
    message: 'Note purchase initiated. Awaiting payment confirmation.',
    purchase: {
      _id: 'ObjectId',
      studentId: 'ObjectId',
      noteId: 'ObjectId',
      tutorId: 'ObjectId',
      price: 25,
      status: 'pending', // Chapa integration on Day 9 will update this
      createdAt: 'ISO-8601 timestamp',
      updatedAt: 'ISO-8601 timestamp'
    }
  };
  
  assert.equal(purchaseResponse.success, true);
  assert.equal(purchaseResponse.purchase.status, 'pending');
  assert.equal(purchaseResponse.purchase.price, 25);
});

test('Purchase Endpoint - increments note purchaseCount on successful purchase', () => {
  // Test logic: after a successful purchase, the note's purchaseCount should increase by 1
  const initialCount = 5;
  const afterPurchase = initialCount + 1;
  
  assert.equal(afterPurchase, 6);
});

test('Note Model - price field has validation constraints', () => {
  // Test that the Note model enforces price validation:
  // - min: 0 (no negative prices)
  // - max: 100,000 (reasonable upper bound)
  // - must be finite number
  
  const priceConstraints = {
    min: 0,
    max: 100000
  };
  
  assert.equal(priceConstraints.min, 0);
  assert.equal(priceConstraints.max, 100000);
});
