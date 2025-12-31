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

        const activeConv =
            conventions.find((c) => c.status !== 'completed') || conventions[0] || null;
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
                            <ul class="simple-list">
                                ${conventions
                                    .map(
                                        (c) => `
                                    <li class="simple-list-item">
                                        <span class="simple-list-name">${c.name}</span>
                                        <span class="simple-list-meta">
                                            Year ${c.year} • ${c.status} • ${
                                            c.totalRaces || 0
                                        } races
                                        </span>
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
                        <button class="btn btn-secondary btn-sm" id="admin-reset-conv" style="margin-left: 4px;">
                            Reset convention
                        </button>
                    </div>
                </div>
                `
                        : ''
                }

                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">🧪 Dev Utilities</h3>
                    </div>
                    <div class="card-body">
                        <p class="card-subtitle">
                            Reset the Neo4j database and re-run the seed script (development only).
                        </p>
                        <button class="btn btn-secondary btn-sm" id="admin-reset-db">
                            💣 Reset database and re-seed
                        </button>
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


