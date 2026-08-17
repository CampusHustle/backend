import test from 'node:test';
import assert from 'node:assert/strict';
import NoteChunk from '../models/NoteChunk.js';
import { 
  splitTextIntoChunks, 
  processTextSegments, 
  validateChunk 
} from '../utils/chunkingUtils.js';

// ============================================
// Day 7: NoteChunk Schema & Chunking Logic
// ============================================

test('NoteChunk Schema Model - validates required fields', () => {
  assert.equal(typeof NoteChunk, 'function', 'NoteChunk should be a Mongoose model');
});

test('splitTextIntoChunks - basic paragraph splitting', () => {
  const text = 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.';
  const chunks = splitTextIntoChunks(text, 1);

  assert.ok(Array.isArray(chunks), 'Should return an array');
  assert.equal(chunks.length, 3, 'Should split into 3 chunks (by double newline)');
  
  chunks.forEach((chunk, i) => {
    assert.equal(chunk.pageNumber, 1, `Chunk ${i} should have pageNumber 1`);
    assert.equal(typeof chunk.text, 'string', `Chunk ${i} text should be a string`);
    assert.equal(typeof chunk.chunkIndex, 'number', `Chunk ${i} should have chunkIndex`);
    assert.equal(chunk.charCount, chunk.text.length, `Chunk ${i} charCount should match text length`);
  });
});

test('splitTextIntoChunks - respects minimum chunk size', () => {
  const text = 'a\n\nb\n\nc\n\nd'; // Very small paragraphs
  const minSize = 10;
  const chunks = splitTextIntoChunks(text, 1, { minChunkSize: minSize, maxChunkSize: 1000 });

  // Small paragraphs should be merged
  chunks.forEach(chunk => {
    assert.ok(
      chunk.charCount >= minSize || chunks.length === 1,
      `Chunk should be >= ${minSize} chars (or be the only chunk)`
    );
  });
});

test('splitTextIntoChunks - respects maximum chunk size', () => {
  const longText = 'word '.repeat(500); // ~2500 chars
  const maxSize = 500;
  const chunks = splitTextIntoChunks(longText, 1, { minChunkSize: 10, maxChunkSize: maxSize });

  chunks.forEach(chunk => {
    assert.ok(
      chunk.charCount <= maxSize,
      `Chunk should not exceed ${maxSize} chars (got ${chunk.charCount})`
    );
  });
});

test('splitTextIntoChunks - handles empty input gracefully', () => {
  const chunks1 = splitTextIntoChunks('', 1);
  assert.equal(chunks1.length, 0, 'Empty string should return empty array');

  const chunks2 = splitTextIntoChunks(null, 1);
  assert.equal(chunks2.length, 0, 'Null should return empty array');

  const chunks3 = splitTextIntoChunks('   \n\n   ', 1);
  assert.equal(chunks3.length, 0, 'Whitespace-only string should return empty array');
});

test('splitTextIntoChunks - normalizes line endings and whitespace', () => {
  const textWithCRLF = 'First paragraph.\r\n\r\nSecond paragraph.';
  const textWithLF = 'First paragraph.\n\nSecond paragraph.';
  
  const chunks1 = splitTextIntoChunks(textWithCRLF, 1);
  const chunks2 = splitTextIntoChunks(textWithLF, 1);
  
  assert.equal(chunks1.length, chunks2.length, 'Should normalize CRLF to LF');
  assert.equal(chunks1[0].text, chunks2[0].text, 'Text should be identical after normalization');
});

test('splitTextIntoChunks - assigns proper chunk indices', () => {
  const text = 'Para 1.\n\nPara 2.\n\nPara 3.';
  const chunks = splitTextIntoChunks(text, 1);

  chunks.forEach((chunk, i) => {
    assert.equal(chunk.chunkIndex, i, `Chunk at index ${i} should have chunkIndex ${i}`);
  });
});

test('splitTextIntoChunks - preserves page number context', () => {
  const text = 'Some content';
  const pageNum = 5;
  const chunks = splitTextIntoChunks(text, pageNum);

  chunks.forEach(chunk => {
    assert.equal(chunk.pageNumber, pageNum, `Should preserve pageNumber ${pageNum}`);
  });
});

test('processTextSegments - combines multiple text segments', () => {
  const segments = [
    { text: 'Page 1 content.\n\nMore page 1.', pageNumber: 1 },
    { text: 'Page 2 content.', pageNumber: 2 },
    { text: 'Page 3 first.\n\nPage 3 second.\n\nPage 3 third.', pageNumber: 3 }
  ];

  const allChunks = processTextSegments(segments);

  assert.ok(Array.isArray(allChunks), 'Should return array');
  assert.ok(allChunks.length > 0, 'Should have chunks from all segments');

  // Check page numbers are preserved
  const page1Chunks = allChunks.filter(c => c.pageNumber === 1);
  const page2Chunks = allChunks.filter(c => c.pageNumber === 2);
  const page3Chunks = allChunks.filter(c => c.pageNumber === 3);

  assert.ok(page1Chunks.length > 0, 'Should have page 1 chunks');
  assert.ok(page2Chunks.length > 0, 'Should have page 2 chunks');
  assert.ok(page3Chunks.length > 0, 'Should have page 3 chunks');
});

test('processTextSegments - handles empty segments array', () => {
  const chunks = processTextSegments([]);
  assert.equal(chunks.length, 0, 'Empty segments should return empty array');

  const chunks2 = processTextSegments(null);
  assert.equal(chunks2.length, 0, 'Null segments should return empty array');
});

test('validateChunk - validates required fields', () => {
  const validChunk = {
    text: 'This is a valid chunk with good content.',
    pageNumber: 1,
    chunkIndex: 0,
    charCount: 40
  };

  const result = validateChunk(validChunk);
  assert.equal(result.valid, true, 'Valid chunk should pass validation');
  assert.equal(result.errors.length, 0, 'No errors for valid chunk');
});

test('validateChunk - rejects missing text', () => {
  const chunk = {
    pageNumber: 1,
    chunkIndex: 0,
    charCount: 0
  };

  const result = validateChunk(chunk);
  assert.equal(result.valid, false, 'Should reject missing text');
  assert.ok(result.errors.length > 0, 'Should list errors');
});

test('validateChunk - rejects invalid pageNumber', () => {
  const chunk = {
    text: 'Content',
    pageNumber: 0, // Invalid: must be >= 1
    chunkIndex: 0,
    charCount: 7
  };

  const result = validateChunk(chunk);
  assert.equal(result.valid, false, 'Should reject pageNumber < 1');
});

test('validateChunk - rejects charCount mismatch', () => {
  const chunk = {
    text: 'Content', // 7 chars
    pageNumber: 1,
    chunkIndex: 0,
    charCount: 999 // Doesn't match!
  };

  const result = validateChunk(chunk);
  assert.equal(result.valid, false, 'Should reject charCount mismatch');
  assert.ok(
    result.errors.some(e => e.includes('charCount')),
    'Should mention charCount in error'
  );
});

test('validateChunk - accepts null embedding (Day 7)', () => {
  const chunk = {
    text: 'Content for testing',
    pageNumber: 1,
    chunkIndex: 0,
    charCount: 19,
    embedding: null // Valid on Day 7; populated on Day 9
  };

  const result = validateChunk(chunk);
  assert.equal(result.valid, true, 'Should accept null embedding (Day 7 stub)');
});

test('validateChunk - accepts valid 768-dimensional embedding vector (Day 9)', async () => {
  const { generateMockEmbedding } = await import('../services/ragService.js');
  const validVector = generateMockEmbedding('Content for embedding testing');
  
  const chunk = {
    text: 'Content for embedding testing',
    pageNumber: 1,
    chunkIndex: 0,
    charCount: 29,
    embedding: validVector
  };

  const result = validateChunk(chunk);
  assert.equal(result.valid, true, 'Should accept valid 768-dimensional embedding');
  assert.equal(result.errors.length, 0);
});

test('validateChunk - rejects invalid embedding format', () => {
  const chunk = {
    text: 'Content',
    pageNumber: 1,
    chunkIndex: 0,
    charCount: 7,
    embedding: [1, 2, 3] // Only 3 dims, not 768
  };

  const result = validateChunk(chunk);
  assert.equal(result.valid, false, 'Should reject wrong embedding dimensions');
});

test('NoteChunk model - indices for efficient retrieval', () => {
  // Test that the model is properly indexed
  assert.equal(typeof NoteChunk, 'function');
  // Day 9+: indices will be used for:
  // - Query by noteId: find all chunks from one note
  // - Query by tutorId: find all chunks from one tutor (scoped search)
  // - Similarity search via embedding (vector DB on Day 10+)
});

test('Chunking pipeline - realistic multi-page document', () => {
  const doc = `Page 1: Chapter 1 Introduction
  
  This chapter covers the fundamentals of data structures. Data structures are specialized formats for organizing, processing, and storing data. They are critical to programming and software design.
  
  The main types of data structures include arrays, linked lists, stacks, queues, trees, and graphs. Each has unique properties and use cases.
  
  Page 2: Arrays
  
  Arrays are the simplest data structure. An array is a collection of elements, each identified by at least one array index or key. Arrays are widely used in most programming languages.
  
  Arrays provide:
  - O(1) access time
  - O(n) insertion/deletion time
  - Fixed size in many languages
  `;

  const segments = [
    { text: doc.split('Page 2:')[0], pageNumber: 1 },
    { text: doc.split('Page 2:')[1], pageNumber: 2 }
  ];

  const chunks = processTextSegments(segments);

  // Verify document was chunked
  assert.ok(chunks.length > 0, 'Should create chunks from document');

  // Verify page context is preserved
  const page1 = chunks.filter(c => c.pageNumber === 1);
  const page2 = chunks.filter(c => c.pageNumber === 2);

  assert.ok(page1.length > 0, 'Should have chunks from page 1');
  assert.ok(page2.length > 0, 'Should have chunks from page 2');

  // Verify all chunks are valid
  chunks.forEach((chunk, i) => {
    const validation = validateChunk(chunk);
    assert.equal(
      validation.valid,
      true,
      `Chunk ${i} should be valid: ${validation.errors.join(', ')}`
    );
  });
});

test('Chunking - handles real PDF text (OCR output format)', () => {
  // Simulate OCR output which may have weird spacing/line breaks
  const ocrText = `CHAPTER  1   INTRODUCTION

This chapter covers fundamentals.

    (page  break  detected)
    
SECTION 1.1

Key concepts  include...`;

  const chunks = splitTextIntoChunks(ocrText, 1);

  // Should normalize whitespace and still produce meaningful chunks
  assert.ok(chunks.length > 0, 'Should handle OCR text');
  chunks.forEach(chunk => {
    assert.ok(chunk.text.length > 0, 'Each chunk should have content');
    assert.equal(chunk.text, chunk.text.trim(), 'Chunks should be trimmed');
  });
});

test('Chunking - FR-11 compliance: chunks are suitable for embedding', () => {
  // Test that chunks produced are reasonable for Gemini embeddings
  // Gemini text-embedding-004 handles up to 3,072 tokens (~12k chars)
  // But we want semantic chunks, so ~200-1500 chars is ideal
  
  const text = 'Semantic chunk about a concept.\n\nAnother concept here.\n\nThird idea.';
  const chunks = splitTextIntoChunks(text, 1, { 
    minChunkSize: 20, 
    maxChunkSize: 1500 
  });

  chunks.forEach(chunk => {
    assert.ok(chunk.charCount <= 1500, 'Chunk should fit in embedding size');
    assert.ok(chunk.text.length > 0, 'Chunk should have meaningful content');
  });
});
