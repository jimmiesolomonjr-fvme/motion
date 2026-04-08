import { PrismaClient } from '@prisma/client';
import Anthropic from '@anthropic-ai/sdk';
import config from '../config/index.js';

const prisma = new PrismaClient();

const VENUE_CATEGORIES_GOOGLE = [
  'restaurant',
  'bar',
  'night_club',
  'bowling_alley',
  'amusement_park',
  'spa',
  'art_gallery',
  'movie_theater',
];

const YELP_CATEGORIES = 'restaurants,bars,arts,nightlife,active';

async function fetchGooglePlacesVenues(city, lat, lng) {
  const apiKey = config.communityMoves.googlePlacesApiKey;
  if (!apiKey) return [];

  const venues = [];
  try {
    for (const type of VENUE_CATEGORIES_GOOGLE.slice(0, 4)) {
      const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=16000&type=${type}&key=${apiKey}&rankby=prominence`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      if (data.results) {
        for (const place of data.results.slice(0, 5)) {
          venues.push({
            name: place.name,
            address: place.vicinity || place.formatted_address || '',
            rating: place.rating || 0,
            priceLevel: place.price_level || 0,
            category: type,
            sourceApi: 'google_places',
            sourceId: place.place_id,
            lat: place.geometry?.location?.lat,
            lng: place.geometry?.location?.lng,
            photo: place.photos?.[0]
              ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=600&photo_reference=${place.photos[0].photo_reference}&key=${apiKey}`
              : null,
          });
        }
      }
    }
  } catch (err) {
    console.error('[pipeline] Google Places error:', err.message);
  }
  return venues;
}

async function fetchYelpVenues(city, lat, lng) {
  const apiKey = config.communityMoves.yelpApiKey;
  if (!apiKey) return [];

  const venues = [];
  try {
    const url = `https://api.yelp.com/v3/businesses/search?latitude=${lat}&longitude=${lng}&categories=${YELP_CATEGORIES}&sort_by=rating&limit=20`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (data.businesses) {
      for (const biz of data.businesses) {
        venues.push({
          name: biz.name,
          address: biz.location?.display_address?.join(', ') || '',
          rating: biz.rating || 0,
          priceLevel: biz.price?.length || 0,
          category: biz.categories?.[0]?.alias || 'restaurant',
          sourceApi: 'yelp',
          sourceId: biz.id,
          lat: biz.coordinates?.latitude,
          lng: biz.coordinates?.longitude,
          photo: biz.image_url || null,
          url: biz.url || null,
        });
      }
    }
  } catch (err) {
    console.error('[pipeline] Yelp error:', err.message);
  }
  return venues;
}

async function deduplicateVenues(venues) {
  if (venues.length === 0) return [];

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentlyUsed = await prisma.communityMoveVenueLog.findMany({
    where: { usedAt: { gte: thirtyDaysAgo } },
    select: { sourceId: true },
  });
  const usedIds = new Set(recentlyUsed.map((v) => v.sourceId));

  return venues.filter((v) => !usedIds.has(v.sourceId));
}

async function curateWithClaude(venues, city) {
  const apiKey = config.communityMoves.anthropicApiKey;
  if (!apiKey) {
    console.warn('[pipeline] No Anthropic API key — skipping AI curation');
    return venues.slice(0, 5).map((v) => ({
      title: `Date Night at ${v.name}`,
      description: `Check out ${v.name} in ${city}. ${v.rating ? `Rated ${v.rating}/5.` : ''}`,
      location: v.address || v.name,
      category: mapCategory(v.category),
      vibeTags: ['date night', 'good vibes'],
      suggestedDate: getNextDateNight(),
      venue: v,
    }));
  }

  const client = new Anthropic({ apiKey });

  const venueList = venues.slice(0, 15).map((v, i) => (
    `${i + 1}. ${v.name} — ${v.address} (Rating: ${v.rating}, Price: ${'$'.repeat(v.priceLevel || 1)}, Category: ${v.category})`
  )).join('\n');

  const prompt = `You are a dating concierge for Motion, a dating app in ${city}. From these venues, pick the 3-5 best date-worthy spots and create compelling community date moves.

Venues:
${venueList}

For each pick, return a JSON array with objects containing:
- "venueIndex": number (1-based index from list above)
- "title": catchy date title (e.g. "Sunset Cocktails at The Rooftop")
- "description": 2-3 sentence romantic/fun description. Be specific about what makes this a great date spot.
- "category": one of DINNER, DRINKS, ADVENTURE, CONCERT, OTHER
- "vibeTags": array of 2-4 vibe tags (e.g. ["romantic", "upscale", "cocktails"])
- "suggestedDay": "monday" or "thursday" (the upcoming one)

Return ONLY the JSON array, no markdown or explanation.`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0]?.text || '';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error('[pipeline] Claude returned non-JSON:', text.substring(0, 200));
      return [];
    }

    const picks = JSON.parse(jsonMatch[0]);
    return picks.map((pick) => {
      const venue = venues[pick.venueIndex - 1];
      if (!venue) return null;
      return {
        title: pick.title,
        description: pick.description,
        location: venue.address || venue.name,
        category: pick.category || 'OTHER',
        vibeTags: pick.vibeTags || [],
        suggestedDate: getSuggestedDate(pick.suggestedDay),
        venue,
      };
    }).filter(Boolean);
  } catch (err) {
    console.error('[pipeline] Claude curation error:', err.message);
    return [];
  }
}

function mapCategory(raw) {
  const map = {
    restaurant: 'DINNER',
    bar: 'DRINKS',
    night_club: 'DRINKS',
    bowling_alley: 'ADVENTURE',
    amusement_park: 'ADVENTURE',
    spa: 'OTHER',
    art_gallery: 'OTHER',
    movie_theater: 'OTHER',
  };
  return map[raw] || 'OTHER';
}

function getNextDateNight() {
  const now = new Date();
  const day = now.getDay();
  // Next Thursday or Saturday
  const daysUntilThursday = (4 - day + 7) % 7 || 7;
  const next = new Date(now);
  next.setDate(now.getDate() + daysUntilThursday);
  next.setHours(19, 0, 0, 0);
  return next;
}

function getSuggestedDate(dayName) {
  const now = new Date();
  const day = now.getDay();
  const target = dayName === 'monday' ? 1 : 4; // Monday or Thursday
  const daysUntil = (target - day + 7) % 7 || 7;
  const next = new Date(now);
  next.setDate(now.getDate() + daysUntil);
  next.setHours(19, 0, 0, 0);
  return next;
}

export async function runPipeline(city) {
  const startTime = Date.now();
  const errors = [];
  let venuesFetched = 0;
  let movesCreated = 0;

  try {
    // Check if pipeline is enabled
    const setting = await prisma.appSetting.findUnique({ where: { key: 'communityMovesEnabled' } });
    if (setting?.value === 'false') {
      console.log('[pipeline] Community moves pipeline is disabled');
      return { status: 'SKIPPED', movesCreated: 0 };
    }

    const targetCity = city || config.communityMoves.defaultCity;
    const lat = config.communityMoves.defaultLat;
    const lng = config.communityMoves.defaultLng;

    // Fetch venues from both APIs
    const [googleVenues, yelpVenues] = await Promise.all([
      fetchGooglePlacesVenues(targetCity, lat, lng),
      fetchYelpVenues(targetCity, lat, lng),
    ]);

    const allVenues = [...googleVenues, ...yelpVenues];
    venuesFetched = allVenues.length;

    if (allVenues.length === 0) {
      errors.push('No venues fetched from any API');
      await logRun('FAILED', movesCreated, venuesFetched, errors, Date.now() - startTime);
      return { status: 'FAILED', movesCreated: 0, errors };
    }

    // Deduplicate against recently used
    const freshVenues = await deduplicateVenues(allVenues);
    if (freshVenues.length === 0) {
      errors.push('All venues recently used');
      await logRun('PARTIAL', movesCreated, venuesFetched, errors, Date.now() - startTime);
      return { status: 'PARTIAL', movesCreated: 0, errors };
    }

    // Curate with Claude
    const curatedMoves = await curateWithClaude(freshVenues, targetCity);
    if (curatedMoves.length === 0) {
      errors.push('AI curation returned no picks');
      await logRun('PARTIAL', movesCreated, venuesFetched, errors, Date.now() - startTime);
      return { status: 'PARTIAL', movesCreated: 0, errors };
    }

    // Find admin user to be the creator
    const adminUser = await prisma.user.findFirst({ where: { isAdmin: true } });
    if (!adminUser) {
      errors.push('No admin user found for move creation');
      await logRun('FAILED', movesCreated, venuesFetched, errors, Date.now() - startTime);
      return { status: 'FAILED', movesCreated: 0, errors };
    }

    const pipelineRunId = crypto.randomUUID();

    // Create moves and log venues
    for (const curated of curatedMoves) {
      try {
        const expiresAt = new Date(curated.suggestedDate);
        expiresAt.setHours(23, 59, 59, 999);

        await prisma.move.create({
          data: {
            creatorId: adminUser.id,
            title: curated.title,
            description: curated.description,
            date: curated.suggestedDate,
            location: curated.location,
            category: curated.category,
            photo: curated.venue.photo || null,
            isCommunity: true,
            sourceApi: curated.venue.sourceApi,
            sourceUrl: curated.venue.url || null,
            vibeTagsCommunity: curated.vibeTags,
            expiresAt,
            pipelineRunId,
            maxInterest: 50,
          },
        });

        // Log venue usage
        await prisma.communityMoveVenueLog.upsert({
          where: { sourceId: curated.venue.sourceId },
          update: { usedAt: new Date() },
          create: {
            venueName: curated.venue.name,
            address: curated.venue.address,
            sourceApi: curated.venue.sourceApi,
            sourceId: curated.venue.sourceId,
          },
        });

        movesCreated++;
      } catch (err) {
        errors.push(`Failed to create move "${curated.title}": ${err.message}`);
      }
    }

    const status = movesCreated > 0 ? 'SUCCESS' : 'FAILED';
    await logRun(status, movesCreated, venuesFetched, errors, Date.now() - startTime);

    console.log(`[pipeline] Created ${movesCreated} community moves (${venuesFetched} venues fetched)`);
    return { status, movesCreated, venuesFetched, errors };
  } catch (err) {
    errors.push(err.message);
    await logRun('FAILED', movesCreated, venuesFetched, errors, Date.now() - startTime);
    console.error('[pipeline] Fatal error:', err);
    return { status: 'FAILED', movesCreated: 0, errors };
  }
}

async function logRun(status, movesCreated, venuesFetched, errors, duration) {
  try {
    await prisma.pipelineRunLog.create({
      data: { status, movesCreated, venuesFetched, errors, duration },
    });
  } catch (err) {
    console.error('[pipeline] Failed to log run:', err.message);
  }
}
