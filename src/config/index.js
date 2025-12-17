/**
 * Application Configuration
 */

module.exports = {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development',
    features: {
        // Enable dev/testing of news audio uploads. Keep false in production until you're ready.
        newsAudio: process.env.FEATURE_NEWS_AUDIO === 'true'
    },
    uploads: {
        // Base folder for uploaded files (relative to project root when used from server.js)
        baseDir: process.env.UPLOADS_DIR || 'uploads',
        newsAudioSubdir: 'news-audio',
        // Default retention for news audio in days
        newsAudioRetentionDays: parseInt(process.env.NEWS_AUDIO_RETENTION_DAYS || '2', 10),
        // Maximum allowed size for a single news audio upload in bytes (default ~512KB)
        newsAudioMaxBytes: parseInt(process.env.NEWS_AUDIO_MAX_BYTES || '524288', 10)
    }
};

