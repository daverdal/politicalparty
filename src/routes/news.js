/**
 * News Routes
 * - User news posts
 * - Follow relationships
 * - Personalized news feed
 */

const express = require('express');
const router = express.Router();

const newsService = require('../services/newsService');
const { authenticate } = require('../middleware/auth');

// All news routes require an authenticated user
router.use(authenticate);

// POST /api/news/posts - create a new news post
router.post('/posts', async (req, res) => {
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

// POST /api/news/follow/:userId - follow or unfollow a user
router.post('/follow/:userId', async (req, res) => {
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

module.exports = router;


