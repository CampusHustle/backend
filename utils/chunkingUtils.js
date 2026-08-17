/**
 * Text chunking utilities for RAG pipeline.
 * 
 * Day 7: Chunking logic for splitting note text into manageable segments.
 * Day 9: Embeddings are generated for each chunk via Gemini API.
 * Day 10: Chunks are searched via cosine similarity to ground AI answers.
 * 
 * Chunking strategy:
 * - Split by page boundaries when available
 * - Apply semantic paragraph-based splitting within pages
 * - Enforce size constraints: configurable min/max chars per chunk
 * - Preserve page context for preview linking and source attribution
 * 
 * FR-11 compliance: Chunking is prerequisite for embedding + RAG retrieval
 */

/**
 * Breaks a single text block into chunks strictly bounded by maxChunkSize.
 * Splits on sentences, then words, then slices as needed.
 *
 * @param {string} block
 * @param {number} maxChunkSize
 * @returns {Array<string>}
 */
function splitBlockByMaxSize(block, maxChunkSize) {
  if (block.length <= maxChunkSize) {
    return [block];
  }

  // Attempt sentence-level split
  const sentenceRegex = /[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g;
  const rawSentences = block.match(sentenceRegex) || [block];
  const units = [];

  for (const rawSentence of rawSentences) {
    const s = rawSentence.trim();
    if (!s) continue;

    if (s.length <= maxChunkSize) {
      units.push(s);
    } else {
      // Split large sentence by words
      const words = s.split(/\s+/);
      let currentWordChunk = '';

      for (const word of words) {
        if (word.length > maxChunkSize) {
          if (currentWordChunk) {
            units.push(currentWordChunk);
            currentWordChunk = '';
          }
          for (let i = 0; i < word.length; i += maxChunkSize) {
            units.push(word.slice(i, i + maxChunkSize));
          }
        } else if (currentWordChunk && currentWordChunk.length + 1 + word.length > maxChunkSize) {
          units.push(currentWordChunk);
          currentWordChunk = word;
        } else {
          currentWordChunk = currentWordChunk ? `${currentWordChunk} ${word}` : word;
        }
      }

      if (currentWordChunk) {
        units.push(currentWordChunk);
      }
    }
  }

  // Combine small units up to maxChunkSize
  const chunks = [];
  let currentChunk = '';

  for (const unit of units) {
    if (currentChunk && currentChunk.length + 1 + unit.length > maxChunkSize) {
      chunks.push(currentChunk.trim());
      currentChunk = unit;
    } else {
      currentChunk = currentChunk ? `${currentChunk} ${unit}` : unit;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Split text into semantically meaningful chunks.
 * 
 * Strategy:
 * 1. Normalize line endings and whitespace
 * 2. Split by separator (default double newlines = paragraphs)
 * 3. If minChunkSize is specified (> 0), merge smaller paragraphs
 * 4. If any paragraph/chunk exceeds maxChunkSize, split further
 * 5. Preserve page context and assign chunk indices
 * 
 * @param {string} text - Full text from the note
 * @param {number} [pageNumber=1] - Page number where this text appears (1-indexed)
 * @param {Object} [options={}] - Chunking configuration
 * @param {number} [options.minChunkSize=0] - Minimum chars per chunk (default 0, preserved when not specified)
 * @param {number} [options.maxChunkSize=1500] - Maximum chars per chunk (default 1500)
 * @param {string} [options.separator='\n\n'] - Text separator to use (default '\n\n')
 * @returns {Array<Object>} Array of chunk objects with text, pageNumber, chunkIndex, charCount
 */
export function splitTextIntoChunks(
  text,
  pageNumber = 1,
  options = {}
) {
  const {
    minChunkSize = 0,
    maxChunkSize = 1500,
    separator = '\n\n'
  } = options;

  if (!text || typeof text !== 'string') {
    return [];
  }

  // Normalize whitespace: collapse multiple spaces/newlines, normalize CRLF to LF
  const normalized = text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!normalized) {
    return [];
  }

  // Split by paragraph separator
  const rawParagraphs = normalized
    .split(separator)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  if (rawParagraphs.length === 0) {
    return [];
  }

  // Break any paragraph longer than maxChunkSize into smaller blocks
  const normalizedParagraphs = [];
  for (const para of rawParagraphs) {
    if (para.length > maxChunkSize) {
      const splitBlocks = splitBlockByMaxSize(para, maxChunkSize);
      normalizedParagraphs.push(...splitBlocks);
    } else {
      normalizedParagraphs.push(para);
    }
  }

  const rawChunks = [];

  if (minChunkSize > 0) {
    // Merge small paragraphs to reach minChunkSize
    let currentChunk = '';

    for (const para of normalizedParagraphs) {
      if (currentChunk && currentChunk.length + separator.length + para.length > maxChunkSize) {
        rawChunks.push(currentChunk.trim());
        currentChunk = para;
      } else if (currentChunk) {
        currentChunk += separator + para;
        if (currentChunk.length >= minChunkSize) {
          rawChunks.push(currentChunk.trim());
          currentChunk = '';
        }
      } else {
        currentChunk = para;
        if (currentChunk.length >= minChunkSize) {
          rawChunks.push(currentChunk.trim());
          currentChunk = '';
        }
      }
    }

    if (currentChunk) {
      if (rawChunks.length > 0 && currentChunk.length < minChunkSize) {
        const lastIdx = rawChunks.length - 1;
        if (rawChunks[lastIdx].length + separator.length + currentChunk.length <= maxChunkSize) {
          rawChunks[lastIdx] = `${rawChunks[lastIdx]}${separator}${currentChunk}`.trim();
        } else {
          rawChunks.push(currentChunk.trim());
        }
      } else {
        rawChunks.push(currentChunk.trim());
      }
    }
  } else {
    // When minChunkSize is 0/unspecified, preserve individual paragraph boundaries
    for (const para of normalizedParagraphs) {
      rawChunks.push(para.trim());
    }
  }

  return rawChunks
    .filter((chunk) => chunk.length > 0)
    .map((chunkText, index) => ({
      text: chunkText,
      pageNumber,
      chunkIndex: index,
      charCount: chunkText.length
    }));
}

/**
 * Process multiple text segments (e.g. from multiple pages or OCR extractions)
 * into a flat array of chunks, maintaining page context and global chunk indices.
 * 
 * @param {Array<{text: string, pageNumber: number}>} textSegments - Array of text + page mappings
 * @param {Object} [options={}] - Passed to splitTextIntoChunks
 * @returns {Array<Object>} Flattened array of all chunks from all segments
 */
export function processTextSegments(textSegments, options = {}) {
  if (!Array.isArray(textSegments)) {
    return [];
  }

  const allChunks = [];
  let globalChunkIndex = 0;

  for (const segment of textSegments) {
    if (!segment || typeof segment !== 'object') continue;
    const { text, pageNumber = 1 } = segment;
    const chunks = splitTextIntoChunks(text, pageNumber, options);

    for (const chunk of chunks) {
      allChunks.push({
        ...chunk,
        chunkIndex: globalChunkIndex
      });
      globalChunkIndex++;
    }
  }

  return allChunks;
}

/**
 * Validate a chunk before storage in NoteChunk model.
 * 
 * @param {Object} chunk - Chunk object to validate
 * @returns {{ valid: boolean, errors: Array<string> }}
 */
export function validateChunk(chunk) {
  const errors = [];

  if (!chunk || typeof chunk !== 'object') {
    return { valid: false, errors: ['Chunk must be an object'] };
  }

  if (typeof chunk.text !== 'string' || chunk.text.trim().length === 0) {
    errors.push('Chunk.text must be a non-empty string');
  } else if (chunk.text.length > 5000) {
    errors.push('Chunk.text cannot exceed 5000 characters');
  }

  if (typeof chunk.pageNumber !== 'number' || chunk.pageNumber < 1) {
    errors.push('Chunk.pageNumber must be a number >= 1');
  }

  if (typeof chunk.chunkIndex !== 'number' || chunk.chunkIndex < 0) {
    errors.push('Chunk.chunkIndex must be a non-negative number');
  }

  if (
    typeof chunk.charCount !== 'number' ||
    (typeof chunk.text === 'string' && chunk.charCount !== chunk.text.length)
  ) {
    errors.push('Chunk.charCount must equal the length of chunk.text');
  }

  if (chunk.embedding !== null && chunk.embedding !== undefined) {
    if (!Array.isArray(chunk.embedding)) {
      errors.push('Chunk.embedding must be null or an array');
    } else if (chunk.embedding.length !== 768) {
      errors.push('Chunk.embedding must be null or a 768-dimensional vector');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
