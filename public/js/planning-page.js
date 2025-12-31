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

    const isVerified = !!App.authUser.verified;

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

            const status = activeSession.status || 'draft';
            const cycleStart = activeSession.cycleStart || activeSession.createdAt || null;
            const cycleEnd = activeSession.cycleEnd || null;

            // Build a time-based timeline from start → end with milestones (plan, issues, goals, actions)
            const toMs = (d) => (d ? new Date(d).getTime() : null);

            const timelineEvents = [];

            if (cycleStart) {
                timelineEvents.push({
                    kind: 'plan',
                    label: 'Plan start',
                    date: cycleStart,
                    color: '#0d6efd'
                });
            } else if (activeSession.createdAt) {
                timelineEvents.push({
                    kind: 'plan',
                    label: 'Plan created',
                    date: activeSession.createdAt,
                    color: '#0d6efd'
                });
            }

            if (cycleEnd) {
                timelineEvents.push({
                    kind: 'plan',
                    label: 'Planned end',
                    date: cycleEnd,
                    color: '#6c757d'
                });
            }

            issues.forEach((i) => {
                if (i.createdAt) {
                    timelineEvents.push({
                        kind: 'issue',
                        label: `Issue: ${i.title}`,
                        date: i.createdAt,
                        color: '#198754'
                    });
                }
            });

            goals.forEach((g) => {
                const when = g.dueDate || g.createdAt;
                if (when) {
                    timelineEvents.push({
                        kind: 'goal',
                        label: `Goal: ${g.title}`,
                        date: when,
                        color: '#fd7e14'
                    });
                }
            });

            actions.forEach((a) => {
                const when = a.dueDate || a.createdAt;
                if (when) {
                    timelineEvents.push({
                        kind: 'action',
                        label: `Action: ${a.description}`,
                        date: when,
                        color: '#20c997'
                    });
                }
            });

            // Compute timeline bounds
            let startMs = toMs(cycleStart || activeSession.createdAt);
            let endMs = toMs(cycleEnd);

            // If there is no explicit projected end date from the backend,
            // assume a reasonable horizon (e.g., ~6 months) so early events
            // stay close together near the left while the right side still
            // represents "future" plan time.
            if (!endMs && startMs) {
                const SIX_MONTHS_MS = 1000 * 60 * 60 * 24 * 30 * 6;
                endMs = startMs + SIX_MONTHS_MS;
            }

            // Add a "today" marker so players can see where they are in the plan
            const now = new Date();
            const nowMs = now.getTime();
            if (startMs && endMs && nowMs >= startMs && nowMs <= endMs) {
                timelineEvents.push({
                    kind: 'today',
                    label: 'Today',
                    date: now.toISOString(),
                    color: '#dc3545'
                });
            }

            // Precompute numeric timestamps for events (used when placing dots)
            timelineEvents.forEach((ev) => {
                ev._ms = toMs(ev.date);
            });

            let timelineHtml = '';
            if (startMs && endMs && endMs > startMs && timelineEvents.length) {
                // Ensure there is always a dot at the far right that represents
                // the end of the Strategic Plan. If the backend did not provide
                // an explicit cycleEnd, add a synthetic "Projected end" event
                // pinned to the computed endMs.
                if (!cycleEnd) {
                    timelineEvents.push({
                        kind: 'plan',
                        label: 'Projected end',
                        date: new Date(endMs).toISOString(),
                        color: '#6c757d',
                        _ms: endMs
                    });
                }

                const eventsHtml = timelineEvents
                    .filter((ev) => ev._ms)
                    .map((ev) => {
                        const ratio = (ev._ms - startMs) / (endMs - startMs);
                        const clamped = Math.max(0, Math.min(1, ratio || 0));
                        const leftPct = (clamped * 100).toFixed(1);
                        const safeLabel = ev.label.replace(/"/g, '&quot;');
                        const dateLabel = App.formatDate(ev.date);
                        return `
                            <div class="planning-timeline-event" style="position: absolute; top: 0; left: ${leftPct}%; transform: translateX(-50%);">
                                <div 
                                    class="planning-timeline-dot"
                                    style="width: 12px; height: 12px; border-radius: 999px; background: ${ev.color}; border: 2px solid #ffffff; box-shadow: 0 0 0 2px rgba(0,0,0,0.1); cursor: default;"
                                    title="${safeLabel} • ${dateLabel}"
                                ></div>
                            </div>
                        `;
                    })
                    .join('');

                timelineHtml = `
                    <div class="planning-timeline" style="margin-bottom: 16px;">
                        <div class="planning-timeline-label-row" style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px;">
                            <span class="planning-timeline-title" style="font-weight: 500; font-size: 0.9rem;">Plan timeline</span>
                            ${
                                cycleStart && cycleEnd
                                    ? `<span class="planning-timeline-dates" style="font-size: 0.8rem; color: #6c757d;">
                                            ${App.formatDate(cycleStart)} → ${App.formatDate(cycleEnd)}
                                       </span>`
                                    : ''
                            }
                        </div>
                        <div class="planning-timeline-track" style="position: relative; height: 26px;">
                            <div style="position: absolute; top: 11px; left: 0; right: 0; height: 4px; border-radius: 999px; background: linear-gradient(90deg, #198754, #0d6efd); opacity: 0.3;"></div>
                            ${eventsHtml}
                        </div>
                    </div>
                `;
            }

            // Group comments by section for display (session-level vs per-issue)
            const commentsByIssue = {};
            const sessionComments = [];
            comments.forEach((c) => {
                if (c.section === 'issue' && c.sectionItemId) {
                    if (!commentsByIssue[c.sectionItemId]) {
                        commentsByIssue[c.sectionItemId] = [];
                    }
                    commentsByIssue[c.sectionItemId].push(c);
                } else {
                    sessionComments.push(c);
                }
            });

            sessionContainer.innerHTML = `
                <div class="card">
                    <div class="card-header">
                        <div>
                            <h3 class="card-title">${activeSession.title || 'Strategic Plan'}</h3>
                            <p class="page-subtitle">
                                For <strong>${locName}</strong> • Status: <strong>${status}</strong>
                            </p>
                        </div>
                    </div>
                    <div class="card-body">
                        ${timelineHtml}
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
                                                .map((i) => {
                                                    const issueComments = commentsByIssue[i.id] || [];
                                                    return `
                                                        <li class="simple-list-item">
                                                            <div class="simple-list-main">
                                                                <span class="simple-list-name">${i.title}</span>
                                                                <span class="simple-list-meta">
                                                                    ${i.description || ''}
                                                                </span>
                                                                <div class="simple-list-meta">
                                                                    Supporters: ${
                                                                        typeof i.votes === 'number'
                                                                            ? i.votes
                                                                            : 0
                                                                    }
                                                                </div>
                                                                ${
                                                                    issueComments.length
                                                                        ? `
                                                                    <ul class="simple-sublist">
                                                                        ${issueComments
                                                                            .map(
                                                                                (c) => `
                                                                            <li class="simple-list-item">
                                                                                <span class="simple-list-meta">
                                                                                    ${c.text}
                                                                                    ${
                                                                                        c.createdAt
                                                                                            ? ' • ' +
                                                                                              App.formatDate(
                                                                                                  c.createdAt
                                                                                              )
                                                                                            : ''
                                                                                    }
                                                                                </span>
                                                                            </li>
                                                                        `
                                                                            )
                                                                            .join('')}
                                                                    </ul>
                                                                `
                                                                        : ''
                                                                }
                                                                <form class="auth-form planning-issue-comment-form" data-issue-id="${
                                                                    i.id
                                                                }" style="margin-top: 8px;">
                                                                    <label>
                                                                        <span>Add a comment on this issue</span>
                                                                        <textarea class="form-textarea planning-issue-comment-text" rows="2"></textarea>
                                                                    </label>
                                                                    <button type="submit" class="btn btn-secondary btn-xs">
                                                                        Comment on issue
                                                                    </button>
                                                                </form>
                                                            </div>
                                                            <div class="simple-list-actions">
                                                                <button 
                                                                    type="button" 
                                                                    class="btn btn-secondary btn-xs planning-issue-support-btn"
                                                                    data-issue-id="${i.id}"
                                                                >
                                                                    Support${
                                                                        typeof i.votes === 'number'
                                                                            ? ` (${i.votes})`
                                                                            : ''
                                                                    }
                                                                </button>
                                                            </div>
                                                        </li>
                                                    `;
                                                })
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
                                        sessionComments.length
                                            ? `
                                        <ul class="simple-list">
                                            ${sessionComments
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
                                            <span>New general comment about this plan</span>
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

            // Wire up "Support" buttons for issues (likes)
            const supportButtons = sessionContainer.querySelectorAll(
                '.planning-issue-support-btn'
            );
            supportButtons.forEach((btn) => {
                btn.addEventListener('click', async () => {
                    if (!isVerified) {
                        alert('Please verify your email to support issues in a Strategic Plan.');
                        return;
                    }

                    const issueId = btn.getAttribute('data-issue-id');
                    if (!issueId) return;

                    btn.disabled = true;
                    const originalText = btn.textContent;
                    btn.textContent = 'Supporting...';

                    try {
                        const { response, data } = await App.apiPost(
                            `/strategic-sessions/${encodeURIComponent(
                                activeSession.id
                            )}/issues/${encodeURIComponent(issueId)}/vote`,
                            {}
                        );
                        if (!response.ok) {
                            alert(data && data.error ? data.error : 'Could not support this issue.');
                            return;
                        }
                        // Reload to refresh counts
                        loadForCurrentSelection();
                    } catch (err) {
                        alert(err.message || 'Unable to support this issue.');
                    } finally {
                        btn.disabled = false;
                        btn.textContent = originalText;
                    }
                });
            });

            // Wire up per-issue comment forms
            const issueCommentForms = sessionContainer.querySelectorAll(
                '.planning-issue-comment-form'
            );
            issueCommentForms.forEach((form) => {
                form.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const issueId = form.getAttribute('data-issue-id');
                    const textArea = form.querySelector('.planning-issue-comment-text');
                    if (!issueId || !textArea) return;
                    const text = (textArea.value || '').trim();
                    if (!text) return;

                    if (!isVerified) {
                        alert('Please verify your email to comment on issues in a Strategic Plan.');
                        return;
                    }

                    const submitBtn = form.querySelector('button[type="submit"]');
                    if (submitBtn) {
                        submitBtn.disabled = true;
                        submitBtn.textContent = 'Saving...';
                    }

                    try {
                        const { response, data } = await App.apiPost(
                            `/strategic-sessions/${encodeURIComponent(activeSession.id)}/comments`,
                            {
                                text,
                                section: 'issue',
                                sectionItemId: issueId
                            }
                        );
                        if (!response.ok) {
                            alert(
                                data && data.error
                                    ? data.error
                                    : 'Could not add a comment for this issue.'
                            );
                            return;
                        }
                        textArea.value = '';
                        loadForCurrentSelection();
                    } catch (err) {
                        alert(err.message || 'Unable to add a comment for this issue.');
                    } finally {
                        if (submitBtn) {
                            submitBtn.disabled = false;
                            submitBtn.textContent = 'Comment on issue';
                        }
                    }
                });
            });

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


