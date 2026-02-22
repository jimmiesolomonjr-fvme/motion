import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { baddiePhotos } from './baddie-photos.js';
import { stepperPhotos } from './stepper-photos.js';

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

async function main() {
  console.log('Seeding database...');

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

  // Create dummy users
  const dummyPassword = await bcrypt.hash('motion123', 12);

  const steppers = [
    { email: 'marcus.j@motion.app', displayName: 'Marcus J', age: 27, city: 'Newark, NJ', bio: 'Entrepreneur. Building my empire one day at a time. Love good food and better conversation.', lookingFor: 'A queen who matches my ambition' },
    { email: 'darius.w@motion.app', displayName: 'Darius W', age: 30, city: 'Jersey City, NJ', bio: 'Software engineer by day, DJ by night. Always in motion.', lookingFor: 'Someone who vibes with versatility' },
    { email: 'khalil.m@motion.app', displayName: 'Khalil M', age: 25, city: 'Trenton, NJ', bio: 'Finance bro with a creative soul. Gallery openings and basketball games.', lookingFor: 'A woman with depth and style' },
    { email: 'jamal.r@motion.app', displayName: 'Jamal R', age: 28, city: 'East Orange, NJ', bio: 'Real estate investor. Family first, always. Let me show you the city.', lookingFor: 'My future wife, no games' },
    { email: 'trevon.b@motion.app', displayName: 'Trevon B', age: 26, city: 'Paterson, NJ', bio: 'Personal trainer and model. Health is wealth. Positive energy only.', lookingFor: 'A baddie who takes care of herself too' },
    { email: 'andre.c@motion.app', displayName: 'Andre C', age: 32, city: 'Plainfield, NJ', bio: 'Restaurant owner. I cook, I clean, I provide. Old school values.', lookingFor: 'A partner to build with' },
    { email: 'isaiah.t@motion.app', displayName: 'Isaiah T', age: 24, city: 'Irvington, NJ', bio: 'Music producer. Grammy season coming soon. Watch the moves.', lookingFor: 'My muse and my peace' },
    { email: 'cameron.d@motion.app', displayName: 'Cameron D', age: 29, city: 'New Brunswick, NJ', bio: 'Attorney by trade. Sneakerhead by passion. Let\'s debate over dinner.', lookingFor: 'Smart, beautiful, and driven' },
    { email: 'xavier.l@motion.app', displayName: 'Xavier L', age: 31, city: 'Camden, NJ', bio: 'Tech startup founder. Building the future. Need a queen who gets the grind.', lookingFor: 'Someone who supports the vision' },
    { email: 'jaylen.h@motion.app', displayName: 'Jaylen H', age: 27, city: 'Montclair, NJ', bio: 'Dentist. Smile specialist on and off the clock. Adventure seeker.', lookingFor: 'A genuine connection' },
  ];

  const baddies = [
    { email: 'aisha.k@motion.app', displayName: 'Aisha K', age: 25, city: 'Elizabeth, NJ', bio: 'Makeup artist & influencer. Soft life advocate. Travel is my therapy.', lookingFor: 'A provider who moves with intention' },
    { email: 'maya.s@motion.app', displayName: 'Maya S', age: 23, city: 'Hoboken, NJ', bio: 'Fashion designer in the making. Runway to real life. Always camera ready.', lookingFor: 'A stepper who matches my energy' },
    { email: 'zara.p@motion.app', displayName: 'Zara P', age: 26, city: 'Princeton, NJ', bio: 'Registered nurse. Healing hands and a beautiful soul. Brunch is life.', lookingFor: 'Stability and spontaneity' },
    { email: 'jasmine.w@motion.app', displayName: 'Jasmine W', age: 28, city: 'Maplewood, NJ', bio: 'Marketing exec. Boss moves only. Wine nights and weekend getaways.', lookingFor: 'A man who leads with confidence' },
    { email: 'nia.r@motion.app', displayName: 'Nia R', age: 24, city: 'Asbury Park, NJ', bio: 'Fitness model. Beach days and green smoothies. Living my best life.', lookingFor: 'Someone who keeps up' },
    { email: 'brianna.t@motion.app', displayName: 'Brianna T', age: 27, city: 'Hackensack, NJ', bio: 'Law student. Future judge. Netflix and case studies. Feed me tacos.', lookingFor: 'Ambition is the biggest turn on' },
    { email: 'taylor.m@motion.app', displayName: 'Taylor M', age: 22, city: 'Woodbridge, NJ', bio: 'Content creator. 200k followers and counting. Let\'s make memories.', lookingFor: 'A stepper with substance' },
    { email: 'destiny.j@motion.app', displayName: 'Destiny J', age: 29, city: 'Morristown, NJ', bio: 'Pharmacist. Independent queen. Love to cook, love to be spoiled.', lookingFor: 'A gentleman and a go-getter' },
    { email: 'kayla.b@motion.app', displayName: 'Kayla B', age: 25, city: 'Orange, NJ', bio: 'Hair stylist & salon owner. Creative energy. Loyalty above everything.', lookingFor: 'Real love, no situationships' },
    { email: 'sasha.d@motion.app', displayName: 'Sasha D', age: 26, city: 'Bloomfield, NJ', bio: 'Interior designer. Aesthetic queen. Good vibes and good wine.', lookingFor: 'A man with taste and vision' },
  ];

  for (let i = 0; i < steppers.length; i++) {
    const s = steppers[i];
    const photo = stepperPhotos[i] || null;
    const user = await prisma.user.upsert({
      where: { email: s.email },
      update: {},
      create: { email: s.email, passwordHash: dummyPassword, role: 'STEPPER', isDummy: true },
    });
    await prisma.profile.upsert({
      where: { userId: user.id },
      update: { city: s.city, photos: photo ? [photo] : [] },
      create: { userId: user.id, displayName: s.displayName, age: s.age, city: s.city, bio: s.bio, lookingFor: s.lookingFor, photos: photo ? [photo] : [] },
    });
  }
  console.log(`Created ${steppers.length} dummy Steppers (with photos)`);

  // baddiePhotos[0-8] = grid photos, [9-10] = Jasmine W dedicated photos
  // Jasmine W is index 3 — give her the 2 dedicated photos
  // Sasha D is index 9 — give her the grid photo that was at slot 3
  const baddiePhotoMap = {};
  for (let i = 0; i < 9; i++) baddiePhotoMap[i] = [baddiePhotos[i]];
  baddiePhotoMap[3] = [baddiePhotos[9], baddiePhotos[10]]; // Jasmine W gets her 2 photos
  baddiePhotoMap[9] = [baddiePhotos[3]]; // Sasha D gets the freed grid photo

  for (let i = 0; i < baddies.length; i++) {
    const b = baddies[i];
    const photos = baddiePhotoMap[i] || [];
    const user = await prisma.user.upsert({
      where: { email: b.email },
      update: {},
      create: { email: b.email, passwordHash: dummyPassword, role: 'BADDIE', isDummy: true },
    });
    await prisma.profile.upsert({
      where: { userId: user.id },
      update: { city: b.city, photos },
      create: { userId: user.id, displayName: b.displayName, age: b.age, city: b.city, bio: b.bio, lookingFor: b.lookingFor, photos },
    });
  }
  console.log(`Created ${baddies.length} dummy Baddies (with photos)`);

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
