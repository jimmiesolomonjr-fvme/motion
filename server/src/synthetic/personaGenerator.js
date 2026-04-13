import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { PREBUILT_PERSONAS } from './personas.js';

const prisma = new PrismaClient();
const SYNTHETIC_PASSWORD = 'Motion2024!';

// Coordinates for all neighborhoods used by synthetic personas
const CITY_COORDINATES = {
  'Harlem, NYC':            { lat: 40.8116, lng: -73.9465 },
  'Jersey City, NJ':        { lat: 40.7178, lng: -74.0431 },
  'Tribeca, NYC':           { lat: 40.7163, lng: -74.0086 },
  'Crown Heights, Brooklyn':{ lat: 40.6694, lng: -73.9422 },
  'Hoboken, NJ':            { lat: 40.7440, lng: -74.0324 },
  'Upper West Side, NYC':   { lat: 40.7870, lng: -73.9754 },
  'Bushwick, Brooklyn':     { lat: 40.6944, lng: -73.9213 },
  'Montclair, NJ':          { lat: 40.8259, lng: -74.2090 },
  'Bed-Stuy, Brooklyn':     { lat: 40.6872, lng: -73.9418 },
  'Newark, NJ':             { lat: 40.7357, lng: -74.1724 },
  'Astoria, Queens':        { lat: 40.7644, lng: -73.9235 },
  'The Bronx, NYC':         { lat: 40.8448, lng: -73.8648 },
  'Fort Greene, Brooklyn':  { lat: 40.6892, lng: -73.9764 },
};

function jitterCoord(value) {
  return value + (Math.random() - 0.5) * 0.02; // ±0.01° (~0.7 miles)
}

export function validatePersonaQuality(persona) {
  const errors = [];

  if (!persona.email) errors.push('missing email');
  if (!['STEPPER', 'BADDIE'].includes(persona.role)) errors.push('invalid role');
  if (!persona.age || persona.age < 18 || persona.age > 99) errors.push('age must be 18-99');
  if (!persona.displayName) errors.push('missing displayName');
  if (!persona.bio) errors.push('missing bio');
  if (!persona.city) errors.push('missing city');

  const cs = persona.personaConfig?.communicationStyle;
  if (!cs) {
    errors.push('missing communicationStyle');
  } else {
    if (!cs.messageLength) errors.push('missing communicationStyle.messageLength');
    if (!cs.responsivenessProfile) errors.push('missing communicationStyle.responsivenessProfile');
  }

  const ds = persona.dailySchedule;
  if (!ds) {
    errors.push('missing dailySchedule');
  } else {
    if (!ds.actionWindows || Object.keys(ds.actionWindows).length === 0) {
      errors.push('dailySchedule must have actionWindows');
    }
  }

  const db = persona.personaConfig?.dealbreakers;
  if (!db?.soft || db.soft.length < 2) {
    errors.push('dealbreakers.soft must have >= 2 items');
  }

  const vk = persona.personaConfig?.voiceKeywords || [];
  const ak = persona.personaConfig?.avoidKeywords || [];
  const overlap = vk.filter((k) => ak.includes(k));
  if (overlap.length > 0) {
    errors.push(`voiceKeywords overlap with avoidKeywords: ${overlap.join(', ')}`);
  }

  return { valid: errors.length === 0, errors };
}

export async function seedPrebuiltPersonas() {
  const passwordHash = await bcrypt.hash(SYNTHETIC_PASSWORD, 12);
  let created = 0;
  let skipped = 0;

  for (const persona of PREBUILT_PERSONAS) {
    // Validate
    const { valid, errors } = validatePersonaQuality(persona);
    if (!valid) {
      console.warn(`[synthetic] Skipping ${persona.email}: ${errors.join(', ')}`);
      skipped++;
      continue;
    }

    // Idempotent — skip if email exists
    const existing = await prisma.user.findUnique({ where: { email: persona.email } });
    if (existing) {
      console.log(`[synthetic] Already exists: ${persona.email}`);
      skipped++;
      continue;
    }

    // Create User (with coordinates from city lookup)
    const coords = CITY_COORDINATES[persona.city];
    const user = await prisma.user.create({
      data: {
        email: persona.email,
        passwordHash,
        role: persona.role,
        isPremium: true,
        isSynthetic: true,
        isDummy: true,
        ...(coords && {
          locationLat: jitterCoord(coords.lat),
          locationLng: jitterCoord(coords.lng),
        }),
      },
    });

    // Create Profile
    await prisma.profile.create({
      data: {
        userId: user.id,
        displayName: persona.displayName,
        bio: persona.bio,
        age: persona.age,
        city: persona.city,
        lookingFor: persona.lookingFor || null,
        height: persona.height || null,
        occupation: persona.occupation || null,
        photos: [],
        lookingForTags: [],
      },
    });

    // Create ProfilePrompts (max 3)
    if (persona.prompts?.length) {
      const promptsToCreate = persona.prompts.slice(0, 3);
      for (let i = 0; i < promptsToCreate.length; i++) {
        await prisma.profilePrompt.create({
          data: {
            userId: user.id,
            prompt: promptsToCreate[i].prompt,
            answer: promptsToCreate[i].answer,
            position: i,
          },
        });
      }
    }

    // Create SyntheticProfile
    await prisma.syntheticProfile.create({
      data: {
        userId: user.id,
        personaConfig: persona.personaConfig,
        dailySchedule: persona.dailySchedule,
        memoryStream: [],
        emotionalState: persona.personaConfig.emotionalState || {},
        currentGoals: persona.personaConfig.currentGoals || {},
        isActive: true,
      },
    });

    console.log(`[synthetic] Created: ${persona.displayName} (${persona.role}) — ${persona.email}`);
    created++;
  }

  // Backfill coordinates for existing synthetic users missing them
  const missingCoords = await prisma.user.findMany({
    where: { isSynthetic: true, locationLat: null },
    include: { profile: { select: { city: true } } },
  });
  let backfilled = 0;
  for (const user of missingCoords) {
    const coords = CITY_COORDINATES[user.profile?.city];
    if (!coords) continue;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        locationLat: jitterCoord(coords.lat),
        locationLng: jitterCoord(coords.lng),
      },
    });
    backfilled++;
  }
  if (backfilled > 0) {
    console.log(`[synthetic] Backfilled coordinates for ${backfilled} existing synthetic users`);
  }

  console.log(`[synthetic] Seeding complete: ${created} created, ${skipped} skipped`);
  return { created, skipped };
}
