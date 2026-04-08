// Photo Pipeline — Deferred Implementation
//
// Full implementation uses:
// - fal.ai (Flux Pro) + IP-Adapter for consistent face generation
// - Sharp for de-AI processing (noise, vignette, barrel distortion, JPEG artifacts)
// - exiftool for EXIF injection
// - Cloudinary upload to motion/profiles
//
// Requires: FAL_API_KEY env var
//
// This is a one-time run for 16 personas. Synthetic users start with empty photo arrays.

export async function generatePersonaPhotos(syntheticProfileId) {
  console.log('[synthetic] Photo pipeline not yet implemented — synthetic users run without photos');
  return { generated: 0, uploaded: 0 };
}

export async function runFullPhotoPipeline() {
  console.log('[synthetic] Full photo pipeline not yet implemented');
  return { total: 0 };
}
