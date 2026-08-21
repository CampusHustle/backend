import test from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { extractTextFromPdfBuffer } from '../utils/pdfExtractor.js';

test('pdfExtractor - extracts text from uncompressed PDF stream buffer', async () => {
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
  const segments = await extractTextFromPdfBuffer(buffer);

  assert.ok(Array.isArray(segments));
  assert.ok(segments.length > 0);
  const allText = segments.map((s) => s.text).join(' ');
  assert.ok(allText.includes('Calculus is the mathematical study'));
});

test('pdfExtractor - extracts text from FlateDecode compressed PDF stream', async () => {
  const content = 'BT /F1 12 Tf 72 720 Td (Photosynthesis converts light energy into chemical energy.) Tj ET';
  const compressed = zlib.deflateSync(Buffer.from(content)).toString('latin1');
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
<< /Length ${compressed.length} /Filter /FlateDecode >>
stream
${compressed}
endstream
endobj
trailer
<< /Size 5 /Root 1 0 R >>
%%EOF`;

  const buffer = Buffer.from(samplePdf, 'latin1');
  const segments = await extractTextFromPdfBuffer(buffer);

  assert.ok(segments.length > 0);
  const allText = segments.map((s) => s.text).join(' ');
  assert.ok(allText.includes('Photosynthesis converts light energy'));
});

test('pdfExtractor - handles empty or invalid buffer gracefully', async () => {
  assert.deepEqual(await extractTextFromPdfBuffer(Buffer.alloc(0)), []);
  assert.deepEqual(await extractTextFromPdfBuffer(null), []);
});
