import test from 'node:test';
import assert from 'node:assert/strict';
import { extractTextFromPdfBuffer } from '../utils/pdfExtractor.js';

test('pdfExtractor - extracts text from PDF stream buffer', () => {
  const samplePdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 85 >>
stream
BT
/F1 12 Tf
100 700 Td
(Calculus is the mathematical study of continuous change.) Tj
ET
endstream
endobj
trailer
<< /Size 5 /Root 1 0 R >>
%%EOF`;

  const buffer = Buffer.from(samplePdf);
  const segments = extractTextFromPdfBuffer(buffer);

  assert.ok(Array.isArray(segments));
  assert.ok(segments.length > 0);
  assert.ok(segments[0].text.includes('Calculus is the mathematical study'));
  assert.equal(segments[0].pageNumber, 1);
});

test('pdfExtractor - handles empty or invalid buffer gracefully', () => {
  assert.deepEqual(extractTextFromPdfBuffer(Buffer.alloc(0)), []);
  assert.deepEqual(extractTextFromPdfBuffer(null), []);
});
