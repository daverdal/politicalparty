/**
 * Admin Page - core implementation
 * Standalone, trimmed version focusing on convention admin and dev utilities.
 *
 * Only admins (server-side) can access /api/admin/* routes.
 */

window.App = window.App || {};
App.pages = App.pages || {};

try {
    if (typeof App.logClientEvent === 'function') {
        App.logClientEvent('info', 'admin-page.js loaded (standalone)', {});
    }
} catch (e) {
    // ignore debug errors
}

App.pages.admin = async function () {
    const content = document.getElementById('content');
    content.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    try {
        const [conventions, autoMode] = await Promise.all([
            App.api('/admin/conventions'),
            App.api('/admin/auto-mode')
        ]);

        // Track which convention is being managed in a small client-side state bucket
        App.adminState = App.adminState || {};
        const existingIds = new Set(conventions.map((c) => c.id));
        if (!App.adminState.selectedConventionId || !existingIds.has(App.adminState.selectedConventionId)) {
            const defaultConv =
                conventions.find((c) => c.status !== 'completed') || conventions[0] || null;
            App.adminState.selectedConventionId = defaultConv ? defaultConv.id : null;
        }

        const activeConv =
            conventions.find((c) => c.id === App.adminState.selectedConventionId) || null;

        let stats = null;
        if (activeConv) {
            try {
                stats = await App.api(
                    `/admin/convention/${encodeURIComponent(activeConv.id)}/stats`
                );
            } catch (e) {
                stats = null;
            }
        }
        const currentYear = new Date().getFullYear();

        content.innerHTML = `
            <header class="page-header">
                <h1 class="page-title">Admin Controls</h1>
                <p class="page-subtitle">Convention management and development utilities</p>
            </header>

            <div class="profile-tabs admin-tabs" style="margin-bottom: 12px;">
                <button class="profile-tab-button active" data-admin-tab="conventions">Conventions</button>
                <button class="profile-tab-button" data-admin-tab="adhoc">Ad-hoc Group Admin</button>
                <button class="profile-tab-button" data-admin-tab="all-locations">AllLocations</button>
                <button class="profile-tab-button" data-admin-tab="dev">Dev & Locations</button>
            </div>

            <div id="admin-result" class="profile-resume-feedback" style="margin-bottom: 12px;"></div>

            <div class="cards-grid">
                <div class="card" id="admin-conventions-card">
                    <div class="card-header">
                        <h3 class="card-title">📋 Conventions</h3>
                    </div>
                    <div class="card-body">
                        ${
                            conventions.length === 0
                                ? '<p class="empty-text">No conventions yet. Create one below.</p>'
                                : `
                            <p class="card-subtitle" style="margin-bottom: 8px;">
                                Click <strong>Manage</strong> on a convention below to control it.
                            </p>
                            <ul class="simple-list">
                                ${conventions
                                    .map(
                                        (c) => `
                                    <li class="simple-list-item admin-conv-item ${
                                        c.id === (activeConv && activeConv.id) ? 'selected' : ''
                                    }" data-conv-id="${c.id}">
                                        <div>
                                            <span class="simple-list-name">${c.name}</span>
                                            <span class="simple-list-meta">
                                                Year ${c.year} • ${c.status} • ${
                                            c.totalRaces || 0
                                        } races
                                            </span>
                                        </div>
                                        <button 
                                            type="button" 
                                            class="btn btn-secondary btn-xs admin-conv-manage" 
                                            data-conv-id="${c.id}">
                                            ${
                                                c.id === (activeConv && activeConv.id)
                                                    ? 'Managing'
                                                    : c.status === 'completed'
                                                    ? 'Completed'
                                                    : 'Manage'
                                            }
                                        </button>
                                    </li>
                                `
                                    )
                                    .join('')}
                            </ul>
                        `
                        }
                    </div>
                </div>

                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">➕ Create Convention</h3>
                    </div>
                    <div class="card-body">
                        <form id="admin-create-conv-form" class="auth-form">
                            <label>
                                <span>Name</span>
                                <input type="text" id="admin-new-conv-name" class="form-input"
                                    value="${currentYear + 1} National Convention" required>
                            </label>
                            <label>
                                <span>Year</span>
                                <input type="number" id="admin-new-conv-year" class="form-input"
                                    value="${currentYear + 1}" min="2020" max="2100" required>
                            </label>
                            <label>
                                <span>Start date (Wave 1 nominations)</span>
                                <input type="date" id="admin-new-conv-start" class="form-input"
                                    value="${currentYear + 1}-01-15">
                            </label>
                            <button type="submit" class="btn btn-primary btn-sm" style="margin-top: 8px;">
                                Create convention
                            </button>
                        </form>
                    </div>
                </div>

                ${
                    activeConv
                        ? `
                <div class="card" id="admin-dev-card">
                    <div class="card-header">
                        <h3 class="card-title">🎛 Active Convention Controls</h3>
                        <p class="card-subtitle">Managing: ${activeConv.name}</p>
                    </div>
                    <div class="card-body">
                        <p class="card-subtitle">Auto-mode: ${
                            autoMode.enabled ? '🤖 Enabled' : '⏸ Disabled'
                        }</p>
                        <button class="btn btn-secondary btn-sm" id="admin-auto-toggle">
                            ${autoMode.enabled ? 'Disable auto-mode' : 'Enable auto-mode'}
                        </button>
                        <hr style="margin: 12px 0;">
                        <button class="btn btn-secondary btn-sm" id="admin-advance-phase">
                            Advance to next phase
                        </button>
                        <button class="btn btn-secondary btn-sm" id="admin-create-wave-races" style="margin-left: 4px;">
                            Create races for current wave
                        </button>
                        ${
                            activeConv.status && activeConv.status.includes('-voting')
                                ? `
                        <button class="btn btn-secondary btn-sm" id="admin-start-all-voting" style="margin-left: 4px;">
                            ▶️ Start all voting
                        </button>
                        <button class="btn btn-secondary btn-sm" id="admin-close-all-rounds" style="margin-left: 4px;">
                            ⏭️ Close all rounds
                        </button>
                        `
                                : ''
                        }
                        <button class="btn btn-secondary btn-sm" id="admin-reset-conv" style="margin-left: 4px;">
                            Reset convention
                        </button>
                        ${
                            activeConv.status === 'completed'
                                ? `
                        <hr style="margin: 12px 0;">
                        <button class="btn btn-secondary btn-sm" id="admin-view-results">
                            View results
                        </button>
                        `
                                : ''
                        }
                    </div>
                </div>

                ${
                    stats
                        ? `
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">📊 Convention Overview</h3>
                        <p class="card-subtitle">
                            ${activeConv.name} (Year ${activeConv.year}) – status: ${stats.status} (wave ${
                            stats.currentWave || 0
                        })
                        </p>
                    </div>
                    <div class="card-body">
                        <ul class="simple-list">
                            <li class="simple-list-item">
                                <span class="simple-list-name">Status</span>
                                <span class="simple-list-meta">${stats.status} (wave ${
                            stats.currentWave || 0
                        })</span>
                            </li>
                            <li class="simple-list-item">
                                <span class="simple-list-name">Races</span>
                                <span class="simple-list-meta">
                                    ${stats.totalRaces} total • ${stats.openRaces} open • ${
                            stats.votingRaces
                        } voting • ${stats.closedRaces} closed
                                </span>
                            </li>
                            <li class="simple-list-item">
                                <span class="simple-list-name">Candidates</span>
                                <span class="simple-list-meta">${stats.totalCandidates}</span>
                            </li>
                            <li class="simple-list-item">
                                <span class="simple-list-name">Nominations</span>
                                <span class="simple-list-meta">${stats.totalNominations}</span>
                            </li>
                            <li class="simple-list-item">
                                <span class="simple-list-name">Votes</span>
                                <span class="simple-list-meta">${stats.totalVotes}</span>
                            </li>
                        </ul>
                    </div>
                </div>
                `
                        : ''
                }
                `
                        : ''
                }

                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">🧪 Dev Utilities</h3>
                    </div>
                    <div class="card-body">
                        <p class="card-subtitle" style="margin-bottom: 8px;">
                            Tools to keep the development database tidy. These do <strong>not</strong> run automatically.
                        </p>
                        <button class="btn btn-secondary btn-sm" id="admin-cleanup-duplicates">
                            🧹 Clean up duplicate users (same email)
                        </button>
                        <div id="cleanup-duplicates-result" class="profile-resume-feedback" style="margin-top: 8px;"></div>
                        <hr style="margin: 12px 0;">
                        <button class="btn btn-secondary btn-sm" id="admin-reset-db">
                            💣 Reset Neo4j database and re-seed
                        </button>
                    </div>
                </div>

                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">🌍 Countries & Locations</h3>
                    </div>
                    <div class="card-body">
                        <p class="card-subtitle" style="margin-bottom: 8px;">
                            Add additional countries (e.g., United States, Bangladesh) so members outside Canada can participate.
                        </p>
                        <label>
                            <span>Country ID</span>
                            <input id="admin-country-id" class="form-input" placeholder="e.g., us, bd">
                        </label>
                        <p class="form-help">
                            Short identifier used in URLs and relationships (e.g., <code>ca</code> for Canada).
                        </p>
                        <label>
                            <span>Country name</span>
                            <input id="admin-country-name" class="form-input" placeholder="e.g., United States">
                        </label>
                        <label>
                            <span>Country code (optional)</span>
                            <input id="admin-country-code" class="form-input" placeholder="e.g., US">
                        </label>
                        <p class="form-help">
                            Defaults to the uppercased ID if left blank.
                        </p>
                        <button class="btn btn-secondary btn-sm" id="admin-country-save" style="margin-top: 8px;">
                            ➕ Add / update country
                        </button>
                        <div id="admin-country-feedback" class="profile-resume-feedback" style="margin-top: 8px;"></div>
                    </div>
                </div>

                <div class="card" id="admin-adhoc-card">
                    <div class="card-header">
                        <h3 class="card-title">👥 Ad-hoc Group Admin</h3>
                    </div>
                    <div class="card-body">
                        <p class="card-subtitle" style="margin-bottom: 8px;">
                            Create Ad-hoc Groups for a province (for example, "Manitoba Policy Nerds") and optionally
                            restrict access by email domain (e.g., <code>@manitobachiefs.com</code>).
                        </p>
                        <div class="form-group" style="display:grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 8px; margin-bottom: 8px;">
                            <label>
                                <span>Country</span>
                                <select id="admin-adhoc-country-select" class="form-select">
                                    <option value="">-- Select country --</option>
                                </select>
                            </label>
                            <label>
                                <span>Province / Territory</span>
                                <select id="admin-adhoc-province-select" class="form-select">
                                    <option value="">-- Select province --</option>
                                </select>
                            </label>
                        </div>
                        <div class="form-group" style="margin-bottom: 8px;">
                            <label>
                                <span>Existing Ad-hoc Group in this province</span>
                                <select id="admin-adhoc-existing-select" class="form-select" disabled>
                                    <option value="">-- No groups yet --</option>
                                </select>
                            </label>
                        </div>
                        <label>
                            <span>Group name</span>
                            <input id="admin-adhoc-name" class="form-input" placeholder="e.g., Manitoba Policy Nerds">
                        </label>
                        <label>
                            <span>Description (optional)</span>
                            <textarea id="admin-adhoc-description" class="form-textarea" rows="3" placeholder="What is this group about?"></textarea>
                        </label>
                        <label>
                            <span>Email domain (optional)</span>
                            <input id="admin-adhoc-domain" class="form-input" placeholder="@example.org">
                        </label>
                        <p class="form-help">
                            Only admins or province moderators can create Ad-hoc Groups. In production, access to the
                            group’s Strategic Plan is limited to members whose email ends with the configured domain.
                        </p>
                        <div style="display:flex; flex-wrap:wrap; gap: 8px; margin-top: 8px;">
                            <button class="btn btn-secondary btn-sm" id="admin-adhoc-create-btn">
                                ➕ Create Ad-hoc Group
                            </button>
                            <button class="btn btn-secondary btn-sm" id="admin-adhoc-save-domain-btn" disabled>
                                💾 Save domain for selected group
                            </button>
                            <button class="btn btn-outline-danger btn-sm" id="admin-adhoc-delete-btn" disabled>
                                🗑 Delete selected Ad-hoc Group
                            </button>
                        </div>
                        <div id="admin-adhoc-feedback" class="profile-resume-feedback" style="margin-top: 8px;"></div>
                    </div>
                </div>

                <div class="card" id="admin-alllocations-card">
                    <div class="card-header">
                        <h3 class="card-title">🌐 All Locations</h3>
                    </div>
                    <div class="card-body">
                        <p class="card-subtitle" style="margin-bottom: 8px;">
                            Read-only view of all planets, countries, provinces, ridings, towns, First Nations, and Ad-hoc Groups.
                            Use this to sanity check the hierarchy that drives Maps, Ideas, and Planning.
                        </p>
                        <div id="admin-alllocations-feedback" class="profile-resume-feedback" style="margin-bottom: 8px;"></div>
                        <div id="admin-alllocations-tree" class="locations-list" style="max-height: 360px; overflow-y:auto; border: 1px solid rgba(255,255,255,0.08); border-radius: 4px; padding: 8px;">
                            <p style="margin:0; font-size: 13px; opacity: 0.8;">Loading location hierarchy…</p>
                        </div>
                    </div>
                </div>

                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">👥 Location Moderators (Admin)</h3>
                    </div>
                    <div class="card-body">
                        <p class="card-subtitle" style="margin-bottom: 8px;">
                            Assign moderators to specific locations (countries, provinces, ridings, towns, First Nations, or adhoc groups).
                        </p>
                        <div class="form-group" style="display:grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 8px;">
                            <label>
                                <span>Location type</span>
                                <select id="mod-location-type" class="form-select">
                                    <option value="federal-ridings">Federal Riding</option>
                                    <option value="provincial-ridings">Provincial Riding</option>
                                    <option value="towns">Town</option>
                                    <option value="first-nations">First Nation</option>
                                    <option value="adhoc-groups">Adhoc Group</option>
                                    <option value="provinces">Province</option>
                                    <option value="countries">Country</option>
                                </select>
                            </label>
                            <label>
                                <span>Country</span>
                                <select id="mod-country-select" class="form-select">
                                    <option value="">-- Select country --</option>
                                </select>
                            </label>
                            <label>
                                <span>Province / State</span>
                                <select id="mod-province-select" class="form-select">
                                    <option value="">-- Select province --</option>
                                </select>
                            </label>
                            <label>
                                <span>Specific location</span>
                                <select id="mod-location-select" class="form-select">
                                    <option value="">-- Select location --</option>
                                </select>
                            </label>
                        </div>
                        <p class="form-help" style="margin-top:4px;">
                            Use the dropdowns to drill down from Country → Province → Location. The internal Location ID will
                            be filled in automatically for the moderator tools.
                        </p>
                        <label>
                            <span>Location ID (advanced)</span>
                            <input id="mod-location-id" class="form-input" placeholder="e.g., riding or group ID">
                        </label>
                        <p class="form-help" style="margin-top:4px;">
                            This is normally filled in from the dropdowns above. Only override it if you know the exact ID from the database.
                        </p>
                        <label>
                            <span>Moderator user</span>
                            <select id="mod-user-select" class="form-select">
                                <option value="">-- Select user --</option>
                            </select>
                        </label>
                        <button class="btn btn-secondary btn-sm" id="mod-assign-btn" style="margin-top: 8px;">
                            ➕ Assign moderator
                        </button>
                        <div id="mod-assign-result" class="profile-resume-feedback" style="margin-top: 8px;"></div>
                        <hr style="margin: 16px 0;">
                        <button class="btn btn-secondary btn-sm" id="mod-refresh-list-btn">
                            🔍 Show moderators for location
                        </button>
                        <div id="mod-list-result" class="profile-resume-feedback" style="margin-top: 8px;"></div>
                        <ul id="mod-list" class="locations-list" style="margin-top: 8px; max-height: 160px; overflow-y:auto;"></ul>
                    </div>
                </div>
            </div>
        `;

        const resultEl = document.getElementById('admin-result');
        const showResult = (msg, isError = false) => {
            if (!resultEl) return;
            resultEl.textContent = msg;
            resultEl.classList.remove('error', 'success');
            resultEl.classList.add(isError ? 'error' : 'success');
        };

        // Admin horizontal tabs – scroll to relevant section
        const adminTabButtons = content.querySelectorAll('.admin-tabs .profile-tab-button');
        const scrollTargets = {
            conventions: document.getElementById('admin-conventions-card'),
            adhoc: document.getElementById('admin-adhoc-card'),
            'all-locations': document.getElementById('admin-alllocations-card'),
            dev: document.getElementById('admin-dev-card')
        };

        adminTabButtons.forEach((btn) => {
            btn.addEventListener('click', () => {
                const tab = btn.getAttribute('data-admin-tab');
                adminTabButtons.forEach((b) => b.classList.toggle('active', b === btn));
                const target = scrollTargets[tab];
                if (target && typeof target.scrollIntoView === 'function') {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        });

        // Allow selecting a convention for management
        document.querySelectorAll('.admin-conv-manage[data-conv-id]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const convId = btn.getAttribute('data-conv-id');
                if (!convId) return;
                App.adminState = App.adminState || {};
                App.adminState.selectedConventionId = convId;
                App.pages.admin();
            });
        });

        // Create convention form
        const createForm = document.getElementById('admin-create-conv-form');
        if (createForm) {
            createForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const nameEl = document.getElementById('admin-new-conv-name');
                const yearEl = document.getElementById('admin-new-conv-year');
                const startEl = document.getElementById('admin-new-conv-start');

                const name = (nameEl.value || '').trim();
                const year = parseInt(yearEl.value, 10) || currentYear + 1;
                const startDate = startEl.value || `${year}-01-15`;

                try {
                    const { response, data } = await App.apiPost('/admin/conventions', {
                        name,
                        year,
                        startDate
                    });
                    if (!response.ok) {
                        showResult(data.error || 'Failed to create convention.', true);
                    } else {
                        showResult(data.message || 'Convention created.');
                        App.pages.admin();
                    }
                } catch (err) {
                    showResult(err.message || 'Error creating convention.', true);
                }
            });
        }

        // Auto-mode toggle
        const autoBtn = document.getElementById('admin-auto-toggle');
        if (autoBtn) {
            autoBtn.addEventListener('click', async () => {
                try {
                    const { response, data } = await App.apiPost('/admin/auto-mode', {
                        enabled: !autoMode.enabled
                    });
                    if (!response.ok) {
                        showResult(data.error || 'Failed to toggle auto-mode.', true);
                    } else {
                        showResult(data.message || 'Auto-mode updated.');
                        App.pages.admin();
                    }
                } catch (err) {
                    showResult(err.message || 'Error toggling auto-mode.', true);
                }
            });
        }

        if (activeConv) {
            const convId = activeConv.id;

            const advanceBtn = document.getElementById('admin-advance-phase');
            if (advanceBtn) {
                advanceBtn.addEventListener('click', async () => {
                    try {
                        const { response, data } = await App.apiPost(
                            `/admin/convention/${encodeURIComponent(convId)}/advance`,
                            {}
                        );
                        if (!response.ok) {
                            showResult(data.error || 'Failed to advance convention.', true);
                        } else {
                            showResult(data.message || 'Convention advanced.');
                            App.pages.admin();
                        }
                    } catch (err) {
                        showResult(err.message || 'Error advancing convention.', true);
                    }
                });
            }

            const racesBtn = document.getElementById('admin-create-wave-races');
            if (racesBtn) {
                racesBtn.addEventListener('click', async () => {
                    try {
                        const { response, data } = await App.apiPost(
                            `/admin/convention/${encodeURIComponent(
                                convId
                            )}/create-wave-races`,
                            {}
                        );
                        if (!response.ok) {
                            showResult(data.error || 'Failed to create races.', true);
                        } else {
                            showResult(data.message || 'Races created for current wave.');
                        }
                    } catch (err) {
                        showResult(err.message || 'Error creating races.', true);
                    }
                });
            }

            const startAllBtn = document.getElementById('admin-start-all-voting');
            if (startAllBtn && activeConv.status && activeConv.status.includes('-voting')) {
                startAllBtn.addEventListener('click', async () => {
                    try {
                        const races = await App.api(
                            `/voting/races/${encodeURIComponent(convId)}`
                        );
                        let started = 0;
                        let skipped = 0;

                        for (const race of races) {
                            if (race.candidates.length > 0 && race.currentRound === 0) {
                                const response = await fetch(
                                    `/api/voting/race/${encodeURIComponent(
                                        race.race.id
                                    )}/start`,
                                    { method: 'POST' }
                                );
                                if (response.ok) started++;
                            } else {
                                skipped++;
                            }
                        }

                        showResult(
                            `Started voting on ${started} race(s). Skipped ${skipped} (already started or no candidates).`
                        );
                    } catch (err) {
                        showResult(err.message || 'Error starting voting.', true);
                    }
                });
            }

            const closeAllBtn = document.getElementById('admin-close-all-rounds');
            if (closeAllBtn && activeConv.status && activeConv.status.includes('-voting')) {
                closeAllBtn.addEventListener('click', async () => {
                    if (
                        !window.confirm(
                            'This will close all active rounds and eliminate the lowest candidate in each race. Continue?'
                        )
                    ) {
                        return;
                    }

                    try {
                        const races = await App.api(
                            `/voting/races/${encodeURIComponent(convId)}`
                        );
                        let closed = 0;
                        const winners = [];
                        const eliminated = [];

                        for (const race of races) {
                            if (race.currentRound > 0 && !race.race.winnerId) {
                                const response = await fetch(
                                    `/api/voting/race/${encodeURIComponent(
                                        race.race.id
                                    )}/close-round`,
                                    { method: 'POST' }
                                );
                                if (response.ok) {
                                    const result = await response.json();
                                    closed++;
                                    if (result.result === 'winner' && result.winner) {
                                        winners.push(
                                            `${race.riding.name}: ${result.winner.name}`
                                        );
                                    } else if (result.eliminated) {
                                        eliminated.push(
                                            `${race.riding.name}: ${result.eliminated.name} eliminated`
                                        );
                                    }
                                }
                            }
                        }

                        let message = `Closed ${closed} round(s).`;
                        if (winners.length) {
                            message += `\n🏆 Winners:\n${winners.join('\n')}`;
                        }
                        if (eliminated.length) {
                            message += `\n\n❌ Eliminated:\n${eliminated.join('\n')}`;
                        }
                        showResult(message.replace(/\n/g, ' '));
                    } catch (err) {
                        showResult(err.message || 'Error closing rounds.', true);
                    }
                });
            }

            const resetConvBtn = document.getElementById('admin-reset-conv');
            if (resetConvBtn) {
                resetConvBtn.addEventListener('click', async () => {
                    if (
                        !window.confirm(
                            'Reset this convention to its initial state? This is a destructive action.'
                        )
                    ) {
                        return;
                    }
                    try {
                        const { response, data } = await App.apiPost(
                            `/admin/convention/${encodeURIComponent(convId)}/reset`,
                            {}
                        );
                        if (!response.ok) {
                            showResult(data.error || 'Failed to reset convention.', true);
                        } else {
                            showResult(data.message || 'Convention reset.');
                            App.pages.admin();
                        }
                    } catch (err) {
                        showResult(err.message || 'Error resetting convention.', true);
                    }
                });
            }

            const viewResultsBtn = document.getElementById('admin-view-results');
            if (viewResultsBtn && activeConv.status === 'completed') {
                viewResultsBtn.addEventListener('click', async () => {
                    try {
                        const results = await App.api(
                            `/admin/convention/${encodeURIComponent(convId)}/results`
                        );
                        const contentEl = document.getElementById('content');
                        if (!results || !results.waves) {
                            contentEl.innerHTML = `
                                <div class="card">
                                    <div class="card-body">
                                        <p class="empty-text">No results are available for this convention yet.</p>
                                        <button class="btn btn-secondary btn-sm" id="admin-back-from-results">← Back to Admin</button>
                                    </div>
                                </div>
                            `;
                        } else {
                            const wavesHtml = Object.entries(results.waves)
                                .map(([waveNum, wave]) => {
                                    const waveRaces = wave.races || [];
                                    const rows = waveRaces
                                        .map(
                                            (r) => `
                                        <tr>
                                            <td>${r.provinceName || ''}</td>
                                            <td>${r.ridingName}</td>
                                            <td>${r.status}</td>
                                            <td>${
                                                r.winner
                                                    ? r.winner.name
                                                    : '<span class="empty-text">No winner</span>'
                                            }</td>
                                        </tr>
                                    `
                                        )
                                        .join('');
                                    return `
                                        <section class="doc-section">
                                            <h2>Wave ${waveNum}: ${wave.waveName}</h2>
                                            ${
                                                waveRaces.length
                                                    ? `
                                                <div class="table-wrapper">
                                                    <table class="simple-table">
                                                        <thead>
                                                            <tr>
                                                                <th>Province</th>
                                                                <th>Riding</th>
                                                                <th>Status</th>
                                                                <th>Winner</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            ${rows}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            `
                                                    : '<p class="empty-text">No races for this wave.</p>'
                                            }
                                        </section>
                                    `;
                                })
                                .join('');

                            contentEl.innerHTML = `
                                <header class="page-header">
                                    <h1 class="page-title">📊 ${results.name} Results</h1>
                                    <p class="page-subtitle">Final results from ${results.year}</p>
                                </header>
                                <div style="margin-bottom: 16px;">
                                    <button class="btn btn-secondary btn-sm" id="admin-back-from-results">← Back to Admin</button>
                                </div>
                                ${wavesHtml}
                            `;
                        }

                        const backBtn = document.getElementById('admin-back-from-results');
                        if (backBtn) {
                            backBtn.addEventListener('click', () => {
                                App.pages.admin();
                            });
                        }
                    } catch (err) {
                        showResult(err.message || 'Error loading convention results.', true);
                    }
                });
            }
        }

        const cleanupBtn = document.getElementById('admin-cleanup-duplicates');
        const cleanupResultEl = document.getElementById('cleanup-duplicates-result');
        if (cleanupBtn && cleanupResultEl) {
            cleanupBtn.addEventListener('click', async () => {
                if (
                    !window.confirm(
                        'This will delete duplicate users that share the same email address in the dev database. Continue?'
                    )
                ) {
                    cleanupResultEl.textContent = 'Cancelled.';
                    cleanupResultEl.classList.remove('error');
                    cleanupResultEl.classList.add('success');
                    return;
                }
                cleanupResultEl.textContent = 'Running cleanup...';
                cleanupResultEl.classList.remove('error', 'success');
                try {
                    const { response, data } = await App.apiPost(
                        '/users/admin/cleanup-duplicates',
                        {}
                    );
                    if (!response.ok) {
                        cleanupResultEl.textContent =
                            (data && data.error) || 'Failed to clean up duplicates.';
                        cleanupResultEl.classList.add('error');
                    } else {
                        const summary =
                            (data.cleaned || [])
                                .map(
                                    (item) =>
                                        `${item.email}: removed ${item.removedCount} duplicate(s)`
                                )
                                .join('; ') || 'No duplicates found.';
                        cleanupResultEl.textContent = `Done. ${summary}`;
                        cleanupResultEl.classList.add('success');
                    }
                } catch (err) {
                    cleanupResultEl.textContent = err.message || 'Error cleaning up duplicates.';
                    cleanupResultEl.classList.add('error');
                }
            });
        }

        const resetDbBtn = document.getElementById('admin-reset-db');
        if (resetDbBtn) {
            resetDbBtn.addEventListener('click', async () => {
                if (
                    !window.confirm(
                        'This will wipe the Neo4j database and re-seed it using test_neo4j.js. Only proceed on a development database. Continue?'
                    )
                ) {
                    return;
                }
                try {
                    const { response, data } = await App.apiPost('/admin/reset-db', {});
                    if (!response.ok) {
                        showResult(
                            data.error ||
                                'Failed to reset database. Check server logs for details.',
                            true
                        );
                    } else {
                        showResult(data.message || 'Database reset and reseeded.');
                    }
                } catch (err) {
                    showResult(err.message || 'Error resetting database.', true);
                }
            });
        }

        // Countries & locations
        const countrySaveBtn = document.getElementById('admin-country-save');
        const countryIdInput = document.getElementById('admin-country-id');
        const countryNameInput = document.getElementById('admin-country-name');
        const countryCodeInput = document.getElementById('admin-country-code');
        const countryFeedback = document.getElementById('admin-country-feedback');

        const adhocCountrySelect = document.getElementById('admin-adhoc-country-select');
        const adhocProvinceSelect = document.getElementById('admin-adhoc-province-select');
        const adhocExistingSelect = document.getElementById('admin-adhoc-existing-select');
        const adhocNameInput = document.getElementById('admin-adhoc-name');
        const adhocDescriptionInput = document.getElementById('admin-adhoc-description');
        const adhocDomainInput = document.getElementById('admin-adhoc-domain');
        const adhocCreateBtn = document.getElementById('admin-adhoc-create-btn');
        const adhocSaveDomainBtn = document.getElementById('admin-adhoc-save-domain-btn');
        const adhocDeleteBtn = document.getElementById('admin-adhoc-delete-btn');
        const adhocFeedback = document.getElementById('admin-adhoc-feedback');

        // All Locations tree
        const allLocTreeEl = document.getElementById('admin-alllocations-tree');
        const allLocFeedbackEl = document.getElementById('admin-alllocations-feedback');

        let adhocGroupsForProvince = [];
        if (
            countrySaveBtn &&
            countryIdInput &&
            countryNameInput &&
            countryCodeInput &&
            countryFeedback
        ) {
            countrySaveBtn.addEventListener('click', async () => {
                const id = (countryIdInput.value || '').trim();
                const name = (countryNameInput.value || '').trim();
                const code = (countryCodeInput.value || '').trim();
                countryFeedback.textContent = '';
                countryFeedback.classList.remove('error', 'success');

                if (!id || !name) {
                    countryFeedback.textContent =
                        'Please provide both a Country ID and a Country name.';
                    countryFeedback.classList.add('error');
                    return;
                }

                if (
                    !window.confirm(
                        `Create or update country "${name}" (ID: ${id})? This is a low-level location change.`
                    )
                ) {
                    return;
                }

                try {
                    countryFeedback.textContent = 'Saving country...';
                    const payload = { id, name };
                    if (code) payload.code = code;
                    const { data } = await App.apiPost('/locations/countries', payload);
                    const result = data || {};
                    countryFeedback.textContent = `Saved country "${
                        result.name || name
                    }" (ID: ${result.id || id}, provinces: ${result.provinceCount || 0}).`;
                    countryFeedback.classList.add('success');
                    // Clear name/code for next entry; keep ID for quick edits
                    countryNameInput.value = '';
                    countryCodeInput.value = '';
                } catch (err) {
                    countryFeedback.textContent =
                        err.message || 'Error saving country. Check server logs.';
                    countryFeedback.classList.add('error');
                }
            });
        }

        // All Locations tree (read-only, collapsible)
        if (allLocTreeEl && allLocFeedbackEl) {
            const renderAllLocations = async () => {
                allLocFeedbackEl.textContent = '';
                allLocFeedbackEl.classList.remove('error', 'success');
                allLocTreeEl.innerHTML =
                    '<p style="margin:0; font-size: 13px; opacity: 0.8;">Loading location hierarchy…</p>';

                try {
                    const hierarchy = await App.api('/locations');
                    if (!Array.isArray(hierarchy) || hierarchy.length === 0) {
                        allLocTreeEl.innerHTML =
                            '<p style="margin:0; font-size: 13px; opacity: 0.8;">No locations found. Seed the database first.</p>';
                        return;
                    }

                    const escapeHtml = (str) =>
                        String(str || '')
                            .replace(/&/g, '&amp;')
                            .replace(/</g, '&lt;')
                            .replace(/>/g, '&gt;')
                            .replace(/"/g, '&quot;')
                            .replace(/'/g, '&#39;');

                    const listItems = await Promise.all(
                        hierarchy.map(async (row) => {
                            const country = row.country;
                            const provinces = Array.isArray(row.provinces) ? row.provinces : [];

                            const provinceBlocks = await Promise.all(
                                provinces.map(async (prov) => {
                                    const provId = prov.id;
                                    let federal = [];
                                    let provincial = [];
                                    let towns = [];
                                    let firstNations = [];
                                    let adhoc = [];
                                    try {
                                        const [
                                            federalRes,
                                            provincialRes,
                                            townsRes,
                                            firstNationsRes,
                                            adhocRes
                                        ] = await Promise.all([
                                            App.api(
                                                `/locations/provinces/${encodeURIComponent(
                                                    provId
                                                )}/federal-ridings`
                                            ),
                                            App.api(
                                                `/locations/provinces/${encodeURIComponent(
                                                    provId
                                                )}/provincial-ridings`
                                            ),
                                            App.api(
                                                `/locations/provinces/${encodeURIComponent(
                                                    provId
                                                )}/towns`
                                            ),
                                            App.api(
                                                `/locations/provinces/${encodeURIComponent(
                                                    provId
                                                )}/first-nations`
                                            ),
                                            App.api(
                                                `/locations/provinces/${encodeURIComponent(
                                                    provId
                                                )}/adhoc-groups`
                                            )
                                        ]);
                                        federal = Array.isArray(federalRes) ? federalRes : [];
                                        provincial = Array.isArray(provincialRes)
                                            ? provincialRes
                                            : [];
                                        towns = Array.isArray(townsRes) ? townsRes : [];
                                        firstNations = Array.isArray(firstNationsRes)
                                            ? firstNationsRes
                                            : [];
                                        adhoc = Array.isArray(adhocRes) ? adhocRes : [];
                                    } catch (e) {
                                        // Best-effort: show what we have and flag error in feedback
                                        allLocFeedbackEl.textContent =
                                            'Some provincial children failed to load. Check server logs for details.';
                                        allLocFeedbackEl.classList.add('error');
                                    }

                                    const renderLeafList = (title, items) => {
                                        if (!items.length) return '';
                                        return `
                                            <details>
                                                <summary style="font-size: 13px;">${escapeHtml(
                                                    title
                                                )} (${items.length})</summary>
                                                <ul style="margin: 4px 0 4px 16px; padding-left: 0; list-style: disc;">
                                                    ${items
                                                        .map(
                                                            (i) =>
                                                                `<li style="font-size: 12px;">${escapeHtml(
                                                                    i.name
                                                                )} <span style="opacity:0.6;">[${
                                                                    i.id
                                                                }]</span></li>`
                                                        )
                                                        .join('')}
                                                </ul>
                                            </details>
                                        `;
                                    };

                                    return `
                                        <details>
                                            <summary><strong>${escapeHtml(
                                                prov.name
                                            )}</strong> <span style="opacity:0.6;">[${escapeHtml(
                                        prov.id
                                    )}]</span></summary>
                                            <div style="margin-left: 12px; margin-top: 4px;">
                                                ${renderLeafList('Federal ridings', federal)}
                                                ${renderLeafList('Provincial ridings', provincial)}
                                                ${renderLeafList('Towns', towns)}
                                                ${renderLeafList('First Nations', firstNations)}
                                                ${renderLeafList('Ad-hoc Groups', adhoc)}
                                            </div>
                                        </details>
                                    `;
                                })
                            );

                            return `
                                <li class="locations-list-item">
                                    <details open>
                                        <summary>
                                            <strong>${escapeHtml(country.name)}</strong>
                                            <span style="opacity:0.6;">[${escapeHtml(
                                                country.id
                                            )}]</span>
                                        </summary>
                                        <div style="margin-left: 12px; margin-top: 4px;">
                                            ${
                                                provinceBlocks.length
                                                    ? provinceBlocks.join('')
                                                    : '<p style="font-size: 12px; opacity: 0.8; margin: 4px 0;">No provinces attached.</p>'
                                            }
                                        </div>
                                    </details>
                                </li>
                            `;
                        })
                    );

                    allLocTreeEl.innerHTML = `<ul style="margin:0; padding-left: 0; list-style: none;">${listItems.join(
                        ''
                    )}</ul>`;
                    allLocFeedbackEl.textContent =
                        'Hierarchy loaded. Expand items to inspect provinces and children.';
                    allLocFeedbackEl.classList.add('success');
                } catch (err) {
                    allLocTreeEl.innerHTML =
                        '<p style="margin:0; font-size: 13px; opacity: 0.8;">Unable to load hierarchy.</p>';
                    allLocFeedbackEl.textContent =
                        err.message || 'Error loading locations. Check server logs.';
                    allLocFeedbackEl.classList.add('error');
                }
            };

            // Fire once when admin page loads
            renderAllLocations();
        }

        // Ad-hoc Group Admin logic (admin or province moderators)
        if (
            adhocCountrySelect &&
            adhocProvinceSelect &&
            adhocExistingSelect &&
            adhocNameInput &&
            adhocDescriptionInput &&
            adhocDomainInput &&
            adhocCreateBtn &&
            adhocSaveDomainBtn &&
            adhocDeleteBtn &&
            adhocFeedback
        ) {
            try {
                const countries = await App.api('/locations/countries');
                adhocCountrySelect.innerHTML =
                    '<option value="">-- Select country --</option>' +
                    countries
                        .map((c) => `<option value="${c.id}">${c.name}</option>`)
                        .join('');
            } catch (err) {
                adhocFeedback.textContent =
                    err.message || 'Unable to load countries for Ad-hoc Group Admin.';
                adhocFeedback.classList.add('error');
            }

            adhocCountrySelect.addEventListener('change', async () => {
                adhocFeedback.textContent = '';
                adhocFeedback.classList.remove('error', 'success');
                const countryId = adhocCountrySelect.value;
                adhocProvinceSelect.innerHTML =
                    '<option value="">-- Select province --</option>';
                adhocProvinceSelect.disabled = true;
                adhocExistingSelect.innerHTML =
                    '<option value="">-- No groups yet --</option>';
                adhocExistingSelect.disabled = true;
                adhocGroupsForProvince = [];
                adhocDomainInput.value = '';
                adhocSaveDomainBtn.disabled = true;
                adhocDeleteBtn.disabled = true;

                if (!countryId) return;

                try {
                    const provinces = await App.api(
                        `/locations/countries/${encodeURIComponent(countryId)}/provinces`
                    );
                    adhocProvinceSelect.innerHTML =
                        '<option value="">-- Select province --</option>' +
                        provinces
                            .map((p) => `<option value="${p.id}">${p.name}</option>`)
                            .join('');
                    adhocProvinceSelect.disabled = false;
                } catch (err) {
                    adhocFeedback.textContent =
                        err.message || 'Unable to load provinces for that country.';
                    adhocFeedback.classList.add('error');
                }
            });

            adhocProvinceSelect.addEventListener('change', async () => {
                adhocFeedback.textContent = '';
                adhocFeedback.classList.remove('error', 'success');
                const provinceId = adhocProvinceSelect.value;
                adhocExistingSelect.innerHTML =
                    '<option value="">-- Loading groups... --</option>';
                adhocExistingSelect.disabled = true;
                adhocGroupsForProvince = [];
                adhocDomainInput.value = '';
                adhocSaveDomainBtn.disabled = true;
                adhocDeleteBtn.disabled = true;

                if (!provinceId) {
                    adhocExistingSelect.innerHTML =
                        '<option value="">-- No groups yet --</option>';
                    return;
                }

                try {
                    const groups = await App.api(
                        `/locations/provinces/${encodeURIComponent(provinceId)}/adhoc-groups`
                    );
                    adhocGroupsForProvince = Array.isArray(groups) ? groups : [];
                    if (!adhocGroupsForProvince.length) {
                        adhocExistingSelect.innerHTML =
                            '<option value="">-- No groups yet --</option>';
                        return;
                    }
                    adhocExistingSelect.innerHTML =
                        '<option value="">-- Select group --</option>' +
                        adhocGroupsForProvince
                            .map((g) => `<option value="${g.id}">${g.name}</option>`)
                            .join('');
                    adhocExistingSelect.disabled = false;
                } catch (err) {
                    adhocFeedback.textContent =
                        err.message || 'Unable to load Ad-hoc Groups for that province.';
                    adhocFeedback.classList.add('error');
                    adhocExistingSelect.innerHTML =
                        '<option value="">-- Error loading groups --</option>';
                }
            });

            adhocExistingSelect.addEventListener('change', () => {
                adhocFeedback.textContent = '';
                adhocFeedback.classList.remove('error', 'success');
                const groupId = adhocExistingSelect.value;
                const selected =
                    groupId && adhocGroupsForProvince
                        ? adhocGroupsForProvince.find((g) => g.id === groupId)
                        : null;

                if (!selected) {
                    adhocDomainInput.value = '';
                    adhocSaveDomainBtn.disabled = true;
                    adhocDeleteBtn.disabled = true;
                    return;
                }

                if (selected.allowedEmailDomain) {
                    adhocDomainInput.value = `@${selected.allowedEmailDomain}`;
                } else {
                    adhocDomainInput.value = '';
                }

                adhocSaveDomainBtn.disabled = false;
                adhocDeleteBtn.disabled = false;
            });

            adhocCreateBtn.addEventListener('click', async () => {
                adhocFeedback.textContent = '';
                adhocFeedback.classList.remove('error', 'success');

                const provinceId = adhocProvinceSelect.value;
                const name = adhocNameInput.value.trim();
                const description = adhocDescriptionInput.value.trim();
                const domainRaw = adhocDomainInput.value.trim();

                if (!provinceId) {
                    adhocFeedback.textContent = 'Please select a province first.';
                    adhocFeedback.classList.add('error');
                    return;
                }

                if (!name) {
                    adhocFeedback.textContent = 'Group name is required.';
                    adhocFeedback.classList.add('error');
                    return;
                }

                adhocCreateBtn.disabled = true;
                adhocCreateBtn.textContent = 'Creating...';

                try {
                    const { response, data } = await App.apiPost('/locations/adhoc-groups', {
                        name,
                        description,
                        provinceId,
                        allowedEmailDomain: domainRaw
                    });

                    if (!response.ok) {
                        adhocFeedback.textContent =
                            (data && data.error) ||
                            'Could not create this Ad-hoc Group. Make sure you are an admin or a moderator for this province.';
                        adhocFeedback.classList.add('error');
                    } else {
                        adhocFeedback.textContent = 'Ad-hoc Group created.';
                        adhocFeedback.classList.add('success');

                        adhocNameInput.value = '';
                        adhocDescriptionInput.value = '';
                        // Leave domain in place so admin can see what was used

                        // Refresh the existing-groups list for this province
                        adhocProvinceSelect.dispatchEvent(new Event('change'));
                    }
                } catch (err) {
                    adhocFeedback.textContent =
                        err.message ||
                        'Unable to create this Ad-hoc Group. Check your permissions or server logs.';
                    adhocFeedback.classList.add('error');
                } finally {
                    adhocCreateBtn.disabled = false;
                    adhocCreateBtn.textContent = '➕ Create Ad-hoc Group';
                }
            });
        }

        if (adhocSaveDomainBtn) {
            adhocSaveDomainBtn.addEventListener('click', async () => {
                adhocFeedback.textContent = '';
                adhocFeedback.classList.remove('error', 'success');

                const groupId = adhocExistingSelect.value;
                if (!groupId) {
                    adhocFeedback.textContent = 'Select a group first.';
                    adhocFeedback.classList.add('error');
                    return;
                }

                const raw = adhocDomainInput.value.trim();

                adhocSaveDomainBtn.disabled = true;
                adhocSaveDomainBtn.textContent = 'Saving...';

                try {
                    const { response, data } = await App.apiPut(
                        `/locations/adhoc-groups/${encodeURIComponent(groupId)}/domain`,
                        { allowedEmailDomain: raw }
                    );

                    if (!response.ok) {
                        adhocFeedback.textContent =
                            (data && data.error) ||
                            'Could not save the email domain rule for this group.';
                        adhocFeedback.classList.add('error');
                    } else {
                        adhocFeedback.textContent = 'Email domain rule saved.';
                        adhocFeedback.classList.add('success');

                        // Update local cache
                        const updatedGroup = data || {};
                        adhocGroupsForProvince = adhocGroupsForProvince.map((g) =>
                            g.id === updatedGroup.id ? updatedGroup : g
                        );
                    }
                } catch (err) {
                    adhocFeedback.textContent =
                        err.message || 'Unable to save the email domain rule.';
                    adhocFeedback.classList.add('error');
                } finally {
                    adhocSaveDomainBtn.disabled = false;
                    adhocSaveDomainBtn.textContent = '💾 Save domain for selected group';
                }
            });
        }

        if (adhocDeleteBtn) {
            adhocDeleteBtn.addEventListener('click', async () => {
                adhocFeedback.textContent = '';
                adhocFeedback.classList.remove('error', 'success');

                const groupId = adhocExistingSelect.value;
                if (!groupId) {
                    adhocFeedback.textContent = 'Select a group first.';
                    adhocFeedback.classList.add('error');
                    return;
                }

                if (
                    !window.confirm(
                        'Are you sure you want to delete this Ad-hoc Group? This cannot be undone.'
                    )
                ) {
                    return;
                }

                adhocDeleteBtn.disabled = true;
                adhocDeleteBtn.textContent = 'Deleting...';

                try {
                    const response = await fetch(
                        `/api/locations/adhoc-groups/${encodeURIComponent(groupId)}`,
                        {
                            method: 'DELETE',
                            headers: { 'Content-Type': 'application/json' }
                        }
                    );
                    const data = await response.json().catch(() => ({}));

                    if (!response.ok) {
                        adhocFeedback.textContent =
                            (data && data.error) ||
                            'Could not delete this Ad-hoc Group right now.';
                        adhocFeedback.classList.add('error');
                    } else {
                        adhocFeedback.textContent = 'Ad-hoc Group deleted.';
                        adhocFeedback.classList.add('success');

                        // Refresh list for this province
                        adhocProvinceSelect.dispatchEvent(new Event('change'));
                        adhocExistingSelect.value = '';
                        adhocDomainInput.value = '';
                        adhocSaveDomainBtn.disabled = true;
                        adhocDeleteBtn.disabled = true;
                    }
                } catch (err) {
                    adhocFeedback.textContent =
                        err.message || 'Unable to delete this Ad-hoc Group.';
                    adhocFeedback.classList.add('error');
                } finally {
                    adhocDeleteBtn.disabled = false;
                    adhocDeleteBtn.textContent = '🗑 Delete selected Ad-hoc Group';
                }
            });
        }

        // Location moderators
        const modTypeSelect = document.getElementById('mod-location-type');
        const modLocIdInput = document.getElementById('mod-location-id');
        const modCountrySelect = document.getElementById('mod-country-select');
        const modProvinceSelect = document.getElementById('mod-province-select');
        const modLocationSelect = document.getElementById('mod-location-select');
        const modUserSelect = document.getElementById('mod-user-select');
        const modAssignBtn = document.getElementById('mod-assign-btn');
        const modAssignResult = document.getElementById('mod-assign-result');
        const modRefreshBtn = document.getElementById('mod-refresh-list-btn');
        const modListResult = document.getElementById('mod-list-result');
        const modListEl = document.getElementById('mod-list');

        // Populate user dropdown from cached users if available
        if (modUserSelect && Array.isArray(App.allUsers)) {
            modUserSelect.innerHTML = '<option value="">-- Select user --</option>';
            App.allUsers.forEach((u) => {
                const opt = document.createElement('option');
                opt.value = u.id;
                opt.textContent = `${u.name || u.email || u.id} (${u.email || 'no email'})`;
                modUserSelect.appendChild(opt);
            });
        }

        // Helper: update the raw location ID field when a dropdown changes
        const syncLocationIdFromDropdowns = () => {
            if (!modLocIdInput) return;
            const type = modTypeSelect ? modTypeSelect.value : '';
            const countryId = modCountrySelect ? modCountrySelect.value : '';
            const provinceId = modProvinceSelect ? modProvinceSelect.value : '';
            const locId = modLocationSelect ? modLocationSelect.value : '';

            // Countries: use selected country
            if (type === 'countries') {
                modLocIdInput.value = countryId || '';
                return;
            }

            // Provinces: use selected province (fall back to country if no province layer)
            if (type === 'provinces') {
                modLocIdInput.value = provinceId || '';
                return;
            }

            // All other types use the deepest specific location
            modLocIdInput.value = locId || '';
        };

        // Load countries on first render
        if (modCountrySelect) {
            (async () => {
                try {
                    const countries = await App.api('/locations/countries');
                    modCountrySelect.innerHTML =
                        '<option value="">-- Select country --</option>' +
                        countries
                            .map(
                                (c) =>
                                    `<option value="${c.id}">${c.name || c.id}</option>`
                            )
                            .join('');
                } catch (err) {
                    // eslint-disable-next-line no-console
                    console.error('Failed to load countries for moderator tools:', err);
                }
            })();
        }

        // When country changes, load provinces for that country
        if (modCountrySelect && modProvinceSelect) {
            modCountrySelect.addEventListener('change', async () => {
                modProvinceSelect.innerHTML =
                    '<option value="">-- Select province --</option>';
                if (modLocationSelect) {
                    modLocationSelect.innerHTML =
                        '<option value="">-- Select location --</option>';
                }

                const countryId = modCountrySelect.value;
                if (!countryId) {
                    syncLocationIdFromDropdowns();
                    return;
                }

                try {
                    const provinces = await App.api(
                        `/locations/countries/${encodeURIComponent(countryId)}/provinces`
                    );
                    modProvinceSelect.innerHTML =
                        '<option value="">-- Select province --</option>' +
                        provinces
                            .map(
                                (p) =>
                                    `<option value="${p.id}">${p.name || p.id}</option>`
                            )
                            .join('');
                } catch (err) {
                    // eslint-disable-next-line no-console
                    console.error('Failed to load provinces for moderator tools:', err);
                } finally {
                    syncLocationIdFromDropdowns();
                }
            });
        }

        // When province or type changes, load the specific locations list (ridings, towns, etc.)
        const reloadSpecificLocations = async () => {
            if (!modProvinceSelect || !modLocationSelect || !modTypeSelect) {
                syncLocationIdFromDropdowns();
                return;
            }

            const type = modTypeSelect.value;
            const provinceId = modProvinceSelect.value;

            modLocationSelect.innerHTML =
                '<option value="">-- Select location --</option>';

            // Countries / provinces don't have a third-level list here
            if (!provinceId || type === 'countries' || type === 'provinces') {
                syncLocationIdFromDropdowns();
                return;
            }

            let endpoint = null;
            switch (type) {
                case 'federal-ridings':
                    endpoint = `/locations/provinces/${encodeURIComponent(
                        provinceId
                    )}/federal-ridings`;
                    break;
                case 'provincial-ridings':
                    endpoint = `/locations/provinces/${encodeURIComponent(
                        provinceId
                    )}/provincial-ridings`;
                    break;
                case 'towns':
                    endpoint = `/locations/provinces/${encodeURIComponent(
                        provinceId
                    )}/towns`;
                    break;
                case 'first-nations':
                    endpoint = `/locations/provinces/${encodeURIComponent(
                        provinceId
                    )}/first-nations`;
                    break;
                case 'adhoc-groups':
                    endpoint = `/locations/provinces/${encodeURIComponent(
                        provinceId
                    )}/adhoc-groups`;
                    break;
                default:
                    break;
            }

            if (!endpoint) {
                syncLocationIdFromDropdowns();
                return;
            }

            try {
                const locations = await App.api(endpoint);
                modLocationSelect.innerHTML =
                    '<option value="">-- Select location --</option>' +
                    locations
                        .map(
                            (loc) =>
                                `<option value="${loc.id}">${loc.name || loc.id}</option>`
                        )
                        .join('');
            } catch (err) {
                // eslint-disable-next-line no-console
                console.error('Failed to load specific locations for moderator tools:', err);
            } finally {
                syncLocationIdFromDropdowns();
            }
        };

        if (modProvinceSelect) {
            modProvinceSelect.addEventListener('change', () => {
                reloadSpecificLocations();
            });
        }

        if (modTypeSelect) {
            modTypeSelect.addEventListener('change', () => {
                reloadSpecificLocations();
                syncLocationIdFromDropdowns();
            });
        }

        if (modLocationSelect) {
            modLocationSelect.addEventListener('change', () => {
                syncLocationIdFromDropdowns();
            });
        }

        if (modAssignBtn && modTypeSelect && modLocIdInput && modUserSelect && modAssignResult) {
            modAssignBtn.addEventListener('click', async () => {
                const userId = modUserSelect.value;
                const type = modTypeSelect.value;
                const locId = (modLocIdInput.value || '').trim();
                modAssignResult.textContent = '';
                modAssignResult.classList.remove('error', 'success');

                if (!userId || !locId) {
                    modAssignResult.textContent = 'Please choose a user and enter a location ID.';
                    modAssignResult.classList.add('error');
                    return;
                }

                try {
                    const { response, data } = await App.apiPost(
                        `/locations/${encodeURIComponent(type)}/${encodeURIComponent(
                            locId
                        )}/moderators`,
                        {
                            userId
                        }
                    );
                    if (!response.ok) {
                        modAssignResult.textContent =
                            (data && data.error) || 'Failed to assign moderator.';
                        modAssignResult.classList.add('error');
                    } else {
                        modAssignResult.textContent =
                            data.message || 'Moderator assigned to that location.';
                        modAssignResult.classList.add('success');
                    }
                } catch (err) {
                    modAssignResult.textContent = err.message || 'Error assigning moderator.';
                    modAssignResult.classList.add('error');
                }
            });
        }

        if (modRefreshBtn && modTypeSelect && modLocIdInput && modListResult && modListEl) {
            modRefreshBtn.addEventListener('click', async () => {
                const type = modTypeSelect.value;
                const locId = (modLocIdInput.value || '').trim();
                modListResult.textContent = '';
                modListResult.classList.remove('error', 'success');
                modListEl.innerHTML = '';

                if (!locId) {
                    modListResult.textContent = 'Enter a location ID to look up moderators.';
                    modListResult.classList.add('error');
                    return;
                }

                try {
                    const moderators = await App.api(
                        `/locations/${encodeURIComponent(type)}/${encodeURIComponent(
                            locId
                        )}/moderators`
                    );
                    if (!moderators || !moderators.length) {
                        modListResult.textContent =
                            'No moderators configured for this location yet.';
                        modListResult.classList.add('success');
                        return;
                    }
                    modListEl.innerHTML = moderators
                        .map(
                            (m) => `
                            <li class="locations-list-item">
                                <span>${m.name || m.email || m.id}</span>
                                ${m.email ? `<span class="list-item-meta">${m.email}</span>` : ''}
                            </li>
                        `
                        )
                        .join('');
                    modListResult.textContent = `Found ${moderators.length} moderator(s) for this location.`;
                    modListResult.classList.add('success');
                } catch (err) {
                    modListResult.textContent = err.message || 'Error loading moderators.';
                    modListResult.classList.add('error');
                }
            });
        }
    } catch (err) {
        content.innerHTML = `
            <div class="card">
                <div class="card-body">
                    <p class="empty-text">Error loading admin controls: ${err.message}</p>
                </div>
            </div>
        `;
    }
};


