import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Fixed UUIDs for idempotent re-runs
const MOTION_USER_ID = 'c0000000-0000-4000-a000-000000000001';
const MOVE_IDS = [
  'c1000000-0000-4000-a000-000000000001',
  'c1000000-0000-4000-a000-000000000002',
  'c1000000-0000-4000-a000-000000000003',
  'c1000000-0000-4000-a000-000000000004',
  'c1000000-0000-4000-a000-000000000005',
  'c1000000-0000-4000-a000-000000000006',
  'c1000000-0000-4000-a000-000000000007',
  'c1000000-0000-4000-a000-000000000008',
  'c1000000-0000-4000-a000-000000000009',
  'c1000000-0000-4000-a000-000000000010',
  'c1000000-0000-4000-a000-000000000011',
  'c1000000-0000-4000-a000-000000000012',
  'c1000000-0000-4000-a000-000000000013',
  'c1000000-0000-4000-a000-000000000014',
  'c1000000-0000-4000-a000-000000000015',
  'c1000000-0000-4000-a000-000000000016',
  'c1000000-0000-4000-a000-000000000017',
  'c1000000-0000-4000-a000-000000000018',
  'c1000000-0000-4000-a000-000000000019',
  'c1000000-0000-4000-a000-000000000020',
];

function daysFromNow(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(20, 0, 0, 0); // default 8 PM
  return d;
}

const COMMUNITY_MOVES = [
  {
    title: 'Rooftop Happy Hour at Pier 13',
    description: 'Drinks with a view of the NYC skyline. Casual vibes, good music, and great people. Pull up after work.',
    location: 'Hoboken, NJ',
    category: 'DRINKS',
    daysOut: 3,
    photo: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=800&q=80',
  },
  {
    title: 'Jazz Night at Smalls',
    description: 'Intimate underground jazz club in the Village. Perfect for a chill, cultured night out.',
    location: 'West Village, NYC',
    category: 'CONCERT',
    daysOut: 4,
    photo: 'https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?w=800&q=80',
  },
  {
    title: 'Cooking Class at Hudson Table',
    description: 'Learn to cook something new together. Hands-on, fun, and you get to eat everything you make.',
    location: 'Jersey City, NJ',
    category: 'ADVENTURE',
    daysOut: 3,
    photo: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=800&q=80',
  },
  {
    title: 'Gallery Walk on the LES',
    description: 'Hit up a few galleries on the Lower East Side. Art, conversation, maybe a wine bar after.',
    location: 'Lower East Side, NYC',
    category: 'OTHER',
    daysOut: 4,
    photo: 'https://images.unsplash.com/photo-1531243269054-5ebf6f34081e?w=800&q=80',
  },
  {
    title: 'Sushi Omakase at Sushi Nakazawa',
    description: 'Chef\'s choice sushi experience. High-end, intimate, and perfect for impressing your date.',
    location: 'West Village, NYC',
    category: 'DINNER',
    daysOut: 5,
    photo: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800&q=80',
  },
  {
    title: 'Art & Coffee at Maman',
    description: 'Cozy French-inspired café with gorgeous interiors. Great for a low-key first date.',
    location: 'SoHo, NYC',
    category: 'OTHER',
    daysOut: 5,
    photo: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&q=80',
  },
  {
    title: 'Sunset Walk on The High Line',
    description: 'Walk above the city as the sun goes down. Stop for street art, gardens, and good conversation.',
    location: 'Chelsea, NYC',
    category: 'ADVENTURE',
    daysOut: 6,
    photo: 'https://images.unsplash.com/photo-1500916434205-0c77489c6cf7?w=800&q=80',
  },
  {
    title: 'Brunch & Brooklyn Bridge Walk',
    description: 'Start with brunch in DUMBO, then walk the Brooklyn Bridge with the skyline behind you.',
    location: 'DUMBO, Brooklyn',
    category: 'DINNER',
    daysOut: 7,
    photo: 'https://images.unsplash.com/photo-1534430480872-3498386e7856?w=800&q=80',
  },
  {
    title: 'Comedy Night at The Cellar',
    description: 'Laugh all night at one of NYC\'s most legendary comedy clubs. Surprise headliners happen often.',
    location: 'Greenwich Village, NYC',
    category: 'CONCERT',
    daysOut: 8,
    photo: 'https://images.unsplash.com/photo-1585699324551-f6c309eedeca?w=800&q=80',
  },
  {
    title: 'Salsa Night at Subrosa',
    description: 'Live salsa music, dancing, and cocktails. No experience needed — just energy and a good attitude.',
    location: 'Meatpacking, NYC',
    category: 'ADVENTURE',
    daysOut: 9,
    photo: 'https://images.unsplash.com/photo-1504609813442-a8924e83f76e?w=800&q=80',
  },
  {
    title: 'Wine Tasting at City Winery',
    description: 'Sample wines from around the world in a sleek urban winery. Classy, educational, and fun.',
    location: 'Hudson Yards, NYC',
    category: 'DRINKS',
    daysOut: 10,
    photo: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=800&q=80',
  },
  {
    title: 'Bowling at Brooklyn Bowl',
    description: 'Bowling, live music, and craft beer under one roof. Competitive but chill.',
    location: 'Williamsburg, Brooklyn',
    category: 'ADVENTURE',
    daysOut: 11,
    photo: 'https://images.unsplash.com/photo-1545232979-8bf68ee9b1af?w=800&q=80',
  },
  {
    title: 'Speakeasy Night at Please Don\'t Tell',
    description: 'Secret entrance through a phone booth. Craft cocktails in a hidden bar. Very NYC.',
    location: 'East Village, NYC',
    category: 'DRINKS',
    daysOut: 12,
    photo: 'https://images.unsplash.com/photo-1572116469696-31de0f17cc34?w=800&q=80',
  },
  {
    title: 'Rooftop Cocktails at Westlight',
    description: '22nd-floor rooftop bar with panoramic views of Manhattan. Dress to impress.',
    location: 'Williamsburg, Brooklyn',
    category: 'DRINKS',
    daysOut: 13,
    photo: 'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=800&q=80',
  },
  {
    title: 'Dinner at Carbone',
    description: 'Italian-American fine dining at its best. The spicy rigatoni is a must. Make it a night.',
    location: 'Greenwich Village, NYC',
    category: 'DINNER',
    daysOut: 14,
    photo: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80',
  },
  {
    title: 'Waterfront Dinner at Battello',
    description: 'Upscale waterfront dining with Manhattan skyline views. Perfect for a special night.',
    location: 'Jersey City, NJ',
    category: 'DINNER',
    daysOut: 8,
    photo: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80',
  },
  {
    title: 'Cocktails at Dullboy',
    description: 'Craft cocktail lounge with creative drinks and moody ambiance. Hidden gem in JC.',
    location: 'Jersey City, NJ',
    category: 'DRINKS',
    daysOut: 15,
    photo: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=800&q=80',
  },
  {
    title: 'Comedy & Drinks at Stress Factory',
    description: 'Top comedians, strong drinks, and a guaranteed good time. Great for breaking the ice.',
    location: 'New Brunswick, NJ',
    category: 'CONCERT',
    daysOut: 6,
    photo: 'https://images.unsplash.com/photo-1527224857830-43a7acc85260?w=800&q=80',
  },
  {
    title: 'Vibes at Bahama Breeze',
    description: 'Island-inspired cocktails and food with a tropical atmosphere. Laid-back and fun.',
    location: 'Woodbridge, NJ',
    category: 'DRINKS',
    daysOut: 9,
    photo: 'https://images.unsplash.com/photo-1551538827-9c037cb4f32a?w=800&q=80',
  },
  {
    title: 'Boardwalk & Bites in Asbury Park',
    description: 'Walk the boardwalk, hit up food spots, and enjoy the shore vibes. Day date energy.',
    location: 'Asbury Park, NJ',
    category: 'ADVENTURE',
    daysOut: 7,
    photo: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80',
  },
];

async function main() {
  console.log('Seeding community moves...');

  // 1. Upsert the Motion system user
  const passwordHash = await bcrypt.hash('motion-system-2024', 12);
  await prisma.user.upsert({
    where: { email: 'motion@motion.app' },
    update: {},
    create: {
      id: MOTION_USER_ID,
      email: 'motion@motion.app',
      passwordHash,
      role: 'STEPPER',
      isDummy: true,
      isHidden: true,
    },
  });

  await prisma.profile.upsert({
    where: { userId: MOTION_USER_ID },
    update: {},
    create: {
      userId: MOTION_USER_ID,
      displayName: 'Motion',
      age: 25,
      city: 'New York, NY',
      bio: 'Community date ideas curated by Motion.',
    },
  });
  console.log('  Motion system user ready');

  // 2. Upsert each community move
  let created = 0;
  for (let i = 0; i < COMMUNITY_MOVES.length; i++) {
    const m = COMMUNITY_MOVES[i];
    const moveId = MOVE_IDS[i];

    await prisma.move.upsert({
      where: { id: moveId },
      update: {
        title: m.title,
        description: m.description,
        location: m.location,
        category: m.category,
        photo: m.photo,
        date: daysFromNow(m.daysOut),
      },
      create: {
        id: moveId,
        creatorId: MOTION_USER_ID,
        title: m.title,
        description: m.description,
        date: daysFromNow(m.daysOut),
        location: m.location,
        category: m.category,
        photo: m.photo,
        status: 'OPEN',
        maxInterest: 10,
      },
    });
    created++;
  }

  console.log(`  ${created} community moves upserted`);
  console.log('Community moves seed complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
