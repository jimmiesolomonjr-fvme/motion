/**
 * Pre-migration script — runs raw SQL before prisma db push
 * Handles column renames and backfills that must happen before schema push.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  try {
    // 1. Add creatorId column if it doesn't exist, backfill from stepperId
    const hasCreatorId = await prisma.$queryRaw`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'Move' AND column_name = 'creatorId'
    `;
    if (hasCreatorId.length === 0) {
      console.log('Pre-migrate: Adding creatorId to Move...');
      await prisma.$executeRawUnsafe(`ALTER TABLE "Move" ADD COLUMN "creatorId" TEXT`);
      await prisma.$executeRawUnsafe(`UPDATE "Move" SET "creatorId" = "stepperId" WHERE "creatorId" IS NULL`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "Move" ALTER COLUMN "creatorId" SET NOT NULL`);
      console.log('Pre-migrate: creatorId added and backfilled from stepperId');
    }

    // 2. Rename baddieId → userId in MoveInterest if old column exists
    const hasBaddieId = await prisma.$queryRaw`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'MoveInterest' AND column_name = 'baddieId'
    `;
    if (hasBaddieId.length > 0) {
      console.log('Pre-migrate: Renaming MoveInterest.baddieId → userId...');
      try {
        await prisma.$executeRawUnsafe(`ALTER TABLE "MoveInterest" DROP CONSTRAINT IF EXISTS "MoveInterest_moveId_baddieId_key"`);
      } catch (e) { /* constraint may not exist */ }
      await prisma.$executeRawUnsafe(`ALTER TABLE "MoveInterest" RENAME COLUMN "baddieId" TO "userId"`);
      console.log('Pre-migrate: baddieId renamed to userId');
    }

    // 3. Make stepperId nullable if it isn't already
    const stepperCol = await prisma.$queryRaw`
      SELECT is_nullable FROM information_schema.columns
      WHERE table_name = 'Move' AND column_name = 'stepperId'
    `;
    if (stepperCol.length > 0 && stepperCol[0].is_nullable === 'NO') {
      console.log('Pre-migrate: Making Move.stepperId nullable...');
      await prisma.$executeRawUnsafe(`ALTER TABLE "Move" ALTER COLUMN "stepperId" DROP NOT NULL`);
      console.log('Pre-migrate: stepperId is now nullable');
    }

    console.log('Pre-migrate: done');
  } catch (error) {
    console.error('Pre-migrate error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

run();
