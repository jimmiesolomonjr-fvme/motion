import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { PREBUILT_PERSONAS } from './personas.js';

const prisma = new PrismaClient();
const SYNTHETIC_PASSWORD = 'Motion2024!';

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

    // Create User
    const user = await prisma.user.create({
      data: {
        email: persona.email,
        passwordHash,
        role: persona.role,
        isPremium: true,
        isSynthetic: true,
        isDummy: true,
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

  console.log(`[synthetic] Seeding complete: ${created} created, ${skipped} skipped`);
  return { created, skipped };
}
