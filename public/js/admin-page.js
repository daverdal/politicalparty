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

            <div id="admin-result" class="profile-resume-feedback" style="margin-bottom: 12px;"></div>

            <div class="cards-grid">
                <div class="card">
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
                <div class="card">
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


