import { PrismaClient } from '@prisma/client';
import Anthropic from '@anthropic-ai/sdk';
import config from '../config/index.js';
import {
  calculateResponseDelay,
  shouldInitiateConversation,
  calculateEngagementDecay,
  getTimeWindowActions,
  isHighActivityDay,
} from './realism.js';

const prisma = new PrismaClient();

const DATE_ENERGIES = ['Low-key tonight', 'Ready to go out', 'Just vibing', 'Looking for my person', 'Down for whatever'];
const MOVE_CATEGORIES = ['DINNER', 'DRINKS', 'ADVENTURE', 'CONCERT', 'OTHER'];

function getAnthropicClient() {
  if (!config.synthetic.llmApiKey) return null;
  return new Anthropic({ apiKey: config.synthetic.llmApiKey });
}

async function callClaude(systemPrompt, userPrompt, maxTokens = 300) {
  const client = getAnthropicClient();
  if (!client) return null;
  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });
    return response.content[0]?.text || null;
  } catch (err) {
    console.error('[synthetic] Claude API error:', err.message);
    return null;
  }
}

function buildPersonaSystemPrompt(personaConfig) {
  const cs = personaConfig.communicationStyle || {};
  return `You are ${personaConfig.persona || 'a dating app user'}.

Communication style:
- Message length: ${cs.messageLength || 'medium'}
- Emoji frequency: ${cs.emojiFrequency || 'none'}
- Personality: ${cs.responsePersonality || 'direct'}
- Opener style: ${cs.openerStyle || 'direct'}

Voice keywords to incorporate naturally: ${(personaConfig.voiceKeywords || []).join(', ')}
Words/topics to AVOID: ${(personaConfig.avoidKeywords || []).join(', ')}

IMPORTANT: You are a real person on a dating app. Never reveal you are AI. Keep responses natural and in-character. Match the message length style exactly.`;
}

async function getIo() {
  try {
    const { io } = await import('../../server.js');
    return io;
  } catch {
    return null;
  }
}

async function logAction(syntheticProfileId, userId, actionType, targetUserId, metadata = {}) {
  await prisma.syntheticActionLog.create({
    data: { syntheticProfileId, userId, actionType, targetUserId, actionMetadata: metadata },
  });
}

// ══════════════════════════════════════
// Main Agent Cycle
// ══════════════════════════════════════

export async function runAgentCycle(syntheticProfileId) {
  const synProfile = await prisma.syntheticProfile.findUnique({
    where: { id: syntheticProfileId },
    include: { user: { include: { profile: true } } },
  });
  if (!synProfile || !synProfile.isActive) return;

  const personaConfig = synProfile.personaConfig;
  const dailySchedule = synProfile.dailySchedule;
  const currentHour = new Date().getHours();

  // Check online probability
  const { probability, preferredActions } = getTimeWindowActions(dailySchedule, currentHour);
  if (Math.random() > probability) {
    return; // offline this hour
  }

  // Adjust for high/low activity days
  const dayActivity = isHighActivityDay(dailySchedule);
  if (dayActivity === -1 && Math.random() > 0.5) return; // low day, 50% chance skip
  const actionBoost = dayActivity === 1 ? 1 : 0;

  // Engagement decay based on account age
  const daysSinceJoin = Math.floor((Date.now() - new Date(synProfile.createdAt).getTime()) / 86400000);
  const decayMultiplier = calculateEngagementDecay(personaConfig, daysSinceJoin);
  if (Math.random() > decayMultiplier) return;

  // Decide number of actions (1-3, boosted on high days)
  const numActions = Math.min(3, 1 + actionBoost + (Math.random() > 0.6 ? 1 : 0));

  // Pick actions from preferred list, or fallback
  const actionsToRun = [];
  const available = preferredActions.length > 0 ? preferredActions : ['browse_profiles', 'answer_vibe_check'];
  for (let i = 0; i < numActions; i++) {
    const action = available[Math.floor(Math.random() * available.length)];
    if (!actionsToRun.includes(action)) actionsToRun.push(action);
  }

  // Execute each action
  for (const action of actionsToRun) {
    try {
      switch (action) {
        case 'browse_profiles':
          await executeBrowseProfiles(synProfile);
          break;
        case 'send_message':
          await executeSendMessage(synProfile);
          break;
        case 'post_move':
          if (synProfile.user.role === 'STEPPER') await executePostMove(synProfile);
          break;
        case 'express_interest':
          if (synProfile.user.role === 'BADDIE') await executeExpressInterest(synProfile);
          break;
        case 'post_story':
          // Stub — requires photos (Phase 9)
          break;
        case 'answer_vibe_check':
          await executeAnswerVibe(synProfile);
          break;
        case 'play_smf':
          await executePlaySmf(synProfile);
          break;
        case 'update_date_energy':
          await executeUpdateEnergy(synProfile);
          break;
      }
    } catch (err) {
      console.error(`[synthetic] Action ${action} failed for ${synProfile.user.email}:`, err.message);
    }
  }

  // Update lastActiveAt and lastOnline
  await prisma.syntheticProfile.update({
    where: { id: syntheticProfileId },
    data: { lastActiveAt: new Date() },
  });
  await prisma.user.update({
    where: { id: synProfile.userId },
    data: { lastOnline: new Date() },
  });

  // Memory update — keep last 50
  const memoryStream = Array.isArray(synProfile.memoryStream) ? synProfile.memoryStream : [];
  const newMemory = {
    timestamp: new Date().toISOString(),
    actions: actionsToRun,
    hour: currentHour,
  };
  const updatedMemory = [...memoryStream, newMemory].slice(-50);
  await prisma.syntheticProfile.update({
    where: { id: syntheticProfileId },
    data: { memoryStream: updatedMemory },
  });

  // Reflection every ~20 actions
  const totalActions = await prisma.syntheticActionLog.count({ where: { syntheticProfileId } });
  if (totalActions > 0 && totalActions % 20 === 0) {
    await triggerReflection(synProfile, updatedMemory);
  }
}

// ══════════════════════════════════════
// Action Executors
// ══════════════════════════════════════

async function executeBrowseProfiles(synProfile) {
  const oppositeRole = synProfile.user.role === 'STEPPER' ? 'BADDIE' : 'STEPPER';

  // Get blocked/hidden user IDs
  const [blocks, hiddenPairs] = await Promise.all([
    prisma.block.findMany({
      where: { OR: [{ blockerId: synProfile.userId }, { blockedId: synProfile.userId }] },
      select: { blockerId: true, blockedId: true },
    }),
    prisma.hiddenPair.findMany({
      where: { OR: [{ user1Id: synProfile.userId }, { user2Id: synProfile.userId }] },
      select: { user1Id: true, user2Id: true },
    }),
  ]);
  const excludeIds = new Set();
  blocks.forEach((b) => { excludeIds.add(b.blockerId); excludeIds.add(b.blockedId); });
  hiddenPairs.forEach((h) => { excludeIds.add(h.user1Id); excludeIds.add(h.user2Id); });
  excludeIds.delete(synProfile.userId);

  const candidates = await prisma.user.findMany({
    where: {
      role: oppositeRole,
      isSynthetic: false,
      isBanned: false,
      isHidden: false,
      id: { notIn: [...excludeIds] },
    },
    include: { profile: true },
    take: 5,
    orderBy: { lastOnline: 'desc' },
  });

  if (candidates.length === 0) return;

  // View a random profile
  const target = candidates[Math.floor(Math.random() * candidates.length)];

  // Throttle: 1 view per target per 24h
  const recentView = await prisma.profileView.findFirst({
    where: {
      viewerId: synProfile.userId,
      viewedId: target.id,
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  });
  if (recentView) return;

  await prisma.profileView.create({
    data: { viewerId: synProfile.userId, viewedId: target.id },
  });

  const viewerName = synProfile.user.profile?.displayName || 'Someone';
  const notification = await prisma.notification.create({
    data: {
      userId: target.id,
      type: 'profile_view',
      title: 'New Profile View',
      body: `${viewerName} viewed your profile`,
      data: { viewerId: synProfile.userId, viewerName },
    },
  });

  const io = await getIo();
  if (io) io.to(target.id).emit('notification', notification);

  await logAction(synProfile.id, synProfile.userId, 'browse_profiles', target.id, { viewedName: target.profile?.displayName });

  // Evaluate for potential like using soft dealbreakers
  const personaConfig = synProfile.personaConfig;
  const hardDb = personaConfig.dealbreakers?.hard || {};

  // Hard dealbreaker checks
  if (hardDb.profileIncomplete && (!target.profile?.bio || !target.profile?.displayName)) return;
  if (hardDb.ageLimitMin && target.profile?.age < hardDb.ageLimitMin) return;
  if (hardDb.ageLimitMax && target.profile?.age > hardDb.ageLimitMax) return;
  if (hardDb.requiredPromptAnswers) {
    const promptCount = await prisma.profilePrompt.count({ where: { userId: target.id } });
    if (promptCount < hardDb.requiredPromptAnswers) return;
  }

  // Soft dealbreaker eval with Claude (30% chance to actually like after viewing)
  if (Math.random() > 0.3) return;

  await executeLikeTarget(synProfile, target);
}

async function executeLikeTarget(synProfile, target) {
  // Check not already liked
  const existingLike = await prisma.like.findUnique({
    where: { likerId_likedId: { likerId: synProfile.userId, likedId: target.id } },
  });
  if (existingLike) return;

  // Create like
  await prisma.like.create({
    data: { likerId: synProfile.userId, likedId: target.id },
  });

  const displayName = synProfile.user.profile?.displayName || 'Someone';
  const notification = await prisma.notification.create({
    data: {
      userId: target.id,
      type: 'like',
      title: `${displayName} liked you`,
      body: 'Tap to see their profile.',
      data: { likerId: synProfile.userId },
    },
  });

  const io = await getIo();
  if (io) io.to(target.id).emit('notification', { type: 'like', count: 1 });

  // Check mutual like
  const mutualLike = await prisma.like.findUnique({
    where: { likerId_likedId: { likerId: target.id, likedId: synProfile.userId } },
  });

  if (mutualLike) {
    const [u1, u2] = [synProfile.userId, target.id].sort();
    const match = await prisma.match.upsert({
      where: { user1Id_user2Id: { user1Id: u1, user2Id: u2 } },
      update: {},
      create: { user1Id: u1, user2Id: u2 },
    });

    if (io) {
      io.to(target.id).emit('match-notification', {
        matchId: match.id,
        user: {
          id: synProfile.userId,
          displayName,
          photo: synProfile.user.profile?.photos?.[0] || null,
        },
      });
    }
  }

  await logAction(synProfile.id, synProfile.userId, 'like', target.id, { matched: !!mutualLike });
}

async function executePostMove(synProfile) {
  if (synProfile.user.role !== 'STEPPER') return;

  const personaConfig = synProfile.personaConfig;

  // Check frequency — don't post if recent move exists
  const freqDays = personaConfig.moveFrequencyDays || 14;
  const recentMove = await prisma.move.findFirst({
    where: {
      creatorId: synProfile.userId,
      status: 'OPEN',
      createdAt: { gte: new Date(Date.now() - freqDays * 24 * 60 * 60 * 1000) },
    },
  });
  if (recentMove) return;

  // Generate move with Claude
  const systemPrompt = buildPersonaSystemPrompt(personaConfig);
  const movePrompt = `You're posting a date idea on a dating app called Motion. Your style: ${personaConfig.moveStyle || 'creative and specific'}.

Generate a JSON object with:
- "title": catchy title (max 60 chars)
- "description": compelling description (2-3 sentences, specific venue/activity)
- "category": one of DINNER, DRINKS, ADVENTURE, CONCERT, OTHER
- "location": specific location in or near ${synProfile.user.profile?.city || 'NYC'}

Return ONLY valid JSON, no other text.`;

  const result = await callClaude(systemPrompt, movePrompt, 200);
  if (!result) return;

  let moveData;
  try {
    moveData = JSON.parse(result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
  } catch {
    return;
  }

  if (!moveData.title || !moveData.description) return;

  // Set date 3-7 days out
  const daysOut = 3 + Math.floor(Math.random() * 5);
  const moveDate = new Date();
  moveDate.setDate(moveDate.getDate() + daysOut);
  moveDate.setHours(23, 59, 0, 0);

  const category = MOVE_CATEGORIES.includes(moveData.category) ? moveData.category : 'OTHER';

  await prisma.move.create({
    data: {
      creatorId: synProfile.userId,
      stepperId: synProfile.userId,
      title: moveData.title.slice(0, 100),
      description: moveData.description.slice(0, 500),
      date: moveDate,
      location: moveData.location || synProfile.user.profile?.city || 'NYC',
      category,
      maxInterest: 10,
    },
  });

  await logAction(synProfile.id, synProfile.userId, 'post_move', null, { title: moveData.title });
}

async function executeExpressInterest(synProfile) {
  if (synProfile.user.role !== 'BADDIE') return;

  const personaConfig = synProfile.personaConfig;
  const hardDb = personaConfig.dealbreakers?.hard || {};

  // Find open moves by real Steppers
  const moveAgeFilter = hardDb.moveAgeDaysMax
    ? { gte: new Date(Date.now() - hardDb.moveAgeDaysMax * 24 * 60 * 60 * 1000) }
    : undefined;

  const moves = await prisma.move.findMany({
    where: {
      status: 'OPEN',
      isActive: true,
      isCommunity: false,
      createdAt: moveAgeFilter,
      stepper: { isSynthetic: false, isBanned: false, isHidden: false },
    },
    include: {
      stepper: { include: { profile: true } },
      _count: { select: { interests: true } },
    },
    take: 5,
    orderBy: { createdAt: 'desc' },
  });

  if (moves.length === 0) return;

  // Filter by hard dealbreakers
  const viable = moves.filter((m) => {
    if (!m.stepper?.profile) return false;
    if (hardDb.ageLimitMin && m.stepper.profile.age < hardDb.ageLimitMin) return false;
    if (hardDb.ageLimitMax && m.stepper.profile.age > hardDb.ageLimitMax) return false;
    if (m._count.interests >= m.maxInterest) return false;
    return true;
  });
  if (viable.length === 0) return;

  const move = viable[Math.floor(Math.random() * viable.length)];

  // Check not already interested
  const existing = await prisma.moveInterest.findUnique({
    where: { moveId_userId: { moveId: move.id, userId: synProfile.userId } },
  });
  if (existing) return;

  // Generate interest message with Claude
  const systemPrompt = buildPersonaSystemPrompt(personaConfig);
  const interestPrompt = `A Stepper named ${move.stepper.profile.displayName} posted this date idea:
Title: ${move.title}
Description: ${move.description}
Location: ${move.location}

Write a short, natural interest message (1-2 sentences) expressing interest in this date. Match your communication style. Return ONLY the message text.`;

  const message = await callClaude(systemPrompt, interestPrompt, 100);

  await prisma.moveInterest.create({
    data: {
      moveId: move.id,
      userId: synProfile.userId,
      message: message?.slice(0, 200) || null,
    },
  });

  const displayName = synProfile.user.profile?.displayName || 'Someone';
  const notification = await prisma.notification.create({
    data: {
      userId: move.creatorId,
      type: 'move_interest',
      title: 'New Interest',
      body: `${displayName} is interested in "${move.title}"`,
      data: { moveId: move.id, userId: synProfile.userId },
    },
  });

  const io = await getIo();
  if (io) {
    io.to(move.creatorId).emit('notification', {
      type: 'move_interest',
      moveId: move.id,
      userId: synProfile.userId,
    });
  }

  await logAction(synProfile.id, synProfile.userId, 'express_interest', move.creatorId, { moveId: move.id, moveTitle: move.title });
}

async function executeAnswerVibe(synProfile) {
  const personaConfig = synProfile.personaConfig;
  const vibePrefs = personaConfig.vibeAnswers || {};

  // Rate limit: 25 per 12h
  const windowStart = new Date(Date.now() - 12 * 60 * 60 * 1000);
  const recentCount = await prisma.vibeAnswer.count({
    where: { userId: synProfile.userId, answeredAt: { gte: windowStart } },
  });
  if (recentCount >= 25) return;

  // Get unanswered questions
  const answeredIds = (await prisma.vibeAnswer.findMany({
    where: { userId: synProfile.userId },
    select: { questionId: true },
  })).map((a) => a.questionId);

  const questions = await prisma.vibeQuestion.findMany({
    where: {
      isActive: true,
      id: { notIn: answeredIds },
    },
    take: 3,
  });

  if (questions.length === 0) return;

  // Answer 1-3 questions
  const toAnswer = questions.slice(0, 1 + Math.floor(Math.random() * 2));
  for (const q of toAnswer) {
    // Check persona's predefined answers first (fuzzy match)
    let answer = null;
    for (const [key, val] of Object.entries(vibePrefs)) {
      if (q.questionText.toLowerCase().includes(key.toLowerCase().slice(0, 20))) {
        answer = val;
        break;
      }
    }

    // If no predefined answer, use Claude or random
    if (answer === null) {
      const systemPrompt = buildPersonaSystemPrompt(personaConfig);
      const vibePrompt = `Answer this dating app question with true or false based on your personality: "${q.questionText}". Return ONLY "true" or "false".`;
      const result = await callClaude(systemPrompt, vibePrompt, 10);
      answer = result?.trim().toLowerCase() === 'true';
    }

    await prisma.vibeAnswer.upsert({
      where: { userId_questionId: { userId: synProfile.userId, questionId: q.id } },
      update: { answer: !!answer, answeredAt: new Date() },
      create: { userId: synProfile.userId, questionId: q.id, answer: !!answer },
    });
  }

  // Update streak
  const user = await prisma.user.findUnique({
    where: { id: synProfile.userId },
    select: { vibeStreak: true, vibeLastAnsweredDate: true },
  });
  const todayStr = new Date().toISOString().slice(0, 10);
  const lastStr = user?.vibeLastAnsweredDate ? new Date(user.vibeLastAnsweredDate).toISOString().slice(0, 10) : null;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  let newStreak = 1;
  if (lastStr === todayStr) {
    newStreak = user.vibeStreak;
  } else if (lastStr === yesterdayStr) {
    newStreak = user.vibeStreak + 1;
  }

  await prisma.user.update({
    where: { id: synProfile.userId },
    data: { vibeStreak: newStreak, vibeLastAnsweredDate: new Date() },
  });

  await logAction(synProfile.id, synProfile.userId, 'answer_vibe_check', null, { count: toAnswer.length, streak: newStreak });
}

async function executePlaySmf(synProfile) {
  // Rate limit: 3 per 6h
  const windowStart = new Date(Date.now() - 6 * 60 * 60 * 1000);
  const roundCount = await prisma.smfRound.count({
    where: { playerId: synProfile.userId, createdAt: { gte: windowStart } },
  });
  if (roundCount >= 3) return;

  const oppositeRole = synProfile.user.role === 'STEPPER' ? 'BADDIE' : 'STEPPER';

  // Get candidates — real users, opposite role
  const excludeIds = new Set([synProfile.userId]);

  // Exclude already picked in window
  const recentRounds = await prisma.smfRound.findMany({
    where: { playerId: synProfile.userId, createdAt: { gte: windowStart } },
    include: { picks: { select: { targetId: true } } },
  });
  recentRounds.forEach((r) => r.picks.forEach((p) => excludeIds.add(p.targetId)));

  const candidates = await prisma.user.findMany({
    where: {
      role: oppositeRole,
      isSynthetic: false,
      isBanned: false,
      isHidden: false,
      id: { notIn: [...excludeIds] },
    },
    include: { profile: true },
    take: 50,
    orderBy: { lastOnline: 'desc' },
  });

  if (candidates.length < 3) return;

  // Shuffle and take 3
  const shuffled = candidates.sort(() => Math.random() - 0.5).slice(0, 3);
  const picks = ['smash', 'marry', 'friendzone'];

  // Assign picks — use persona preference for ordering
  const personaConfig = synProfile.personaConfig;
  const idealMatch = personaConfig.idealMatch || '';

  // Simple heuristic: give smash/marry to profiles with more complete data
  const scored = shuffled.map((c) => ({
    user: c,
    score: (c.profile?.bio ? 1 : 0) + (c.profile?.photos?.length > 0 ? 1 : 0) + (c.profile?.lookingFor ? 1 : 0),
  })).sort((a, b) => b.score - a.score);

  const pickAssignments = scored.map((s, i) => ({
    userId: s.user.id,
    pick: picks[i],
  }));

  // Create round
  const round = await prisma.smfRound.create({
    data: {
      playerId: synProfile.userId,
      picks: {
        create: pickAssignments.map((p) => ({ targetId: p.userId, pick: p.pick })),
      },
    },
  });

  // Notifications for smash/marry only
  const io = await getIo();
  const pickerName = synProfile.user.profile?.displayName || 'Someone';
  const pickerPhoto = synProfile.user.profile?.photos?.[0] || null;

  for (const pa of pickAssignments) {
    if (pa.pick === 'friendzone') continue;

    const title = pa.pick === 'smash'
      ? `${pickerName} rated you Smash`
      : `${pickerName} rated you Marry`;
    const body = pa.pick === 'smash'
      ? 'The attraction is real'
      : "Someone sees forever in you";

    const notification = await prisma.notification.create({
      data: {
        userId: pa.userId,
        type: 'smf_pick',
        title,
        body,
        data: { pickerId: synProfile.userId, pickerName, pickerPhoto },
      },
    });

    if (io) io.to(pa.userId).emit('notification', notification);
  }

  await logAction(synProfile.id, synProfile.userId, 'play_smf', null, {
    roundId: round.id,
    picks: pickAssignments.map((p) => ({ userId: p.userId, pick: p.pick })),
  });
}

async function executeUpdateEnergy(synProfile) {
  const personaConfig = synProfile.personaConfig;
  const currentHour = new Date().getHours();
  const mood = personaConfig.emotionalState?.mood || 'neutral';

  // Pick energy based on time and mood
  let energy;
  if (currentHour >= 5 && currentHour < 12) {
    energy = mood === 'energized' ? 'Ready to go out' : 'Just vibing';
  } else if (currentHour >= 12 && currentHour < 17) {
    energy = 'Just vibing';
  } else if (currentHour >= 17 && currentHour < 21) {
    energy = Math.random() > 0.5 ? 'Ready to go out' : 'Looking for my person';
  } else if (currentHour >= 21) {
    energy = Math.random() > 0.5 ? 'Low-key tonight' : 'Down for whatever';
  } else {
    energy = 'Low-key tonight';
  }

  await prisma.user.update({
    where: { id: synProfile.userId },
    data: { dateEnergy: energy, dateEnergySetAt: new Date() },
  });

  await logAction(synProfile.id, synProfile.userId, 'update_date_energy', null, { energy });
}

async function executeSendMessage(synProfile) {
  const personaConfig = synProfile.personaConfig;

  // Find conversations with real users
  const conversations = await prisma.conversation.findMany({
    where: {
      OR: [{ user1Id: synProfile.userId }, { user2Id: synProfile.userId }],
    },
    include: {
      messages: { orderBy: { createdAt: 'desc' }, take: 5 },
      user1: { select: { id: true, isSynthetic: true } },
      user2: { select: { id: true, isSynthetic: true } },
    },
    orderBy: { lastMessageAt: 'desc' },
    take: 5,
  });

  // Filter to conversations with real users only
  const realConvos = conversations.filter((c) => {
    const other = c.user1Id === synProfile.userId ? c.user2 : c.user1;
    return !other.isSynthetic;
  });

  // Prioritize: unanswered messages from real users
  let targetConvo = null;
  let conversationHistory = [];

  for (const convo of realConvos) {
    const lastMsg = convo.messages[0];
    if (lastMsg && lastMsg.senderId !== synProfile.userId) {
      // There's an unanswered message from the other user
      targetConvo = convo;
      conversationHistory = convo.messages.reverse();
      break;
    }
  }

  // If no unanswered, consider initiating (only with matches)
  if (!targetConvo) {
    // Find matches
    const matches = await prisma.match.findMany({
      where: {
        OR: [{ user1Id: synProfile.userId }, { user2Id: synProfile.userId }],
      },
      take: 5,
      orderBy: { createdAt: 'desc' },
    });

    for (const match of matches) {
      const otherId = match.user1Id === synProfile.userId ? match.user2Id : match.user1Id;
      const otherUser = await prisma.user.findUnique({ where: { id: otherId }, select: { isSynthetic: true } });
      if (otherUser?.isSynthetic) continue;

      const daysSinceMatch = Math.floor((Date.now() - new Date(match.createdAt).getTime()) / 86400000);
      const existingConvo = realConvos.find((c) =>
        (c.user1Id === otherId || c.user2Id === otherId)
      );

      // Check if we should initiate
      const msgCount = existingConvo?.messages?.length || 0;
      if (!shouldInitiateConversation(personaConfig, daysSinceMatch, msgCount)) continue;

      // Don't double-message
      if (existingConvo?.messages?.[0]?.senderId === synProfile.userId) continue;

      // Find or create conversation
      if (existingConvo) {
        targetConvo = existingConvo;
        conversationHistory = existingConvo.messages.reverse();
      } else {
        targetConvo = await prisma.conversation.create({
          data: { user1Id: synProfile.userId, user2Id: otherId },
        });
        conversationHistory = [];
      }
      break;
    }
  }

  if (!targetConvo) return;

  const otherId = targetConvo.user1Id === synProfile.userId ? targetConvo.user2Id : targetConvo.user1Id;
  const otherProfile = await prisma.profile.findUnique({ where: { userId: otherId } });

  // Apply response delay (logged but not actually waited — scheduler handles timing)
  const delay = calculateResponseDelay(personaConfig.communicationStyle || {}, 1, new Date().getHours());

  // Generate message with Claude
  const systemPrompt = buildPersonaSystemPrompt(personaConfig);
  const historyText = conversationHistory.map((m) =>
    `${m.senderId === synProfile.userId ? 'You' : otherProfile?.displayName || 'Them'}: ${m.content}`
  ).join('\n');

  const msgPrompt = conversationHistory.length === 0
    ? `You just matched with ${otherProfile?.displayName || 'someone'} on a dating app. Their bio: "${otherProfile?.bio || 'No bio'}". Send a first message. Return ONLY the message text, nothing else.`
    : `Conversation so far:\n${historyText}\n\nReply naturally in character. Return ONLY the message text, nothing else.`;

  const messageText = await callClaude(systemPrompt, msgPrompt, 150);
  if (!messageText) return;

  const message = await prisma.message.create({
    data: {
      conversationId: targetConvo.id,
      senderId: synProfile.userId,
      content: messageText.trim().slice(0, 500),
      contentType: 'TEXT',
    },
  });

  await prisma.conversation.update({
    where: { id: targetConvo.id },
    data: { lastMessageAt: new Date() },
  });

  const io = await getIo();
  if (io) {
    io.to(otherId).emit('message-notification', {
      conversationId: targetConvo.id,
      message,
    });
  }

  await logAction(synProfile.id, synProfile.userId, 'send_message', otherId, {
    conversationId: targetConvo.id,
    messageLength: messageText.length,
    isFirstMessage: conversationHistory.length === 0,
    responseDelayMs: delay,
  });
}

// ══════════════════════════════════════
// Reflection
// ══════════════════════════════════════

async function triggerReflection(synProfile, memoryStream) {
  const personaConfig = synProfile.personaConfig;
  const systemPrompt = buildPersonaSystemPrompt(personaConfig);

  const recentActions = memoryStream.slice(-10).map((m) => `${m.timestamp}: ${m.actions.join(', ')}`).join('\n');

  const reflectionPrompt = `Review your recent activity on this dating app:\n${recentActions}\n\nIn 2-3 sentences, reflect on how things are going and what you might focus on next. Stay in character.`;

  const reflection = await callClaude(systemPrompt, reflectionPrompt, 150);
  if (!reflection) return;

  // Update emotional state based on activity
  const actionCount = memoryStream.length;
  const newState = { ...personaConfig.emotionalState };
  if (actionCount > 30) {
    newState.energy = Math.max(0.4, (newState.energy || 0.7) - 0.05);
  }

  await prisma.syntheticProfile.update({
    where: { id: synProfile.id },
    data: {
      lastReflectionAt: new Date(),
      emotionalState: newState,
    },
  });
}
