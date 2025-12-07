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
            <div class="card">
                <div class="card-header"><h3 class="card-title">⚙️ Settings</h3></div>
                <div class="card-body">
                    <div class="theme-toggle-row">
                        <div class="theme-toggle-info">
                            <h4>🖥️ VT100 Mode</h4>
                            <p>Classic 1980s green phosphor terminal</p>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" id="theme-toggle" ${App.currentTheme === 'vt100' ? 'checked' : ''} onchange="App.toggleTheme(this.checked)">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                </div>
            </div>
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
                            <p class="profile-region">${userDetails.locations?.length > 0 
                                ? userDetails.locations.map(l => l.name).join(' • ') 
                                : (App.currentUser.region || 'No locations set')}</p>
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
                        <h4>My Location</h4>
                        <p class="location-help">Set your location to appear in local candidates list and receive nominations for your area.</p>
                        
                        <div class="location-selector-row">
                            <label>Province</label>
                            <select id="province-select" class="form-select">
                                <option value="">-- Select Province --</option>
                                ${provinces.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                            </select>
                        </div>
                        
                        <div class="location-selector-row">
                            <label>Federal Riding</label>
                            <select id="federal-riding-select" class="form-select" disabled><option value="">-- Select Federal Riding --</option></select>
                        </div>
                        
                        <div class="location-selector-row">
                            <label>Provincial Riding</label>
                            <select id="provincial-riding-select" class="form-select" disabled><option value="">-- Select Provincial Riding --</option></select>
                        </div>
                        
                        <div class="location-selector-row">
                            <label>Town</label>
                            <select id="town-select" class="form-select" disabled><option value="">-- Select Town --</option></select>
                        </div>
                        
                        <div class="location-selector-row">
                            <label>First Nation</label>
                            <select id="first-nation-select" class="form-select" disabled><option value="">-- Select First Nation --</option></select>
                        </div>
                        
                        <div class="location-selector-row">
                            <label>Group</label>
                            <select id="group-select" class="form-select" disabled><option value="">-- Select Group --</option></select>
                        </div>
                        
                        <button class="btn btn-primary" id="save-location-btn" disabled style="margin-top: 12px;">Save Locations</button>
                        <div id="location-feedback" class="location-feedback"></div>
                        ${userDetails.locations && userDetails.locations.length > 0 ? `
                            <div class="current-locations">
                                <strong>Current Locations:</strong>
                                <ul class="locations-list">
                                    ${userDetails.locations.map(loc => `<li>${loc.name} <span class="location-type">(${loc.type})</span></li>`).join('')}
                                </ul>
                            </div>
                        ` : ''}
                    </div>
                    
                    <!-- Theme Toggle -->
                    <div class="theme-toggle-section">
                        <div class="theme-toggle-row">
                            <div class="theme-toggle-info">
                                <h4>🖥️ VT100 Mode</h4>
                                <p>Classic 1980s green phosphor terminal</p>
                            </div>
                            <label class="toggle-switch">
                                <input type="checkbox" id="theme-toggle" ${App.currentTheme === 'vt100' ? 'checked' : ''} onchange="App.toggleTheme(this.checked)">
                                <span class="toggle-slider"></span>
                            </label>
                        </div>
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
        const federalSelect = document.getElementById('federal-riding-select');
        const provincialSelect = document.getElementById('provincial-riding-select');
        const townSelect = document.getElementById('town-select');
        const firstNationSelect = document.getElementById('first-nation-select');
        const groupSelect = document.getElementById('group-select');
        const saveBtn = document.getElementById('save-location-btn');
        const feedback = document.getElementById('location-feedback');
        
        // Helper to populate a dropdown
        const populateDropdown = (select, items, placeholder, type) => {
            let options = `<option value="">${placeholder}</option>`;
            items.forEach(item => {
                options += `<option value="${item.id}" data-type="${type}">${item.name}</option>`;
            });
            select.innerHTML = options;
            select.disabled = items.length === 0;
        };
        
        // Check if any dropdown has a selection
        const hasAnySelection = () => {
            return [federalSelect, provincialSelect, townSelect, firstNationSelect, groupSelect].some(sel => 
                sel && sel.value
            );
        };
        
        // Province change - load all location types
        provinceSelect?.addEventListener('change', async (e) => {
            const provinceId = e.target.value;
            saveBtn.disabled = true;
            
            // Reset all dropdowns
            [federalSelect, provincialSelect, townSelect, firstNationSelect, groupSelect].forEach(sel => {
                if (sel) {
                    sel.innerHTML = '<option value="">Loading...</option>';
                    sel.disabled = true;
                }
            });
            
            if (!provinceId) {
                populateDropdown(federalSelect, [], '-- Select Federal Riding --', 'FederalRiding');
                populateDropdown(provincialSelect, [], '-- Select Provincial Riding --', 'ProvincialRiding');
                populateDropdown(townSelect, [], '-- Select Town --', 'Town');
                populateDropdown(firstNationSelect, [], '-- Select First Nation --', 'FirstNation');
                populateDropdown(groupSelect, [], '-- Select Group --', 'AdhocGroup');
                return;
            }
            
            try {
                // Load all location types in parallel
                const [federal, provincial, towns, firstNations, groups] = await Promise.all([
                    App.api(`/locations/provinces/${provinceId}/federal-ridings`),
                    App.api(`/locations/provinces/${provinceId}/provincial-ridings`),
                    App.api(`/locations/provinces/${provinceId}/towns`),
                    App.api(`/locations/provinces/${provinceId}/first-nations`),
                    App.api(`/locations/provinces/${provinceId}/adhoc-groups`)
                ]);
                
                populateDropdown(federalSelect, federal, '-- Select Federal Riding --', 'FederalRiding');
                populateDropdown(provincialSelect, provincial, '-- Select Provincial Riding --', 'ProvincialRiding');
                populateDropdown(townSelect, towns, '-- Select Town --', 'Town');
                populateDropdown(firstNationSelect, firstNations, '-- Select First Nation --', 'FirstNation');
                populateDropdown(groupSelect, groups, '-- Select Group --', 'AdhocGroup');
            } catch (err) {
                feedback.innerHTML = `<span class="error">Error loading locations</span>`;
            }
        });
        
        // Enable save button when any dropdown changes
        [federalSelect, provincialSelect, townSelect, firstNationSelect, groupSelect].forEach(sel => {
            sel?.addEventListener('change', () => {
                saveBtn.disabled = !hasAnySelection();
            });
        });
        
        // Save button - save ALL selected locations
        saveBtn?.addEventListener('click', async () => {
            const locations = [];
            
            if (federalSelect?.value) {
                locations.push({ id: federalSelect.value, type: 'FederalRiding' });
            }
            if (provincialSelect?.value) {
                locations.push({ id: provincialSelect.value, type: 'ProvincialRiding' });
            }
            if (townSelect?.value) {
                locations.push({ id: townSelect.value, type: 'Town' });
            }
            if (firstNationSelect?.value) {
                locations.push({ id: firstNationSelect.value, type: 'FirstNation' });
            }
            if (groupSelect?.value) {
                locations.push({ id: groupSelect.value, type: 'AdhocGroup' });
            }
            
            if (locations.length === 0) return;
            
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving...';
            
            try {
                const { response, data } = await App.apiPut(`/users/${App.currentUser.id}/locations`, { locations });
                
                if (response.ok) {
                    feedback.innerHTML = `<span class="success">Saved ${locations.length} location(s)</span>`;
                    setTimeout(() => App.pages.profile(), 1500);
                } else {
                    feedback.innerHTML = `<span class="error">${data.error}</span>`;
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Save Location';
                }
            } catch (err) {
                feedback.innerHTML = `<span class="error">Error: ${err.message}</span>`;
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
                
                ${activeConv.status?.includes('-voting') ? `
                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title">🗳️ Voting - Wave ${activeConv.currentWave || 1}</h3>
                            <span class="badge success">${activeRaces.length} ridings</span>
                        </div>
                        <div class="card-body">
                            <p class="races-help">Cast your vote for candidates in each riding</p>
                            <div id="voting-races-container">
                                <div class="loading"><div class="spinner"></div></div>
                            </div>
                        </div>
                    </div>
                ` : `
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
                                                ${race.candidateCount === 0 ? '<div class="race-empty">No candidates yet</div>' :
                                                  race.candidateCount === 1 ? '<div class="race-uncontested">1 candidate</div>' :
                                                  `<div class="race-contested">${race.candidateCount} candidates</div>`}
                                            </div>
                                            <div class="race-card-footer"><span class="view-race-btn">View Race →</span></div>
                                        </div>
                                    `).join('')
                                }
                            </div>
                        </div>
                    </div>
                `}
            ` : '<div class="card"><div class="card-body"><p>No conventions available yet.</p></div></div>'}
        `;
        
        // Load voting UI if in voting phase
        if (activeConv?.status?.includes('-voting')) {
            const votingContainer = document.getElementById('voting-races-container');
            if (votingContainer && App.voting) {
                App.voting.loadVotingUI(activeConv.id, votingContainer);
            }
        }
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
        const [allConventions, autoMode] = await Promise.all([
            App.api('/admin/conventions'),
            App.api('/admin/auto-mode')
        ]);
        
        // Find active convention (non-completed) or most recent
        const activeConv = allConventions.find(c => c.status !== 'completed') || allConventions[0];
        const pastConventions = allConventions.filter(c => c.status === 'completed');
        
        // Fetch stats for the active convention
        let stats = null;
        if (activeConv?.id) {
            try {
                stats = await App.api(`/admin/convention/${activeConv.id}/stats`);
            } catch (e) {
                console.log('Could not fetch stats:', e.message);
            }
        }
        
        const phases = [
            { status: 'upcoming', label: '🗓️ Upcoming', wave: 0 },
            { status: 'wave1-nominations', label: '📝 Wave 1 Nom', wave: 1 },
            { status: 'wave1-voting', label: '🗳️ Wave 1 Vote', wave: 1 },
            { status: 'wave2-nominations', label: '📝 Wave 2 Nom', wave: 2 },
            { status: 'wave2-voting', label: '🗳️ Wave 2 Vote', wave: 2 },
            { status: 'wave3-nominations', label: '📝 Wave 3 Nom', wave: 3 },
            { status: 'wave3-voting', label: '🗳️ Wave 3 Vote', wave: 3 },
            { status: 'wave4-nominations', label: '📝 Wave 4 Nom', wave: 4 },
            { status: 'wave4-voting', label: '🗳️ Wave 4 Vote', wave: 4 },
            { status: 'wave5-nominations', label: '📝 Wave 5 Nom', wave: 5 },
            { status: 'wave5-voting', label: '🗳️ Wave 5 Vote', wave: 5 },
            { status: 'wave6-nominations', label: '📝 Wave 6 Nom', wave: 6 },
            { status: 'wave6-voting', label: '🗳️ Wave 6 Vote', wave: 6 },
            { status: 'completed', label: '✅ Completed', wave: 6 },
        ];
        
        const currentYear = new Date().getFullYear();
        
        content.innerHTML = `
            <header class="page-header">
                <h1 class="page-title">Admin Controls</h1>
                <p class="page-subtitle">Convention management and testing tools</p>
            </header>
            
            <div class="cards-grid">
                <!-- All Conventions Card -->
                <div class="card">
                    <div class="card-header"><h3 class="card-title">📋 All Conventions</h3></div>
                    <div class="card-body">
                        ${allConventions.length === 0 ? '<p class="empty-text">No conventions yet. Create one below.</p>' : `
                            <div class="convention-list">
                                ${allConventions.map(c => `
                                    <div class="convention-item ${c.id === activeConv?.id ? 'active' : ''} ${c.status === 'completed' ? 'completed' : ''}">
                                        <div class="convention-info">
                                            <span class="convention-name">${c.name}</span>
                                            <span class="convention-status">${c.status}</span>
                                        </div>
                                        <div class="convention-stats">
                                            ${c.totalRaces} races, ${c.totalCandidates} candidates
                                            ${c.winnersDecided > 0 ? `, ${c.winnersDecided} winners` : ''}
                                        </div>
                                        <div class="convention-actions">
                                            ${c.status === 'completed' ? 
                                                `<button class="admin-btn small" onclick="App.viewConventionResults('${c.id}')">View Results</button>` :
                                                `<button class="admin-btn small primary" onclick="App.setActiveConvention('${c.id}')">Manage</button>`
                                            }
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        `}
                    </div>
                </div>
                
                <!-- Create New Convention Card -->
                <div class="card">
                    <div class="card-header"><h3 class="card-title">➕ Create New Convention</h3></div>
                    <div class="card-body">
                        <div class="form-group">
                            <label>Convention Name</label>
                            <input type="text" id="new-conv-name" class="form-input" placeholder="e.g., ${currentYear + 1} National Convention" value="${currentYear + 1} National Convention">
                        </div>
                        <div class="form-group">
                            <label>Year</label>
                            <input type="number" id="new-conv-year" class="form-input" min="2020" max="2100" value="${currentYear + 1}">
                        </div>
                        <button class="admin-btn primary" onclick="App.createNewConvention()" style="margin-top: 12px;">➕ Create Convention</button>
                        <div id="create-conv-result" style="margin-top: 12px; display: none;"></div>
                    </div>
                </div>
                
                ${activeConv ? `
                <!-- Active Convention Controls -->
                <div class="card" style="grid-column: span 2;">
                    <div class="card-header">
                        <h3 class="card-title">🎯 Active: ${activeConv.name}</h3>
                    </div>
                    <div class="card-body">
                        <div class="stats-grid" style="margin-bottom: 20px;">
                            <div class="stat-item">
                                <span class="stat-value">${stats?.totalRaces || 0}</span>
                                <span class="stat-label">Races</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-value">${stats?.totalCandidates || 0}</span>
                                <span class="stat-label">Candidates</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-value">${stats?.totalNominations || 0}</span>
                                <span class="stat-label">Nominations</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-value">${stats?.totalVotes || 0}</span>
                                <span class="stat-label">Votes</span>
                            </div>
                        </div>
                        
                        <p style="margin-bottom: 12px;">Current Phase: <strong>${activeConv.status}</strong> ${stats?.currentWave ? `(Wave ${stats.currentWave})` : ''}</p>
                        
                        <div class="admin-phase-buttons" style="margin-bottom: 16px;">
                            ${phases.map(p => `<button class="admin-btn ${activeConv.status === p.status ? 'active' : ''}" onclick="App.setConventionPhase('${activeConv.id}', '${p.status}', ${p.wave})">${p.label}</button>`).join('')}
                        </div>
                        
                        <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                            <button class="admin-btn primary" onclick="App.advanceConvention('${activeConv.id}')">⏩ Advance Phase</button>
                            <button class="admin-btn" onclick="App.createWaveRaces('${activeConv.id}')">🏁 Create Races</button>
                            ${activeConv.status?.includes('-voting') ? `
                                <button class="admin-btn" onclick="App.startAllVoting('${activeConv.id}')">▶️ Start All Voting</button>
                                <button class="admin-btn warning" onclick="App.closeAllRounds('${activeConv.id}')">⏭️ Close All Rounds</button>
                            ` : ''}
                            <button class="admin-btn danger" onclick="App.confirmResetConvention('${activeConv.id}')">🔄 Reset</button>
                            <button class="admin-btn danger" onclick="App.confirmDeleteConvention('${activeConv.id}', '${activeConv.name}')">🗑️ Delete</button>
                        </div>
                        
                        <div id="admin-result" style="margin-top: 16px; padding: 12px; background: var(--bg-secondary); border-radius: 8px; display: none;"></div>
                    </div>
                </div>
                ` : ''}
                
                <!-- Auto Mode Card -->
                <div class="card auto-mode-card ${autoMode.enabled ? 'enabled' : ''}">
                    <div class="card-header">
                        <h3 class="card-title">🤖 Auto Mode</h3>
                        <label class="toggle-switch">
                            <input type="checkbox" id="auto-mode-toggle" ${autoMode.enabled ? 'checked' : ''} onchange="App.toggleAutoMode(this.checked)">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                    <div class="card-body">
                        <p class="auto-mode-status">${autoMode.enabled ? '🤖 <strong>AUTO</strong> - Checks dates hourly' : '🎮 <strong>MANUAL</strong> - Use buttons'}</p>
                        ${autoMode.lastCheck ? `<p class="auto-mode-info">Last check: ${new Date(autoMode.lastCheck).toLocaleString()}</p>` : ''}
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

App.startAllVoting = async function(convId) {
    try {
        const races = await App.api(`/voting/races/${convId}`);
        let started = 0;
        let skipped = 0;
        
        for (const race of races) {
            if (race.candidates.length > 0 && race.currentRound === 0) {
                const response = await fetch(`/api/voting/race/${race.race.id}/start`, { method: 'POST' });
                if (response.ok) started++;
            } else {
                skipped++;
            }
        }
        
        App.showAdminResult(`Started voting on ${started} races. Skipped ${skipped} (already started or no candidates).`);
        setTimeout(() => App.pages.admin(), 2000);
    } catch (err) {
        App.showAdminResult('Error: ' + err.message);
    }
};

App.closeAllRounds = async function(convId) {
    if (!confirm('This will close all active rounds and eliminate the lowest candidate in each. Continue?')) return;
    
    try {
        const races = await App.api(`/voting/races/${convId}`);
        let closed = 0;
        let winners = [];
        let eliminated = [];
        
        for (const race of races) {
            if (race.currentRound > 0 && !race.race.winnerId) {
                const response = await fetch(`/api/voting/race/${race.race.id}/close-round`, { method: 'POST' });
                if (response.ok) {
                    const result = await response.json();
                    closed++;
                    if (result.result === 'winner') {
                        winners.push(`${race.riding.name}: ${result.winner.name}`);
                    } else if (result.eliminated) {
                        eliminated.push(`${race.riding.name}: ${result.eliminated.name} eliminated`);
                    }
                }
            }
        }
        
        let message = `Closed ${closed} rounds.\n`;
        if (winners.length) message += `\n🏆 Winners:\n${winners.join('\n')}`;
        if (eliminated.length) message += `\n\n❌ Eliminated:\n${eliminated.join('\n')}`;
        
        App.showAdminResult(message);
        setTimeout(() => App.pages.admin(), 3000);
    } catch (err) {
        App.showAdminResult('Error: ' + err.message);
    }
};

App.confirmResetConvention = function(convId) {
    if (!confirm('⚠️ WARNING: This will DELETE all races, nominations, candidates, and votes!\n\nThe convention will be reset to "upcoming" status.\n\nAre you sure you want to continue?')) {
        return;
    }
    
    // Double confirm for safety
    if (!confirm('🔄 FINAL CONFIRMATION\n\nThis action cannot be undone. Reset the entire convention?')) {
        return;
    }
    
    App.resetConvention(convId);
};

App.resetConvention = async function(convId) {
    try {
        App.showAdminResult('🔄 Resetting convention...');
        const { data } = await App.apiPost(`/admin/convention/${convId}/reset`, {});
        App.showAdminResult(data.message || data.error);
        setTimeout(() => App.pages.admin(), 2000);
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
// CONVENTION MANAGEMENT
// ============================================

App.createNewConvention = async function() {
    const name = document.getElementById('new-conv-name')?.value?.trim();
    const year = parseInt(document.getElementById('new-conv-year')?.value);
    const resultEl = document.getElementById('create-conv-result');
    
    if (!name || !year) {
        if (resultEl) {
            resultEl.style.display = 'block';
            resultEl.innerHTML = '<span style="color: var(--danger);">Please enter a name and year</span>';
        }
        return;
    }
    
    try {
        if (resultEl) {
            resultEl.style.display = 'block';
            resultEl.innerHTML = 'Creating convention...';
        }
        
        const { data } = await App.apiPost('/admin/conventions', { name, year });
        
        if (data.success) {
            if (resultEl) {
                resultEl.innerHTML = `<span style="color: var(--success);">${data.message}</span>`;
            }
            setTimeout(() => App.pages.admin(), 1500);
        } else {
            if (resultEl) {
                resultEl.innerHTML = `<span style="color: var(--danger);">${data.error}</span>`;
            }
        }
    } catch (err) {
        if (resultEl) {
            resultEl.style.display = 'block';
            resultEl.innerHTML = `<span style="color: var(--danger);">Error: ${err.message}</span>`;
        }
    }
};

App.setActiveConvention = function(convId) {
    // Just reload the admin page - it will automatically show this convention
    // if it's the active one (non-completed)
    App.pages.admin();
};

App.viewConventionResults = async function(convId) {
    const content = document.getElementById('content');
    content.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    
    try {
        const results = await App.api(`/admin/convention/${convId}/results`);
        
        content.innerHTML = `
            <header class="page-header">
                <h1 class="page-title">📊 ${results.name} Results</h1>
                <p class="page-subtitle">Final results from ${results.year}</p>
            </header>
            
            <div style="margin-bottom: 20px;">
                <button class="admin-btn" onclick="App.pages.admin()">← Back to Admin</button>
            </div>
            
            <div class="cards-grid">
                ${Object.entries(results.waves).map(([waveNum, wave]) => `
                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title">Wave ${waveNum}: ${wave.waveName}</h3>
                        </div>
                        <div class="card-body">
                            <div class="results-list">
                                ${wave.races.map(race => `
                                    <div class="result-item ${race.winner ? 'has-winner' : 'no-winner'}">
                                        <div class="result-riding">
                                            <span class="riding-name">${race.ridingName}</span>
                                            <span class="riding-province">${race.provinceName || ''}</span>
                                        </div>
                                        <div class="result-winner">
                                            ${race.winner ? 
                                                `<span class="winner-name">🏆 ${race.winner.name}</span>` :
                                                `<span class="no-winner-text">No winner</span>`
                                            }
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    } catch (err) {
        content.innerHTML = `
            <div class="card">
                <div class="card-body">
                    <p>Error loading results: ${err.message}</p>
                    <button class="admin-btn" onclick="App.pages.admin()">← Back to Admin</button>
                </div>
            </div>
        `;
    }
};

App.confirmDeleteConvention = function(convId, name) {
    if (!confirm(`⚠️ WARNING: Delete "${name}"?\n\nThis will permanently delete the convention and ALL its data (races, nominations, votes, results).\n\nThis cannot be undone!`)) {
        return;
    }
    
    if (!confirm(`🗑️ FINAL CONFIRMATION\n\nType "DELETE" to confirm... (Just kidding, click OK to delete "${name}")`)) {
        return;
    }
    
    App.deleteConvention(convId);
};

App.deleteConvention = async function(convId) {
    try {
        App.showAdminResult('🗑️ Deleting convention...');
        const response = await fetch(`/api/admin/convention/${convId}`, { method: 'DELETE' });
        const data = await response.json();
        
        if (data.success) {
            App.showAdminResult(data.message);
            setTimeout(() => App.pages.admin(), 1500);
        } else {
            App.showAdminResult('Error: ' + (data.error || 'Failed to delete'));
        }
    } catch (err) {
        App.showAdminResult('Error: ' + err.message);
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

