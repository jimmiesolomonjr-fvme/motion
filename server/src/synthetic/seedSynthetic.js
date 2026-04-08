import { seedPrebuiltPersonas } from './personaGenerator.js';

async function main() {
  console.log('[synthetic] Starting synthetic user seed...');
  const result = await seedPrebuiltPersonas();
  console.log(`[synthetic] Done: ${result.created} created, ${result.skipped} skipped`);
  process.exit(0);
}

main().catch((err) => {
  console.error('[synthetic] Seed failed:', err);
  process.exit(1);
});
