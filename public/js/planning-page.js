/**
 * Strategic Planning Page - core implementation
 * Lightweight, standalone version that does not depend on pages-extended.js.
 *
 * Features:
 * - Uses the user's saved locations from Profile
 * - One active Strategic Plan per location
 * - Shows active plan summary (title, status, issues, comments)
 * - Lets verified users start a new plan, add issues, and add comments
 */

window.App = window.App || {};
App.pages = App.pages || {};

App.pages.planning = async function () {
    const content = document.getElementById('content');

    // Require sign-in for Planning
    if (!App.authUser) {
        content.innerHTML = `
            <header class="page-header">
                <h1 class="page-title">📋 Strategic Planning</h1>
            </header>
            <div class="card">
                <div class="card-body">
                    <p class="empty-text">
                        Please sign in to view and participate in Strategic Plans.
                    </p>
                    <button class="btn btn-secondary btn-sm" id="planning-signin-btn">
                        Sign in
                    </button>
                </div>
            </div>
        `;
        const btn = document.getElementById('planning-signin-btn');
        if (btn && typeof App.showAuthModal === 'function') {
            btn.addEventListener('click', () => App.showAuthModal('login'));
        }
        return;
    }

    content.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    // Map backend location types -> REST path segments
    const typeToPath = {
        Country: 'countries',
        Province: 'provinces',
        FederalRiding: 'federal-ridings',
        ProvincialRiding: 'provincial-ridings',
        Town: 'towns',
        FirstNation: 'first-nations',
        AdhocGroup: 'adhoc-groups'
    };

    const typeToLabel = {
        Country: 'Country',
        Province: 'Province',
        FederalRiding: 'Federal Riding',
        ProvincialRiding: 'Provincial Riding',
        Town: 'Town',
        FirstNation: 'First Nation',
        AdhocGroup: 'Ad-hoc Group'
    };

    try {
        const userId = App.authUser.id;
        const userDetails = await App.api(`/users/${encodeURIComponent(userId)}`);
        const locations = userDetails.locations || [];

        if (!locations.length) {
            content.innerHTML = `
                <header class="page-header">
                    <h1 class="page-title">📋 Strategic Planning</h1>
                </header>
                <div class="card">
                    <div class="card-body">
                        <p class="empty-text">
                            You do not have any locations set yet. Go to <strong>My Profile</strong> and add your
                            First Nation, Federal Riding, Provincial Riding, Town, or Ad-hoc Group to begin planning.
                        </p>
                    </div>
                </div>
            `;
            return;
        }

        // Remember last-selected location while navigating
        App.planningState = App.planningState || {};
        if (!App.planningState.selectedLocation) {
            const first = locations[0];
            App.planningState.selectedLocation = {
                id: first.id,
                type: first.type,
                name: first.name
            };
        }

        const selected = App.planningState.selectedLocation;

        const buildLocationOptions = () =>
            locations
                .map((loc) => {
                    const label = typeToLabel[loc.type] || loc.type || 'Location';
                    const isSelected = selected && selected.id === loc.id && selected.type === loc.type;
                    return `
                        <option 
                            value="${loc.id}" 
                            data-type="${loc.type}"
                            ${isSelected ? 'selected' : ''}
                        >
                            ${loc.name} (${label})
                        </option>
                    `;
                })
                .join('');

        content.innerHTML = `
            <header class="page-header">
                <h1 class="page-title">📋 Strategic Planning</h1>
                <p class="page-subtitle">
                    One active Strategic Plan per location. Start a plan for any of your locations
                    (Country, Province, First Nation, Federal, Provincial, Town, or Ad-hoc group).
                </p>
            </header>

            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">Select Location</h3>
                </div>
                <div class="card-body">
                    <div class="location-selector-row">
                        <label for="planning-location-select">My locations</label>
                        <select id="planning-location-select" class="form-select">
                            ${buildLocationOptions()}
                        </select>
                    </div>
                    <p class="location-help" id="planning-location-help"></p>
                </div>
            </div>

            <div id="planning-session-container">
                <div class="card">
                    <div class="card-body">
                        <div class="loading"><div class="spinner"></div></div>
                    </div>
                </div>
            </div>
        `;

        const selectEl = document.getElementById('planning-location-select');
        const helpEl = document.getElementById('planning-location-help');
        const sessionContainer = document.getElementById('planning-session-container');

        const renderSession = (locId, locType, locName, activeSession, history) => {
            const pathSegment = typeToPath[locType];
            if (!pathSegment) {
                sessionContainer.innerHTML = `
                    <div class="card">
                        <div class="card-body">
                            <p class="empty-text">Planning is not yet supported for this location type (${locType}).</p>
                        </div>
                    </div>
                `;
                return;
            }

            if (helpEl) {
                const label = typeToLabel[locType] || locType;
                helpEl.textContent = `Planning for: ${locName} – ${label}. Only one active Strategic Plan can exist for this location at a time.`;
            }

            if (!activeSession) {
                sessionContainer.innerHTML = `
                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title">No Active Plan Yet</h3>
                        </div>
                        <div class="card-body">
                            <p class="empty-text">
                                There is no active Strategic Plan for <strong>${locName}</strong> yet.
                                Start a plan to gather issues, goals, and comments from your community.
                            </p>
                            <div class="form-grid">
                                <label>
                                    <span>Plan title</span>
                                    <input type="text" id="planning-new-title" class="form-input" placeholder="e.g. 2025–2026 Strategic Plan for ${locName}">
                                </label>
                                <label>
                                    <span>Vision (optional)</span>
                                    <textarea id="planning-new-vision" class="form-textarea" rows="3" placeholder="Short vision or purpose for this plan"></textarea>
                                </label>
                            </div>
                            <button class="btn btn-primary" id="planning-create-btn">Start Strategic Plan</button>
                            <div id="planning-create-feedback" class="profile-resume-feedback"></div>
                        </div>
                    </div>
                    ${
                        history && history.length
                            ? `
                        <div class="card" style="margin-top: 16px;">
                            <div class="card-header">
                                <h3 class="card-title">Previous Plans for ${locName}</h3>
                            </div>
                            <div class="card-body">
                                <ul class="simple-list">
                                    ${history
                                        .map(
                                            (s) => `
                                        <li class="simple-list-item">
                                            <span class="simple-list-name">${s.title || 'Strategic Plan'}</span>
                                            <span class="simple-list-meta">
                                                ${s.status || 'archived'}
                                                ${
                                                    s.createdAt
                                                        ? ' • started ' + App.formatDate(s.createdAt)
                                                        : ''
                                                }
                                            </span>
                                        </li>
                                    `
                                        )
                                        .join('')}
                                </ul>
                            </div>
                        </div>
                    `
                            : ''
                    }
                `;

                const createBtn = document.getElementById('planning-create-btn');
                const titleInput = document.getElementById('planning-new-title');
                const visionInput = document.getElementById('planning-new-vision');
                const feedbackEl = document.getElementById('planning-create-feedback');

                if (createBtn && titleInput && visionInput && feedbackEl) {
                    createBtn.addEventListener('click', async () => {
                        feedbackEl.textContent = '';
                        feedbackEl.classList.remove('error', 'success');

                        const title = titleInput.value.trim();
                        const vision = visionInput.value.trim();

                        if (!title) {
                            feedbackEl.textContent = 'Please provide a title for this plan.';
                            feedbackEl.classList.add('error');
                            return;
                        }

                        createBtn.disabled = true;
                        createBtn.textContent = 'Creating...';

                        try {
                            const { response, data } = await App.apiPost(
                                `/strategic-sessions/location/${pathSegment}/${encodeURIComponent(
                                    locId
                                )}`,
                                { title, vision }
                            );

                            if (!response.ok) {
                                feedbackEl.textContent =
                                    (data && data.error) ||
                                    'Could not create plan. Make sure your email is verified.';
                                feedbackEl.classList.add('error');
                            } else {
                                feedbackEl.textContent = 'Plan created. Loading...';
                                feedbackEl.classList.add('success');
                                // Reload for this location
                                loadForCurrentSelection();
                            }
                        } catch (err) {
                            feedbackEl.textContent = err.message || 'Unable to create plan.';
                            feedbackEl.classList.add('error');
                        } finally {
                            createBtn.disabled = false;
                            createBtn.textContent = 'Start Strategic Plan';
                        }
                    });
                }

                return;
            }

            // There is an active session
            const issues = activeSession.issues || [];
            const comments = activeSession.comments || [];
            const goals = activeSession.goals || [];
            const actions = activeSession.actions || [];

            sessionContainer.innerHTML = `
                <div class="card">
                    <div class="card-header">
                        <div>
                            <h3 class="card-title">${activeSession.title || 'Strategic Plan'}</h3>
                            <p class="page-subtitle">
                                For <strong>${locName}</strong> • Status: <strong>${activeSession.status || 'draft'}</strong>
                            </p>
                        </div>
                    </div>
                    <div class="card-body">
                        <div class="profile-stats">
                            <div class="profile-stat">
                                <span class="profile-stat-value">${issues.length}</span>
                                <span class="profile-stat-label">Issues / Priorities</span>
                            </div>
                            <div class="profile-stat">
                                <span class="profile-stat-value">${goals.length}</span>
                                <span class="profile-stat-label">Goals</span>
                            </div>
                            <div class="profile-stat">
                                <span class="profile-stat-value">${actions.length}</span>
                                <span class="profile-stat-label">Actions</span>
                            </div>
                            <div class="profile-stat">
                                <span class="profile-stat-value">${comments.length}</span>
                                <span class="profile-stat-label">Comments</span>
                            </div>
                        </div>

                        <div class="cards-grid">
                            <div class="card">
                                <div class="card-header">
                                    <h3 class="card-title">Issues & Priorities</h3>
                                </div>
                                <div class="card-body">
                                    ${
                                        issues.length
                                            ? `
                                        <ul class="simple-list">
                                            ${issues
                                                .map(
                                                    (i) => `
                                                <li class="simple-list-item">
                                                    <span class="simple-list-name">${i.title}</span>
                                                    <span class="simple-list-meta">
                                                        ${i.description || ''}
                                                        ${
                                                            typeof i.votes === 'number'
                                                                ? ' • ' + i.votes + ' support'
                                                                : ''
                                                        }
                                                    </span>
                                                </li>
                                            `
                                                )
                                                .join('')}
                                        </ul>
                                    `
                                            : '<p class="empty-text">No issues added yet. Start by naming the challenges or priorities.</p>'
                                    }

                                    <form id="planning-issue-form" class="auth-form" style="margin-top: 12px;">
                                        <label>
                                            <span>New issue or priority</span>
                                            <input type="text" id="planning-issue-title" class="form-input" required>
                                        </label>
                                        <label>
                                            <span>Details (optional)</span>
                                            <textarea id="planning-issue-description" class="form-textarea" rows="2"></textarea>
                                        </label>
                                        <button type="submit" class="btn btn-primary btn-sm">Add issue</button>
                                    </form>
                                </div>
                            </div>

                            <div class="card">
                                <div class="card-header">
                                    <h3 class="card-title">Comments</h3>
                                </div>
                                <div class="card-body">
                                    ${
                                        comments.length
                                            ? `
                                        <ul class="simple-list">
                                            ${comments
                                                .map(
                                                    (c) => `
                                                <li class="simple-list-item">
                                                    <span class="simple-list-meta">
                                                        ${c.text}
                                                        ${
                                                            c.createdAt
                                                                ? ' • ' + App.formatDate(c.createdAt)
                                                                : ''
                                                        }
                                                    </span>
                                                </li>
                                            `
                                                )
                                                .join('')}
                                        </ul>
                                    `
                                            : '<p class="empty-text">No comments yet. Share thoughts, questions, or ideas.</p>'
                                    }

                                    <form id="planning-comment-form" class="auth-form" style="margin-top: 12px;">
                                        <label>
                                            <span>New comment</span>
                                            <textarea id="planning-comment-text" class="form-textarea" rows="2" required></textarea>
                                        </label>
                                        <button type="submit" class="btn btn-secondary btn-sm">Add comment</button>
                                    </form>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            const issueForm = document.getElementById('planning-issue-form');
            const issueTitleInput = document.getElementById('planning-issue-title');
            const issueDescInput = document.getElementById('planning-issue-description');

            if (issueForm && issueTitleInput) {
                issueForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const title = (issueTitleInput.value || '').trim();
                    const description = (issueDescInput.value || '').trim();
                    if (!title) return;
                    try {
                        const { response, data } = await App.apiPost(
                            `/strategic-sessions/${encodeURIComponent(activeSession.id)}/issues`,
                            { title, description }
                        );
                        if (!response.ok) {
                            alert(data && data.error ? data.error : 'Could not add issue.');
                            return;
                        }
                        issueTitleInput.value = '';
                        if (issueDescInput) issueDescInput.value = '';
                        loadForCurrentSelection();
                    } catch (err) {
                        alert(err.message || 'Unable to add issue.');
                    }
                });
            }

            const commentForm = document.getElementById('planning-comment-form');
            const commentTextInput = document.getElementById('planning-comment-text');

            if (commentForm && commentTextInput) {
                commentForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const text = (commentTextInput.value || '').trim();
                    if (!text) return;
                    try {
                        const { response, data } = await App.apiPost(
                            `/strategic-sessions/${encodeURIComponent(activeSession.id)}/comments`,
                            { text }
                        );
                        if (!response.ok) {
                            alert(data && data.error ? data.error : 'Could not add comment.');
                            return;
                        }
                        commentTextInput.value = '';
                        loadForCurrentSelection();
                    } catch (err) {
                        alert(err.message || 'Unable to add comment.');
                    }
                });
            }
        };

        const loadForCurrentSelection = async () => {
            const selectedOption = selectEl.options[selectEl.selectedIndex];
            if (!selectedOption) return;

            const locId = selectedOption.value;
            const locType = selectedOption.getAttribute('data-type');
            const locName = selectedOption.textContent.trim();

            App.planningState.selectedLocation = { id: locId, type: locType, name: locName };

            sessionContainer.innerHTML = `
                <div class="card">
                    <div class="card-body">
                        <div class="loading"><div class="spinner"></div></div>
                    </div>
                </div>
            `;

            const pathSegment = typeToPath[locType];
            if (!pathSegment) {
                renderSession(locId, locType, locName, null, []);
                return;
            }

            try {
                const [activeSession, history] = await Promise.all([
                    App.api(
                        `/strategic-sessions/location/${pathSegment}/${encodeURIComponent(
                            locId
                        )}/active`
                    ),
                    App.api(
                        `/strategic-sessions/location/${pathSegment}/${encodeURIComponent(
                            locId
                        )}/history?limit=5`
                    ).catch(() => [])
                ]);

                renderSession(locId, locType, locName, activeSession, history || []);
            } catch (err) {
                sessionContainer.innerHTML = `
                    <div class="card">
                        <div class="card-body">
                            <p class="empty-text">Error loading Strategic Plan for this location: ${err.message}</p>
                        </div>
                    </div>
                `;
            }
        };

        selectEl.addEventListener('change', () => {
            loadForCurrentSelection();
        });

        // Initial load
        await loadForCurrentSelection();
    } catch (err) {
        content.innerHTML = `
            <header class="page-header">
                <h1 class="page-title">📋 Strategic Planning</h1>
            </header>
            <div class="card">
                <div class="card-body">
                    <p class="empty-text">Error loading Strategic Planning: ${err.message}</p>
                </div>
            </div>
        `;
    }
};


