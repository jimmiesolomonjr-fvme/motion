import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Search iTunes for songs
router.get('/search', authenticate, async (req, res) => {
  try {
    const { term } = req.query;
    if (!term || term.trim().length < 2) {
      return res.json([]);
    }

    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&limit=10`;
    const response = await fetch(url);
    const data = await response.json();

    const results = (data.results || []).map((track) => ({
      trackName: track.trackName,
      artistName: track.artistName,
      previewUrl: track.previewUrl || null,
      artworkUrl: track.artworkUrl100
        ? track.artworkUrl100.replace('100x100bb', '300x300bb')
        : null,
    }));

    res.json(results);
  } catch (error) {
    console.error('iTunes search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

export default router;
