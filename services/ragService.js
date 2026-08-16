import NoteChunk from '../models/NoteChunk.js';
import { config } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';
import { processTextSegments, validateChunk } from '../utils/chunkingUtils.js';

/**
 * Expected vector dimension from Gemini text-embedding-004.
 */
export const EMBEDDING_DIMENSION = 768;

/**
 * Generates a deterministic, normalized 768-dimensional float embedding vector
 * based on input text. Used for offline testing, development environments without
 * live API keys, and graceful fallback per NFR-10.
 *
 * @param {string} text - Input text to hash into vector
 * @returns {Array<number>} 768-dimensional normalized float array
 */
export function generateMockEmbedding(text) {
  if (!text || typeof text !== 'string') {
    throw new AppError('Text to embed must be a non-empty string.', 400, 'INVALID_INPUT');
  }

  const vector = new Array(EMBEDDING_DIMENSION);
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }

  let norm = 0;
  for (let i = 0; i < EMBEDDING_DIMENSION; i++) {
    // Deterministic pseudo-random value seeded by hash and dimension index
    const val = Math.sin(hash + i * 13.37) * Math.cos((hash ^ i) * 0.17);
    vector[i] = val;
    norm += val * val;
  }

  // L2-normalize the vector so dot product equals cosine similarity
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < EMBEDDING_DIMENSION; i++) {
    vector[i] = parseFloat((vector[i] / norm).toFixed(6));
  }

  return vector;
}

/**
 * Generates a 768-dimensional vector embedding for a single text chunk
 * using Google Gemini API (text-embedding-004) with graceful rate-limit handling (NFR-10).
 *
 * @param {string} text - Text content to embed
 * @param {Object} [options={}] - Execution options
 * @param {string} [options.apiKey] - Override API key
 * @param {string} [options.model] - Override model name
 * @param {Function} [options.fetchFn] - Custom fetch for testing/mocking
 * @param {boolean} [options.allowMockFallback=true] - Fall back to deterministic vector if API key is unset
 * @returns {Promise<Array<number>>} 768-dimensional float array
 */
export async function generateEmbedding(text, options = {}) {
  if (!text || typeof text !== 'string' || !text.trim()) {
    throw new AppError('Text to embed must be a non-empty string.', 400, 'INVALID_INPUT');
  }

  const apiKey = options.apiKey || config.geminiApiKey;
  const model = options.model || config.geminiEmbeddingModel || 'text-embedding-004';
  const fetchFn = options.fetchFn || globalThis.fetch;
  const allowMockFallback = options.allowMockFallback !== undefined ? options.allowMockFallback : true;

  // Use deterministic mock embedding if no API key is present in dev/test environment
  if (!apiKey || apiKey === 'your_gemini_api_key_here' || apiKey === 'mock_key') {
    if (allowMockFallback) {
      return generateMockEmbedding(text);
    }
    throw new AppError('Gemini API key is not configured.', 500, 'GEMINI_CONFIG_ERROR');
  }

  const endpointUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${apiKey}`;

  let retries = 2;
  while (retries >= 0) {
    try {
      const response = await fetchFn(endpointUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: `models/${model}`,
          content: {
            parts: [{ text: text.trim() }]
          }
        }),
        signal: AbortSignal.timeout(10000)
      });

      if (response.status === 429) {
        // NFR-10: Graceful degradation under free-tier rate limits
        if (retries > 0) {
          retries--;
          await new Promise((r) => setTimeout(r, 1000 * (3 - retries)));
          continue;
        }
        throw new AppError(
          'AI Embedding service is temporarily busy (rate limit reached). Please try again shortly.',
          429,
          'GEMINI_RATE_LIMITED'
        );
      }

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw new AppError(
          `Gemini Embedding API returned error (${response.status}): ${errorBody || response.statusText}`,
          502,
          'GEMINI_API_ERROR'
        );
      }

      const data = await response.json();
      const values = data?.embedding?.values;

      if (!Array.isArray(values) || values.length !== EMBEDDING_DIMENSION) {
        throw new AppError(
          `Invalid embedding format received from Gemini API. Expected ${EMBEDDING_DIMENSION} dimensions.`,
          502,
          'INVALID_EMBEDDING_DIMENSION'
        );
      }

      return values;
    } catch (err) {
      if (err instanceof AppError) throw err;
      if (retries > 0 && err.name === 'TimeoutError') {
        retries--;
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }
      throw new AppError(
        `Failed to generate embedding: ${err.message}`,
        500,
        'GEMINI_EMBEDDING_FAILED'
      );
    }
  }
}

/**
 * Batch generates embeddings for an array of text strings.
 * Batches requests in chunks of 20 to respect Gemini free-tier payload limits.
 *
 * @param {Array<string>} texts - Array of chunk texts
 * @param {Object} [options={}] - Options forwarded to generateEmbedding
 * @returns {Promise<Array<Array<number>>>} Array of 768-dimensional float arrays
 */
export async function batchGenerateEmbeddings(texts, options = {}) {
  if (!Array.isArray(texts)) {
    throw new AppError('Texts to embed must be an array.', 400, 'INVALID_INPUT');
  }

  if (texts.length === 0) {
    return [];
  }

  // Validate each text element
  for (let i = 0; i < texts.length; i++) {
    if (typeof texts[i] !== 'string' || !texts[i].trim()) {
      throw new AppError(`Text at index ${i} must be a non-empty string.`, 400, 'INVALID_INPUT');
    }
  }

  const apiKey = options.apiKey || config.geminiApiKey;
  const model = options.model || config.geminiEmbeddingModel || 'text-embedding-004';
  const fetchFn = options.fetchFn || globalThis.fetch;
  const allowMockFallback = options.allowMockFallback !== undefined ? options.allowMockFallback : true;

  if (!apiKey || apiKey === 'your_gemini_api_key_here' || apiKey === 'mock_key') {
    if (allowMockFallback) {
      return texts.map((t) => generateMockEmbedding(t));
    }
    throw new AppError('Gemini API key is not configured.', 500, 'GEMINI_CONFIG_ERROR');
  }

  const BATCH_SIZE = 20;
  const allEmbeddings = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const endpointUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:batchEmbedContents?key=${apiKey}`;

    try {
      const response = await fetchFn(endpointUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: batch.map((text) => ({
            model: `models/${model}`,
            content: { parts: [{ text: text.trim() }] }
          }))
        }),
        signal: AbortSignal.timeout(15000)
      });

      if (response.status === 429) {
        throw new AppError(
          'AI Embedding service rate limit reached during batch processing.',
          429,
          'GEMINI_RATE_LIMITED'
        );
      }

      if (!response.ok) {
        // Fallback to sequential generation on batch failure
        const sequentialResults = await Promise.all(
          batch.map((t) => generateEmbedding(t, options))
        );
        allEmbeddings.push(...sequentialResults);
        continue;
      }

      const data = await response.json();
      const rawEmbeddings = data?.embeddings;

      if (!Array.isArray(rawEmbeddings) || rawEmbeddings.length !== batch.length) {
        throw new AppError('Batch embedding response size mismatch.', 502, 'INVALID_EMBEDDING_RESPONSE');
      }

      for (const item of rawEmbeddings) {
        const values = item?.values;
        if (!Array.isArray(values) || values.length !== EMBEDDING_DIMENSION) {
          throw new AppError(
            `Invalid vector dimension in batch response. Expected ${EMBEDDING_DIMENSION}.`,
            502,
            'INVALID_EMBEDDING_DIMENSION'
          );
        }
        allEmbeddings.push(values);
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      // Graceful fallback to sequential processing
      const sequentialResults = await Promise.all(
        batch.map((t) => generateEmbedding(t, options))
      );
      allEmbeddings.push(...sequentialResults);
    }
  }

  return allEmbeddings;
}

/**
 * Core Pipeline: Ingests raw text segments for an uploaded note,
 * chunks text semantically, generates 768-dim Gemini embeddings,
 * validates integrity, and persists NoteChunk records to MongoDB Atlas.
 *
 * Satisfies FR-11 (Chunking + Embedding generation).
 *
 * @param {string|ObjectId} noteId - Originating Note ID
 * @param {string|ObjectId} tutorId - Owning Tutor ID (for scoped Q&A)
 * @param {Array<{text: string, pageNumber: number}>} textSegments - Page/OCR text segments
 * @param {Object} [options={}] - Chunking and embedding configurations
 * @returns {Promise<{ success: boolean, count: number, chunks: Array<Object> }>}
 */
export async function processAndStoreNoteChunks(noteId, tutorId, textSegments, options = {}) {
  if (!noteId || !tutorId) {
    throw new AppError('noteId and tutorId are required to process note chunks.', 400, 'MISSING_REQUIRED_FIELDS');
  }

  if (!Array.isArray(textSegments) || textSegments.length === 0) {
    throw new AppError('No text segments provided for chunking and embedding.', 400, 'EMPTY_TEXT_SEGMENTS');
  }

  // 1. Text Chunking via segmentation algorithm
  const rawChunks = processTextSegments(textSegments, {
    minChunkSize: options.minChunkSize || 0,
    maxChunkSize: options.maxChunkSize || 1500,
    separator: options.separator || '\n\n'
  });

  if (rawChunks.length === 0) {
    throw new AppError('Document segmentation produced no readable text chunks.', 400, 'NO_CHUNKS_PRODUCED');
  }

  // 2. Validate preliminary chunk structure before expensive AI embedding
  for (const chunk of rawChunks) {
    const check = validateChunk({ ...chunk, embedding: null });
    if (!check.valid) {
      throw new AppError(
        `Chunk validation failed before embedding: ${check.errors.join('; ')}`,
        400,
        'CHUNK_VALIDATION_ERROR'
      );
    }
  }

  // 3. Batch Generate 768-dimensional embeddings via Gemini API
  const chunkTexts = rawChunks.map((c) => c.text);
  const embeddings = await batchGenerateEmbeddings(chunkTexts, options);

  if (embeddings.length !== rawChunks.length) {
    throw new AppError('Mismatch between chunk count and generated embeddings count.', 500, 'EMBEDDING_COUNT_MISMATCH');
  }

  // 4. Assemble NoteChunk documents with vectors and metadata
  const chunksToInsert = rawChunks.map((chunk, idx) => ({
    noteId,
    tutorId,
    text: chunk.text,
    pageNumber: chunk.pageNumber,
    chunkIndex: chunk.chunkIndex,
    charCount: chunk.charCount,
    embedding: embeddings[idx]
  }));

  // 5. Validate final structured documents with embeddings
  for (const chunkDoc of chunksToInsert) {
    const finalCheck = validateChunk(chunkDoc);
    if (!finalCheck.valid) {
      throw new AppError(
        `Final chunk document validation failed: ${finalCheck.errors.join('; ')}`,
        400,
        'CHUNK_VALIDATION_ERROR'
      );
    }
  }

  // 6. Bulk persist to MongoDB Atlas
  const savedChunks = await NoteChunk.insertMany(chunksToInsert);

  return {
    success: true,
    count: savedChunks.length,
    chunks: savedChunks
  };
}

/**
 * Retrieve all chunks belonging to a specific note.
 *
 * @param {string|ObjectId} noteId
 * @returns {Promise<Array<Object>>}
 */
export async function getChunksByNote(noteId) {
  if (!noteId) {
    throw new AppError('noteId is required.', 400, 'MISSING_REQUIRED_FIELDS');
  }

  return NoteChunk.find({ noteId })
    .sort({ chunkIndex: 1 })
    .select('-__v');
}

/**
 * Retrieve all chunks belonging to a tutor (powers tutor-scoped AI Assistant search).
 * Satisfies FR-11 and UC-10.
 *
 * @param {string|ObjectId} tutorId
 * @returns {Promise<Array<Object>>}
 */
export async function getChunksByTutor(tutorId) {
  if (!tutorId) {
    throw new AppError('tutorId is required.', 400, 'MISSING_REQUIRED_FIELDS');
  }

  return NoteChunk.find({ tutorId })
    .sort({ noteId: 1, chunkIndex: 1 })
    .select('-__v');
}

/**
 * Delete all chunks belonging to a note with ownership validation.
 * Mitigates Tampering and Elevation of Privilege (STRIDE).
 *
 * @param {string|ObjectId} noteId
 * @param {string|ObjectId} tutorId
 * @returns {Promise<{ success: boolean, deletedCount: number }>}
 */
export async function deleteChunksByNote(noteId, tutorId) {
  if (!noteId || !tutorId) {
    throw new AppError('noteId and tutorId are required for chunk deletion.', 400, 'MISSING_REQUIRED_FIELDS');
  }

  const result = await NoteChunk.deleteMany({
    noteId,
    tutorId
  });

  return {
    success: true,
    deletedCount: result.deletedCount || 0
  };
}
