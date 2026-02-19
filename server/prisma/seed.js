import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

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

  // Seed vibe questions
  // Clear existing and re-seed
  await prisma.vibeQuestion.deleteMany({});
  for (const q of vibeQuestions) {
    await prisma.vibeQuestion.create({ data: q });
  }

  console.log(`Seeded ${vibeQuestions.length} vibe questions`);

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
      city: 'Atlanta',
      bio: 'Platform admin',
    },
  });

  console.log('Created admin user: admin@motion.app / admin12345');
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
