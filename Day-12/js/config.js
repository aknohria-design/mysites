export const MODEL_PATH = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
export const FACE_DISTANCE_THRESHOLD = 0.58;
export const IDS_DOCUMENTS_ENDPOINT = './api/ids';
export const NAME_SIMILARITY_THRESHOLD = 0.72;
export const SAMPLE_DOCUMENT_PATH = './IMG_4804.jpeg';

export const appState = {
  callUrl: '',
  documentSource: null,
  documentMode: 'upload',
  documentPreviewUrl: '',
  extractedDocument: null,
  idsDocuments: [],
  selfieBlob: null,
  selfiePreviewUrl: '',
  stream: null
};

export function createVerificationRoomUrl() {
  const roomName = `identity-check-${Date.now()}`;
  return `https://meet.jit.si/${roomName}`;
}

export function setDocumentSource(source, previewUrl) {
  appState.documentSource = source;
  appState.documentPreviewUrl = previewUrl;
  appState.extractedDocument = null;
}

export function setSelfie(blob, previewUrl) {
  appState.selfieBlob = blob;
  appState.selfiePreviewUrl = previewUrl;
}

export function normalizeName(value) {
  return value
    .toUpperCase()
    .replace(/[^A-Z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeLoose(value) {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9\s/:-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function formatDateForDisplay(dateValue) {
  if (!dateValue) {
    return 'Not found';
  }

  const isoMatch = dateValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return `${isoMatch[2]}/${isoMatch[3]}/${isoMatch[1]}`;
  }

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }

  return new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
}

export function parseDateCandidate(rawValue) {
  if (!rawValue) {
    return null;
  }

  const compact = rawValue.trim().replace(/[-.]/g, '/');
  const isoMatch = rawValue.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const match = compact.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (match) {
    const month = Number(match[1]);
    const day = Number(match[2]);
    const year = Number(match[3]);

    if (!month || !day || !year || month > 12 || day > 31) {
      return null;
    }

    return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  }

  const directDate = new Date(rawValue.trim());
  if (!Number.isNaN(directDate.getTime())) {
    const year = directDate.getFullYear();
    const month = `${directDate.getMonth() + 1}`.padStart(2, '0');
    const day = `${directDate.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return null;
}

export function safeObjectUrl(blob) {
  return blob ? URL.createObjectURL(blob) : '';
}