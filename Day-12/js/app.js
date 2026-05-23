import {
  IDS_DOCUMENTS_ENDPOINT,
  SAMPLE_DOCUMENT_PATH,
  appState,
  createVerificationRoomUrl,
  formatDateForDisplay,
  safeObjectUrl,
  setDocumentSource,
  setSelfie
} from './config.js';
import { extractDocumentData } from './documentOCR.js';
import { compareDocumentFaceToSelfie, ensureFaceApiReady } from './faceDetection.js';
import { getOverallDecision, verifyDob, verifyName } from './verification.js';
import { captureFrame, startCamera, stopCamera } from './webcam.js';

const elements = {
  appStatus: document.querySelector('#app-status'),
  callStatus: document.querySelector('#call-status'),
  cameraPreview: document.querySelector('#camera-preview'),
  cameraStatus: document.querySelector('#camera-status'),
  captureButton: document.querySelector('#capture-button'),
  captureCanvas: document.querySelector('#capture-canvas'),
  claimedDob: document.querySelector('#claimed-dob'),
  claimedName: document.querySelector('#claimed-name'),
  dobResult: document.querySelector('#dob-result'),
  documentInput: document.querySelector('#document-input'),
  documentPreview: document.querySelector('#document-preview'),
  documentSourceModes: document.querySelectorAll('input[name="document-source-mode"]'),
  faceResult: document.querySelector('#face-result'),
  idsDocumentSelect: document.querySelector('#ids-document-select'),
  idsFolderResults: document.querySelector('#ids-folder-results'),
  idsFolderStatus: document.querySelector('#ids-folder-status'),
  existingDocumentPanel: document.querySelector('#existing-document-panel'),
  loadIdsDocumentButton: document.querySelector('#load-ids-document-button'),
  loadSampleButton: document.querySelector('#load-sample-button'),
  nameResult: document.querySelector('#name-result'),
  ocrDob: document.querySelector('#ocr-dob'),
  ocrName: document.querySelector('#ocr-name'),
  ocrText: document.querySelector('#ocr-text'),
  overallResult: document.querySelector('#overall-result'),
  resultDetail: document.querySelector('#result-detail'),
  selfiePreview: document.querySelector('#selfie-preview'),
  startCallButton: document.querySelector('#start-call-button'),
  startCameraButton: document.querySelector('#start-camera-button'),
  uploadDocumentPanel: document.querySelector('#upload-document-panel'),
  verifyIdsFolderButton: document.querySelector('#verify-ids-folder-button'),
  verifyButton: document.querySelector('#verify-button')
};

function setStatus(element, message) {
  element.textContent = message;
}

function setResultState(element, label, tone) {
  element.textContent = label;
  element.classList.remove('is-pass', 'is-review', 'is-fail');

  if (tone === 'pass') {
    element.classList.add('is-pass');
  }

  if (tone === 'review') {
    element.classList.add('is-review');
  }

  if (tone === 'fail') {
    element.classList.add('is-fail');
  }
}

function resetResults() {
  setResultState(elements.nameResult, 'Pending', '');
  setResultState(elements.dobResult, 'Pending', '');
  setResultState(elements.faceResult, 'Pending', '');
  setResultState(elements.overallResult, 'Awaiting verification', '');
  elements.resultDetail.textContent = 'The app will summarize OCR matches and face similarity here.';
}

function setDocumentMode(mode) {
  appState.documentMode = mode;
  const isExistingMode = mode === 'existing';

  elements.uploadDocumentPanel.hidden = isExistingMode;
  elements.existingDocumentPanel.hidden = !isExistingMode;
  elements.verifyButton.textContent = isExistingMode ? 'Find Matching Stored ID' : 'Validate Uploaded Identity';

  resetResults();

  if (isExistingMode) {
    setStatus(elements.appStatus, 'Stored-document mode selected. Enter the claimed identity, capture a selfie, then find a matching ID in the IDS folder.');
    return;
  }

  setStatus(elements.appStatus, appState.documentSource ? 'Uploaded-document mode selected. Validate the loaded document when ready.' : 'Uploaded-document mode selected. Upload a valid identity document to continue.');
}

function paintDocumentPreview(previewUrl) {
  elements.documentPreview.src = previewUrl;
  elements.documentPreview.hidden = false;
}

function paintSelfiePreview(previewUrl) {
  elements.selfiePreview.src = previewUrl;
  elements.selfiePreview.hidden = false;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatPassFail(result, passLabel = 'Matched', failLabel = 'Mismatch') {
  return result.passed ? passLabel : failLabel;
}

function renderIdsDocumentOptions() {
  elements.idsDocumentSelect.innerHTML = '';

  if (!appState.idsDocuments.length) {
    const option = new Option('No image documents found in IDS folder', '');
    elements.idsDocumentSelect.append(option);
    elements.idsDocumentSelect.disabled = true;
    elements.loadIdsDocumentButton.disabled = true;
    elements.verifyIdsFolderButton.disabled = true;
    setStatus(elements.idsFolderStatus, 'No image documents were found in the IDS folder.');
    return;
  }

  appState.idsDocuments.forEach((documentInfo) => {
    const option = new Option(documentInfo.name, documentInfo.url);
    elements.idsDocumentSelect.append(option);
  });

  elements.idsDocumentSelect.disabled = false;
  elements.loadIdsDocumentButton.disabled = false;
  elements.verifyIdsFolderButton.disabled = false;
  setStatus(elements.idsFolderStatus, `${appState.idsDocuments.length} document(s) found in the IDS folder.`);
}

function getSelectedIdsDocument() {
  return appState.idsDocuments.find((documentInfo) => documentInfo.url === elements.idsDocumentSelect.value) || null;
}

async function loadIdsDocuments() {
  const response = await fetch(IDS_DOCUMENTS_ENDPOINT, { cache: 'no-store' });

  if (!response.ok) {
    throw new Error('Unable to read the IDS folder from the local server.');
  }

  const payload = await response.json();
  appState.idsDocuments = Array.isArray(payload.documents) ? payload.documents : [];
  renderIdsDocumentOptions();
}

async function loadSelectedIdsDocument() {
  const selectedDocument = getSelectedIdsDocument();

  if (!selectedDocument) {
    throw new Error('Choose an ID document from the IDS folder first.');
  }

  setStatus(elements.idsFolderStatus, `Loading ${selectedDocument.name} from the IDS folder...`);
  await useDocumentSource(selectedDocument.url, selectedDocument.url);
  setStatus(elements.idsFolderStatus, `${selectedDocument.name} loaded. You can now run Validate Identity.`);
}

function renderIdsFolderResults(rows) {
  if (!rows.length) {
    elements.idsFolderResults.className = 'folder-results-empty';
    elements.idsFolderResults.innerHTML = 'No IDS folder verification results yet.';
    return;
  }

  elements.idsFolderResults.className = 'folder-results-table-wrap';
  elements.idsFolderResults.innerHTML = `
    <table class="folder-results-table">
      <thead>
        <tr>
          <th>Document</th>
          <th>OCR Name</th>
          <th>OCR DOB</th>
          <th>Name</th>
          <th>Date of Birth</th>
          <th>Face</th>
          <th>Decision</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map((row) => {
            if (row.error) {
              return `
                <tr>
                  <td>${escapeHtml(row.name)}</td>
                  <td colspan="6"><span class="match-badge is-fail">Error</span> ${escapeHtml(row.error)}</td>
                </tr>
              `;
            }

            return `
              <tr>
                <td>${escapeHtml(row.name)}</td>
                <td>${escapeHtml(row.extractedName || 'Not found')}</td>
                <td>${escapeHtml(formatDateForDisplay(row.extractedDob))}</td>
                <td><span class="match-badge ${row.nameResult.passed ? 'is-pass' : 'is-fail'}">${formatPassFail(row.nameResult)}</span></td>
                <td><span class="match-badge ${row.dobResult.passed ? 'is-pass' : 'is-fail'}">${formatPassFail(row.dobResult)}</span></td>
                <td><span class="match-badge ${row.faceResult.passed ? 'is-pass' : 'is-fail'}">${formatPassFail(row.faceResult)} (${row.faceDistance})</span></td>
                <td><span class="match-badge ${row.overall.tone === 'pass' ? 'is-pass' : row.overall.tone === 'review' ? 'is-review' : 'is-fail'}">${row.overall.label}</span></td>
              </tr>
            `;
          })
          .join('')}
      </tbody>
    </table>
  `;
}

function updatePrimaryResultsFromFolderRows(rows) {
  const completedRows = rows.filter((row) => row.overall);

  if (!completedRows.length) {
    setResultState(elements.nameResult, 'No readable stored ID', 'fail');
    setResultState(elements.dobResult, 'No readable stored ID', 'fail');
    setResultState(elements.faceResult, 'No readable stored ID', 'fail');
    setResultState(elements.overallResult, 'No stored match', 'fail');
    elements.resultDetail.textContent = 'The IDS folder search could not complete verification for any stored document.';
    return;
  }

  const scoreRow = (row) => [row.nameResult, row.dobResult, row.faceResult].filter((result) => result.passed).length;
  const bestRow = completedRows
    .slice()
    .sort((left, right) => scoreRow(right) - scoreRow(left) || Number(left.faceDistance) - Number(right.faceDistance))[0];

  setResultState(
    elements.nameResult,
    bestRow.nameResult.passed ? `Matched in ${bestRow.name}` : `Mismatch in best candidate`,
    bestRow.nameResult.passed ? 'pass' : 'fail'
  );
  setResultState(
    elements.dobResult,
    bestRow.dobResult.passed ? `Matched in ${bestRow.name}` : `Mismatch in best candidate`,
    bestRow.dobResult.passed ? 'pass' : 'fail'
  );
  setResultState(
    elements.faceResult,
    bestRow.faceResult.passed ? `Matched (${bestRow.faceDistance})` : `Mismatch (${bestRow.faceDistance})`,
    bestRow.faceResult.passed ? 'pass' : 'fail'
  );
  setResultState(elements.overallResult, bestRow.overall.label, bestRow.overall.tone);
  elements.resultDetail.textContent = `Best stored document candidate: ${bestRow.name}. ${bestRow.overall.detail} ${bestRow.nameResult.detail}. ${bestRow.dobResult.detail}. ${bestRow.faceResult.detail}`;
}

async function runDocumentExtraction() {
  if (!appState.documentSource) {
    throw new Error('Upload an ID document first.');
  }

  setStatus(elements.appStatus, 'Reading the document and extracting OCR text...');
  const extracted = await extractDocumentData(appState.documentSource);
  appState.extractedDocument = extracted;

  elements.ocrName.textContent = extracted.extractedName || 'Not found';
  elements.ocrDob.textContent = formatDateForDisplay(extracted.extractedDob);
  elements.ocrText.value = extracted.rawText || '';
}

async function useDocumentSource(source, previewUrl) {
  setDocumentSource(source, previewUrl);
  paintDocumentPreview(previewUrl);
  resetResults();
  elements.ocrName.textContent = 'Extracting...';
  elements.ocrDob.textContent = 'Extracting...';
  elements.ocrText.value = '';
  await runDocumentExtraction();
  setStatus(elements.appStatus, 'Document loaded. Start the call, enable the camera, and capture a selfie.');
}

async function handleDocumentUpload(event) {
  const [file] = event.target.files || [];
  if (!file) {
    return;
  }

  const previewUrl = safeObjectUrl(file);
  await useDocumentSource(file, previewUrl);
}

async function handleLoadSample() {
  await useDocumentSource(SAMPLE_DOCUMENT_PATH, SAMPLE_DOCUMENT_PATH);
}

async function verifyIdsFolder() {
  if (!appState.idsDocuments.length) {
    throw new Error('No ID documents were found in the IDS folder.');
  }

  if (!appState.selfieBlob) {
    throw new Error('Capture a selfie before verifying the IDS folder.');
  }

  if (!elements.claimedName.value.trim() || !elements.claimedDob.value) {
    throw new Error('Enter the claimed full name and date of birth before verifying the IDS folder.');
  }

  const rows = [];
  elements.verifyIdsFolderButton.disabled = true;
  renderIdsFolderResults(rows);
  setStatus(elements.appStatus, 'Comparing the claimed identity and selfie against IDS folder documents...');

  try {
    for (const [index, documentInfo] of appState.idsDocuments.entries()) {
      setStatus(elements.idsFolderStatus, `Checking ${index + 1} of ${appState.idsDocuments.length}: ${documentInfo.name}`);

      try {
        const extractedDocument =
          appState.documentSource === documentInfo.url && appState.extractedDocument
            ? appState.extractedDocument
            : await extractDocumentData(documentInfo.url);
        const nameResult = verifyName(elements.claimedName.value, extractedDocument.extractedName);
        const dobResult = verifyDob(elements.claimedDob.value, extractedDocument.extractedDob);
        const faceCheck = await compareDocumentFaceToSelfie(documentInfo.url, appState.selfieBlob);
        const faceResult = {
          passed: faceCheck.passed,
          detail: `Face distance ${faceCheck.distance.toFixed(3)} with ${(faceCheck.similarityScore * 100).toFixed(0)}% confidence against threshold.`
        };
        const overall = getOverallDecision({ nameResult, dobResult, faceResult });

        rows.push({
          name: documentInfo.name,
          extractedName: extractedDocument.extractedName,
          extractedDob: extractedDocument.extractedDob,
          nameResult,
          dobResult,
          faceResult,
          faceDistance: faceCheck.distance.toFixed(3),
          overall
        });
      } catch (error) {
        rows.push({
          name: documentInfo.name,
          error: error instanceof Error ? error.message : 'Unable to verify this document.'
        });
      }

      renderIdsFolderResults(rows);
    }

    const verifiedMatches = rows.filter((row) => row.overall?.tone === 'pass');
    const reviewMatches = rows.filter((row) => row.overall?.tone === 'review');

    if (verifiedMatches.length) {
      setStatus(elements.idsFolderStatus, `${verifiedMatches.length} full match(es) found in the IDS folder.`);
      setStatus(elements.appStatus, 'IDS folder verification complete. At least one document matched name, date of birth, and face.');
    } else if (reviewMatches.length) {
      setStatus(elements.idsFolderStatus, `${reviewMatches.length} partial match(es) found; manual review required.`);
      setStatus(elements.appStatus, 'IDS folder verification complete. No full match, but at least one document partially matched.');
    } else {
      setStatus(elements.idsFolderStatus, 'No matching document found in the IDS folder.');
      setStatus(elements.appStatus, 'IDS folder verification complete. Name, date of birth, and face did not all match any IDS document.');
    }

    updatePrimaryResultsFromFolderRows(rows);
    return rows;
  } finally {
    elements.verifyIdsFolderButton.disabled = false;
  }
}

function startCall() {
  const callUrl = createVerificationRoomUrl();
  appState.callUrl = callUrl;
  window.open(callUrl, '_blank', 'noopener,noreferrer');
  setStatus(elements.callStatus, `Call launched: ${callUrl}`);
}

async function enableCamera() {
  stopCamera(appState.stream);
  setStatus(elements.cameraStatus, 'Requesting camera access...');
  appState.stream = await startCamera(elements.cameraPreview);
  setStatus(elements.cameraStatus, 'Camera live. Capture the user when framing looks correct.');
}

async function captureSelfie() {
  if (!appState.stream) {
    throw new Error('Enable the camera before capturing a selfie.');
  }

  const blob = await captureFrame(elements.cameraPreview, elements.captureCanvas);
  const previewUrl = safeObjectUrl(blob);
  setSelfie(blob, previewUrl);
  paintSelfiePreview(previewUrl);
  setStatus(elements.cameraStatus, 'Selfie captured. You can run verification now.');
}

async function runVerification() {
  if (appState.documentMode === 'existing') {
    await verifyIdsFolder();
    return;
  }

  if (!appState.documentSource) {
    throw new Error('Upload a valid identity document before running verification, or choose that the user already provided the document.');
  }

  if (!appState.selfieBlob) {
    throw new Error('Capture a selfie before running verification.');
  }

  if (!elements.claimedName.value.trim() || !elements.claimedDob.value) {
    throw new Error('Enter the claimed full name and date of birth before verifying.');
  }

  if (!appState.extractedDocument) {
    await runDocumentExtraction();
  }

  setStatus(elements.appStatus, 'Running OCR comparison and face verification...');

  const nameResult = verifyName(elements.claimedName.value, appState.extractedDocument.extractedName);
  const dobResult = verifyDob(elements.claimedDob.value, appState.extractedDocument.extractedDob);
  const faceCheck = await compareDocumentFaceToSelfie(appState.documentSource, appState.selfieBlob);

  const faceResult = {
    passed: faceCheck.passed,
    detail: `Face distance ${faceCheck.distance.toFixed(3)} with ${(faceCheck.similarityScore * 100).toFixed(0)}% confidence against threshold.`
  };

  setResultState(
    elements.nameResult,
    nameResult.passed ? `Matched (${(nameResult.similarity * 100).toFixed(0)}%)` : `Mismatch (${(nameResult.similarity * 100).toFixed(0)}%)`,
    nameResult.passed ? 'pass' : 'fail'
  );
  setResultState(elements.dobResult, dobResult.passed ? 'Matched' : 'Mismatch', dobResult.passed ? 'pass' : 'fail');
  setResultState(
    elements.faceResult,
    faceResult.passed ? `Matched (${faceCheck.distance.toFixed(3)})` : `Mismatch (${faceCheck.distance.toFixed(3)})`,
    faceResult.passed ? 'pass' : 'fail'
  );

  const overall = getOverallDecision({ nameResult, dobResult, faceResult });
  setResultState(elements.overallResult, overall.label, overall.tone);
  elements.resultDetail.textContent = `${overall.detail} ${nameResult.detail}. ${dobResult.detail}. ${faceResult.detail}`;
  setStatus(elements.appStatus, 'Verification complete. Review the result cards below.');
}

function attachEvents() {
  elements.documentSourceModes.forEach((modeInput) => {
    modeInput.addEventListener('change', () => {
      if (modeInput.checked) {
        setDocumentMode(modeInput.value);
      }
    });
  });
  elements.documentInput.addEventListener('change', (event) => {
    handleDocumentUpload(event).catch(handleError);
  });
  elements.loadSampleButton.addEventListener('click', () => {
    handleLoadSample().catch(handleError);
  });
  elements.loadIdsDocumentButton.addEventListener('click', () => {
    loadSelectedIdsDocument().catch(handleError);
  });
  elements.verifyIdsFolderButton.addEventListener('click', () => {
    verifyIdsFolder().catch(handleError);
  });
  elements.startCallButton.addEventListener('click', () => {
    startCall();
  });
  elements.startCameraButton.addEventListener('click', () => {
    enableCamera().catch(handleError);
  });
  elements.captureButton.addEventListener('click', () => {
    captureSelfie().catch(handleError);
  });
  elements.verifyButton.addEventListener('click', () => {
    runVerification().catch(handleError);
  });
  window.addEventListener('beforeunload', () => {
    stopCamera(appState.stream);
  });
}

function handleError(error) {
  const message = error instanceof Error ? error.message : 'Unexpected error while running the verification flow.';
  setStatus(elements.appStatus, message);
}

async function bootstrap() {
  resetResults();
  attachEvents();
  setDocumentMode('upload');
  setStatus(elements.appStatus, 'Loading face verification models in the background...');

  loadIdsDocuments().catch((error) => {
    const message = error instanceof Error ? error.message : 'Unable to load IDS folder documents.';
    setStatus(elements.idsFolderStatus, message);
  });

  try {
    await ensureFaceApiReady();
    if (appState.documentMode === 'existing') {
      setStatus(elements.appStatus, 'Models ready. Enter the claimed identity, capture a selfie, then find a matching ID in the IDS folder.');
    } else {
      setStatus(elements.appStatus, 'Models ready. Upload a document or use the sample ID to begin.');
    }
  } catch (error) {
    handleError(new Error('Unable to preload face models. Check your network connection and reload the page.'));
  }
}

bootstrap();