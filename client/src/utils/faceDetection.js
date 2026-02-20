/**
 * Detect whether an image file contains a human face using the browser's
 * FaceDetector API (Chrome, Edge, Safari). Falls back to allowing the
 * photo if the API is unavailable (e.g. Firefox).
 */
export async function detectFace(file) {
  if (!('FaceDetector' in window)) return true;

  try {
    const bitmap = await createImageBitmap(file);
    const detector = new window.FaceDetector();
    const faces = await detector.detect(bitmap);
    return faces.length > 0;
  } catch {
    // API threw (e.g. unsupported platform detail) — allow the photo
    return true;
  }
}
