// Photo Pipeline — fal.ai FLUX Pro 1.1 + Sharp de-AI + Cloudinary upload
//
// Generates realistic profile photos for all 16 synthetic personas.
// One-time run: `node src/synthetic/photoPipeline.js`
//
// Requires: FAL_API_KEY, CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET env vars

import falPkg from '@fal-ai/client';
const { fal } = falPkg;
import { v2 as cloudinary } from 'cloudinary';
import sharp from 'sharp';
import { PrismaClient } from '@prisma/client';
import config from '../config/index.js';
import { PREBUILT_PERSONAS } from './personas.js';

const prisma = new PrismaClient();

// Configure fal.ai
fal.config({ credentials: config.synthetic.falApiKey });

// Configure Cloudinary
const cloudinaryEnabled = !!(config.cloudinary.cloudName && config.cloudinary.apiKey && config.cloudinary.apiSecret);
if (cloudinaryEnabled) {
  cloudinary.config({
    cloud_name: config.cloudinary.cloudName,
    api_key: config.cloudinary.apiKey,
    api_secret: config.cloudinary.apiSecret,
  });
}

// ─── Persona appearance descriptions ─────────────────────────────────────────
// Each persona gets a base appearance + 4 scene variants = 5 photos total

const PERSONA_APPEARANCES = {
  // STEPPERS
  'marcus@motionapp.internal': {
    base: 'Black man, 34 years old, clean-cut with short dark hair and well-groomed facial hair, warm brown skin, stylish and well-dressed, creative director look, confident relaxed expression',
    scenes: [
      { setting: 'seated at an upscale restaurant table with warm ambient lighting, wearing a fitted dark henley, looking at camera with a slight smile', style: 'portrait' },
      { setting: 'standing on a Harlem street at golden hour, wearing a tailored bomber jacket and clean sneakers, casual confident pose', style: 'street' },
      { setting: 'at an outdoor food market, holding a drink, candid laugh, wearing a crisp button-down with sleeves rolled up', style: 'candid' },
      { setting: 'leaning against a brick wall in a dimly lit cocktail bar, wearing a blazer over a black tee, moody warm lighting', style: 'mood' },
    ],
  },
  'darius@motionapp.internal': {
    base: 'Black man, 29 years old, medium dark skin, modern low fade haircut, lean athletic build, understated style, tech founder aesthetic, thoughtful expression',
    scenes: [
      { setting: 'sitting by a window in a modern coffee shop, natural light, wearing a minimalist crewneck sweater, looking at camera', style: 'portrait' },
      { setting: 'standing on the Jersey City waterfront at sunset, wearing a fitted jacket, skyline behind him, calm confident look', style: 'outdoor' },
      { setting: 'at a rooftop bar with city lights behind, wearing a clean dark shirt, holding a cocktail, slight smirk', style: 'nightlife' },
      { setting: 'candid shot walking down a city street, wearing premium athleisure, AirPods in one ear, natural stride', style: 'candid' },
    ],
  },
  'andre@motionapp.internal': {
    base: 'Black man, 38 years old, warm dark skin, bald head or very short hair, broad-shouldered, warm inviting smile, restaurant owner presence, well-groomed',
    scenes: [
      { setting: 'standing behind a beautiful restaurant counter, wearing a crisp white chef coat open over a dark shirt, warm smile', style: 'portrait' },
      { setting: 'seated at a wine bar with glasses of wine on the table, wearing a cashmere sweater, intimate lighting, relaxed pose', style: 'mood' },
      { setting: 'walking through a Tribeca street with brown paper grocery bags, wearing a tailored peacoat, autumn light', style: 'lifestyle' },
      { setting: 'candid shot tasting food from a spoon in a restaurant kitchen, focused expression, warm overhead lighting', style: 'candid' },
    ],
  },
  'khalil@motionapp.internal': {
    base: 'Black man, 31 years old, medium brown skin, short natural hair and neatly trimmed beard, lean build, intellectual and creative look, glasses with thin frames',
    scenes: [
      { setting: 'standing in a modern architecture studio with blueprints, wearing a dark turtleneck, natural light from large windows', style: 'portrait' },
      { setting: 'sitting on a bench in Fort Greene Park, reading a book, wearing a fitted jacket, autumn leaves around, candid', style: 'lifestyle' },
      { setting: 'at a museum gallery, looking thoughtfully at artwork, profile shot, wearing a crisp button-down', style: 'candid' },
      { setting: 'on a Brooklyn rooftop at dusk, leaning on railing, city skyline behind, wearing a crewneck and jeans, contemplative look', style: 'mood' },
    ],
  },
  'tyler@motionapp.internal': {
    base: 'Black man, 36 years old, light brown skin, athletic muscular build, short fade haircut, clean-shaven, tall, clean-cut finance professional and former athlete look',
    scenes: [
      { setting: 'wearing a fitted navy suit without tie, standing in a modern office lobby, confident relaxed pose, slight smile', style: 'portrait' },
      { setting: 'post-workout in athletic wear, standing outside a gym with a water bottle, morning light, natural and relaxed', style: 'fitness' },
      { setting: 'sitting at a sports bar watching a game, wearing a casual polo, beer on the table, laughing naturally', style: 'candid' },
      { setting: 'running along the Hoboken waterfront at sunrise, athletic form, Manhattan skyline in background, action shot', style: 'action' },
    ],
  },
  'james@motionapp.internal': {
    base: 'Black man, 42 years old, distinguished look, short salt-and-pepper hair, deep brown skin, lean fit build, refined and cultured appearance, warm knowing eyes',
    scenes: [
      { setting: 'seated in a jazz club with dim amber lighting, wearing a tailored sport coat over a dark shirt, drink in hand, sophisticated', style: 'mood' },
      { setting: 'standing at a theater entrance, wearing a charcoal overcoat, evening lighting, composed elegant pose', style: 'portrait' },
      { setting: 'sitting in a book-lined study or library, reading with glasses on, wearing a cashmere sweater, warm lamp light', style: 'lifestyle' },
      { setting: 'walking through Central Park on the Upper West Side, autumn, wearing a fitted topcoat, natural stride, golden light', style: 'outdoor' },
    ],
  },
  'nate@motionapp.internal': {
    base: 'Black man, 28 years old, dark skin, medium-length locs or twists, slim creative build, effortlessly cool, music producer aesthetic, artistic look',
    scenes: [
      { setting: 'in a music studio with headphones around neck, wearing a vintage graphic tee, warm studio lighting, relaxed pose', style: 'portrait' },
      { setting: 'at a dimly lit vinyl bar, flipping through records, wearing an oversized jacket, candid and focused', style: 'lifestyle' },
      { setting: 'standing on a Bushwick street with graffiti murals behind, wearing layered streetwear, nighttime, neon reflections', style: 'street' },
      { setting: 'sitting on a fire escape at golden hour, wearing a hoodie and chains, looking off to the side, contemplative', style: 'mood' },
    ],
  },
  'chris@motionapp.internal': {
    base: 'Black man, 33 years old, medium brown skin, short neat haircut, clean-shaven, medium athletic build, suburban successful look, approachable warm expression',
    scenes: [
      { setting: 'standing on the porch of a nice suburban home, wearing a fitted quarter-zip and chinos, warm afternoon light, genuine smile', style: 'portrait' },
      { setting: 'at a farm-to-table restaurant in a small town, wearing a casual button-down, wine glass in hand, natural lighting', style: 'lifestyle' },
      { setting: 'in a modern home office with clean desk, wearing a sharp blazer over a crewneck, looking at camera, confident', style: 'professional' },
      { setting: 'walking a dog in a tree-lined neighborhood, wearing premium casual wear, laughing, candid morning shot', style: 'candid' },
    ],
  },

  // BADDIES
  'zara@motionapp.internal': {
    base: 'Black woman, 22 years old, dark skin, natural hair in protective style or short artistic cut, tall and slender model build, striking features, fashion-forward artistic aesthetic',
    scenes: [
      { setting: 'in an art studio with paint splashes on her hands, wearing vintage denim and a crop top, natural light from large windows, candid', style: 'lifestyle' },
      { setting: 'standing on a Bed-Stuy street, wearing an oversized vintage jacket and statement earrings, golden hour, effortless pose', style: 'street' },
      { setting: 'at a gallery opening, wearing a minimal black dress, holding a glass of wine, moody lighting, slight smile', style: 'event' },
      { setting: 'sitting in a thrift store trying on vintage sunglasses, laughing, wearing layered boho outfit, candid and natural', style: 'candid' },
    ],
  },
  'nia@motionapp.internal': {
    base: 'Black woman, 24 years old, warm medium-dark skin, long braids or natural curls, beautiful warm smile, fit feminine build, natural beauty, kind expressive eyes',
    scenes: [
      { setting: 'at a cozy brunch spot, laughing over a table of food, wearing a fitted knit top and gold jewelry, warm natural lighting', style: 'candid' },
      { setting: 'walking down a Harlem brownstone street, wearing a midi dress and heels, warm evening glow, confident stride', style: 'street' },
      { setting: 'selfie-style portrait in nursing scrubs, hair pulled back, warm genuine smile, hospital hallway background, authentic', style: 'professional' },
      { setting: 'sitting on apartment steps with a coffee, wearing cozy loungewear, morning light, soft natural look, relaxed', style: 'lifestyle' },
    ],
  },
  'jade@motionapp.internal': {
    base: 'Black woman, 21 years old, caramel brown skin, straight or pressed hair in a sleek style, petite and pretty, ambitious sharp look, youthful energy',
    scenes: [
      { setting: 'on a college campus with books, wearing a chic casual outfit with sneakers, backpack, determined confident look, natural light', style: 'lifestyle' },
      { setting: 'at a rooftop restaurant at night, wearing a bodycon dress and statement jewelry, city lights behind, glamorous', style: 'nightlife' },
      { setting: 'selfie in a library study room, cute focused expression, wearing a cozy sweater, books and laptop visible, authentic', style: 'candid' },
      { setting: 'walking through downtown Newark, wearing fitted jeans and a leather jacket, coffee in hand, urban confident stride', style: 'street' },
    ],
  },
  'simone@motionapp.internal': {
    base: 'Black woman, 25 years old, medium brown skin, short natural TWA or curly bob, cute and approachable, creative professional look, bright warm smile',
    scenes: [
      { setting: 'at a trendy cafe with a laptop and sketchbook, wearing a colorful top and minimal jewelry, natural light, working and smiling', style: 'lifestyle' },
      { setting: 'standing outside a new restaurant in Astoria, wearing a cute fitted dress, laughing at something off-camera, warm evening', style: 'candid' },
      { setting: 'in a design studio workspace, wearing a graphic tee and high-waisted pants, surrounded by mood boards, creative energy', style: 'professional' },
      { setting: 'at an outdoor food market, trying street food, wearing oversized sunglasses and a sundress, bright sunny day, candid joy', style: 'outdoor' },
    ],
  },
  'aaliyah@motionapp.internal': {
    base: 'Black woman, 23 years old, dark brown skin, long straight or wavy hair, striking beautiful face, fit and polished, content creator aesthetic, magnetic presence',
    scenes: [
      { setting: 'on a Jersey City rooftop with skyline view, wearing an elegant casual outfit, golden hour lighting, looking at camera confidently', style: 'portrait' },
      { setting: 'in a minimalist apartment, natural window light, wearing cozy loungewear, genuine low-key smile, no makeup or light makeup', style: 'intimate' },
      { setting: 'at a trendy cocktail bar, wearing a sleek outfit, warm ambient lighting, holding a drink, effortlessly beautiful', style: 'nightlife' },
      { setting: 'walking along a waterfront boardwalk, wearing athleisure, hair blowing in wind, natural candid laugh, daytime', style: 'outdoor' },
    ],
  },
  'maya@motionapp.internal': {
    base: 'Black woman, 20 years old, rich dark skin, natural hair in a bold protective style or twists, confident sharp features, pre-law student energy, striking and intelligent look',
    scenes: [
      { setting: 'at a university library table with law books, wearing a structured blazer over a casual top, focused but approachable, warm light', style: 'academic' },
      { setting: 'standing on a Bronx street with colorful murals, wearing fitted jeans and a statement top, confident pose, golden hour', style: 'street' },
      { setting: 'at a dinner table, wearing a elegant blouse, animated conversation pose, warm restaurant lighting, genuine smile', style: 'candid' },
      { setting: 'sitting in a park reading, wearing a stylish casual outfit, natural light, serene focused expression, autumn setting', style: 'lifestyle' },
    ],
  },
  'tia@motionapp.internal': {
    base: 'Black woman, 24 years old, light brown skin, long curly or wavy hair, toned athletic build, bright genuine smile, pilates instructor fitness look, radiant healthy glow',
    scenes: [
      { setting: 'post-workout in a pilates studio, wearing fitted athletic wear, dewy skin, bright smile, natural light streaming in', style: 'fitness' },
      { setting: 'running along the Hoboken waterfront, Manhattan skyline behind, morning light, athletic form, action shot', style: 'action' },
      { setting: 'at a smoothie bar, wearing cute athleisure, holding a green smoothie, laughing with bright energy, daytime', style: 'lifestyle' },
      { setting: 'golden hour portrait on a park bench, wearing a sundress, hair down, warm relaxed smile, natural beauty', style: 'portrait' },
    ],
  },
  'kira@motionapp.internal': {
    base: 'Black woman, 22 years old, dark skin, short natural hair or small locs, slim indie aesthetic, observational quiet beauty, photographer artist look, interesting face',
    scenes: [
      { setting: 'holding a film camera, looking through viewfinder, wearing a vintage band tee and baggy jeans, golden light, candid', style: 'lifestyle' },
      { setting: 'walking through Fort Greene on a quiet street, wearing earth tones and a crossbody bag, soft afternoon light, observant look', style: 'street' },
      { setting: 'at a cafe window seat, film camera on the table, wearing a chunky sweater, looking out the window thoughtfully, warm tones', style: 'mood' },
      { setting: 'sitting on a brownstone stoop, developing photos spread around her, wearing cool indie outfit, concentrating, natural light', style: 'candid' },
    ],
  },
};

// ─── De-AI Processing ────────────────────────────────────────────────────────
// Makes AI-generated photos look more like real phone/camera photos

async function deAiProcess(imageBuffer) {
  const image = sharp(imageBuffer);
  const metadata = await image.metadata();
  const width = metadata.width || 1024;
  const height = metadata.height || 1024;

  // 1. Add subtle sensor noise (gaussian)
  const noiseBuffer = Buffer.alloc(width * height * 3);
  for (let i = 0; i < noiseBuffer.length; i++) {
    noiseBuffer[i] = Math.floor(Math.random() * 8); // subtle noise 0-7
  }

  const noiseImage = sharp(noiseBuffer, {
    raw: { width, height, channels: 3 },
  });

  // 2. Process: slight blur, noise overlay, JPEG compression artifacts, slight vignette
  const processed = await sharp(imageBuffer)
    // Slight resize jitter (simulates non-perfect resolution)
    .resize(
      width - Math.floor(Math.random() * 20),
      null,
      { withoutEnlargement: true, fit: 'inside' }
    )
    // Slight sharpening to counter AI softness
    .sharpen({ sigma: 0.8, m1: 0.5, m2: 0.3 })
    // Slight warmth/color shift (simulates phone camera white balance)
    .modulate({
      brightness: 0.97 + Math.random() * 0.06, // 0.97-1.03
      saturation: 0.95 + Math.random() * 0.1,   // 0.95-1.05
    })
    // Encode as JPEG with realistic quality (not perfect)
    .jpeg({
      quality: 85 + Math.floor(Math.random() * 6), // 85-90
      mozjpeg: true,
      chromaSubsampling: '4:2:0', // realistic phone JPEG
    })
    .toBuffer();

  return processed;
}

// ─── Photo Generation ────────────────────────────────────────────────────────

async function generateSinglePhoto(prompt, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await fal.subscribe('fal-ai/flux-pro/v1.1', {
        input: {
          prompt,
          image_size: 'portrait_4_3',
          num_images: 1,
          output_format: 'jpeg',
          safety_tolerance: '2',
        },
        logs: false,
      });

      if (result?.data?.images?.[0]?.url) {
        return result.data.images[0].url;
      }
      console.warn(`[photo-pipeline] No image in result, attempt ${attempt + 1}`);
    } catch (err) {
      console.error(`[photo-pipeline] Generation error (attempt ${attempt + 1}):`, err.message);
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 3000 * (attempt + 1)));
      }
    }
  }
  return null;
}

async function downloadImage(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function uploadToCloudinary(buffer, folder = 'motion/profiles') {
  if (!cloudinaryEnabled) {
    console.warn('[photo-pipeline] Cloudinary not configured, returning base64');
    const b64 = buffer.toString('base64');
    return `data:image/jpeg;base64,${b64}`;
  }

  const b64 = buffer.toString('base64');
  const dataUri = `data:image/jpeg;base64,${b64}`;
  const result = await cloudinary.uploader.upload(dataUri, {
    folder,
    resource_type: 'image',
  });

  // Add f_auto,q_auto transforms
  const url = result.secure_url;
  if (url && url.includes('/upload/')) {
    return url.replace('/upload/', '/upload/f_auto,q_auto/');
  }
  return url;
}

// ─── Per-Persona Generation ──────────────────────────────────────────────────

export async function generatePersonaPhotos(syntheticProfileId) {
  const synProfile = await prisma.syntheticProfile.findUnique({
    where: { id: syntheticProfileId },
    include: { user: { include: { profile: true } } },
  });

  if (!synProfile) {
    console.error(`[photo-pipeline] SyntheticProfile ${syntheticProfileId} not found`);
    return { generated: 0, uploaded: 0 };
  }

  const email = synProfile.user.email;
  const appearance = PERSONA_APPEARANCES[email];
  if (!appearance) {
    console.warn(`[photo-pipeline] No appearance config for ${email}`);
    return { generated: 0, uploaded: 0 };
  }

  console.log(`[photo-pipeline] Generating photos for ${synProfile.user.profile?.displayName || email}...`);

  const photoUrls = [];
  let generated = 0;

  for (const scene of appearance.scenes) {
    const prompt = `Professional dating app profile photo. ${appearance.base}. ${scene.setting}. Shot on iPhone 14 Pro, natural lighting, realistic photograph, not AI-generated, candid authentic feel, dating app photo, high quality but natural.`;

    console.log(`  [${scene.style}] Generating...`);
    const imageUrl = await generateSinglePhoto(prompt);

    if (!imageUrl) {
      console.warn(`  [${scene.style}] FAILED — skipping`);
      continue;
    }
    generated++;

    // Download, de-AI process, upload to Cloudinary
    try {
      const rawBuffer = await downloadImage(imageUrl);
      const processed = await deAiProcess(rawBuffer);
      const cloudUrl = await uploadToCloudinary(processed);
      photoUrls.push(cloudUrl);
      console.log(`  [${scene.style}] OK → ${cloudUrl.substring(0, 60)}...`);
    } catch (err) {
      console.error(`  [${scene.style}] Post-processing error:`, err.message);
    }

    // Small delay between generations to avoid rate limits
    await new Promise(r => setTimeout(r, 2000));
  }

  // Update profile photos
  if (photoUrls.length > 0 && synProfile.user.profile) {
    await prisma.profile.update({
      where: { userId: synProfile.userId },
      data: { photos: photoUrls },
    });
    console.log(`[photo-pipeline] ${synProfile.user.profile.displayName}: ${photoUrls.length} photos saved to profile`);
  }

  return { generated, uploaded: photoUrls.length };
}

// ─── Full Pipeline ───────────────────────────────────────────────────────────

export async function runFullPhotoPipeline() {
  console.log('[photo-pipeline] Starting full photo pipeline for all synthetic users...');

  if (!config.synthetic.falApiKey) {
    console.error('[photo-pipeline] FAL_API_KEY not set — aborting');
    return { total: 0 };
  }

  if (!cloudinaryEnabled) {
    console.warn('[photo-pipeline] Cloudinary not configured — photos will be base64 (not recommended for production)');
  }

  const synProfiles = await prisma.syntheticProfile.findMany({
    include: { user: { include: { profile: true } } },
  });

  console.log(`[photo-pipeline] Found ${synProfiles.length} synthetic profiles`);

  let totalUploaded = 0;
  const results = [];

  for (const sp of synProfiles) {
    const name = sp.user.profile?.displayName || sp.user.email;

    // Skip if already has photos
    if (sp.user.profile?.photos && sp.user.profile.photos.length > 0) {
      console.log(`[photo-pipeline] ${name}: already has ${sp.user.profile.photos.length} photos — skipping`);
      results.push({ name, skipped: true, existing: sp.user.profile.photos.length });
      continue;
    }

    try {
      const result = await generatePersonaPhotos(sp.id);
      totalUploaded += result.uploaded;
      results.push({ name, ...result });
    } catch (err) {
      console.error(`[photo-pipeline] ${name}: FAILED —`, err.message);
      results.push({ name, error: err.message });
    }

    // Delay between personas to stay within rate limits
    console.log('[photo-pipeline] Waiting 5s before next persona...');
    await new Promise(r => setTimeout(r, 5000));
  }

  console.log('\n[photo-pipeline] ════════ RESULTS ════════');
  for (const r of results) {
    if (r.skipped) {
      console.log(`  ${r.name}: SKIPPED (${r.existing} existing)`);
    } else if (r.error) {
      console.log(`  ${r.name}: ERROR — ${r.error}`);
    } else {
      console.log(`  ${r.name}: ${r.uploaded}/${r.generated} photos uploaded`);
    }
  }
  console.log(`[photo-pipeline] Total uploaded: ${totalUploaded}`);
  console.log('[photo-pipeline] Done.');

  return { total: totalUploaded, results };
}

// ─── CLI runner ──────────────────────────────────────────────────────────────
// Run with: node src/synthetic/photoPipeline.js

const isMainModule = process.argv[1]?.includes('photoPipeline');
if (isMainModule) {
  runFullPhotoPipeline()
    .then(({ total }) => {
      console.log(`\nFinished. ${total} photos generated and uploaded.`);
      process.exit(0);
    })
    .catch(err => {
      console.error('Pipeline failed:', err);
      process.exit(1);
    });
}
