/**
 * Referendums Page - core implementation
 * Standalone file so we don't depend on pages-extended.js.
 *
 * Features:
 * - Lists all referendum questions
 * - Shows details and perspectives for a selected question
 * - Lets verified users add a perspective and upvote existing ones
 */

window.App = window.App || {};
App.pages = App.pages || {};

try {
    if (typeof App.logClientEvent === 'function') {
        App.logClientEvent('info', 'referendums-page.js loaded (standalone)', {});
    }
} catch (e) {
    // ignore debug errors
}

App.pages.referendums = async function () {
    const content = document.getElementById('content');

    // Require sign-in for participation
    if (!App.authUser) {
        content.innerHTML = `
            <header class="page-header">
                <h1 class="page-title">📑 Referendums</h1>
            </header>
            <div class="card">
                <div class="card-body">
                    <p class="empty-text">
                        Please sign in to view and participate in referendum questions.
                    </p>
                    <button class="btn btn-secondary btn-sm" id="ref-signin-btn">
                        Sign in
                    </button>
                </div>
            </div>
        `;
        const btn = document.getElementById('ref-signin-btn');
        if (btn && typeof App.showAuthModal === 'function') {
            btn.addEventListener('click', () => App.showAuthModal('login'));
        }
        return;
    }

    try {
        if (typeof App.logClientEvent === 'function') {
            App.logClientEvent('info', 'App.pages.referendums rendering', {
                userId: App.authUser && App.authUser.id
            });
        }
    } catch (e) {
        // ignore
    }

    content.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    try {
        const referendums = await App.api('/referendums');
        const hasAny = Array.isArray(referendums) && referendums.length > 0;

        content.innerHTML = `
            <header class="page-header">
                <h1 class="page-title">📑 Referendums</h1>
                <p class="page-subtitle">
                    Explore questions, read perspectives, and add your voice.
                </p>
            </header>

            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">Create a Referendum</h3>
                </div>
                <div class="card-body">
                    <p class="card-subtitle" style="margin-bottom: 8px;">
                        Any verified member can propose a new question. Your riding/location is used automatically
                        for riding-level questions.
                    </p>
                    <form id="create-ref-form" class="auth-form">
                        <label>
                            <span>Title</span>
                            <input type="text" id="create-ref-title" class="form-input" required
                                placeholder="Should we adopt ranked-choice voting for party leadership?">
                        </label>
                        <label>
                            <span>Description</span>
                            <textarea id="create-ref-body" class="form-textarea" rows="3" required
                                placeholder="Explain what this referendum is about..."></textarea>
                        </label>
                        <label>
                            <span>Scope</span>
                            <select id="create-ref-scope" class="form-select">
                                <option value="national">National (all members)</option>
                                <option value="province">Province-wide</option>
                                <option value="riding">Riding-level (uses your profile location)</option>
                            </select>
                        </label>
                        <button type="submit" class="btn btn-primary btn-sm">Create referendum</button>
                        <div id="create-ref-feedback" class="profile-resume-feedback"></div>
                    </form>
                </div>
            </div>

            <div class="cards-grid" style="margin-top: 16px;">
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Questions</h3>
                    </div>
                    <div class="card-body">
                        ${
                            hasAny
                                ? `
                            <div id="ref-list">
                                ${referendums
                                    .map(
                                        (q) => `
                                    <div class="list-item" data-ref-id="${q.id}">
                                        <div class="list-item-title">${q.title}</div>
                                        <div class="list-item-meta">
                                            <span>${q.locationName || q.scope || 'All members'}</span>
                                            <span class="list-item-stat">${q.argumentCount || 0} perspectives</span>
                                        </div>
                                    </div>
                                `
                                    )
                                    .join('')}
                            </div>
                        `
                                : '<p class="empty-text">No referendums yet. An admin can seed sample questions.</p>'
                        }
                    </div>
                </div>

                <div class="card" id="ref-detail-card" style="grid-column: span 2;">
                    <div class="card-body" id="ref-detail-body">
                        ${
                            hasAny
                                ? '<p class="empty-text">Select a question on the left to see details.</p>'
                                : '<p class="empty-text">When questions are available, you will see full details here.</p>'
                        }
                    </div>
                </div>
            </div>
        `;

        const listEl = document.getElementById('ref-list');
        const detailBody = document.getElementById('ref-detail-body');

        // Wire "Create Referendum" form
        const createForm = document.getElementById('create-ref-form');
        const createTitle = document.getElementById('create-ref-title');
        const createBody = document.getElementById('create-ref-body');
        const createScope = document.getElementById('create-ref-scope');
        const createFeedback = document.getElementById('create-ref-feedback');

        if (createForm && createTitle && createBody && createScope && createFeedback) {
            createForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                createFeedback.textContent = '';
                createFeedback.classList.remove('error', 'success');

                const title = (createTitle.value || '').trim();
                const body = (createBody.value || '').trim();
                const scope = createScope.value || 'national';

                if (!title || !body) {
                    createFeedback.textContent = 'Please provide both a title and description.';
                    createFeedback.classList.add('error');
                    return;
                }

                const submitBtn = createForm.querySelector('button[type="submit"]');
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.textContent = 'Creating...';
                }

                try {
                    const { response, data } = await App.apiPost('/referendums', {
                        title,
                        body,
                        scope
                    });

                    if (!response.ok) {
                        createFeedback.textContent =
                            (data && data.error) ||
                            'Unable to create referendum. Make sure your email is verified and your profile location is set for riding-level questions.';
                        createFeedback.classList.add('error');
                    } else {
                        createFeedback.textContent = 'Referendum created.';
                        createFeedback.classList.add('success');
                        createForm.reset();
                        // Reload page so the new question appears in the list
                        App.pages.referendums();
                    }
                } catch (err) {
                    createFeedback.textContent =
                        err.message || 'Unable to create referendum right now.';
                    createFeedback.classList.add('error');
                } finally {
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Create referendum';
                    }
                }
            });
        }

        if (!hasAny) {
            return;
        }

        const loadDetail = async (id) => {
            if (!id) return;

            detailBody.innerHTML =
                '<div class="loading"><div class="spinner"></div></div>';

            try {
                const [ref, args] = await Promise.all([
                    App.api(`/referendums/${encodeURIComponent(id)}`),
                    App.api(`/referendums/${encodeURIComponent(id)}/arguments`).catch(
                        () => []
                    )
                ]);

                const pro = args.filter((a) => a.side === 'pro');
                const con = args.filter((a) => a.side === 'con');
                const neutral = args.filter((a) => a.side === 'neutral');

                detailBody.innerHTML = `
                    <header class="page-header">
                        <h2 class="page-title">${ref.title}</h2>
                        <p class="page-subtitle">
                            ${ref.locationName || ref.scope || 'All members'}
                            ${
                                ref.createdAt
                                    ? ' • opened ' + App.formatDate(ref.createdAt)
                                    : ''
                            }
                        </p>
                    </header>
                    <div class="referendum-detail">
                        <div class="detail-section">
                            <h3>Question</h3>
                            <p class="detail-body">${ref.body || ''}</p>
                        </div>
                        <div class="cards-grid">
                            <div class="card">
                                <div class="card-header">
                                    <h3 class="card-title">👍 In Favour</h3>
                                </div>
                                <div class="card-body">
                                    ${
                                        pro.length
                                            ? pro
                                                  .map(
                                                      (a) => `
                                        <div class="argument-card">
                                            <div class="argument-body">${a.body}</div>
                                            <div class="argument-meta">
                                                <span>${a.displayName}</span>
                                                ${
                                                    a.createdAt
                                                        ? ' • ' +
                                                          App.formatDate(a.createdAt)
                                                        : ''
                                                }
                                                <button class="btn btn-secondary btn-xs ref-upvote-btn" data-arg-id="${
                                                    a.id
                                                }">
                                                    👍 ${a.votes}
                                                </button>
                                            </div>
                                        </div>
                                    `
                                                  )
                                                  .join('')
                                            : '<p class="empty-text">No perspectives yet.</p>'
                                    }
                                </div>
                            </div>
                            <div class="card">
                                <div class="card-header">
                                    <h3 class="card-title">👎 Opposed</h3>
                                </div>
                                <div class="card-body">
                                    ${
                                        con.length
                                            ? con
                                                  .map(
                                                      (a) => `
                                        <div class="argument-card">
                                            <div class="argument-body">${a.body}</div>
                                            <div class="argument-meta">
                                                <span>${a.displayName}</span>
                                                ${
                                                    a.createdAt
                                                        ? ' • ' +
                                                          App.formatDate(a.createdAt)
                                                        : ''
                                                }
                                                <button class="btn btn-secondary btn-xs ref-upvote-btn" data-arg-id="${
                                                    a.id
                                                }">
                                                    👍 ${a.votes}
                                                </button>
                                            </div>
                                        </div>
                                    `
                                                  )
                                                  .join('')
                                            : '<p class="empty-text">No perspectives yet.</p>'
                                    }
                                </div>
                            </div>
                            <div class="card">
                                <div class="card-header">
                                    <h3 class="card-title">🤔 Neutral / Questions</h3>
                                </div>
                                <div class="card-body">
                                    ${
                                        neutral.length
                                            ? neutral
                                                  .map(
                                                      (a) => `
                                        <div class="argument-card">
                                            <div class="argument-body">${a.body}</div>
                                            <div class="argument-meta">
                                                <span>${a.displayName}</span>
                                                ${
                                                    a.createdAt
                                                        ? ' • ' +
                                                          App.formatDate(a.createdAt)
                                                        : ''
                                                }
                                                <button class="btn btn-secondary btn-xs ref-upvote-btn" data-arg-id="${
                                                    a.id
                                                }">
                                                    👍 ${a.votes}
                                                </button>
                                            </div>
                                        </div>
                                    `
                                                  )
                                                  .join('')
                                            : '<p class="empty-text">No perspectives yet.</p>'
                                    }
                                </div>
                            </div>
                        </div>

                        <div class="card" style="margin-top: 16px;">
                            <div class="card-header">
                                <h3 class="card-title">Add Your Perspective</h3>
                            </div>
                            <div class="card-body">
                                <form id="ref-arg-form">
                                    <div class="form-group">
                                        <label>Side</label>
                                        <select id="ref-arg-side" class="form-select">
                                            <option value="pro">👍 In favour</option>
                                            <option value="con">👎 Opposed</option>
                                            <option value="neutral">🤔 Neutral / Question</option>
                                        </select>
                                    </div>
                                    <div class="form-group">
                                        <label>Your perspective</label>
                                        <textarea id="ref-arg-body" class="form-input" rows="3" required></textarea>
                                    </div>
                                    <div class="form-group">
                                        <label>How your name appears</label>
                                        <select id="ref-arg-visibility" class="form-select">
                                            <option value="PUBLIC">Show my name</option>
                                            <option value="PSEUDO">Use a shorter version of my name</option>
                                            <option value="ANON">Anonymous member</option>
                                        </select>
                                    </div>
                                    <button type="submit" class="btn btn-primary btn-sm">Post perspective</button>
                                    <div id="ref-arg-feedback" class="profile-resume-feedback"></div>
                                </form>
                            </div>
                        </div>
                    </div>
                `;

                // Wire add argument form
                const argForm = document.getElementById('ref-arg-form');
                const sideEl = document.getElementById('ref-arg-side');
                const bodyEl = document.getElementById('ref-arg-body');
                const visEl = document.getElementById('ref-arg-visibility');
                const feedbackEl = document.getElementById('ref-arg-feedback');

                if (argForm && sideEl && bodyEl && visEl && feedbackEl) {
                    argForm.addEventListener('submit', async (e) => {
                        e.preventDefault();
                        feedbackEl.textContent = '';
                        feedbackEl.classList.remove('error', 'success');

                        const text = (bodyEl.value || '').trim();
                        if (!text) {
                            feedbackEl.textContent =
                                'Please enter your perspective before submitting.';
                            feedbackEl.classList.add('error');
                            return;
                        }

                        try {
                            const { response, data } = await App.apiPost(
                                `/referendums/${encodeURIComponent(id)}/arguments`,
                                {
                                    side: sideEl.value,
                                    body: text,
                                    visibility: visEl.value
                                }
                            );
                            if (!response.ok) {
                                feedbackEl.textContent =
                                    (data && data.error) ||
                                    'Unable to post perspective right now.';
                                feedbackEl.classList.add('error');
                            } else {
                                feedbackEl.textContent = 'Perspective added.';
                                feedbackEl.classList.add('success');
                                bodyEl.value = '';
                                // Reload details so the new argument appears
                                loadDetail(id);
                            }
                        } catch (err) {
                            feedbackEl.textContent =
                                err.message || 'Unable to post perspective.';
                            feedbackEl.classList.add('error');
                        }
                    });
                }

                // Wire upvote buttons
                detailBody.addEventListener('click', async (e) => {
                    const btn = e.target.closest('.ref-upvote-btn');
                    if (!btn) return;
                    const argId = btn.getAttribute('data-arg-id');
                    if (!argId) return;
                    btn.disabled = true;
                    try {
                        const { response, data } = await App.apiPost(
                            `/referendums/${encodeURIComponent(
                                id
                            )}/arguments/${encodeURIComponent(argId)}/upvote`,
                            {}
                        );
                        if (!response.ok) {
                            alert(
                                (data && data.error) ||
                                    'Unable to support this perspective right now.'
                            );
                        } else {
                            // Reload to show updated vote counts
                            loadDetail(id);
                        }
                    } catch (err) {
                        alert(err.message || 'Unable to support this perspective.');
                    } finally {
                        btn.disabled = false;
                    }
                });
            } catch (err) {
                detailBody.innerHTML = `
                    <div class="card">
                        <div class="card-body">
                            <p class="empty-text">Error loading referendum details: ${err.message}</p>
                        </div>
                    </div>
                `;
            }
        };

        // Wire list click handlers
        listEl.addEventListener('click', (e) => {
            const item = e.target.closest('.list-item[data-ref-id]');
            if (!item) return;
            listEl
                .querySelectorAll('.list-item')
                .forEach((el) => el.classList.remove('selected'));
            item.classList.add('selected');
            const id = item.getAttribute('data-ref-id');
            loadDetail(id);
        });

        // Auto-select first referendum
        const first = referendums[0];
        const firstItem = listEl.querySelector('.list-item[data-ref-id]');
        if (first && firstItem) {
            firstItem.classList.add('selected');
            loadDetail(first.id);
        }
    } catch (err) {
        content.innerHTML = `
            <header class="page-header">
                <h1 class="page-title">📑 Referendums</h1>
            </header>
            <div class="card">
                <div class="card-body">
                    <p class="empty-text">Error loading referendums: ${err.message}</p>
                </div>
            </div>
        `;
    }
};


