/**
 * Page Loaders
 * Each function renders a different page of the app
 */

window.App = window.App || {};
App.pages = {};

// ============================================
// DASHBOARD
// ============================================

App.pages.dashboard = async function() {
    const content = document.getElementById('content');
    content.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    
    try {
        const [users, ideas, events, votes] = await Promise.all([
            App.api('/users'),
            App.api('/ideas'),
            App.api('/events'),
            App.api('/votes')
        ]);

        let pointsSummary = null;
        let localLeaderboard = null;

        if (App.authUser) {
            try {
                pointsSummary = await App.api('/points/me');
                if (pointsSummary && pointsSummary.location) {
                    const { id, type } = pointsSummary.location;
                    localLeaderboard = await App.api(
                        `/points/leaderboard?locationId=${encodeURIComponent(id)}&locationType=${encodeURIComponent(type)}&limit=5`
                    );
                }
            } catch (e) {
                // Points are optional on dashboard; ignore failures
                // eslint-disable-next-line no-console
                console.warn('Points summary unavailable:', e.message || e);
            }
        }
        
        const hasPoints = !!pointsSummary;
        const leaderboardUsers = localLeaderboard?.users || [];
        const locationName = pointsSummary?.location?.name;
        
        content.innerHTML = `
            <header class="page-header">
                <h1 class="page-title">Dashboard</h1>
                <p class="page-subtitle">Overview of your community platform</p>
            </header>
            
            <div class="stats-row">
                <div class="stat-card"><div class="stat-label">Members</div><div class="stat-value">${users.length}</div></div>
                <div class="stat-card"><div class="stat-label">Ideas</div><div class="stat-value">${ideas.length}</div></div>
                <div class="stat-card"><div class="stat-label">Events</div><div class="stat-value">${events.length}</div></div>
                <div class="stat-card"><div class="stat-label">Votes</div><div class="stat-value">${votes.length}</div></div>
            </div>
            
            <div class="cards-grid">
                <div class="card">
                    <div class="card-header">
                        <div>
                            <h3 class="card-title">Welcome to Political Party</h3>
                            <p class="card-subtitle">Community engagement platform</p>
                        </div>
                    </div>
                    <div class="card-body">
                        <p>This platform enables democratic participation through:</p>
                        <ul style="margin-top: 12px; padding-left: 20px;">
                            <li>Member nominations and endorsements</li>
                            <li>Idea submissions and community support</li>
                            <li>Assembly events and participation</li>
                            <li>Transparent voting sessions</li>
                        </ul>
                    </div>
                </div>

                <div class="card">
                    <div class="card-header">
                        <div>
                            <h3 class="card-title">Local Points</h3>
                            <p class="card-subtitle">Support earned from your neighbours</p>
                        </div>
                    </div>
                    <div class="card-body">
                        ${
                            hasPoints
                                ? `
                            <p>You are based in <strong>${locationName}</strong>.</p>
                            <div class="stats-row small">
                                <div class="stat-card">
                                    <div class="stat-label">Local points</div>
                                    <div class="stat-value">${pointsSummary.localPoints}</div>
                                </div>
                                <div class="stat-card">
                                    <div class="stat-label">Global points</div>
                                    <div class="stat-value">${pointsSummary.globalPoints}</div>
                                </div>
                            </div>
                            ${
                                leaderboardUsers.length
                                    ? `
                                <h4 style="margin-top: 16px;">Top contributors in ${locationName}</h4>
                                <ul class="simple-list">
                                    ${leaderboardUsers
                                        .map(
                                            (u, idx) => `
                                        <li class="simple-list-item">
                                            <span class="rank-badge">#${idx + 1}</span>
                                            <span class="simple-list-name">${u.name}</span>
                                            <span class="simple-list-meta">${u.localPoints} local • ${u.globalPoints} global</span>
                                        </li>
                                    `
                                        )
                                        .join('')}
                                </ul>
                            `
                                    : '<p class="empty-text">No local points yet. Post ideas and earn support from your community!</p>'
                            }
                        `
                                : `
                            <p class="empty-text">
                                Sign in and set your riding/location in your profile to start earning local points.
                            </p>
                        `
                        }
                    </div>
                </div>
            </div>
        `;
    } catch (err) {
        content.innerHTML = `<div class="card"><div class="card-body">Error: ${err.message}</div></div>`;
    }
};

// ============================================
// BROWSE IDEAS (Three-Panel Layout)
// ============================================

App.pages.browse = async function() {
    const content = document.getElementById('content');
    const pageId = 'ideas';
    
    content.innerHTML = App.createThreePanelLayout({
        pageId,
        panel1Title: '🌍 Locations',
        panel2Title: '💡 Ideas',
        panel3Title: '📄 Details',
        emptyIcon2: '🗺️',
        emptyText2: 'Select a location to view ideas',
        emptyIcon3: '💡',
        emptyText3: 'Select an idea to view details'
    });
    
    await App.initLocationTree(pageId, App.onIdeasLocationSelect);
};

App.onIdeasLocationSelect = async function(type, id, name, autoSelectFirst = false) {
    const pageId = 'ideas';
    App.showSelectedBadge(pageId, name);
    App.showListLoading(pageId);
    App.showDetailEmpty(pageId, '💡', 'Select an idea to view details');
    
    try {
        const ideas = await App.api(`/locations/${type}/${id}/ideas`);
        
        if (!ideas.length) {
            App.showListEmpty(pageId, '💭', 'No ideas from this location yet');
            return;
        }
        
        App.panelState[pageId].currentItems = ideas;
        
        const list = document.getElementById(`${pageId}-list`);
        const showMapLink = type === 'provinces' || type === 'countries';
        list.innerHTML = `
            ${showMapLink ? `
            <div class="panel-toolbar">
                <span class="panel-toolbar-title">${name}</span>
                <button class="map-link-btn" id="ideas-map-link">🗺️ Map</button>
            </div>
            ` : ''}
            ${ideas.map((idea, index) => `
                <div class="list-item" data-index="${index}" data-id="${idea.id}">
                    <div class="list-item-title">${idea.title}</div>
                    <div class="list-item-meta">
                        <span class="list-item-stat">👍 ${idea.supportCount || 0}</span>
                        <span>${idea.author?.name || 'Anonymous'}</span>
                    </div>
                </div>
            `).join('')}
        `;
        
        document.querySelectorAll(`#${pageId}-list .list-item`).forEach(item => {
            item.addEventListener('click', () => {
                document.querySelectorAll(`#${pageId}-list .list-item`).forEach(i => i.classList.remove('selected'));
                item.classList.add('selected');
                const idx = parseInt(item.dataset.index);
                App.showIdeaDetailPanel(App.panelState[pageId].currentItems[idx]);
            });
        });
        
        // Map link
        const mapLink = document.getElementById('ideas-map-link');
        if (mapLink) {
            mapLink.addEventListener('click', () => {
                if (type === 'provinces') {
                    App.showProvinceMap(pageId, id, name);
                } else {
                    const detail = document.getElementById(`${pageId}-detail`);
                    if (!detail) return;
                    let placeholder = detail.querySelector('.province-map-placeholder');
                    if (!placeholder) {
                        placeholder = document.createElement('div');
                        placeholder.className = 'province-map-placeholder';
                        placeholder.innerHTML = `
                            <strong>🗺️ Country Map (coming soon)</strong>
                            <p>Once map data is loaded, you’ll see an overview of provinces with riding pins.</p>
                        `;
                        detail.appendChild(placeholder);
                    }
                    placeholder.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        }
        
        // Auto-select first item if requested
        if (autoSelectFirst && ideas.length > 0) {
            const firstItem = document.querySelector(`#${pageId}-list .list-item`);
            if (firstItem) {
                firstItem.classList.add('selected');
                App.showIdeaDetailPanel(ideas[0]);
            }
        }
    } catch (err) {
        App.showListEmpty(pageId, '⚠️', `Error: ${err.message}`);
    }
};

App.showIdeaDetailPanel = function(idea) {
    const detail = document.getElementById('ideas-detail');
    detail.innerHTML = `
        <div class="detail-content">
            <div class="detail-header">
                <h2 class="detail-title">${idea.title}</h2>
                <p class="detail-subtitle">${idea.author ? `Posted by ${idea.author.name}` : 'Posted anonymously'}${idea.region ? ` • ${idea.region}` : ''}</p>
            </div>
            <div class="detail-stats">
                <div class="detail-stat">
                    <div class="detail-stat-value">${idea.supportCount || 0}</div>
                    <div class="detail-stat-label">Supporters</div>
                </div>
            </div>
            <div class="detail-body">${idea.description || 'No description provided.'}</div>
            ${idea.tags?.length ? `<div class="detail-tags">${idea.tags.map(tag => `<span class="tag accent">${tag}</span>`).join('')}</div>` : ''}
        </div>
    `;
};

// Province map (using First Nations lat/lon when available)
App.showProvinceMap = async function(pageId, provinceId, provinceName) {
    const detail = document.getElementById(`${pageId}-detail`);
    if (!detail) return;

    // Remove any previous placeholder
    const existingPlaceholder = detail.querySelector('.province-map-placeholder');
    if (existingPlaceholder) {
        existingPlaceholder.remove();
    }

    // Remove previous canvas
    const existingCanvas = detail.querySelector('.province-map-canvas');
    if (existingCanvas && existingCanvas.parentElement) {
        existingCanvas.parentElement.remove();
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'province-map-wrapper';
    const title = document.createElement('div');
    title.className = 'panel-toolbar-title';
    title.textContent = `Map of ${provinceName} (First Nations positions)`;
    const canvas = document.createElement('div');
    canvas.className = 'province-map-canvas';

    wrapper.appendChild(title);
    wrapper.appendChild(canvas);
    detail.appendChild(wrapper);

    try {
        const fns = await App.api(`/locations/provinces/${provinceId}/first-nations`);
        const points = [];

        const getLatLon = (n) => {
            const latRaw = n.lat ?? n.latitude ?? n.Latitude ?? n.LAT;
            const lonRaw = n.lon ?? n.lng ?? n.longitude ?? n.Longitude ?? n.LON;
            const lat = typeof latRaw === 'number' ? latRaw : parseFloat(latRaw);
            const lon = typeof lonRaw === 'number' ? lonRaw : parseFloat(lonRaw);
            if (!isFinite(lat) || !isFinite(lon)) return null;
            return { lat, lon, name: n.name || n.id || 'Community' };
        };

        for (const n of fns) {
            const p = getLatLon(n);
            if (p) points.push(p);
        }

        if (!points.length) {
            canvas.innerHTML = `
                <div class="province-map-empty">
                    No coordinate data found yet for First Nations in ${provinceName}. Once we add lat/long values in Neo4j, this will render a live map.
                </div>
            `;
            return;
        }

        const lats = points.map((p) => p.lat);
        const lons = points.map((p) => p.lon);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLon = Math.min(...lons);
        const maxLon = Math.max(...lons);
        const latRange = maxLat - minLat || 1;
        const lonRange = maxLon - minLon || 1;

        points.forEach((p) => {
            const x = ((p.lon - minLon) / lonRange) * 100;
            const y = (1 - (p.lat - minLat) / latRange) * 100;

            const dot = document.createElement('div');
            dot.className = 'province-map-dot';
            dot.style.left = `${x}%`;
            dot.style.top = `${y}%`;

            const label = document.createElement('div');
            label.className = 'province-map-dot-label';
            label.textContent = p.name;
            label.style.left = `${x}%`;
            label.style.top = `${y}%`;

            canvas.appendChild(dot);
            canvas.appendChild(label);
        });
    } catch (err) {
        canvas.innerHTML = `<div class="province-map-empty">Error loading map data: ${err.message}</div>`;
    }
};

// ============================================
// CANDIDATES (Three-Panel Layout)
// ============================================

App.pages.candidates = async function() {
    const content = document.getElementById('content');
    const pageId = 'candidates';
    
    content.innerHTML = App.createThreePanelLayout({
        pageId,
        panel1Title: '🌍 Locations',
        panel2Title: '🎯 Candidates',
        panel3Title: '📄 Profile',
        emptyIcon2: '🗳️',
        emptyText2: 'Select a location to view candidates',
        emptyIcon3: '👤',
        emptyText3: 'Select a candidate to view profile'
    });
    
    await App.initLocationTree(pageId, App.onCandidatesLocationSelect);
};

App.onCandidatesLocationSelect = async function(type, id, name, autoSelectFirst = false) {
    const pageId = 'candidates';
    App.showSelectedBadge(pageId, name);
    App.showListLoading(pageId);
    App.showDetailEmpty(pageId, '👤', 'Select a candidate to view profile');
    
    try {
        const candidates = await App.api(`/locations/${type}/${id}/candidates`);
        
        if (!candidates.length) {
            App.showListEmpty(pageId, '🗳️', 'No candidates in this location yet');
            return;
        }
        
        App.panelState[pageId].currentItems = candidates;
        App.renderCandidatesListPanel(autoSelectFirst);
    } catch (err) {
        App.showListEmpty(pageId, '⚠️', `Error: ${err.message}`);
    }
};

App.renderCandidatesListPanel = function(autoSelectFirst = false) {
    const pageId = 'candidates';
    const state = App.panelState[pageId];
    const list = document.getElementById(`${pageId}-list`);
    const candidates = [...state.currentItems];
    
    // Sort candidates
    if (state.sortBy === 'points') {
        candidates.sort((a, b) => (b.points || 0) - (a.points || 0));
    } else if (state.sortBy === 'nominations') {
        candidates.sort((a, b) => (b.nominationCount || 0) - (a.nominationCount || 0));
    } else {
        candidates.sort((a, b) => a.name.localeCompare(b.name));
    }
    
    let html = `
        <div class="sort-controls">
            <span class="sort-label">Sort:</span>
            <label class="sort-option"><input type="radio" name="candSort" value="name" ${state.sortBy === 'name' ? 'checked' : ''}><span class="sort-option-label">Name</span></label>
            <label class="sort-option"><input type="radio" name="candSort" value="points" ${state.sortBy === 'points' ? 'checked' : ''}><span class="sort-option-label">⭐ Points</span></label>
            <label class="sort-option"><input type="radio" name="candSort" value="nominations" ${state.sortBy === 'nominations' ? 'checked' : ''}><span class="sort-option-label">👍 Nominations</span></label>
        </div>
    `;
    
    html += candidates.map((c, index) => `
        <div class="list-item with-avatar" data-index="${index}" data-id="${c.id}">
            <div class="list-item-avatar">${App.getInitials(c.name)}</div>
            <div class="list-item-content">
                <div class="list-item-title">${c.name}</div>
                <div class="list-item-meta">
                    <span class="list-item-stat">⭐ ${c.points || 0}</span>
                    <span class="list-item-stat">👍 ${c.endorsementCount || 0}</span>
                </div>
            </div>
        </div>
    `).join('');
    
    list.innerHTML = html;
    state.currentItems = candidates;
    
    // Sort listeners
    document.querySelectorAll('input[name="candSort"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            state.sortBy = e.target.value;
            App.renderCandidatesListPanel();
        });
    });
    
    // Item click listeners
    document.querySelectorAll(`#${pageId}-list .list-item`).forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll(`#${pageId}-list .list-item`).forEach(i => i.classList.remove('selected'));
            item.classList.add('selected');
            const idx = parseInt(item.dataset.index);
            App.showCandidateDetailPanel(state.currentItems[idx]);
        });
    });
    
    // Auto-select first item if requested
    if (autoSelectFirst && candidates.length > 0) {
        const firstItem = document.querySelector(`#${pageId}-list .list-item`);
        if (firstItem) {
            firstItem.classList.add('selected');
            App.showCandidateDetailPanel(candidates[0]);
        }
    }
};

App.showCandidateDetailPanel = function(candidate) {
    const detail = document.getElementById('candidates-detail');
    detail.innerHTML = `
        <div class="detail-content">
            <div class="detail-header with-avatar">
                <div class="detail-avatar">${App.getInitials(candidate.name)}</div>
                <div>
                    <h2 class="detail-title">${candidate.name}</h2>
                    <p class="detail-subtitle">📍 ${candidate.region || 'Unknown location'}</p>
                </div>
            </div>
            <div class="detail-stats">
                <div class="detail-stat">
                    <div class="detail-stat-value accent">${candidate.points || 0}</div>
                    <div class="detail-stat-label">Points</div>
                </div>
                <div class="detail-stat">
                    <div class="detail-stat-value">${candidate.endorsementCount || 0}</div>
                    <div class="detail-stat-label">Endorsements</div>
                </div>
            </div>
            ${candidate.platform ? `<div class="detail-section"><h3>Platform</h3><p>${candidate.platform}</p></div>` : ''}
            <div class="detail-section"><h3>About</h3><p>${candidate.bio || 'No bio provided.'}</p></div>
            ${candidate.skills?.length ? `<div class="detail-section"><h3>Skills</h3><div class="detail-tags">${candidate.skills.map(s => `<span class="tag">${s}</span>`).join('')}</div></div>` : ''}
            ${candidate.interests?.length ? `<div class="detail-section"><h3>Interests</h3><div class="detail-tags">${candidate.interests.map(i => `<span class="tag accent">${i}</span>`).join('')}</div></div>` : ''}
        </div>
    `;
};

// ============================================
// MEMBERS (Three-Panel Layout)
// ============================================

App.pages.users = async function() {
    const content = document.getElementById('content');
    const pageId = 'members';
    
    content.innerHTML = App.createThreePanelLayout({
        pageId,
        panel1Title: '🌍 Locations',
        panel2Title: '👥 Members',
        panel3Title: '📄 Profile',
        emptyIcon2: '🗺️',
        emptyText2: 'Select a location to view members',
        emptyIcon3: '👤',
        emptyText3: 'Select a member to view profile'
    });
    
    await App.initLocationTree(pageId, App.onMembersLocationSelect);
};

App.onMembersLocationSelect = async function(type, id, name, autoSelectFirst = false) {
    const pageId = 'members';
    App.showSelectedBadge(pageId, name);
    App.showListLoading(pageId);
    App.showDetailEmpty(pageId, '👤', 'Select a member to view profile');
    
    try {
        const members = await App.api(`/locations/${type}/${id}/users`);
        
        if (!members.length) {
            App.showListEmpty(pageId, '👥', 'No members in this location yet');
            return;
        }
        
        App.panelState[pageId].currentItems = members;
        App.renderMembersListPanel(autoSelectFirst);
    } catch (err) {
        App.showListEmpty(pageId, '⚠️', `Error: ${err.message}`);
    }
};

App.renderMembersListPanel = function(autoSelectFirst = false) {
    const pageId = 'members';
    const state = App.panelState[pageId];
    const list = document.getElementById(`${pageId}-list`);
    const members = [...state.currentItems];
    
    // Sort by name
    if (state.sortBy === 'endorsements') {
        members.sort((a, b) => (b.endorsementCount || 0) - (a.endorsementCount || 0));
    } else {
        members.sort((a, b) => a.name.localeCompare(b.name));
    }
    
    let html = `
        <div class="sort-controls">
            <span class="sort-label">Sort:</span>
            <label class="sort-option"><input type="radio" name="memberSort" value="name" ${state.sortBy !== 'endorsements' ? 'checked' : ''}><span class="sort-option-label">Name</span></label>
            <label class="sort-option"><input type="radio" name="memberSort" value="endorsements" ${state.sortBy === 'endorsements' ? 'checked' : ''}><span class="sort-option-label">👍 Endorsements</span></label>
        </div>
    `;
    
    html += members.map((m, index) => `
        <div class="list-item with-avatar" data-index="${index}" data-id="${m.id}">
            <div class="list-item-avatar">${App.getInitials(m.name)}</div>
            <div class="list-item-content">
                <div class="list-item-title">${m.name}</div>
                <div class="list-item-meta">
                    ${m.candidate ? '<span class="badge-small">Candidate</span>' : ''}
                    <span class="list-item-stat">👍 ${m.endorsementCount || 0}</span>
                </div>
            </div>
        </div>
    `).join('');
    
    list.innerHTML = html;
    state.currentItems = members;
    
    // Sort listeners
    document.querySelectorAll('input[name="memberSort"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            state.sortBy = e.target.value;
            App.renderMembersListPanel();
        });
    });
    
    // Item click listeners
    document.querySelectorAll(`#${pageId}-list .list-item`).forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll(`#${pageId}-list .list-item`).forEach(i => i.classList.remove('selected'));
            item.classList.add('selected');
            const idx = parseInt(item.dataset.index);
            App.showMemberDetailPanel(state.currentItems[idx]);
        });
    });
    
    // Auto-select first item if requested
    if (autoSelectFirst && members.length > 0) {
        const firstItem = document.querySelector(`#${pageId}-list .list-item`);
        if (firstItem) {
            firstItem.classList.add('selected');
            App.showMemberDetailPanel(members[0]);
        }
    }
};

App.showMemberDetailPanel = function(member) {
    const detail = document.getElementById('members-detail');
    detail.innerHTML = `
        <div class="detail-content">
            <div class="detail-header with-avatar">
                <div class="detail-avatar">${App.getInitials(member.name)}</div>
                <div>
                    <h2 class="detail-title">${member.name}</h2>
                    <p class="detail-subtitle">📍 ${member.location?.name || member.region || 'Unknown location'}</p>
                </div>
            </div>
            <div class="detail-stats">
                <div class="detail-stat">
                    <div class="detail-stat-value">${member.endorsementCount || 0}</div>
                    <div class="detail-stat-label">Endorsements</div>
                </div>
                ${member.candidate ? `<div class="detail-stat"><div class="detail-stat-value accent">✓</div><div class="detail-stat-label">Candidate</div></div>` : ''}
            </div>
            <div class="detail-section"><h3>About</h3><p>${member.bio || 'No bio provided.'}</p></div>
            ${member.skills?.length ? `<div class="detail-section"><h3>Skills</h3><div class="detail-tags">${member.skills.map(s => `<span class="tag">${s}</span>`).join('')}</div></div>` : ''}
            ${member.interests?.length ? `<div class="detail-section"><h3>Interests</h3><div class="detail-tags">${member.interests.map(i => `<span class="tag accent">${i}</span>`).join('')}</div></div>` : ''}
            
            <div class="detail-actions">
                <button class="btn btn-primary" onclick="App.showMemberDetail('${member.id}')">View Full Profile</button>
                ${App.currentUser && App.currentUser.id !== member.id ? `
                    <button class="btn btn-secondary" onclick="App.nominateMember('${member.id}')">Nominate</button>
                ` : ''}
            </div>
        </div>
    `;
};

// ============================================
// EVENTS (Three-Panel Layout)
// ============================================

App.pages.events = async function() {
    const content = document.getElementById('content');
    const pageId = 'events';
    
    content.innerHTML = App.createThreePanelLayout({
        pageId,
        panel1Title: '🌍 Locations',
        panel2Title: '📅 Events',
        panel3Title: '📄 Details',
        emptyIcon2: '🗺️',
        emptyText2: 'Select a location to view events',
        emptyIcon3: '📅',
        emptyText3: 'Select an event to view details'
    });
    
    await App.initLocationTree(pageId, App.onEventsLocationSelect);
};

App.onEventsLocationSelect = async function(type, id, name, autoSelectFirst = false) {
    const pageId = 'events';
    App.showSelectedBadge(pageId, name);
    App.showListLoading(pageId);
    App.showDetailEmpty(pageId, '📅', 'Select an event to view details');
    
    try {
        const events = await App.api(`/locations/${type}/${id}/events`);
        
        if (!events.length) {
            App.showListEmpty(pageId, '📅', 'No events in this location yet');
            return;
        }
        
        App.panelState[pageId].currentItems = events;
        App.renderEventsListPanel(autoSelectFirst);
    } catch (err) {
        App.showListEmpty(pageId, '⚠️', `Error: ${err.message}`);
    }
};

App.renderEventsListPanel = function(autoSelectFirst = false) {
    const pageId = 'events';
    const state = App.panelState[pageId];
    const list = document.getElementById(`${pageId}-list`);
    const events = [...state.currentItems];
    
    // Sort by date (newest first) or by participants
    if (state.sortBy === 'participants') {
        events.sort((a, b) => (b.participantCount || 0) - (a.participantCount || 0));
    } else {
        events.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
    }
    
    let html = `
        <div class="sort-controls">
            <span class="sort-label">Sort:</span>
            <label class="sort-option"><input type="radio" name="eventSort" value="date" ${state.sortBy !== 'participants' ? 'checked' : ''}><span class="sort-option-label">📅 Date</span></label>
            <label class="sort-option"><input type="radio" name="eventSort" value="participants" ${state.sortBy === 'participants' ? 'checked' : ''}><span class="sort-option-label">👥 Participants</span></label>
        </div>
    `;
    
    html += events.map((e, index) => `
        <div class="list-item" data-index="${index}" data-id="${e.id}">
            <div class="list-item-type">${e.type || 'event'}</div>
            <div class="list-item-title">${e.title}</div>
            <div class="list-item-meta">
                <span>📅 ${App.formatDate(e.startTime)}</span>
                <span class="list-item-stat">👥 ${e.participantCount || 0}</span>
            </div>
        </div>
    `).join('');
    
    list.innerHTML = html;
    state.currentItems = events;
    
    // Sort listeners
    document.querySelectorAll('input[name="eventSort"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            state.sortBy = e.target.value;
            App.renderEventsListPanel();
        });
    });
    
    // Item click listeners
    document.querySelectorAll(`#${pageId}-list .list-item`).forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll(`#${pageId}-list .list-item`).forEach(i => i.classList.remove('selected'));
            item.classList.add('selected');
            const idx = parseInt(item.dataset.index);
            App.showEventDetailPanel(state.currentItems[idx]);
        });
    });
    
    // Auto-select first item if requested
    if (autoSelectFirst && events.length > 0) {
        const firstItem = document.querySelector(`#${pageId}-list .list-item`);
        if (firstItem) {
            firstItem.classList.add('selected');
            App.showEventDetailPanel(events[0]);
        }
    }
};

App.showEventDetailPanel = function(event) {
    const detail = document.getElementById('events-detail');
    detail.innerHTML = `
        <div class="detail-content">
            <div class="detail-header">
                <span class="event-type-badge">${event.type || 'event'}</span>
                <h2 class="detail-title">${event.title}</h2>
                <p class="detail-subtitle">📍 ${event.region}</p>
            </div>
            <div class="detail-stats">
                <div class="detail-stat">
                    <div class="detail-stat-value">${event.participantCount || 0}</div>
                    <div class="detail-stat-label">Participants</div>
                </div>
            </div>
            <div class="event-datetime">
                <div class="event-date">📅 ${App.formatDate(event.startTime)}</div>
                <div class="event-time">🕐 ${App.formatTime(event.startTime)} - ${App.formatTime(event.endTime)}</div>
            </div>
            <div class="detail-section">
                <h3>Description</h3>
                <p>${event.description || 'No description provided.'}</p>
            </div>
            ${App.currentUser ? `
                <div class="detail-actions">
                    <button class="btn btn-primary" onclick="App.joinEvent('${event.id}')">Join Event</button>
                </div>
            ` : ''}
        </div>
    `;
};

// ============================================
// VOTES
// ============================================

App.pages.votes = async function() {
    const content = document.getElementById('content');
    content.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    
    try {
        const votes = await App.api('/votes');
        
        content.innerHTML = `
            <header class="page-header">
                <h1 class="page-title">Convention Voting</h1>
                <p class="page-subtitle">${votes.length} vote session(s)</p>
            </header>
            
            <div class="cards-grid">
                ${votes.map(vote => {
                    let resultHtml = '<div class="badge warning">⏳ Voting in progress</div>';
                    if (vote.result?.resultData) {
                        try {
                            const data = JSON.parse(vote.result.resultData);
                            if (data.yes !== undefined) {
                                resultHtml = `<div class="vote-results">
                                    <span class="badge success">✓ Yes: ${data.yes}</span>
                                    <span class="badge danger">✗ No: ${data.no}</span>
                                    ${data.abstain ? `<span class="badge">⊘ Abstain: ${data.abstain}</span>` : ''}
                                </div>`;
                            }
                        } catch (e) {}
                    }
                    return `
                        <div class="card">
                            <div class="card-header">
                                <div><span class="event-type" style="background: rgba(0, 212, 170, 0.1); color: var(--accent-primary);">${vote.type || 'vote'}</span><h3 class="card-title">${vote.question}</h3></div>
                            </div>
                            ${vote.event ? `<p class="card-subtitle" style="margin-bottom: 12px;">Part of: ${vote.event.title}</p>` : ''}
                            <div class="card-body">${resultHtml}</div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    } catch (err) {
        content.innerHTML = `<div class="card"><div class="card-body">Error: ${err.message}</div></div>`;
    }
};

