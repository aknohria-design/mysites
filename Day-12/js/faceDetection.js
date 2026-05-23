import { FACE_DISTANCE_THRESHOLD, MODEL_PATH } from './config.js';

let modelPromise;

function euclideanDistance(descriptorA, descriptorB) {
  const total = descriptorA.reduce((sum, value, index) => {
    const diff = value - descriptorB[index];
    return sum + diff * diff;
  }, 0);

  return Math.sqrt(total);
}

async function loadImageElement(source) {
  if (source instanceof HTMLImageElement) {
    if (source.complete) {
      return source;
    }

    await new Promise((resolve, reject) => {
      source.onload = resolve;
      source.onerror = reject;
    });
    return source;
  }

  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = typeof source === 'string' ? source : URL.createObjectURL(source);
  });
}

export async function ensureFaceApiReady() {
  if (!modelPromise) {
    modelPromise = Promise.all([
      window.faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_PATH),
      window.faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_PATH),
      window.faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_PATH)
    ]);
  }

  await modelPromise;
}

async function getPrimaryDescriptor(input) {
  const options = new window.faceapi.SsdMobilenetv1Options({ minConfidence: 0.35, maxResults: 3 });
  const detections = await window.faceapi
    .detectAllFaces(input, options)
    .withFaceLandmarks()
    .withFaceDescriptors();

  if (!detections.length) {
    return null;
  }

  return detections
    .sort((left, right) => {
      const leftArea = left.detection.box.width * left.detection.box.height;
      const rightArea = right.detection.box.width * right.detection.box.height;
      return rightArea - leftArea;
    })[0]
    .descriptor;
}

export async function compareDocumentFaceToSelfie(documentSource, selfieBlob) {
  await ensureFaceApiReady();

  const [documentImage, selfieImage] = await Promise.all([
    loadImageElement(documentSource),
    loadImageElement(selfieBlob)
  ]);

  const [documentDescriptor, selfieDescriptor] = await Promise.all([
    getPrimaryDescriptor(documentImage),
    getPrimaryDescriptor(selfieImage)
  ]);

  if (!documentDescriptor) {
    throw new Error('No face was detected on the uploaded document.');
  }

  if (!selfieDescriptor) {
    throw new Error('No face was detected in the captured selfie.');
  }

  const distance = euclideanDistance(Array.from(documentDescriptor), Array.from(selfieDescriptor));
  const passed = distance <= FACE_DISTANCE_THRESHOLD;

  return {
    distance,
    passed,
    similarityScore: Math.max(0, 1 - distance / FACE_DISTANCE_THRESHOLD)
  };
}