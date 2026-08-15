import Tesseract from 'tesseract.js';
import PDFDocument from 'pdfkit';
import fs from 'fs';

const OCR_CONFIDENCE_THRESHOLD = 45;

/**
 * Extracts text from an image and saves it locally as a clean PDF file.
 * @param {string} imagePath - The temporary path of the uploaded image file.
 * @param {string} outputPath - The path where the final PDF should be written.
 */
export async function processOcrToPdf(imagePath, outputPath) {
  try {
    // 1. Run Tesseract OCR to read text from the photo
    const result = await Tesseract.recognize(imagePath, 'eng');
    const extractedText = (result?.data?.text || '').trim();
    const confidence = Number(result?.data?.confidence ?? 0);

    if (!extractedText) {
      throw new Error('No readable text found in the image.');
    }

    if (confidence > 0 && confidence < OCR_CONFIDENCE_THRESHOLD) {
      throw new Error(`OCR confidence too low (${confidence}%). Please upload a clearer image or a PDF.`);
    }

    // 2. Generate a clean PDF using PDFKit
    const doc = new PDFDocument();
    const writeStream = fs.createWriteStream(outputPath);
    doc.pipe(writeStream);

    // Style the text inside the PDF file nicely
    doc.fontSize(16).text('Extracted Note Content (campusHustle OCR)', { underline: true });
    doc.moveDown();
    doc.fontSize(12).text(extractedText);

    doc.end();

    // Wait until the PDF file is completely saved to disk
    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    return {
      extractedText,
      confidence,
      outputPath
    };
  } catch (error) {
    throw new Error(`OCR Pipeline failed: ${error.message}`);
  }
}

