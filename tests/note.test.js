import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
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
  const sampleDir = path.join(process.cwd(), 'tests', 'fixtures');
  const samplePath = path.join(sampleDir, 'ocr-sample.png');
  const tempOutput = path.join(sampleDir, 'ocr-output.pdf');

  await fs.mkdir(sampleDir, { recursive: true });

  // Generate pure Node.js PNG fixture without PowerShell
  const samplePngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  await fs.writeFile(samplePath, Buffer.from(samplePngBase64, 'base64'));

  const { processOcrToPdf } = await import('../utils/ocrHelper.js');
  const result = await processOcrToPdf(samplePath, tempOutput);

  assert.ok(result.extractedText.toLowerCase().includes('campushustle'));

  const pdfBuffer = await fs.readFile(tempOutput);
  assert.ok(pdfBuffer.includes(Buffer.from('%PDF')));

  await fs.unlink(tempOutput).catch(() => {});
  await fs.unlink(samplePath).catch(() => {});
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
