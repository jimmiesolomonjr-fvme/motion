import { PrismaClient } from '@prisma/client';
import { seedPrebuiltPersonas } from './personaGenerator.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const prisma = new PrismaClient();

async function restorePhotos() {
  const photoMapPath = path.join(__dirname, 'synthetic-photos.json');
  let photoMap;
  try {
    photoMap = JSON.parse(readFileSync(photoMapPath, 'utf-8'));
  } catch {
    console.log('[synthetic] No synthetic-photos.json found — skipping photo restore');
    return 0;
  }

  let restored = 0;
  for (const [email, photos] of Object.entries(photoMap)) {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });
    if (!user?.profile) continue;

    // Only restore if photos are empty (don't overwrite manual edits)
    const existing = user.profile.photos;
    if (Array.isArray(existing) && existing.length > 0) continue;

    await prisma.profile.update({
      where: { userId: user.id },
      data: { photos },
    });
    console.log(`[synthetic] Restored ${photos.length} photos for ${email}`);
    restored++;
  }
  return restored;
}

async function main() {
  console.log('[synthetic] Starting synthetic user seed...');
  const result = await seedPrebuiltPersonas();
  console.log(`[synthetic] Done: ${result.created} created, ${result.skipped} skipped`);

  // Restore photos from baked-in map if profiles have empty photos
  const restored = await restorePhotos();
  if (restored > 0) {
    console.log(`[synthetic] Restored photos for ${restored} profiles`);
  }

  await prisma.$disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('[synthetic] Seed failed:', err);
  process.exit(1);
});
