import zlib from 'node:zlib';

/**
 * Extracts readable text segments from a PDF buffer (FR-9, FR-11).
 *
 * Primary strategy: pdf.js (pdfjs-dist) — properly decodes compressed
 * content streams (FlateDecode), subset font encodings, and per-page text.
 *
 * Fallback strategy: lightweight stream parsing with zlib inflation and
 * Tj/TJ operator extraction, used when pdf.js cannot process the file.
 *
 * @param {Buffer} pdfBuffer - Raw PDF file binary buffer
 * @returns {Promise<Array<{ text: string, pageNumber: number }>>}
 */
export async function extractTextFromPdfBuffer(pdfBuffer) {
  if (!Buffer.isBuffer(pdfBuffer) || pdfBuffer.length === 0) {
    return [];
  }

  try {
    const segments = await extractWithPdfJs(pdfBuffer);
    if (segments.length > 0) {
      return segments;
    }
  } catch (_err) {
    // Fall through to the lightweight parser below
  }

  return extractWithStreamParsing(pdfBuffer);
}

/**
 * Extracts text per page using pdf.js.
 * @param {Buffer} pdfBuffer
 * @returns {Promise<Array<{ text: string, pageNumber: number }>>}
 */
async function extractWithPdfJs(pdfBuffer) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(pdfBuffer),
    isEvalSupported: false,
    useSystemFonts: true
  }).promise;

  const segments = [];
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();

    let pageText = '';
    for (const item of content.items) {
      if (typeof item.str !== 'string') {
        continue;
      }
      pageText += item.str + (item.hasEOL ? '\n' : ' ');
    }

    const clean = pageText
      .replace(/[ \t]+/g, ' ')
      .replace(/ ?\n ?/g, '\n')
      .trim();

    if (clean.length > 0) {
      segments.push({ text: clean, pageNumber: pageNum });
    }
  }

  return segments;
}

/**
 * Lightweight fallback parser: scans raw/inflated content streams for
 * Tj and TJ text-showing operators. Handles both uncompressed streams
 * and FlateDecode-compressed streams.
 * @param {Buffer} pdfBuffer
 * @returns {Array<{ text: string, pageNumber: number }>}
 */
function extractWithStreamParsing(pdfBuffer) {
  const pdfString = pdfBuffer.toString('latin1');
  const segments = [];

  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match;
  let pageNumber = 1;

  while ((match = streamRegex.exec(pdfString)) !== null) {
    const rawStream = match[1];
    let decodedStream = rawStream;

    // Attempt FlateDecode inflation for compressed streams
    try {
      const buf = Buffer.from(rawStream, 'latin1');
      const inflated = zlib.inflateSync(buf).toString('latin1');
      if (inflated) {
        decodedStream = inflated;
      }
    } catch (_err) {
      // Not zlib-compressed; keep raw stream
    }

    const pageText = extractTextOperators(decodedStream);
    const clean = pageText.replace(/\s+/g, ' ').trim();
    if (clean.length > 0) {
      segments.push({
        text: clean,
        pageNumber: pageNumber++
      });
    }
  }

  // Last resort: printable ASCII sequences from the whole buffer
  if (segments.length === 0) {
    const textMatches = pdfString.match(/[a-zA-Z0-9.,?!'"\-:;\s]{15,}/g) || [];
    const combined = textMatches
      .map(s => s.trim())
      .filter(s => s.length > 20 && !s.includes('obj') && !s.includes('xref') && !s.includes('stream'))
      .join('\n\n');

    if (combined.trim()) {
      segments.push({
        text: combined.trim(),
        pageNumber: 1
      });
    }
  }

  return segments;
}

/**
 * Extracts text from PDF content-stream operators (Tj, ', ", TJ).
 * @param {string} streamContent - Decoded content stream
 * @returns {string} Concatenated visible text
 */
function extractTextOperators(streamContent) {
  let pageText = '';

  const tjRegex = /\(([^)]+)\)\s*(?:Tj|'|")/g;
  let tjMatch;
  while ((tjMatch = tjRegex.exec(streamContent)) !== null) {
    const decoded = decodePdfString(tjMatch[1]);
    if (decoded.trim()) {
      pageText += decoded + ' ';
    }
  }

  const tjArrayRegex = /\[([^\]]+)\]\s*TJ/g;
  let arrMatch;
  while ((arrMatch = tjArrayRegex.exec(streamContent)) !== null) {
    const partRegex = /\(([^)]+)\)/g;
    let partMatch;
    while ((partMatch = partRegex.exec(arrMatch[1])) !== null) {
      const decoded = decodePdfString(partMatch[1]);
      if (decoded.trim()) {
        pageText += decoded + ' ';
      }
    }
  }

  return pageText;
}

/**
 * Decodes basic PDF escape sequences
 * @param {string} str
 * @returns {string}
 */
function decodePdfString(str) {
  return str
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\b/g, '\b')
    .replace(/\\f/g, '\f')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\');
}
