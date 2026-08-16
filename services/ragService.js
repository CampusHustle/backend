import NoteChunk from '../models/NoteChunk.js';
import { config } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';
import { processTextSegments, validateChunk } from '../utils/chunkingUtils.js';

/**
 * Expected vector dimension from Gemini text-embedding-004.
 */
export const EMBEDDING_DIMENSION = 768;

/**
 * Fallback message when question cannot be answered from available material (TC-4).
 */
export const CANNOT_ANSWER_FALLBACK =
  'I cannot answer this question from the available tutor study material. Please consult your tutor or course instructor directly.';

/**
 * Generates a deterministic, normalized 768-dimensional float embedding vector
 * based on input text. Used for offline testing, development environments without
 * live API keys, and graceful fallback per NFR-10.
 *
 * @param {string} text - Input text to hash into vector
 * @returns {Array<number>} 768-dimensional normalized float array
 */
export function generateMockEmbedding(text) {
  if (!text || typeof text !== 'string' || !text.trim()) {
    throw new AppError('Text to embed must be a non-empty string.', 400, 'INVALID_INPUT');
  }

  const vector = new Array(EMBEDDING_DIMENSION);
  let hash = 0;
  const clean = text.trim();
  for (let i = 0; i < clean.length; i++) {
    const char = clean.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }

  let norm = 0;
  for (let i = 0; i < EMBEDDING_DIMENSION; i++) {
    const val = Math.sin(hash + i * 13.37) * Math.cos((hash ^ i) * 0.17);
    vector[i] = val;
    norm += val * val;
  }

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

  const rawChunks = processTextSegments(textSegments, {
    minChunkSize: options.minChunkSize || 0,
    maxChunkSize: options.maxChunkSize || 1500,
    separator: options.separator || '\n\n'
  });

  if (rawChunks.length === 0) {
    throw new AppError('Document segmentation produced no readable text chunks.', 400, 'NO_CHUNKS_PRODUCED');
  }

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

  const chunkTexts = rawChunks.map((c) => c.text);
  const embeddings = await batchGenerateEmbeddings(chunkTexts, options);

  if (embeddings.length !== rawChunks.length) {
    throw new AppError('Mismatch between chunk count and generated embeddings count.', 500, 'EMBEDDING_COUNT_MISMATCH');
  }

  const chunksToInsert = rawChunks.map((chunk, idx) => ({
    noteId,
    tutorId,
    text: chunk.text,
    pageNumber: chunk.pageNumber,
    chunkIndex: chunk.chunkIndex,
    charCount: chunk.charCount,
    embedding: embeddings[idx]
  }));

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

// ============================================================================
// Day 10: Cosine Similarity Search & Grounded Answer Generation (FR-11, TC-4)
// ============================================================================

/**
 * Calculates the cosine similarity between two numeric vectors.
 * Returns a score between -1 and 1 (1 = identical direction, 0 = orthogonal).
 *
 * @param {Array<number>} vecA - First vector
 * @param {Array<number>} vecB - Second vector
 * @returns {number} Cosine similarity score
 */
export function cosineSimilarity(vecA, vecB) {
  if (!Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length === 0 || vecB.length === 0) {
    throw new AppError('Vectors for similarity calculation must be non-empty arrays.', 400, 'INVALID_VECTOR');
  }

  if (vecA.length !== vecB.length) {
    throw new AppError(
      `Vector dimension mismatch: ${vecA.length} vs ${vecB.length}.`,
      400,
      'VECTOR_DIMENSION_MISMATCH'
    );
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    const a = vecA[i];
    const b = vecB[i];
    dotProduct += a * b;
    normA += a * a;
    normB += b * b;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) {
    return 0;
  }

  const similarity = dotProduct / denominator;
  // Guard against float precision drift beyond [-1, 1]
  return Math.max(-1, Math.min(1, parseFloat(similarity.toFixed(6))));
}

/**
 * Performs tutor-scoped cosine similarity search over NoteChunk embeddings in MongoDB.
 * Ensures questions are matched strictly against the target tutor's notes (FR-11).
 *
 * @param {string|ObjectId} tutorId - Tutor ID scoping the search (STRIDE: Information Disclosure mitigation)
 * @param {Array<number>} queryEmbedding - 768-dim query vector
 * @param {Object} [options={}] - Search options
 * @param {number} [options.topK=3] - Maximum chunks to return
 * @param {number} [options.minSimilarityThreshold=0.35] - Relevance cutoff score
 * @param {string|ObjectId} [options.noteId] - Optional note-specific filter
 * @returns {Promise<Array<Object>>} Ranked matching chunks with similarity scores
 */
export async function searchChunksBySimilarity(tutorId, queryEmbedding, options = {}) {
  if (!tutorId) {
    throw new AppError('tutorId is required for scoped chunk search.', 400, 'MISSING_REQUIRED_FIELDS');
  }

  if (!Array.isArray(queryEmbedding) || queryEmbedding.length !== EMBEDDING_DIMENSION) {
    throw new AppError(
      `queryEmbedding must be a valid ${EMBEDDING_DIMENSION}-dimensional vector.`,
      400,
      'INVALID_QUERY_EMBEDDING'
    );
  }

  const topK = options.topK || 3;
  const minSimilarityThreshold = options.minSimilarityThreshold !== undefined
    ? options.minSimilarityThreshold
    : 0.35;

  const query = {
    tutorId,
    embedding: { $ne: null }
  };

  if (options.noteId) {
    query.noteId = options.noteId;
  }

  // Retrieve candidate chunks for the tutor
  const chunks = await NoteChunk.find(query).select('-__v');

  if (!chunks || chunks.length === 0) {
    return [];
  }

  // Score each chunk via cosine similarity
  const scoredChunks = [];
  for (const chunk of chunks) {
    if (!Array.isArray(chunk.embedding) || chunk.embedding.length !== EMBEDDING_DIMENSION) {
      continue;
    }

    const score = cosineSimilarity(queryEmbedding, chunk.embedding);
    if (score >= minSimilarityThreshold) {
      scoredChunks.push({
        _id: chunk._id,
        noteId: chunk.noteId,
        tutorId: chunk.tutorId,
        pageNumber: chunk.pageNumber,
        chunkIndex: chunk.chunkIndex,
        charCount: chunk.charCount,
        text: chunk.text,
        similarityScore: score
      });
    }
  }

  // Sort descending by similarity score
  scoredChunks.sort((a, b) => b.similarityScore - a.similarityScore);

  return scoredChunks.slice(0, topK);
}

/**
 * Generates grounded answer using Google Gemini model based exclusively
 * on retrieved note chunks. Returns explicit fallback when chunks are insufficient (TC-4).
 *
 * @param {string} question - Student question
 * @param {Array<Object>} relevantChunks - Matching note chunks from similarity search
 * @param {Object} [options={}] - Options (model, apiKey, fetchFn)
 * @returns {Promise<{ grounded: boolean, answer: string, sources: Array<Object> }>}
 */
export async function generateGroundedAnswer(question, relevantChunks, options = {}) {
  if (!question || typeof question !== 'string' || !question.trim()) {
    throw new AppError('Question must be a non-empty string.', 400, 'INVALID_INPUT');
  }

  // TC-4 Fallback: If no matching chunks found or below similarity threshold
  if (!Array.isArray(relevantChunks) || relevantChunks.length === 0) {
    return {
      grounded: false,
      answer: CANNOT_ANSWER_FALLBACK,
      sources: []
    };
  }

  const apiKey = options.apiKey || config.geminiApiKey;
  const model = options.model || config.geminiChatModel || 'gemini-1.5-flash';
  const fetchFn = options.fetchFn || globalThis.fetch;
  const allowMockFallback = options.allowMockFallback !== undefined ? options.allowMockFallback : true;

  // Build context payload from retrieved chunks
  const contextExcerpts = relevantChunks
    .map((chunk, i) => `[Source Excerpt ${i + 1} (Page ${chunk.pageNumber})]:\n${chunk.text}`)
    .join('\n\n');

  const sources = relevantChunks.map((chunk) => ({
    noteId: chunk.noteId,
    pageNumber: chunk.pageNumber,
    chunkIndex: chunk.chunkIndex,
    similarityScore: chunk.similarityScore
  }));

  // Deterministic mock generation for offline/test environments
  if (!apiKey || apiKey === 'your_gemini_api_key_here' || apiKey === 'mock_key') {
    if (allowMockFallback) {
      const topExcerpt = relevantChunks[0]?.text || '';
      return {
        grounded: true,
        answer: `Based on the tutor's notes (Page ${relevantChunks[0].pageNumber}): ${topExcerpt.slice(0, 200)}...`,
        sources
      };
    }
    throw new AppError('Gemini API key is not configured.', 500, 'GEMINI_CONFIG_ERROR');
  }

  const promptText = `You are the CampusHustle AI Study Assistant.
Answer the student's question strictly and exclusively using the provided tutor note excerpts below.
If the excerpts do not contain enough information to answer the question, state explicitly: "${CANNOT_ANSWER_FALLBACK}"
Do not invent facts or use external knowledge not present in the excerpts.

Tutor Note Excerpts:
${contextExcerpts}

Student Question:
${question.trim()}

Answer:`;

  const endpointUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  try {
    const response = await fetchFn(endpointUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: promptText }]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 800
        }
      }),
      signal: AbortSignal.timeout(15000)
    });

    if (response.status === 429) {
      throw new AppError(
        'AI Assistant service is temporarily busy. Please try again shortly.',
        429,
        'GEMINI_RATE_LIMITED'
      );
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new AppError(
        `Gemini Generation API error (${response.status}): ${errorBody || response.statusText}`,
        502,
        'GEMINI_API_ERROR'
      );
    }

    const data = await response.json();
    const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidateText || !candidateText.trim()) {
      return {
        grounded: false,
        answer: CANNOT_ANSWER_FALLBACK,
        sources: []
      };
    }

    const trimmedAnswer = candidateText.trim();
    const isUnanswerable = trimmedAnswer.toLowerCase().includes('cannot answer') ||
      trimmedAnswer.toLowerCase().includes('available material') ||
      trimmedAnswer === CANNOT_ANSWER_FALLBACK;

    return {
      grounded: !isUnanswerable,
      answer: trimmedAnswer,
      sources: isUnanswerable ? [] : sources
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(
      `Failed to generate AI response: ${err.message}`,
      500,
      'GEMINI_GENERATION_FAILED'
    );
  }
}

/**
 * End-to-End Orchestrator: Receives a student question for a tutor,
 * embeds the question, performs cosine similarity search over that tutor's NoteChunks,
 * and generates a grounded response via Gemini with explicit fallback (FR-11, TC-4).
 *
 * @param {string|ObjectId} tutorId - Target tutor ID
 * @param {string} question - Student question
 * @param {Object} [options={}] - Options forwarded to embedding and generation
 * @returns {Promise<{ success: boolean, answer: string, grounded: boolean, sources: Array<Object>, matchedChunksCount: number }>}
 */
export async function askTutorAssistant(tutorId, question, options = {}) {
  if (!tutorId) {
    throw new AppError('tutorId is required to scope the AI Study Assistant.', 400, 'MISSING_REQUIRED_FIELDS');
  }

  if (!question || typeof question !== 'string' || !question.trim()) {
    throw new AppError('Question must be a non-empty string.', 400, 'INVALID_QUESTION');
  }

  const cleanQuestion = question.trim();
  if (cleanQuestion.length < 3) {
    throw new AppError('Question must be at least 3 characters long.', 400, 'QUESTION_TOO_SHORT');
  }

  if (cleanQuestion.length > 1000) {
    throw new AppError('Question cannot exceed 1000 characters.', 400, 'QUESTION_TOO_LONG');
  }

  // 1. Generate 768-dimensional embedding for query
  const queryEmbedding = await generateEmbedding(cleanQuestion, options);

  // 2. Perform tutor-scoped cosine similarity search
  const matchingChunks = await searchChunksBySimilarity(tutorId, queryEmbedding, options);

  // 3. Generate grounded answer or trigger TC-4 fallback
  const result = await generateGroundedAnswer(cleanQuestion, matchingChunks, options);

  return {
    success: true,
    answer: result.answer,
    grounded: result.grounded,
    sources: result.sources,
    matchedChunksCount: matchingChunks.length
  };
}
