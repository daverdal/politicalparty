const fs = require('fs');
const path = require('path');
const { getDriver, getDatabase } = require('../config/db');
const config = require('../config');

function getNewsAudioDir() {
    const base = config.uploads?.baseDir || 'uploads';
    const sub = config.uploads?.newsAudioSubdir || 'news-audio';
    const dir = path.join(process.cwd(), base, sub);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
}

function getRetentionDays() {
    const days = config.uploads?.newsAudioRetentionDays || 2;
    return Number.isFinite(days) && days > 0 ? days : 2;
}

async function attachAudioToPost({ postId, buffer, mimeType }) {
    const dir = getNewsAudioDir();
    const maxBytes = config.uploads?.newsAudioMaxBytes || 524288;

    if (buffer && buffer.length > maxBytes) {
        const err = new Error('Audio file is too large.');
        err.statusCode = 413;
        throw err;
    }
    const ext = mimeType === 'audio/webm' ? 'webm' : 'dat';
    const fileName = `${postId}_${Date.now()}.${ext}`;
    const filePath = path.join(dir, fileName);

    await fs.promises.writeFile(filePath, buffer);

    const relativePath = path.join(config.uploads.baseDir || 'uploads', config.uploads.newsAudioSubdir || 'news-audio', fileName);
    const retentionDays = getRetentionDays();
    const expiresAt = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000).toISOString();

    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });

    try {
        await session.run(
            `
            MATCH (p:NewsPost {id: $postId})
            SET p.audioUrl = $audioUrl,
                p.audioMimeType = $mimeType,
                p.audioExpiresAt = datetime($expiresAt)
            RETURN p
        `,
            {
                postId,
                audioUrl: `/${relativePath.replace(/\\/g, '/')}`,
                mimeType,
                expiresAt
            }
        );

        const audioUrl = `/${relativePath.replace(/\\/g, '/')}`;
        if (config.env !== 'test') {
            console.log(
                `[newsAudio] Attached audio to post ${postId} → ${audioUrl}, expires ${expiresAt}`
            );
        }

        return {
            audioUrl,
            audioExpiresAt: expiresAt
        };
    } finally {
        await session.close();
    }
}

async function cleanupExpiredAudio() {
    const dir = getNewsAudioDir();
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });

    try {
        const result = await session.run(
            `
            MATCH (p:NewsPost)
            WHERE p.audioExpiresAt < datetime()
            RETURN p.id AS id, p.audioUrl AS audioUrl
        `
        );

        const records = result.records || [];
        for (const record of records) {
            const postId = record.get('id');
            const audioUrl = record.get('audioUrl');
            if (audioUrl) {
                const relPath = audioUrl.replace(/^\//, '');
                const fullPath = path.join(process.cwd(), relPath);
                try {
                    if (fullPath.startsWith(dir) && fs.existsSync(fullPath)) {
                        await fs.promises.unlink(fullPath);
                    }
                } catch (e) {
                    // best-effort; ignore file errors
                }
            }

            await session.run(
                `
                MATCH (p:NewsPost {id: $postId})
                REMOVE p.audioUrl, p.audioMimeType, p.audioExpiresAt
            `,
                { postId }
            );
        }

        if (config.env !== 'test') {
            console.log(`[newsAudio] Cleanup removed ${records.length} expired audio entrie(s).`);
        }

        return { removed: records.length };
    } finally {
        await session.close();
    }
}

module.exports = {
    attachAudioToPost,
    cleanupExpiredAudio
};


