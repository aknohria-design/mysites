import { parseDateCandidate } from './config.js';

let workerPromise;

async function getWorker() {
  if (!workerPromise) {
    workerPromise = window.Tesseract.createWorker('eng', 1);
  }

  return workerPromise;
}

function cleanupLine(line) {
  return line.replace(/^[^A-Z0-9]+/, '').replace(/\s+/g, ' ').trim();
}

function cleanNameToken(token) {
  return token.replace(/[^A-Z'-]/g, '').trim();
}

function looksLikeNameLine(line) {
  if (!line || /\d{2,}/.test(line)) {
    return false;
  }

  const cleaned = cleanupLine(line);
  if (!cleaned || cleaned.length < 2 || cleaned.length > 32) {
    return false;
  }

  const blockedWords = ['DRIVER', 'LICENSE', 'ARIZONA', 'PHOENIX', 'RESTRICTIONS', 'CLASS', 'ENDORSEMENTS'];
  return !blockedWords.some((word) => cleaned.includes(word));
}

function extractName(lines, text) {
  const numberedMatch = text.match(/(?:^|\n)\s*1\s+([A-Z][A-Z\s'-]+)\s*(?:\n|$)[\s\S]{0,40}?\s*2\s+([A-Z][A-Z\s'-]+)\s*(?:\n|$)/m);
  if (numberedMatch) {
    return `${cleanupLine(numberedMatch[2])} ${cleanupLine(numberedMatch[1])}`.trim();
  }

  const flattenedText = text.replace(/[^A-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const fieldAnchoredMatch = flattenedText.match(/([A-Z]{2,})\s+(?:[A-Z]{1,3}\s+){0,3}2\s+([A-Z]{2,})\s+\d{1,5}[A-Z]?\b/);
  if (fieldAnchoredMatch) {
    return `${cleanNameToken(fieldAnchoredMatch[2])} ${cleanNameToken(fieldAnchoredMatch[1])}`.trim();
  }

  const addressAnchoredMatch = flattenedText.match(/([A-Z]{2,})\s+(?:[A-Z]{1,3}\s+){0,3}([A-Z]{2,})\s+\d{1,5}[A-Z]?\b/);
  if (addressAnchoredMatch) {
    return `${cleanNameToken(addressAnchoredMatch[2])} ${cleanNameToken(addressAnchoredMatch[1])}`.trim();
  }

  const candidates = lines.filter(looksLikeNameLine).slice(0, 4);
  if (candidates.length >= 2) {
    return `${cleanupLine(candidates[1])} ${cleanupLine(candidates[0])}`.trim();
  }

  return candidates[0] ? cleanupLine(candidates[0]) : '';
}

function extractDob(text) {
  const dobMatch = text.match(/DOB[^0-9]{0,12}(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{4})/i);
  if (dobMatch) {
    return parseDateCandidate(dobMatch[1]);
  }

  const now = new Date();
  const minimumAdultYear = now.getFullYear() - 16;
  const allDates = [...text.matchAll(/(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{4})/g)]
    .map((match) => parseDateCandidate(match[1]))
    .filter(Boolean);

  const likelyBirthDates = allDates.filter((dateValue) => {
    const year = Number(dateValue.slice(0, 4));
    return year >= 1900 && year <= minimumAdultYear;
  });

  if (likelyBirthDates.length) {
    return likelyBirthDates.sort()[0];
  }

  return allDates[0] || null;
}

export async function extractDocumentData(imageSource) {
  const worker = await getWorker();
  const result = await worker.recognize(imageSource, { rotateAuto: true });
  const rawText = result.data.text || '';
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => cleanupLine(line.toUpperCase()))
    .filter(Boolean);

  return {
    extractedName: extractName(lines, rawText.toUpperCase()),
    extractedDob: extractDob(rawText),
    rawText: rawText.trim()
  };
}