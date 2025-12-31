/**
 * News Page - core implementation
 * Standalone file so we don't depend on pages-extended.js.
 *
 * Shows:
 * - Personalized feed (posts from followed users, ideas, and plans)
 * - Simple composer for text posts (verified users)
 * - "Following" list
 */

window.App = window.App || {};
App.pages = App.pages || {};

try {
    if (typeof App.logClientEvent === 'function') {
        App.logClientEvent('info', 'news-page.js loaded (standalone)', {});
    }
} catch (e) {
    // ignore debug errors
}

App.pages.news = async function () {
    const content = document.getElementById('content');

    // Require sign-in for News
    if (!App.authUser) {
        content.innerHTML = `
            <header class="page-header">
                <h1 class="page-title">📰 News & Activity</h1>
            </header>
            <div class="card">
                <div class="card-body">
                    <p class="empty-text">
                        Please sign in to view your personalized News feed.
                    </p>
                    <button class="btn btn-secondary btn-sm" id="news-signin-btn">
                        Sign in
                    </button>
                </div>
            </div>
        `;
        const btn = document.getElementById('news-signin-btn');
        if (btn && typeof App.showAuthModal === 'function') {
            btn.addEventListener('click', () => App.showAuthModal('login'));
        }
        return;
    }

    try {
        if (typeof App.logClientEvent === 'function') {
            App.logClientEvent('info', 'App.pages.news rendering', {
                userId: App.authUser && App.authUser.id
            });
        }
    } catch (e) {
        // ignore
    }

    content.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    try {
        const [feed, following] = await Promise.all([
            App.api('/news/feed?limit=50').catch(() => []),
            App.api('/news/following').catch(() => [])
        ]);

        const isVerified = !!App.authUser.verified;

        const renderFeedItem = (item) => {
            const date = item.createdAt ? App.formatDate(item.createdAt) : '';
            if (item.kind === 'post') {
                return `
                    <div class="card" data-kind="post">
                        <div class="card-header">
                            <h3 class="card-title">📰 Post from ${item.author?.name || 'Member'}</h3>
                            <p class="card-subtitle">${date}</p>
                        </div>
                        <div class="card-body">
                            <p>${item.body || ''}</p>
                        </div>
                    </div>
                `;
            }
            if (item.kind === 'idea') {
                return `
                    <div class="card" data-kind="idea">
                        <div class="card-header">
                            <h3 class="card-title">💡 Idea from ${item.author?.name || 'Member'}</h3>
                            <p class="card-subtitle">${date}</p>
                        </div>
                        <div class="card-body">
                            <h4>${item.title || 'Idea'}</h4>
                            <p>${item.description || ''}</p>
                        </div>
                    </div>
                `;
            }
            // plan
            const locName = item.location?.name || 'Location';
            const status = item.status || 'draft';
            return `
                <div class="card" data-kind="plan">
                    <div class="card-header">
                        <h3 class="card-title">📋 Strategic Plan update</h3>
                        <p class="card-subtitle">${locName} • Status: ${status} • ${date}</p>
                    </div>
                    <div class="card-body">
                        <p class="empty-text">
                            This plan is part of Strategic Planning for ${locName}. Visit the Planning page for details.
                        </p>
                    </div>
                </div>
            `;
        };

        content.innerHTML = `
            <header class="page-header">
                <h1 class="page-title">📰 News & Activity</h1>
                <p class="page-subtitle">
                    See posts from people you follow, ideas they share, and updates from Strategic Plans in your locations.
                </p>
            </header>

            <div class="cards-grid">
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Share an update</h3>
                        <p class="card-subtitle">
                            ${
                                isVerified
                                    ? 'Write a short update for people who follow you.'
                                    : 'Verify your email to post news updates.'
                            }
                        </p>
                    </div>
                    <div class="card-body">
                        <textarea id="news-post-body" class="form-textarea" rows="3" placeholder="What would you like to share?" ${
                            isVerified ? '' : 'disabled'
                        }></textarea>
                        <button class="btn btn-primary btn-sm" id="news-post-submit" style="margin-top: 8px;" ${
                            isVerified ? '' : 'disabled'
                        }>
                            Post update
                        </button>
                        <div id="news-post-feedback" class="profile-resume-feedback">
                            ${
                                isVerified
                                    ? ''
                                    : 'You are signed in, but your email is not verified. Please verify your email to post.'
                            }
                        </div>
                    </div>
                </div>

                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">People you follow</h3>
                    </div>
                    <div class="card-body">
                        ${
                            following && following.length
                                ? `
                            <ul class="simple-list">
                                ${following
                                    .map(
                                        (u) => `
                                    <li class="simple-list-item">
                                        <span class="simple-list-name">${u.name}</span>
                                        ${
                                            u.email
                                                ? `<span class="simple-list-meta">${u.email}</span>`
                                                : ''
                                        }
                                    </li>
                                `
                                    )
                                    .join('')}
                            </ul>
                        `
                                : '<p class="empty-text">You are not following anyone yet. Use the Follow buttons on member and candidate profiles.</p>'
                        }
                    </div>
                </div>
            </div>

            <div class="card" style="margin-top: 16px;">
                <div class="card-header">
                    <h3 class="card-title">Your News Feed</h3>
                </div>
                <div class="card-body" id="news-feed-body">
                    ${
                        feed && feed.length
                            ? feed.map((item) => renderFeedItem(item)).join('')
                            : '<p class="empty-text">No activity yet. Follow some members and start a Strategic Plan to see updates here.</p>'
                    }
                </div>
            </div>
        `;

        // Wire up post composer
        const postBody = document.getElementById('news-post-body');
        const postBtn = document.getElementById('news-post-submit');
        const postFeedback = document.getElementById('news-post-feedback');

        if (postBtn && postBody && postFeedback && isVerified) {
            postBtn.addEventListener('click', async () => {
                const body = (postBody.value || '').trim();
                postFeedback.textContent = '';
                postFeedback.classList.remove('error', 'success');

                if (!body) {
                    postFeedback.textContent = 'Please enter something to post.';
                    postFeedback.classList.add('error');
                    return;
                }

                postBtn.disabled = true;
                postBtn.textContent = 'Posting...';

                try {
                    const { response, data } = await App.apiPost('/news/posts', { body });
                    if (!response.ok) {
                        postFeedback.textContent =
                            (data && data.error) || 'Unable to post update right now.';
                        postFeedback.classList.add('error');
                    } else {
                        postFeedback.textContent = 'Posted.';
                        postFeedback.classList.add('success');
                        postBody.value = '';
                        // Reload feed after posting
                        App.pages.news();
                    }
                } catch (err) {
                    postFeedback.textContent = err.message || 'Unable to post update.';
                    postFeedback.classList.add('error');
                } finally {
                    postBtn.disabled = false;
                    postBtn.textContent = 'Post update';
                }
            });
        }
    } catch (err) {
        content.innerHTML = `
            <header class="page-header">
                <h1 class="page-title">📰 News & Activity</h1>
            </header>
            <div class="card">
                <div class="card-body">
                    <p class="empty-text">Error loading News: ${err.message}</p>
                </div>
            </div>
        `;
    }
};


