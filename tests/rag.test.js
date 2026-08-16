import test from 'node:test';
import assert from 'node:assert/strict';
import NoteChunk from '../models/NoteChunk.js';
import {
  EMBEDDING_DIMENSION,
  generateMockEmbedding,
  generateEmbedding,
  batchGenerateEmbeddings,
  processAndStoreNoteChunks,
  getChunksByNote,
  getChunksByTutor,
  deleteChunksByNote
} from '../services/ragService.js';
import { validateChunk } from '../utils/chunkingUtils.js';

// ============================================================================
// Section 1: Unit Tests — Gemini Embedding Generation (FR-11)
// ============================================================================

test('EMBEDDING_DIMENSION constant is strictly 768 (text-embedding-004)', () => {
  assert.equal(EMBEDDING_DIMENSION, 768);
});

test('generateMockEmbedding - creates deterministic normalized 768-dim vector', () => {
  const text = 'Data Structures and Algorithms: Binary Search Trees';
  const vector1 = generateMockEmbedding(text);
  const vector2 = generateMockEmbedding(text);

  assert.ok(Array.isArray(vector1), 'Embedding must be an array');
  assert.equal(vector1.length, 768, 'Embedding must have 768 dimensions');
  
  // Deterministic output for same input
  assert.deepEqual(vector1, vector2, 'Identical text must generate identical embeddings');

  // Verify all elements are finite numbers
  for (let i = 0; i < vector1.length; i++) {
    assert.equal(typeof vector1[i], 'number');
    assert.equal(Number.isFinite(vector1[i]), true);
  }

  // Verify L2 normalization (sum of squares is close to 1.0)
  const norm = vector1.reduce((sum, val) => sum + val * val, 0);
  assert.ok(Math.abs(norm - 1.0) < 0.05, `Vector norm ${norm} should be approximately 1.0`);
});

test('generateMockEmbedding - rejects invalid or empty input strings', () => {
  assert.throws(
    () => generateMockEmbedding(''),
    (err) => err.code === 'INVALID_INPUT' || /non-empty string/.test(err.message)
  );
  assert.throws(
    () => generateMockEmbedding(null),
    (err) => err.code === 'INVALID_INPUT' || /non-empty string/.test(err.message)
  );
  assert.throws(
    () => generateMockEmbedding(123),
    (err) => err.code === 'INVALID_INPUT' || /non-empty string/.test(err.message)
  );
});

test('generateEmbedding - falls back to deterministic mock embedding when API key is missing (NFR-10)', async () => {
  const text = 'Calculus III: Multivariable differentiation and vector fields';
  const embedding = await generateEmbedding(text, { apiKey: '' });

  assert.ok(Array.isArray(embedding));
  assert.equal(embedding.length, 768);
});

test('generateEmbedding - calls Gemini API and parses 768-dim values correctly', async () => {
  const mockApiVector = new Array(768).fill(0.0123);
  let requestPayload = null;

  const mockFetch = async (url, options) => {
    requestPayload = JSON.parse(options.body);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        embedding: {
          values: mockApiVector
        }
      })
    };
  };

  const embedding = await generateEmbedding('Sample text', {
    apiKey: 'test-gemini-key',
    fetchFn: mockFetch
  });

  assert.equal(embedding.length, 768);
  assert.equal(requestPayload.content.parts[0].text, 'Sample text');
  assert.equal(requestPayload.model, 'models/text-embedding-004');
});

test('generateEmbedding - handles 429 rate limits gracefully per NFR-10', async () => {
  let attempts = 0;
  const mockFetch = async () => {
    attempts++;
    return {
      ok: false,
      status: 429,
      text: async () => 'Quota exceeded'
    };
  };

  await assert.rejects(
    () => generateEmbedding('Test', { apiKey: 'test-gemini-key', fetchFn: mockFetch }),
    (err) => {
      assert.equal(err.statusCode, 429);
      assert.equal(err.code, 'GEMINI_RATE_LIMITED');
      return true;
    }
  );
});

test('generateEmbedding - rejects malformed embedding vector from upstream API', async () => {
  const mockFetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      embedding: {
        values: [1, 2, 3] // Invalid: only 3 dimensions instead of 768
      }
    })
  });

  await assert.rejects(
    () => generateEmbedding('Test', { apiKey: 'test-gemini-key', fetchFn: mockFetch }),
    (err) => {
      assert.equal(err.statusCode, 502);
      assert.equal(err.code, 'INVALID_EMBEDDING_DIMENSION');
      return true;
    }
  );
});

// ============================================================================
// Section 2: Unit Tests — Batch Embedding Generation (FR-11)
// ============================================================================

test('batchGenerateEmbeddings - handles empty array and validates text items', async () => {
  const emptyResult = await batchGenerateEmbeddings([]);
  assert.deepEqual(emptyResult, []);

  await assert.rejects(
    () => batchGenerateEmbeddings(null),
    (err) => err.code === 'INVALID_INPUT' || /must be an array/.test(err.message)
  );

  await assert.rejects(
    () => batchGenerateEmbeddings(['Valid chunk', '']),
    (err) => err.code === 'INVALID_INPUT' || /non-empty string/.test(err.message)
  );
});

test('batchGenerateEmbeddings - generates embeddings for multiple chunks', async () => {
  const texts = [
    'Introduction to Operating Systems: Processes and Threads',
    'Memory Management: Virtual Memory and Paging',
    'File Systems and Disk Scheduling algorithms'
  ];

  const embeddings = await batchGenerateEmbeddings(texts);

  assert.equal(embeddings.length, 3);
  embeddings.forEach((emb, i) => {
    assert.equal(emb.length, 768, `Embedding ${i} should have 768 dimensions`);
    const validation = validateChunk({
      text: texts[i],
      pageNumber: 1,
      chunkIndex: i,
      charCount: texts[i].length,
      embedding: emb
    });
    assert.equal(validation.valid, true, `Chunk ${i} with embedding must be valid`);
  });
});

test('batchGenerateEmbeddings - invokes batchEmbedContents API with requests payload', async () => {
  const mockApiVector = new Array(768).fill(0.0456);
  let requestPayload = null;

  const mockFetch = async (url, options) => {
    requestPayload = JSON.parse(options.body);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        embeddings: [
          { values: mockApiVector },
          { values: mockApiVector }
        ]
      })
    };
  };

  const texts = ['First paragraph', 'Second paragraph'];
  const embeddings = await batchGenerateEmbeddings(texts, {
    apiKey: 'test-gemini-key',
    fetchFn: mockFetch
  });

  assert.equal(embeddings.length, 2);
  assert.equal(requestPayload.requests.length, 2);
  assert.equal(requestPayload.requests[0].content.parts[0].text, 'First paragraph');
});

// ============================================================================
// Section 3: Integration Tests — Chunking + Embedding Ingestion Pipeline
// ============================================================================

test('processAndStoreNoteChunks - validates required IDs and text segments', async () => {
  await assert.rejects(
    () => processAndStoreNoteChunks(null, 'tutorId123', [{ text: 'Sample', pageNumber: 1 }]),
    (err) => err.code === 'MISSING_REQUIRED_FIELDS' || /required/.test(err.message)
  );

  await assert.rejects(
    () => processAndStoreNoteChunks('noteId123', null, [{ text: 'Sample', pageNumber: 1 }]),
    (err) => err.code === 'MISSING_REQUIRED_FIELDS' || /required/.test(err.message)
  );

  await assert.rejects(
    () => processAndStoreNoteChunks('noteId123', 'tutorId123', []),
    (err) => err.code === 'EMPTY_TEXT_SEGMENTS' || /No text segments/.test(err.message)
  );
});

test('processAndStoreNoteChunks - segments multi-page note, generates 768-dim embeddings, and persists to DB', async () => {
  const originalInsertMany = NoteChunk.insertMany;
  try {
    let insertedDocs = null;
    NoteChunk.insertMany = (docs) => {
      insertedDocs = docs;
      return Promise.resolve(docs.map((d, i) => ({ ...d, _id: `chunk_${i}` })));
    };

    const textSegments = [
      {
        pageNumber: 1,
        text: 'Chapter 1: Foundations of Database Systems.\n\nRelational databases organize data into tables.'
      },
      {
        pageNumber: 2,
        text: 'Chapter 2: Normalization and Indexing.\n\nB-trees and Hash indexes speed up lookups.'
      }
    ];

    const result = await processAndStoreNoteChunks(
      'note507f1f77bcf86cd799439011',
      'tutor507f1f77bcf86cd799439022',
      textSegments
    );

    assert.equal(result.success, true);
    assert.equal(result.count, 4, 'Should create 4 distinct chunks across 2 pages');
    assert.equal(insertedDocs.length, 4);

    // Verify each chunk has proper noteId, tutorId, pageNumber, chunkIndex, and 768-dim embedding
    insertedDocs.forEach((chunk, i) => {
      assert.equal(chunk.noteId, 'note507f1f77bcf86cd799439011');
      assert.equal(chunk.tutorId, 'tutor507f1f77bcf86cd799439022');
      assert.equal(typeof chunk.text, 'string');
      assert.equal(chunk.chunkIndex, i);
      assert.equal(chunk.charCount, chunk.text.length);
      assert.ok(Array.isArray(chunk.embedding), 'Must include vector embedding');
      assert.equal(chunk.embedding.length, 768, 'Must have 768 dimensions');

      // Verify NoteChunk schema validity
      const validation = validateChunk(chunk);
      assert.equal(validation.valid, true, `Chunk ${i} must satisfy all constraints: ${validation.errors.join(', ')}`);
    });

    // Check page numbers
    assert.equal(insertedDocs[0].pageNumber, 1);
    assert.equal(insertedDocs[1].pageNumber, 1);
    assert.equal(insertedDocs[2].pageNumber, 2);
    assert.equal(insertedDocs[3].pageNumber, 2);
  } finally {
    NoteChunk.insertMany = originalInsertMany;
  }
});

// ============================================================================
// Section 4: Integration Tests — Scoped Queries & Ownership Security
// ============================================================================

test('getChunksByNote - retrieves chunks for a specific note ordered by chunkIndex', async () => {
  const originalFind = NoteChunk.find;
  try {
    const mockChunks = [
      { _id: 'c1', noteId: 'n1', chunkIndex: 0, text: 'Part 1' },
      { _id: 'c2', noteId: 'n1', chunkIndex: 1, text: 'Part 2' }
    ];

    NoteChunk.find = (filter) => {
      assert.equal(filter.noteId, 'n1');
      return {
        sort: (sortObj) => {
          assert.equal(sortObj.chunkIndex, 1);
          return {
            select: () => Promise.resolve(mockChunks)
          };
        }
      };
    };

    const chunks = await getChunksByNote('n1');
    assert.equal(chunks.length, 2);
    assert.equal(chunks[0].text, 'Part 1');
  } finally {
    NoteChunk.find = originalFind;
  }
});

test('getChunksByTutor - retrieves tutor-scoped chunks for AI Q&A (FR-11, UC-10)', async () => {
  const originalFind = NoteChunk.find;
  try {
    const mockChunks = [
      { _id: 'c1', tutorId: 'tutor1', text: 'Tutor 1 material' },
      { _id: 'c2', tutorId: 'tutor1', text: 'Tutor 1 extra' }
    ];

    NoteChunk.find = (filter) => {
      assert.equal(filter.tutorId, 'tutor1');
      return {
        sort: () => ({
          select: () => Promise.resolve(mockChunks)
        })
      };
    };

    const chunks = await getChunksByTutor('tutor1');
    assert.equal(chunks.length, 2);
  } finally {
    NoteChunk.find = originalFind;
  }
});

test('deleteChunksByNote - enforces tutor ownership on deletion (STRIDE Tampering/Elevation of Privilege)', async () => {
  const originalDeleteMany = NoteChunk.deleteMany;
  try {
    NoteChunk.deleteMany = (filter) => {
      assert.equal(filter.noteId, 'note123');
      assert.equal(filter.tutorId, 'tutor456');
      return Promise.resolve({ deletedCount: 3 });
    };

    const result = await deleteChunksByNote('note123', 'tutor456');
    assert.equal(result.success, true);
    assert.equal(result.deletedCount, 3);
  } finally {
    NoteChunk.deleteMany = originalDeleteMany;
  }
});
