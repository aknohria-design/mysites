export async function startCamera(videoElement) {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: 'user',
      width: { ideal: 1280 },
      height: { ideal: 720 }
    }
  });

  videoElement.srcObject = stream;
  await videoElement.play();
  return stream;
}

export function stopCamera(stream) {
  if (!stream) {
    return;
  }

  stream.getTracks().forEach((track) => track.stop());
}

export function captureFrame(videoElement, canvasElement) {
  const width = videoElement.videoWidth || 1280;
  const height = videoElement.videoHeight || 720;
  canvasElement.width = width;
  canvasElement.height = height;

  const context = canvasElement.getContext('2d');
  context.drawImage(videoElement, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvasElement.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Unable to capture a selfie from the current camera frame.'));
        return;
      }

      resolve(blob);
    }, 'image/jpeg', 0.92);
  });
}