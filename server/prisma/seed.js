import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { jasminePhotos } from './jasmine-photos.js';
import { uploadToCloud } from '../src/middleware/upload.js';

const prisma = new PrismaClient();

const vibeQuestions = [
  // Lifestyle
  { questionText: 'Do you prefer going out over staying in?', category: 'lifestyle' },
  { questionText: 'Are you a morning person?', category: 'lifestyle' },
  { questionText: 'Do you enjoy cooking at home?', category: 'lifestyle' },
  { questionText: 'Do you work out regularly?', category: 'lifestyle' },
  { questionText: 'Are you into fashion and keeping up with trends?', category: 'lifestyle' },
  { questionText: 'Do you enjoy traveling internationally?', category: 'lifestyle' },
  { questionText: 'Do you prefer luxury experiences over casual ones?', category: 'lifestyle' },
  { questionText: 'Are you a foodie who loves trying new restaurants?', category: 'lifestyle' },
  { questionText: 'Do you enjoy going to concerts and live events?', category: 'lifestyle' },
  { questionText: 'Do you prefer the city over the suburbs?', category: 'lifestyle' },

  // Values
  { questionText: 'Is family the most important thing to you?', category: 'values' },
  { questionText: 'Do you want kids in the future?', category: 'values' },
  { questionText: 'Is financial stability a top priority?', category: 'values' },
  { questionText: 'Do you believe in traditional gender roles in relationships?', category: 'values' },
  { questionText: 'Is faith or spirituality important to you?', category: 'values' },
  { questionText: 'Do you think couples should combine finances?', category: 'values' },
  { questionText: 'Is education level important in a partner?', category: 'values' },
  { questionText: 'Do you value ambition over everything else?', category: 'values' },
  { questionText: 'Do you believe in marriage?', category: 'values' },
  { questionText: 'Is giving back to the community important to you?', category: 'values' },

  // Relationship Style
  { questionText: 'Do you like receiving surprise gifts?', category: 'relationship' },
  { questionText: 'Is physical touch your love language?', category: 'relationship' },
  { questionText: 'Do you prefer planned dates over spontaneous ones?', category: 'relationship' },
  { questionText: 'Do you need a lot of alone time in a relationship?', category: 'relationship' },
  { questionText: 'Is good communication more important than chemistry?', category: 'relationship' },
  { questionText: 'Do you believe in love at first sight?', category: 'relationship' },
  { questionText: 'Would you date someone with a different political view?', category: 'relationship' },
  { questionText: 'Is it important that your partner gets along with your friends?', category: 'relationship' },
  { questionText: 'Do you like PDA (public displays of affection)?', category: 'relationship' },
  { questionText: 'Do you think long-distance can work?', category: 'relationship' },

  // Culture & Vibes
  { questionText: 'Is music a big part of your daily life?', category: 'culture' },
  { questionText: 'Do you keep up with Black culture and trends?', category: 'culture' },
  { questionText: 'Are you into sports?', category: 'culture' },
  { questionText: 'Do you enjoy art galleries and museums?', category: 'culture' },
  { questionText: 'Is your social media presence important to you?', category: 'culture' },
  { questionText: 'Do you enjoy clubbing and nightlife?', category: 'culture' },
  { questionText: 'Are you into podcasts and audiobooks?', category: 'culture' },
  { questionText: 'Do you support Black-owned businesses intentionally?', category: 'culture' },
  { questionText: 'Do you enjoy reality TV?', category: 'culture' },
  { questionText: 'Is having a strong friend group important to you?', category: 'culture' },

  // Ambition & Money
  { questionText: 'Do you have entrepreneurial goals?', category: 'ambition' },
  { questionText: 'Is building generational wealth important to you?', category: 'ambition' },
  { questionText: 'Do you invest in stocks or real estate?', category: 'ambition' },
  { questionText: 'Do you believe the man should pay on dates?', category: 'ambition' },
  { questionText: 'Would you relocate for the right opportunity?', category: 'ambition' },
  { questionText: 'Do you prefer experiences over material things?', category: 'ambition' },
  { questionText: 'Is your career your top priority right now?', category: 'ambition' },
  { questionText: 'Do you have a 5-year plan?', category: 'ambition' },
  { questionText: 'Is financial literacy attractive to you?', category: 'ambition' },
  { questionText: 'Do you believe in manifesting your goals?', category: 'ambition' },

  // Bonus
  { questionText: 'Do you believe in astrology?', category: 'bonus' },
  { questionText: 'Is a sense of humor the most attractive quality?', category: 'bonus' },
  { questionText: 'Would you rather be respected than liked?', category: 'bonus' },
  { questionText: 'Do you think loyalty is earned, not given?', category: 'bonus' },
  { questionText: 'Are you a risk-taker?', category: 'bonus' },
];

async function migratePhotosToCloudinary() {
  console.log('Starting base64 → Cloudinary migration...');
  let migrated = 0;

  // 1. Profile photos (JSON array of strings)
  const profiles = await prisma.profile.findMany({
    where: { NOT: { photos: { equals: [] } } },
    select: { id: true, userId: true, photos: true },
  });

  for (const profile of profiles) {
    const photos = profile.photos;
    let changed = false;
    const newPhotos = [];

    for (const photo of photos) {
      if (typeof photo === 'string' && photo.startsWith('data:')) {
        try {
          const url = await uploadToCloud(photo, 'motion/profiles');
          newPhotos.push(url);
          changed = true;
          migrated++;
        } catch (err) {
          console.error(`  Failed to migrate profile photo for user ${profile.userId}:`, err.message);
          newPhotos.push(photo); // keep original on failure
        }
      } else {
        newPhotos.push(photo);
      }
    }

    if (changed) {
      await prisma.profile.update({
        where: { id: profile.id },
        data: { photos: newPhotos },
      });
    }
  }
  console.log(`  Migrated ${migrated} profile photos`);

  // 2. Move photos (single string)
  let moveMigrated = 0;
  const moves = await prisma.move.findMany({
    select: { id: true, photo: true },
  });

  for (const move of moves) {
    if (move.photo && move.photo.startsWith('data:')) {
      try {
        const url = await uploadToCloud(move.photo, 'motion/moves');
        await prisma.move.update({ where: { id: move.id }, data: { photo: url } });
        moveMigrated++;
      } catch (err) {
        console.error(`  Failed to migrate move photo ${move.id}:`, err.message);
      }
    }
  }
  console.log(`  Migrated ${moveMigrated} move photos`);

  // 3. Story photos (single string)
  let storyMigrated = 0;
  const stories = await prisma.story.findMany({
    select: { id: true, photo: true },
  });

  for (const story of stories) {
    if (story.photo && story.photo.startsWith('data:')) {
      try {
        const url = await uploadToCloud(story.photo, 'motion/stories');
        await prisma.story.update({ where: { id: story.id }, data: { photo: url } });
        storyMigrated++;
      } catch (err) {
        console.error(`  Failed to migrate story photo ${story.id}:`, err.message);
      }
    }
  }
  console.log(`  Migrated ${storyMigrated} story photos`);

  // 4. Message content (IMAGE and VOICE types)
  let messageMigrated = 0;
  const messages = await prisma.message.findMany({
    where: {
      contentType: { in: ['IMAGE', 'VOICE'] },
      content: { startsWith: 'data:' },
    },
    select: { id: true, content: true },
  });

  for (const msg of messages) {
    try {
      const url = await uploadToCloud(msg.content, 'motion/messages');
      await prisma.message.update({ where: { id: msg.id }, data: { content: url } });
      messageMigrated++;
    } catch (err) {
      console.error(`  Failed to migrate message ${msg.id}:`, err.message);
    }
  }
  console.log(`  Migrated ${messageMigrated} message media files`);

  console.log(`Migration complete: ${migrated + moveMigrated + storyMigrated + messageMigrated} total files migrated`);
}

async function main() {
  console.log('Seeding database...');

  // Delete all dummy users except Jasmine W
  const dummyUsersToDelete = await prisma.user.findMany({
    where: { isDummy: true, email: { not: 'jasmine.w@motion.app' } },
    select: { id: true },
  });
  if (dummyUsersToDelete.length > 0) {
    const ids = dummyUsersToDelete.map(u => u.id);
    await prisma.$transaction(async (tx) => {
      await tx.message.deleteMany({ where: { OR: [{ senderId: { in: ids } }, { conversation: { OR: [{ user1Id: { in: ids } }, { user2Id: { in: ids } }] } }] } });
      await tx.conversation.deleteMany({ where: { OR: [{ user1Id: { in: ids } }, { user2Id: { in: ids } }] } });
      await tx.like.deleteMany({ where: { OR: [{ likerId: { in: ids } }, { likedId: { in: ids } }] } });
      await tx.match.deleteMany({ where: { OR: [{ user1Id: { in: ids } }, { user2Id: { in: ids } }] } });
      await tx.block.deleteMany({ where: { OR: [{ blockerId: { in: ids } }, { blockedId: { in: ids } }] } });
      await tx.report.deleteMany({ where: { OR: [{ reporterId: { in: ids } }, { reportedId: { in: ids } }] } });
      const moves = await tx.move.findMany({ where: { stepperId: { in: ids } }, select: { id: true } });
      if (moves.length) await tx.moveInterest.deleteMany({ where: { moveId: { in: moves.map(m => m.id) } } });
      await tx.move.deleteMany({ where: { stepperId: { in: ids } } });
      await tx.moveInterest.deleteMany({ where: { baddieId: { in: ids } } });
      await tx.hiddenPair.deleteMany({ where: { OR: [{ user1Id: { in: ids } }, { user2Id: { in: ids } }] } });
      await tx.user.deleteMany({ where: { id: { in: ids } } });
    });
    console.log(`Deleted ${dummyUsersToDelete.length} dummy users`);
  }

  // Seed vibe questions — only on fresh DB with zero questions
  // Admin-managed questions are never overwritten by deploys
  const existingCount = await prisma.vibeQuestion.count();
  if (existingCount > 0) {
    console.log(`Vibe questions: skipped (${existingCount} already exist, managed via admin panel)`);
  } else {
    await prisma.vibeQuestion.createMany({ data: vibeQuestions });
    console.log(`Vibe questions: seeded ${vibeQuestions.length} questions`);
  }

  // Create test admin user
  const adminHash = await bcrypt.hash('admin12345', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@motion.app' },
    update: {},
    create: {
      email: 'admin@motion.app',
      passwordHash: adminHash,
      role: 'STEPPER',
      isAdmin: true,
      isPremium: true,
    },
  });

  await prisma.profile.upsert({
    where: { userId: admin.id },
    update: {},
    create: {
      userId: admin.id,
      displayName: 'Admin',
      age: 25,
      city: 'Newark, NJ',
      bio: 'Platform admin',
    },
  });

  console.log('Created admin user: admin@motion.app / admin12345');

  // Create Jasmine W dummy user
  const dummyPassword = await bcrypt.hash('motion123', 12);

  // Upload Jasmine's photos to Cloudinary if configured, otherwise use base64
  const jasminePhotoUrls = await Promise.all(
    jasminePhotos.map(photo => uploadToCloud(photo, 'motion/profiles'))
  );

  const jasmineUser = await prisma.user.upsert({
    where: { email: 'jasmine.w@motion.app' },
    update: {},
    create: { email: 'jasmine.w@motion.app', passwordHash: dummyPassword, role: 'BADDIE', isDummy: true },
  });
  await prisma.profile.upsert({
    where: { userId: jasmineUser.id },
    update: { city: 'Maplewood, NJ', photos: jasminePhotoUrls },
    create: {
      userId: jasmineUser.id,
      displayName: 'Jasmine W',
      age: 28,
      city: 'Maplewood, NJ',
      bio: 'Marketing exec. Boss moves only. Wine nights and weekend getaways.',
      lookingFor: 'A man who leads with confidence',
      photos: jasminePhotoUrls,
    },
  });
  console.log('Created dummy user: Jasmine W');

  // Seed default app settings
  await prisma.appSetting.upsert({
    where: { key: 'freeMessaging' },
    update: {},
    create: { key: 'freeMessaging', value: 'true' },
  });
  await prisma.appSetting.upsert({
    where: { key: 'showDummyUsers' },
    update: {},
    create: { key: 'showDummyUsers', value: 'true' },
  });
  console.log('Seeded app settings');

  // Migrate existing base64 photos to Cloudinary (idempotent — skips URLs)
  await migratePhotosToCloudinary();

  console.log('Seed complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
