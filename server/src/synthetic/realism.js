// Realism utilities for synthetic user behavior timing

const RESPONSIVENESS_RANGES = {
  fast:     { min: 60,  max: 300 },   // 1-5 min
  moderate: { min: 300, max: 900 },   // 5-15 min
  slow:     { min: 900, max: 2700 },  // 15-45 min
};

export function calculateResponseDelay(persona, messageComplexity = 1, currentHour = new Date().getHours()) {
  const profile = persona.communicationStyle?.responsivenessProfile || 'moderate';
  const range = RESPONSIVENESS_RANGES[profile] || RESPONSIVENESS_RANGES.moderate;

  let base = range.min + Math.random() * (range.max - range.min);

  // Work hours multiplier (9-17)
  if (currentHour >= 9 && currentHour < 17) {
    base *= 1.5;
  }
  // Late night multiplier (1-6)
  if (currentHour >= 1 && currentHour < 6) {
    base *= 3.0;
  }

  // Message complexity multiplier
  base *= (0.8 + messageComplexity * 0.4);

  // Jitter ±30%
  const jitter = 1 + (Math.random() - 0.5) * 0.6;
  base *= jitter;

  return Math.round(base * 1000); // return ms
}

export function shouldInitiateConversation(persona, matchAgeDays = 0, interactionCount = 0) {
  const openness = persona.emotionalState?.openness || 0.5;

  // Base probability from openness
  let prob = openness * 0.3;

  // Decay with match age
  if (matchAgeDays > 0) {
    prob *= Math.max(0.1, 1 - matchAgeDays * 0.05);
  }

  // Decay with interaction count
  if (interactionCount > 0) {
    prob *= Math.max(0.2, 1 - interactionCount * 0.1);
  }

  return Math.random() < prob;
}

export function calculateEngagementDecay(persona, daysSinceJoin = 0) {
  // Week 1: full engagement
  if (daysSinceJoin <= 7) return 1.0;

  // Gradual decline from 1.0 to 0.4 over weeks 2-6
  const decayRate = 0.025;
  const multiplier = Math.max(0.4, 1.0 - (daysSinceJoin - 7) * decayRate);

  return multiplier;
}

export function getTimeWindowActions(dailySchedule, currentHour = new Date().getHours()) {
  const hourStr = String(currentHour).padStart(2, '0');
  const probability = dailySchedule.onlineProbability?.[hourStr] || 0;

  // Find which action window matches the current hour
  const windows = dailySchedule.actionWindows || {};
  for (const [, window] of Object.entries(windows)) {
    if (window.hours?.includes(hourStr)) {
      return {
        probability,
        preferredActions: window.preferredActions || [],
      };
    }
  }

  return { probability: probability || 0.1, preferredActions: [] };
}

export function isHighActivityDay(dailySchedule, dayName = null) {
  if (!dayName) {
    const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
    dayName = days[new Date().getDay()];
  }
  const low = dailySchedule.lowActivityDays || [];
  const high = dailySchedule.highActivityDays || [];

  if (high.includes(dayName)) return 1;   // boost
  if (low.includes(dayName)) return -1;    // reduce
  return 0;                                // neutral
}

export function randomJitterMs(maxSeconds = 120) {
  return Math.floor(Math.random() * maxSeconds * 1000);
}
