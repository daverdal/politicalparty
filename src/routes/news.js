/**
 * News Routes
 * - User news posts
 * - Follow relationships
 * - Personalized news feed
 */

const express = require('express');
const router = express.Router();

const newsService = require('../services/newsService');
const newsAudioService = require('../services/newsAudioService');
const config = require('../config');
const { authenticate, requireVerifiedUser } = require('../middleware/auth');

// All news routes require an authenticated user
router.use(authenticate);

// POST /api/news/posts - create a new news post (verified users only)
router.post('/posts', requireVerifiedUser, async (req, res) => {
    try {
        const { body } = req.body || {};
        if (!body || !body.trim()) {
            return res.status(400).json({ error: 'Post body is required.' });
        }
        const post = await newsService.createPost({
            authorId: req.user.id,
            body: body.trim()
        });
        res.status(201).json(post);
    } catch (error) {
        res.status(error.statusCode || 500).json({ error: error.message });
    }
});

// POST /api/news/posts/:id/audio - attach audio to a news post (dev/feature-flag only)
router.post('/posts/:id/audio', requireVerifiedUser, async (req, res) => {
    if (!config.features.newsAudio) {
        return res.status(404).json({ error: 'News audio is not enabled.' });
    }

    try {
        const chunks = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', async () => {
            try {
                if (!chunks.length) {
                    return res.status(400).json({ error: 'Empty audio payload.' });
                }
                const buffer = Buffer.concat(chunks);
                const mimeType = req.headers['content-type'] || 'application/octet-stream';
                const { audioUrl, audioExpiresAt } = await newsAudioService.attachAudioToPost({
                    postId: req.params.id,
                    buffer,
                    mimeType
                });
                res.status(201).json({ audioUrl, audioExpiresAt });
            } catch (error) {
                res.status(error.statusCode || 500).json({ error: error.message });
            }
        });
    } catch (error) {
        res.status(error.statusCode || 500).json({ error: error.message });
    }
});

// POST /api/news/follow/:userId - follow or unfollow a user (verified users only)
router.post('/follow/:userId', requireVerifiedUser, async (req, res) => {
    try {
        const { follow } = req.body || {};
        const result = await newsService.setFollow({
            userId: req.user.id,
            targetUserId: req.params.userId,
            follow: follow !== false
        });
        res.json(result);
    } catch (error) {
        res.status(error.statusCode || 500).json({ error: error.message });
    }
});

// GET /api/news/following - list users the current user follows
router.get('/following', async (req, res) => {
    try {
        const following = await newsService.getFollowing(req.user.id);
        res.json(following);
    } catch (error) {
        res.status(error.statusCode || 500).json({ error: error.message });
    }
});

// GET /api/news/feed - personalized news feed
router.get('/feed', async (req, res) => {
    try {
        const { limit, includePosts, includeIdeas, includePlans } = req.query;
        const feed = await newsService.getFeedForUser({
            userId: req.user.id,
            limit: limit ? parseInt(limit, 10) || 50 : 50,
            includePosts: includePosts !== 'false',
            includeIdeas: includeIdeas !== 'false',
            includePlans: includePlans !== 'false'
        });
        res.json(feed);
    } catch (error) {
        res.status(error.statusCode || 500).json({ error: error.message });
    }
});

// POST /api/news/cleanup-audio - best-effort cleanup of expired audio (admin/maintenance)
router.post('/cleanup-audio', async (req, res) => {
    if (!config.features.newsAudio) {
        return res.status(404).json({ error: 'News audio is not enabled.' });
    }

    try {
        const result = await newsAudioService.cleanupExpiredAudio();
        res.json(result);
    } catch (error) {
        res.status(error.statusCode || 500).json({ error: error.message });
    }
});

module.exports = router;


