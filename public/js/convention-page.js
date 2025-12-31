/**
 * Convention Page - core implementation
 * Standalone version without pages-extended.js.
 *
 * Focus:
 * - Show current convention and wave timeline
 * - Show basic race stats (contested / uncontested / vacant)
 * - Show voting section + sessions summary
 */

window.App = window.App || {};
App.pages = App.pages || {};

try {
    if (typeof App.logClientEvent === 'function') {
        App.logClientEvent('info', 'convention-page.js loaded (standalone)', {});
    }
} catch (e) {
    // ignore debug errors
}

App.pages.convention = async function () {
    const content = document.getElementById('content');

    content.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    try {
        const conventions = await App.api('/conventions');
        const activeConv = conventions.find((c) => c.status !== 'completed') || conventions[0];

        let activeRaces = [];
        let votes = [];
        if (activeConv) {
            activeRaces = await App.api(`/conventions/${encodeURIComponent(activeConv.id)}/races`);
            try {
                votes = await App.api('/votes');
            } catch (e) {
                votes = [];
            }
        }

        const totalRaces = activeRaces.length;
        const contestedRaces = activeRaces.filter((r) => r.candidateCount > 1).length;
        const uncontested = activeRaces.filter((r) => r.candidateCount === 1).length;
        const vacant = activeRaces.filter((r) => r.candidateCount === 0).length;

        const waves = [
            { wave: 1, name: 'Pacific', emoji: '🌊', provinces: 'BC, Yukon' },
            { wave: 2, name: 'Mountain', emoji: '⛰️', provinces: 'Alberta, NWT' },
            { wave: 3, name: 'Prairie', emoji: '🌾', provinces: 'SK, MB, Nunavut' },
            { wave: 4, name: 'Central', emoji: '🏙️', provinces: 'Ontario' },
            { wave: 5, name: 'Quebec', emoji: '⚜️', provinces: 'Quebec' },
            { wave: 6, name: 'Atlantic', emoji: '🦞', provinces: 'NB, NS, PE, NL' }
        ];

        const getStatusBadge = (status) => {
            if (status === 'upcoming') return '<span class="badge">🗓️ Upcoming</span>';
            if (status === 'completed') return '<span class="badge">✅ Completed</span>';
            if (status?.includes('-nominations')) {
                return `<span class="badge warning">📝 ${status
                    .replace('wave', 'Wave ')
                    .replace('-nominations', ' Nominations')}</span>`;
            }
            if (status?.includes('-voting')) {
                return `<span class="badge success">🗳️ ${status
                    .replace('wave', 'Wave ')
                    .replace('-voting', ' Voting')}</span>`;
            }
            return `<span class="badge">${status || 'scheduled'}</span>`;
        };

        const buildWaveTimeline = (conv) => {
            const currentWave = conv.currentWave || 1;
            const status = conv.status || '';
            const isCompleted = status === 'completed';
            let html = '<div class="wave-timeline">';

            waves.forEach((w) => {
                const isNominating = status === `wave${w.wave}-nominations`;
                const isVoting = status === `wave${w.wave}-voting`;
                const isActive = isNominating || isVoting;
                const isWaveCompleted = currentWave > w.wave || isCompleted;

                html += `
                    <div class="wave-phase ${isActive ? 'active' : isWaveCompleted ? 'completed' : 'future'}">
                        <div class="wave-dot"></div>
                        <div class="wave-info">
                            <div class="wave-name">${w.emoji} Wave ${w.wave}: ${w.name}</div>
                            <div class="wave-provinces">${w.provinces}</div>
                        </div>
                    </div>
                `;
            });

            html += '</div>';
            return html;
        };

        content.innerHTML = `
            <header class="page-header">
                <h1 class="page-title">🏛️ Convention</h1>
                <p class="page-subtitle">${
                    activeConv ? activeConv.name : 'West to East regional voting waves'
                }</p>
            </header>

            ${
                activeConv
                    ? `
            <div class="card convention-hero">
                <div class="card-header">
                    <div>
                        <h2 class="card-title">${activeConv.name}</h2>
                        <p class="card-subtitle">${
                            activeConv.description || 'West to East regional voting waves across Canada.'
                        }</p>
                    </div>
                    ${getStatusBadge(activeConv.status)}
                </div>
                <div class="card-body">
                    ${buildWaveTimeline(activeConv)}
                </div>
            </div>

            <div class="stats-row">
                <div class="stat-card">
                    <div class="stat-label">Total Races (wave ${activeConv.currentWave || 1})</div>
                    <div class="stat-value">${totalRaces}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Contested</div>
                    <div class="stat-value">${contestedRaces}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Uncontested</div>
                    <div class="stat-value">${uncontested}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Vacant</div>
                    <div class="stat-value">${vacant}</div>
                </div>
            </div>

            <div class="cards-grid" style="margin-top: 16px;">
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">${
                            activeConv.status?.includes('-voting')
                                ? '🗳️ Active Voting Races'
                                : '🏁 Active Nomination Races'
                        }</h3>
                        <span class="badge">${activeRaces.length} ridings</span>
                    </div>
                    <div class="card-body">
                        ${
                            !activeRaces.length
                                ? '<p class="empty-text">No races are active for this wave yet.</p>'
                                : `
                            <div class="races-grid">
                                ${activeRaces
                                    .map(
                                        (race) => `
                                    <div class="race-card ${
                                        race.candidateCount > 1
                                            ? 'contested'
                                            : race.candidateCount === 1
                                            ? 'uncontested'
                                            : 'vacant'
                                    }">
                                        <div class="race-card-header">
                                            <div class="race-riding-name">${
                                                race.riding?.name || 'Unknown riding'
                                            }</div>
                                            <div class="race-province-name">${
                                                race.provinceName || ''
                                            }</div>
                                        </div>
                                        <div class="race-card-body">
                                            ${
                                                race.candidateCount === 0
                                                    ? '<div class="race-empty">No candidates yet</div>'
                                                    : race.candidateCount === 1
                                                    ? '<div class="race-uncontested">1 candidate</div>'
                                                    : `<div class="race-contested">${race.candidateCount} candidates</div>`
                                            }
                                        </div>
                                    </div>
                                `
                                    )
                                    .join('')}
                            </div>
                        `
                        }
                    </div>
                </div>

                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Convention Voting Sessions</h3>
                        <span class="badge">${votes.length} session(s)</span>
                    </div>
                    <div class="card-body">
                        ${
                            !votes.length
                                ? '<p class="empty-text">No convention-wide votes have been created yet.</p>'
                                : `
                            <div class="cards-grid">
                                ${votes
                                    .map(
                                        (vote) => `
                                    <div class="card">
                                        <div class="card-header">
                                            <div>
                                                <span class="event-type">${
                                                    vote.type || 'vote'
                                                }</span>
                                                <h3 class="card-title">${vote.question}</h3>
                                            </div>
                                        </div>
                                        ${
                                            vote.event
                                                ? `<p class="card-subtitle" style="margin-bottom: 8px;">Part of: ${vote.event.title}</p>`
                                                : ''
                                        }
                                        <div class="card-body">
                                            ${
                                                vote.result
                                                    ? '<span class="badge success">Results available</span>'
                                                    : '<span class="badge warning">Voting in progress or scheduled</span>'
                                            }
                                        </div>
                                    </div>
                                `
                                    )
                                    .join('')}
                            </div>
                        `
                        }
                    </div>
                </div>
            </div>
            `
                    : '<div class="card"><div class="card-body"><p class="empty-text">No conventions are configured yet.</p></div></div>'
            }
        `;
    } catch (err) {
        content.innerHTML = `
            <div class="card">
                <div class="card-body">
                    <p class="empty-text">Error loading convention: ${err.message}</p>
                </div>
            </div>
        `;
    }
};


