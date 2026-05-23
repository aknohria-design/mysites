import { NAME_SIMILARITY_THRESHOLD, formatDateForDisplay, normalizeName, parseDateCandidate } from './config.js';

function levenshteinDistance(left, right) {
  const matrix = Array.from({ length: left.length + 1 }, () => new Array(right.length + 1).fill(0));

  for (let index = 0; index <= left.length; index += 1) {
    matrix[index][0] = index;
  }

  for (let index = 0; index <= right.length; index += 1) {
    matrix[0][index] = index;
  }

  for (let row = 1; row <= left.length; row += 1) {
    for (let column = 1; column <= right.length; column += 1) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1;
      matrix[row][column] = Math.min(
        matrix[row - 1][column] + 1,
        matrix[row][column - 1] + 1,
        matrix[row - 1][column - 1] + cost
      );
    }
  }

  return matrix[left.length][right.length];
}

export function verifyName(claimedName, extractedName) {
  const normalizedClaim = normalizeName(claimedName);
  const normalizedExtracted = normalizeName(extractedName);

  if (!normalizedClaim || !normalizedExtracted) {
    return {
      passed: false,
      similarity: 0,
      detail: 'Missing claimed name or OCR name.'
    };
  }

  const distance = levenshteinDistance(normalizedClaim, normalizedExtracted);
  const maxLength = Math.max(normalizedClaim.length, normalizedExtracted.length) || 1;
  const similarity = 1 - distance / maxLength;

  return {
    passed: similarity >= NAME_SIMILARITY_THRESHOLD,
    similarity,
    detail: `Claimed: ${normalizedClaim} | OCR: ${normalizedExtracted}`
  };
}

export function verifyDob(claimedDob, extractedDob) {
  const normalizedClaim = parseDateCandidate(claimedDob);
  const normalizedExtracted = parseDateCandidate(extractedDob);
  const passed = Boolean(normalizedClaim && normalizedExtracted && normalizedClaim === normalizedExtracted);

  return {
    passed,
    detail: `Claimed: ${formatDateForDisplay(normalizedClaim)} | OCR: ${formatDateForDisplay(normalizedExtracted)}`
  };
}

export function getOverallDecision({ nameResult, dobResult, faceResult }) {
  const passCount = [nameResult, dobResult, faceResult].filter((result) => result.passed).length;

  if (passCount === 3) {
    return {
      tone: 'pass',
      label: 'Verified',
      detail: 'All three checks passed: claimed identity, date of birth, and face match.'
    };
  }

  if (passCount === 2) {
    return {
      tone: 'review',
      label: 'Manual review required',
      detail: 'Two checks passed, but one verification step needs review before approval.'
    };
  }

  return {
    tone: 'fail',
    label: 'Verification failed',
    detail: 'Multiple verification checks failed. Do not auto-approve this identity.'
  };
}