/**
 * Extended Pages
 * Profile, Convention, Admin pages and Modals
 */

window.App = window.App || {};

// ============================================
// PROFILE PAGE
// ============================================

App.pages.profile = async function() {
    const content = document.getElementById('content');
    
    if (!App.currentUser) {
        content.innerHTML = `
            <header class="page-header"><h1 class="page-title">👤 My Profile</h1></header>
            <div class="card"><div class="card-body"><p class="empty-text">Please select a user from the dropdown above to view your profile.</p></div></div>
        `;
        return;
    }
    
    content.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    
    try {
        const [userDetails, conventions, provinces] = await Promise.all([
            App.api(`/users/${App.currentUser.id}`),
            App.api('/conventions'),
            App.api('/locations/provinces')
        ]);
        
        const activeConv = conventions.find(c => c.status !== 'completed');
        let nominations = [];
        let currentRace = null;
        
        if (activeConv) {
            try {
                const nomData = await App.api(`/conventions/${activeConv.id}/nominations/${App.currentUser.id}`);
                nominations = Array.isArray(nomData) ? nomData : (nomData.nominations || []);
                currentRace = nominations.find(n => n.hasAccepted);
            } catch (e) {}
        }
        
        const pendingNominations = nominations.filter(n => !n.hasAccepted);
        
        content.innerHTML = `
            <header class="page-header">
                <h1 class="page-title">👤 My Profile</h1>
                <p class="page-subtitle">Welcome, ${App.currentUser.name}</p>
            </header>
            
            <div class="card">
                <div class="card-header">
                    <div class="profile-header">
                        <div class="profile-avatar">${App.getInitials(App.currentUser.name)}</div>
                        <div>
                            <h2 class="profile-name">${App.currentUser.name}</h2>
                            <p class="profile-region">${userDetails.location?.name || App.currentUser.region || 'No location set'}</p>
                        </div>
                    </div>
                    ${App.currentUser.candidate ? '<span class="badge success">⭐ Candidate</span>' : ''}
                </div>
                <div class="card-body">
                    <p class="profile-bio">${userDetails.bio || 'No bio provided'}</p>
                    <div class="profile-stats">
                        <div class="profile-stat"><span class="profile-stat-value">${userDetails.points || 0}</span><span class="profile-stat-label">Points</span></div>
                        <div class="profile-stat"><span class="profile-stat-value">${userDetails.endorsementCount || 0}</span><span class="profile-stat-label">Endorsements</span></div>
                    </div>
                    
                    <div class="location-selector-section">
                        <h4>📍 My Location (Riding)</h4>
                        <p class="location-help">Set your riding to appear in local candidates list and receive nominations for your area.</p>
                        <div class="location-selector-form">
                            <select id="province-select" class="form-select">
                                <option value="">-- Select Province --</option>
                                ${provinces.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                            </select>
                            <select id="riding-select" class="form-select" disabled><option value="">-- Select Riding --</option></select>
                            <button class="btn btn-primary" id="save-location-btn" disabled>Save Location</button>
                        </div>
                        <div id="location-feedback" class="location-feedback"></div>
                        ${userDetails.location ? `<p class="current-location">Current: <strong>${userDetails.location.name}</strong></p>` : ''}
                    </div>
                </div>
            </div>
            
            ${currentRace ? `
                <div class="card">
                    <div class="card-header"><h3 class="card-title">🏁 Currently Running In</h3><span class="badge success">Active</span></div>
                    <div class="card-body">
                        <div class="current-race-info">
                            <div class="race-riding-lg">${currentRace.riding?.name || 'Unknown Riding'}</div>
                            <p class="race-province-lg">${currentRace.province?.name || ''}</p>
                            <div class="race-actions">
                                <button class="btn btn-danger" onclick="App.withdrawFromRace('${activeConv?.id}', '${currentRace.race?.id}')">Withdraw from Race</button>
                            </div>
                        </div>
                    </div>
                </div>
            ` : ''}
            
            <div class="card ${pendingNominations.length > 0 ? 'highlight' : ''}">
                <div class="card-header">
                    <h3 class="card-title">📬 Pending Nominations</h3>
                    ${pendingNominations.length > 0 ? `<span class="badge warning">${pendingNominations.length} pending</span>` : ''}
                </div>
                <div class="card-body">
                    ${pendingNominations.length === 0 ? `
                        <p class="empty-text">No pending nominations. ${currentRace ? "You're already running in a race!" : 'Others can nominate you for races during the nomination phase.'}</p>
                    ` : `
                        <p class="nominations-help">You've been nominated for the following races. You can only accept <strong>one</strong> nomination per convention.</p>
                        <div class="nominations-list">
                            ${pendingNominations.map(nom => `
                                <div class="nomination-card" data-race-id="${nom.race?.id}">
                                    <div class="nomination-riding">${nom.riding?.name || 'Unknown Riding'}</div>
                                    <div class="nomination-province">${nom.province?.name || ''}</div>
                                    <div class="nomination-count">${nom.nominationCount || 1} nomination(s)</div>
                                    <div class="nomination-nominators">Nominated by: ${nom.nominations?.map(n => n.nominatorName).join(', ') || 'Unknown'}</div>
                                    <div class="nomination-actions">
                                        <button class="btn btn-primary" onclick="App.acceptNomination('${activeConv?.id}', '${nom.race?.id}')">✅ Accept & Run</button>
                                        <button class="btn btn-secondary" onclick="App.declineNomination('${activeConv?.id}', '${nom.race?.id}')">❌ Decline</button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    `}
                </div>
            </div>
        `;
        
        // Location selector handlers
        const provinceSelect = document.getElementById('province-select');
        const ridingSelect = document.getElementById('riding-select');
        const saveBtn = document.getElementById('save-location-btn');
        const feedback = document.getElementById('location-feedback');
        
        provinceSelect?.addEventListener('change', async (e) => {
            const provinceId = e.target.value;
            ridingSelect.innerHTML = '<option value="">Loading...</option>';
            ridingSelect.disabled = true;
            saveBtn.disabled = true;
            
            if (!provinceId) {
                ridingSelect.innerHTML = '<option value="">-- Select Riding --</option>';
                return;
            }
            
            try {
                const ridings = await App.api(`/locations/provinces/${provinceId}/ridings`);
                const grouped = {};
                ridings.forEach(r => {
                    const cat = r.category || 'Other';
                    if (!grouped[cat]) grouped[cat] = [];
                    grouped[cat].push(r);
                });
                
                let options = '<option value="">-- Select Riding --</option>';
                for (const [category, items] of Object.entries(grouped)) {
                    options += `<optgroup label="${category}">`;
                    items.forEach(r => { options += `<option value="${r.id}" data-type="${r.type}">${r.name}</option>`; });
                    options += '</optgroup>';
                }
                
                ridingSelect.innerHTML = options;
                ridingSelect.disabled = false;
            } catch (err) {
                ridingSelect.innerHTML = '<option value="">Error loading ridings</option>';
            }
        });
        
        ridingSelect?.addEventListener('change', (e) => { saveBtn.disabled = !e.target.value; });
        
        saveBtn?.addEventListener('click', async () => {
            const ridingOption = ridingSelect.options[ridingSelect.selectedIndex];
            const locationId = ridingOption.value;
            const locationType = ridingOption.dataset.type || 'FederalRiding';
            
            if (!locationId) return;
            
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving...';
            
            try {
                const { response, data } = await App.apiPut(`/users/${App.currentUser.id}/location`, { locationId, locationType });
                
                if (response.ok) {
                    feedback.innerHTML = `<span class="success">✅ Location set to ${data.location?.name || locationId}</span>`;
                    setTimeout(() => App.pages.profile(), 1500);
                } else {
                    feedback.innerHTML = `<span class="error">❌ ${data.error}</span>`;
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Save Location';
                }
            } catch (err) {
                feedback.innerHTML = `<span class="error">❌ Error: ${err.message}</span>`;
                saveBtn.disabled = false;
                saveBtn.textContent = 'Save Location';
            }
        });
        
    } catch (err) {
        content.innerHTML = `<div class="card"><div class="card-body">Error: ${err.message}</div></div>`;
    }
};

// ============================================
// CONVENTION PAGE
// ============================================

App.pages.convention = async function() {
    const content = document.getElementById('content');
    content.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    
    try {
        const conventions = await App.api('/conventions');
        const activeConv = conventions.find(c => c.status !== 'completed') || conventions[0];
        
        let activeRaces = [];
        if (activeConv) {
            activeRaces = await App.api(`/conventions/${activeConv.id}/races`);
        }
        
        const totalRaces = activeRaces.length;
        const contestedRaces = activeRaces.filter(r => r.candidateCount > 1).length;
        const uncontested = activeRaces.filter(r => r.candidateCount === 1).length;
        const vacant = activeRaces.filter(r => r.candidateCount === 0).length;
        
        const waves = [
            { wave: 1, name: 'Pacific', emoji: '🌊', provinces: 'BC, Yukon' },
            { wave: 2, name: 'Mountain', emoji: '⛰️', provinces: 'Alberta, NWT' },
            { wave: 3, name: 'Prairie', emoji: '🌾', provinces: 'SK, MB, Nunavut' },
            { wave: 4, name: 'Central', emoji: '🏙️', provinces: 'Ontario' },
            { wave: 5, name: 'Quebec', emoji: '⚜️', provinces: 'Quebec' },
            { wave: 6, name: 'Atlantic', emoji: '🦞', provinces: 'NB, NS, PE, NL' }
        ];
        
        const getStatusBadge = (status) => {
            if (status === 'upcoming') return '<span class="badge">🗓️ Coming Feb 2025</span>';
            if (status === 'completed') return '<span class="badge">✅ Completed</span>';
            if (status?.includes('-nominations')) return `<span class="badge warning">📝 ${status.replace('wave', 'Wave ').replace('-nominations', ' Nominations')}</span>`;
            if (status?.includes('-voting')) return `<span class="badge success">🗳️ ${status.replace('wave', 'Wave ').replace('-voting', ' Voting')}</span>`;
            return `<span class="badge">${status}</span>`;
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
                    <div class="wave-phase ${isActive ? 'active' : isWaveCompleted ? 'completed' : 'future'}" data-wave="${w.wave}">
                        <div class="wave-dot" style="background: ${isActive || isWaveCompleted ? 'var(--accent-primary)' : 'var(--border-color)'}"></div>
                        <div class="wave-info">
                            <div class="wave-name">${w.emoji} Wave ${w.wave}: ${w.name}</div>
                            <div class="wave-provinces">${w.provinces}</div>
                            <div class="wave-schedule">
                                <div class="wave-phase-row ${isNominating ? 'active-phase' : ''}"><span class="phase-icon">📝</span> Nominations: ${conv[`wave${w.wave}NominationStart`] ? App.formatDate(conv[`wave${w.wave}NominationStart`]) : ''} - ${conv[`wave${w.wave}NominationEnd`] ? App.formatDate(conv[`wave${w.wave}NominationEnd`]) : ''}</div>
                                <div class="wave-phase-row ${isVoting ? 'active-phase' : ''}"><span class="phase-icon">🗳️</span> Voting: ${conv[`wave${w.wave}VotingStart`] ? App.formatDate(conv[`wave${w.wave}VotingStart`]) : ''} - ${conv[`wave${w.wave}VotingEnd`] ? App.formatDate(conv[`wave${w.wave}VotingEnd`]) : ''}</div>
                            </div>
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
                <p class="page-subtitle">West to East regional voting waves</p>
            </header>
            
            ${activeConv ? `
                <div class="card convention-hero">
                    <div class="card-header">
                        <div><h2 class="card-title">${activeConv.name}</h2><p class="card-subtitle">${activeConv.description || ''}</p></div>
                        ${getStatusBadge(activeConv.status)}
                    </div>
                    <div class="card-body">${buildWaveTimeline(activeConv)}</div>
                </div>
                
                <div class="stats-row">
                    <div class="stat-card"><div class="stat-label">Total Races</div><div class="stat-value">${totalRaces}</div></div>
                    <div class="stat-card contested"><div class="stat-label">Contested</div><div class="stat-value">${contestedRaces}</div></div>
                    <div class="stat-card uncontested"><div class="stat-label">Uncontested</div><div class="stat-value">${uncontested}</div></div>
                    <div class="stat-card vacant"><div class="stat-label">Need Candidates</div><div class="stat-value">${vacant}</div></div>
                </div>
                
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">🏁 Active Races - Wave ${activeConv.currentWave || 1}</h3>
                        <span class="badge">${activeRaces.length} ridings</span>
                    </div>
                    <div class="card-body">
                        <p class="races-help">Click a riding to see candidates and nominate someone</p>
                        <div class="races-grid">
                            ${activeRaces.length === 0 ? '<p class="empty-text">No races created yet. Use Admin panel to create races.</p>' : 
                                activeRaces.map(race => `
                                    <div class="race-card ${race.candidateCount > 1 ? 'contested' : race.candidateCount === 1 ? 'uncontested' : 'vacant'}" 
                                         data-race-id="${race.id}" onclick="App.showRaceDetail('${race.id}')">
                                        <div class="race-card-header">
                                            <div class="race-riding-name">${race.riding?.name || 'Unknown'}</div>
                                            <div class="race-province-name">${race.provinceName || ''}</div>
                                        </div>
                                        <div class="race-card-body">
                                            ${race.candidateCount === 0 ? '<div class="race-empty">🚫 No candidates yet</div>' :
                                              race.candidateCount === 1 ? '<div class="race-uncontested">👤 1 candidate</div>' :
                                              `<div class="race-contested">👥 ${race.candidateCount} candidates</div>`}
                                        </div>
                                        <div class="race-card-footer"><span class="view-race-btn">View Race →</span></div>
                                    </div>
                                `).join('')
                            }
                        </div>
                    </div>
                </div>
            ` : '<div class="card"><div class="card-body"><p>No conventions available yet.</p></div></div>'}
        `;
    } catch (err) {
        content.innerHTML = `<div class="card"><div class="card-body">Error: ${err.message}</div></div>`;
    }
};

// ============================================
// ADMIN PAGE
// ============================================

App.pages.admin = async function() {
    const content = document.getElementById('content');
    content.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    
    try {
        const [conventions, autoMode] = await Promise.all([
            App.api('/conventions'),
            App.api('/admin/auto-mode')
        ]);
        const activeConv = conventions.find(c => c.status !== 'completed') || conventions[0];
        
        const phases = [
            { status: 'upcoming', label: '🗓️ Upcoming', wave: 0 },
            { status: 'wave1-nominations', label: '📝 Wave 1 Nominations', wave: 1 },
            { status: 'wave1-voting', label: '🗳️ Wave 1 Voting', wave: 1 },
            { status: 'wave2-nominations', label: '📝 Wave 2 Nominations', wave: 2 },
            { status: 'wave2-voting', label: '🗳️ Wave 2 Voting', wave: 2 },
            { status: 'wave3-nominations', label: '📝 Wave 3 Nominations', wave: 3 },
            { status: 'wave3-voting', label: '🗳️ Wave 3 Voting', wave: 3 },
            { status: 'wave4-nominations', label: '📝 Wave 4 Nominations', wave: 4 },
            { status: 'wave4-voting', label: '🗳️ Wave 4 Voting', wave: 4 },
            { status: 'wave5-nominations', label: '📝 Wave 5 Nominations', wave: 5 },
            { status: 'wave5-voting', label: '🗳️ Wave 5 Voting', wave: 5 },
            { status: 'wave6-nominations', label: '📝 Wave 6 Nominations', wave: 6 },
            { status: 'wave6-voting', label: '🗳️ Wave 6 Voting', wave: 6 },
            { status: 'completed', label: '✅ Completed', wave: 6 },
        ];
        
        content.innerHTML = `
            <header class="page-header">
                <h1 class="page-title">⚡ Admin Controls</h1>
                <p class="page-subtitle">Super admin tools for testing the convention</p>
            </header>
            
            <div class="cards-grid">
                <div class="card auto-mode-card ${autoMode.enabled ? 'enabled' : ''}">
                    <div class="card-header">
                        <h3 class="card-title">🤖 Auto Mode</h3>
                        <label class="toggle-switch">
                            <input type="checkbox" id="auto-mode-toggle" ${autoMode.enabled ? 'checked' : ''} onchange="App.toggleAutoMode(this.checked)">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                    <div class="card-body">
                        <p class="auto-mode-status">${autoMode.enabled ? '🤖 <strong>AUTO</strong> - System checks dates every hour' : '🎮 <strong>MANUAL</strong> - Use buttons to control phases'}</p>
                        ${autoMode.lastCheck ? `<p class="auto-mode-info">Last check: ${new Date(autoMode.lastCheck).toLocaleString()}</p>` : ''}
                    </div>
                </div>
                
                <div class="card">
                    <div class="card-header"><h3 class="card-title">🎮 Convention Phase Control</h3></div>
                    <div class="card-body">
                        <p style="margin-bottom: 16px;">Current: <strong>${activeConv?.status || 'none'}</strong></p>
                        <div class="admin-phase-buttons">
                            ${phases.map(p => `<button class="admin-btn ${activeConv?.status === p.status ? 'active' : ''}" onclick="App.setConventionPhase('${activeConv?.id}', '${p.status}', ${p.wave})">${p.label}</button>`).join('')}
                        </div>
                    </div>
                </div>
                
                <div class="card">
                    <div class="card-header"><h3 class="card-title">⏩ Quick Actions</h3></div>
                    <div class="card-body">
                        <button class="admin-btn primary" onclick="App.advanceConvention('${activeConv?.id}')">⏩ Advance to Next Phase</button>
                        <button class="admin-btn" onclick="App.createWaveRaces('${activeConv?.id}')" style="margin-top: 12px;">🏁 Create Races for Current Wave</button>
                        <div id="admin-result" style="margin-top: 16px; padding: 12px; background: var(--bg-secondary); border-radius: 8px; display: none;"></div>
                    </div>
                </div>
            </div>
        `;
    } catch (err) {
        content.innerHTML = `<div class="card"><div class="card-body">Error: ${err.message}</div></div>`;
    }
};

// ============================================
// ADMIN ACTIONS
// ============================================

App.toggleAutoMode = async function(enabled) {
    try {
        const { data } = await App.apiPost('/admin/auto-mode', { enabled });
        App.showAdminResult(data.message || data.error);
        App.pages.admin();
    } catch (err) {
        App.showAdminResult('Error: ' + err.message);
    }
};

App.setConventionPhase = async function(convId, status, wave) {
    try {
        const { data } = await App.apiPost(`/admin/convention/${convId}/set-phase`, { status, currentWave: wave });
        App.showAdminResult(data.message || data.error);
        App.pages.admin();
    } catch (err) {
        App.showAdminResult('Error: ' + err.message);
    }
};

App.advanceConvention = async function(convId) {
    try {
        const { data } = await App.apiPost(`/admin/convention/${convId}/advance`, {});
        App.showAdminResult(data.message || data.error);
        App.pages.admin();
    } catch (err) {
        App.showAdminResult('Error: ' + err.message);
    }
};

App.createWaveRaces = async function(convId) {
    try {
        const { data } = await App.apiPost(`/admin/convention/${convId}/create-wave-races`, {});
        App.showAdminResult(data.message || data.error);
    } catch (err) {
        App.showAdminResult('Error: ' + err.message);
    }
};

App.showAdminResult = function(message) {
    const el = document.getElementById('admin-result');
    if (el) {
        el.innerHTML = message.split('\n').map(line => `<div>${line}</div>`).join('');
        el.style.display = 'block';
    }
};

// ============================================
// NOMINATION ACTIONS
// ============================================

App.acceptNomination = async function(convId, raceId) {
    if (!App.currentUser) { alert('Please select a user first'); return; }
    
    try {
        const { response, data } = await App.apiPost(`/conventions/${convId}/accept-nomination`, { userId: App.currentUser.id, raceId });
        if (data.success) {
            alert('✅ Nomination accepted! You are now a candidate.');
            App.pages.profile();
        } else {
            alert('❌ ' + (data.error || 'Failed to accept nomination'));
        }
    } catch (err) {
        alert('❌ Error: ' + err.message);
    }
};

App.declineNomination = async function(convId, raceId) {
    if (!App.currentUser || !confirm('Are you sure you want to decline this nomination?')) return;
    
    try {
        const { data } = await App.apiPost(`/conventions/${convId}/decline-nomination`, { userId: App.currentUser.id, raceId });
        if (data.success) {
            alert('Nomination declined.');
            App.pages.profile();
        } else {
            alert('❌ ' + (data.error || 'Failed to decline'));
        }
    } catch (err) {
        alert('❌ Error: ' + err.message);
    }
};

App.withdrawFromRace = async function(convId, raceId) {
    if (!App.currentUser || !confirm('Are you sure you want to withdraw from this race?')) return;
    
    try {
        const { data } = await App.apiPost(`/conventions/${convId}/withdraw`, { userId: App.currentUser.id, raceId });
        if (data.success) {
            alert('You have withdrawn from the race.');
            App.pages.profile();
        } else {
            alert('❌ ' + (data.error || 'Failed to withdraw'));
        }
    } catch (err) {
        alert('❌ Error: ' + err.message);
    }
};

// ============================================
// MODALS
// ============================================

App.showMemberDetail = async function(userId) {
    try {
        const [user, conventions] = await Promise.all([
            App.api(`/users/${userId}`),
            App.api('/conventions')
        ]);
        
        const activeConv = conventions.find(c => c.status !== 'completed');
        const isNominationsOpen = activeConv?.status?.includes('nominations');
        const hasLocation = user.location && user.location.id;
        const locationType = user.location?.type || 'FederalRiding';
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <div class="profile-header">
                        <div class="profile-avatar">${App.getInitials(user.name)}</div>
                        <div>
                            <h2>${user.name}</h2>
                            <p class="modal-subtitle">📍 ${user.location?.name || user.region || 'No location set'}</p>
                        </div>
                    </div>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <p class="member-bio">${user.bio || 'No bio provided'}</p>
                    <div class="member-stats">
                        <div class="member-stat"><span class="stat-value">${user.points || 0}</span><span class="stat-label">Points</span></div>
                        <div class="member-stat"><span class="stat-value">${user.endorsementCount || 0}</span><span class="stat-label">Endorsements</span></div>
                    </div>
                    ${user.skills?.length ? `<div class="member-section"><h4>Skills</h4><div class="tags">${user.skills.map(s => `<span class="tag">${s}</span>`).join('')}</div></div>` : ''}
                    <hr class="modal-divider">
                    <div class="nominate-section">
                        <h4>📝 Nominate for Convention</h4>
                        ${!App.currentUser ? '<p class="nominate-hint">Select yourself from the "Playing as" dropdown to nominate this member.</p>' :
                          App.currentUser.id === userId ? '<p class="nominate-hint">You cannot nominate yourself.</p>' :
                          !isNominationsOpen ? '<p class="nominate-hint">Nominations are not currently open.</p>' :
                          !hasLocation ? '<p class="nominate-hint">This member hasn\'t set their riding yet.</p>' :
                          `<p class="nominate-info">Nominate <strong>${user.name}</strong> to run in <strong>${user.location.name}</strong></p>
                           <button class="btn btn-primary" id="nominate-member-btn">🗳️ Nominate ${user.name}</button>
                           <div id="nominate-feedback" class="nomination-feedback"></div>`}
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        const nominateBtn = modal.querySelector('#nominate-member-btn');
        if (nominateBtn) {
            nominateBtn.addEventListener('click', async () => {
                const feedback = modal.querySelector('#nominate-feedback');
                nominateBtn.disabled = true;
                nominateBtn.textContent = 'Nominating...';
                
                try {
                    const { response, data } = await App.apiPost(`/conventions/${activeConv.id}/nominate`, {
                        nominatorId: App.currentUser.id,
                        nomineeId: userId,
                        ridingId: user.location.id,
                        ridingType: locationType
                    });
                    
                    if (response.ok && data.success) {
                        feedback.innerHTML = `<span class="success">✅ ${user.name} has been nominated!</span>`;
                        nominateBtn.textContent = '✅ Nominated!';
                    } else {
                        feedback.innerHTML = `<span class="error">❌ ${data.error || 'Failed'}</span>`;
                        nominateBtn.disabled = false;
                        nominateBtn.textContent = `🗳️ Nominate ${user.name}`;
                    }
                } catch (err) {
                    feedback.innerHTML = `<span class="error">❌ ${err.message}</span>`;
                    nominateBtn.disabled = false;
                    nominateBtn.textContent = `🗳️ Nominate ${user.name}`;
                }
            });
        }
        
        modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    } catch (err) {
        alert('Error loading member details');
    }
};

App.showRaceDetail = async function(raceId) {
    try {
        const race = await App.api(`/conventions/races/${raceId}`);
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content modal-wide">
                <div class="modal-header">
                    <div>
                        <h2>${race.riding?.name || 'Unknown Riding'}</h2>
                        <p class="modal-subtitle">${race.province?.name || ''}</p>
                    </div>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <h3 class="candidates-header">${race.candidates?.length || 0} Declared Candidates</h3>
                    ${race.candidates?.length === 0 ? `
                        <p class="empty-text">No candidates have accepted nominations for this riding yet.</p>
                        <p class="nomination-hint">💡 To nominate someone: Go to <strong>Members</strong>, find a member who lives in this riding, and click "Nominate".</p>
                    ` : `
                        <div class="race-candidates-detail">
                            ${race.candidates.map((c, i) => `
                                <div class="race-candidate-card ${i === 0 ? 'leading' : ''}">
                                    <div class="candidate-rank">#${i + 1}</div>
                                    <div class="candidate-avatar-lg">${App.getInitials(c.name)}</div>
                                    <div class="candidate-info-detail">
                                        <h4>${c.name}</h4>
                                        <p class="candidate-bio-short">${c.bio || 'No bio'}</p>
                                        <div class="candidate-stats-row">
                                            <span class="stat-pill points">⭐ ${c.points || 0} points</span>
                                            <span class="stat-pill endorsements">👍 ${c.endorsementCount || 0} endorsements</span>
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    `}
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    } catch (err) {
        console.error('Error loading race:', err);
    }
};

