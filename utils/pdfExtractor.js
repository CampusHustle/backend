/**
 * Extracts readable text segments from a PDF buffer (FR-9, FR-11).
 * Pure JavaScript extractor without external C++ binary dependencies.
 *
 * Extracts text from PDF content streams (BT ... ET blocks, Tj and TJ operators)
 * as well as plain text streams.
 *
 * @param {Buffer} pdfBuffer - Raw PDF file binary buffer
 * @returns {Array<{ text: string, pageNumber: number }>}
 */
export function extractTextFromPdfBuffer(pdfBuffer) {
  if (!Buffer.isBuffer(pdfBuffer) || pdfBuffer.length === 0) {
    return [];
  }

  const pdfString = pdfBuffer.toString('latin1');
  const segments = [];

  // Match all /Contents streams or stream...endstream blocks
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match;
  let pageNumber = 1;

  while ((match = streamRegex.exec(pdfString)) !== null) {
    const rawStream = match[1];
    let pageText = '';

    // 1. Extract text enclosed in Tj operators: (text) Tj
    const tjRegex = /\(([^)]+)\)\s*(?:Tj|'|")/g;
    let tjMatch;
    while ((tjMatch = tjRegex.exec(rawStream)) !== null) {
      const decoded = decodePdfString(tjMatch[1]);
      if (decoded.trim()) {
        pageText += decoded + ' ';
      }
    }

    // 2. Extract text enclosed in TJ array operators: [(t1) 20 (t2)] TJ
    const tjArrayRegex = /\[([^\]]+)\]\s*TJ/g;
    let arrMatch;
    while ((arrMatch = tjArrayRegex.exec(rawStream)) !== null) {
      const inner = arrMatch[1];
      const partRegex = /\(([^)]+)\)/g;
      let partMatch;
      while ((partMatch = partRegex.exec(inner)) !== null) {
        const decoded = decodePdfString(partMatch[1]);
        if (decoded.trim()) {
          pageText += decoded + ' ';
        }
      }
    }

    // 3. If stream has readable plain text without standard operators
    if (!pageText.trim()) {
      const cleanStream = rawStream.replace(/[^\x20-\x7E\r\n\t]/g, ' ').trim();
      if (cleanStream.length > 20 && !cleanStream.startsWith('x\x9c') && !cleanStream.startsWith('/FlateDecode')) {
        pageText = cleanStream;
      }
    }

    const clean = pageText.replace(/\s+/g, ' ').trim();
    if (clean.length > 0) {
      segments.push({
        text: clean,
        pageNumber: pageNumber++
      });
    }
  }

  // Fallback: If no stream matches were found, extract printable text sequences from whole buffer
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
