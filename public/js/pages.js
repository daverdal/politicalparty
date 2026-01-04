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
        // Use a lightweight summary endpoint so the dashboard does not have to
        // load full user/idea/event/vote lists (which can be slow and heavy
        // on small production instances).
        const summary = await App.api('/dashboard/summary');
        const usersCount = summary && typeof summary.users === 'number' ? summary.users : 0;
        const ideasCount = summary && typeof summary.ideas === 'number' ? summary.ideas : 0;
        const eventsCount = summary && typeof summary.events === 'number' ? summary.events : 0;
        const votesCount = summary && typeof summary.votes === 'number' ? summary.votes : 0;
        
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
                <div class="stat-card"><div class="stat-label">Members</div><div class="stat-value">${usersCount}</div></div>
                <div class="stat-card"><div class="stat-label">Ideas</div><div class="stat-value">${ideasCount}</div></div>
                <div class="stat-card"><div class="stat-label">Events</div><div class="stat-value">${eventsCount}</div></div>
                <div class="stat-card"><div class="stat-label">Votes</div><div class="stat-value">${votesCount}</div></div>
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

    // Inject "Post Idea" button into the Locations panel header
    const locHeader = document.querySelector('#ideas-location-panel .browse-panel-header');
    if (locHeader) {
        locHeader.innerHTML = `
            <span>🌍 Locations</span>
            <button class="btn btn-secondary btn-sm" id="ideas-post-idea-btn" style="margin-left: 8px;">
                Post Idea
            </button>
        `;
        const postBtn = document.getElementById('ideas-post-idea-btn');
        if (postBtn) {
            postBtn.addEventListener('click', () => {
                if (typeof App.showPostIdeaModal === 'function') {
                    App.showPostIdeaModal();
                } else {
                    alert('Posting ideas is not available right now.');
                }
            });
        }
    }
    
    if (typeof App.enableBrowseLayoutDragScroll === 'function') {
        App.enableBrowseLayoutDragScroll();
    }
    
    await App.initLocationTree(pageId, App.onIdeasLocationSelect);

    // After the unified tree is ready, auto-open Manitoba on the Ideas page
    // so users immediately see Manitoba ideas and the Manitoba map.
    try {
        const provinces = await App.api('/locations/provinces');
        const manitoba = provinces.find((p) => p.name === 'Manitoba');
        if (manitoba) {
            // Do not auto-select the first idea so the list doesn't grab focus or scroll.
            await App.onIdeasLocationSelect('provinces', manitoba.id, manitoba.name, false);
        }
    } catch (e) {
        console.error('Failed to auto-select Manitoba on Ideas page:', e);
    }
};

App.onIdeasLocationSelect = async function(type, id, name, autoSelectFirst = false, selectedIdeaId = null) {
    const pageId = 'ideas';

    // Track selected location for posting new ideas
    if (!App.browseState) {
        App.browseState = {};
    }
    App.browseState.selectedLocation = id;
    App.browseState.selectedLocationType = type;
    App.browseState.selectedLocationName = name;

    // Highlight the matching location in the unified tree (left pane), if present
    try {
        const selector = `.tree-header[data-tree-page="${pageId}"][data-tree-type="${type}"][data-tree-location-id="${CSS.escape(
            id
        )}"]`;
        const header = document.querySelector(selector);
        if (header) {
            document
                .querySelectorAll(`[data-tree-page="${pageId}"].tree-header`)
                .forEach((h) => h.classList.remove('active'));
            header.classList.add('active');
        }
    } catch (e) {
        // ignore; CSS.escape may not exist in very old browsers
    }

    // For Ideas/#browse, show the selected location directly in the list header
    // instead of in a separate badge row to reduce visual duplication.
    const listHeader = document.querySelector('#ideas-list-panel .browse-panel-header');
    if (listHeader) {
        listHeader.textContent = `Ideas from ${name}`;
    }
    // We no longer use the secondary badge row for Ideas.
    // App.showSelectedBadge(pageId, name);
    App.showDetailEmpty(pageId, '💡', 'Select an idea to view details');
    
    try {
        const ideas = await App.api(`/locations/${type}/${id}/ideas`);
        
        const list = document.getElementById(`${pageId}-list`);
        const showMapLink = type === 'provinces' || type === 'countries';
        
        // Always render a toolbar for actions (e.g. Map button).
        // The "Ideas from {name}" label now lives in the panel header above.
        let html = `
            <div class="panel-toolbar">
                ${showMapLink ? '<button class="map-link-btn" id="ideas-map-link">🗺️ Map</button>' : ''}
            </div>
        `;

        if (!ideas.length) {
            html += `
                <div class="panel-empty">
                    <div class="panel-empty-icon">💭</div>
                    <div class="panel-empty-text">No ideas from this location yet</div>
                </div>
            `;
            list.innerHTML = html;
        } else {
            App.panelState[pageId].currentItems = ideas;
            html += ideas.map((idea, index) => `
            <div class="list-item" data-index="${index}" data-id="${idea.id}">
                <div class="list-item-title">${idea.title}</div>
                <div class="list-item-meta">
                    <span class="list-item-stat">👍 ${idea.supportCount || 0}</span>
                    <span>${idea.author?.name || 'Anonymous'}</span>
                </div>
            </div>
        `).join('');
            list.innerHTML = html;

            document.querySelectorAll(`#${pageId}-list .list-item`).forEach(item => {
                item.addEventListener('click', () => {
                    document.querySelectorAll(`#${pageId}-list .list-item`).forEach(i => i.classList.remove('selected'));
                    item.classList.add('selected');
                    const idx = parseInt(item.dataset.index);
                    App.showIdeaDetailPanel(App.panelState[pageId].currentItems[idx]);
                });
            });
        }
        
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
        
        // Auto-select a specific idea (e.g., newly created) or the first item if requested
        if (ideas.length > 0) {
            let targetItem = null;
            if (selectedIdeaId) {
                targetItem = document.querySelector(
                    `#${pageId}-list .list-item[data-id="${CSS.escape(selectedIdeaId)}"]`
                );
            }
            if (!targetItem && autoSelectFirst) {
                targetItem = document.querySelector(`#${pageId}-list .list-item`);
            }
            if (targetItem) {
                document
                    .querySelectorAll(`#${pageId}-list .list-item`)
                    .forEach(i => i.classList.remove('selected'));
                targetItem.classList.add('selected');
                const idx = parseInt(targetItem.dataset.index);
                if (Number.isFinite(idx) && App.panelState[pageId].currentItems[idx]) {
                    App.showIdeaDetailPanel(App.panelState[pageId].currentItems[idx]);
                }
                // Do not auto-scroll the list into view; this preserves the initial
                // viewport position (especially on mobile) and avoids the "jump" effect.
            }
        }

        // Automatically show the province map when a province is selected,
        // so users immediately see the map without needing to click the Map button.
        if (type === 'provinces') {
            App.showProvinceMap(pageId, id, name);
        }
    } catch (err) {
        App.showListEmpty(pageId, '⚠️', `Error: ${err.message}`);
    }
};

App.showIdeaDetailPanel = function(idea) {
    const detail = document.getElementById('ideas-detail');
    const devVoiceUrl =
        typeof App.loadIdeaVoiceNote === 'function' && idea && idea.id
            ? App.loadIdeaVoiceNote(idea.id)
            : null;
    detail.innerHTML = `
        <div class="detail-content">
            <div class="detail-header">
                <h2 class="detail-title">${idea.title}</h2>
                <p class="detail-subtitle">${idea.author ? `Posted by ${idea.author.name}` : 'Posted anonymously'}${idea.region ? ` • ${idea.region}` : ''}</p>
            </div>
            <div class="detail-stats">
                <div class="detail-stat">
                    <div class="detail-stat-value" id="idea-support-count">${idea.supportCount || 0}</div>
                    <div class="detail-stat-label">Supporters</div>
                </div>
                <div class="detail-actions">
                    <button class="btn btn-secondary btn-sm" id="idea-like-btn">👍 Like this idea</button>
                </div>
            </div>
            <div class="detail-body">${idea.description || 'No description provided.'}</div>
            ${
                devVoiceUrl
                    ? `
            <div class="detail-section" style="margin-top:16px;">
                <h3>Voice note (dev)</h3>
                <audio controls src="${devVoiceUrl}" style="width:100%; margin-top:4px;"></audio>
                <p class="form-help" style="margin-top:4px; font-size:0.8rem;">
                    This recording is stored only in your browser for up to 2 days.
                </p>
            </div>
            `
                    : ''
            }
            ${idea.tags?.length ? `<div class="detail-tags">${idea.tags.map(tag => `<span class="tag accent">${tag}</span>`).join('')}</div>` : ''}
        </div>
    `;

    // Wire up Like button (support idea)
    const likeBtn = detail.querySelector('#idea-like-btn');
    const countEl = detail.querySelector('#idea-support-count');

    if (likeBtn) {
        likeBtn.addEventListener('click', async () => {
            if (!App.requireVerifiedAuth || !App.requireVerifiedAuth()) {
                return;
            }

            likeBtn.disabled = true;
            likeBtn.textContent = 'Liking...';

            try {
                const { response, data } = await App.apiPost(`/ideas/${encodeURIComponent(idea.id)}/support`, {
                    userId: App.authUser.id
                });

                if (!response.ok) {
                    alert(data.error || 'Unable to support idea.');
                    likeBtn.disabled = false;
                    likeBtn.textContent = '👍 Like this idea';
                    return;
                }

                // Fetch updated idea to get fresh supporter count
                const updated = await App.api(`/ideas/${encodeURIComponent(idea.id)}`);
                const newCount =
                    (Array.isArray(updated.supporters) && updated.supporters.length) ||
                    updated.supportCount ||
                    0;

                if (countEl) {
                    countEl.textContent = newCount;
                }

                likeBtn.textContent = '👍 Supported';
                likeBtn.disabled = true;
            } catch (err) {
                alert(err.message || 'Unexpected error while supporting idea.');
                likeBtn.disabled = false;
                likeBtn.textContent = '👍 Like this idea';
            }
        });
    }
};

// Province map (using First Nations lat/lon when available)
App.showProvinceMap = async function(pageId, provinceId, provinceName) {
    const detail = document.getElementById(`${pageId}-detail`);
    if (!detail) return;

    // Clear any existing idea detail so the map fully owns the right pane
    detail.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.className = 'province-map-wrapper';
    const title = document.createElement('div');
    title.className = 'panel-toolbar-title';
    const isCandidatesPage = pageId === 'candidates';
    title.textContent = isCandidatesPage
        ? `Map of ${provinceName} (First Nations candidates)`
        : `Map of ${provinceName} (First Nations positions)`;
    const canvas = document.createElement('div');
    canvas.className = 'province-map-canvas';

    const inner = document.createElement('div');
    inner.className = 'province-map-inner';
    canvas.appendChild(inner);

    const info = document.createElement('div');
    info.className = 'province-map-info';
    info.textContent = isCandidatesPage
        ? 'Hover, click or tap a dot to see First Nation candidates running there. On touch screens, pinch to zoom and drag to pan.'
        : 'Hover, click or tap a dot to see First Nation details and top ideas. On touch screens, pinch to zoom and drag to pan.';

    // Optional small control strip for things like "Re-center map"
    const controls = document.createElement('div');
    controls.className = 'province-map-controls';
    const recenterBtn = document.createElement('button');
    recenterBtn.type = 'button';
    recenterBtn.className = 'btn btn-secondary btn-xs';
    recenterBtn.textContent = 'Re-center map';
    controls.appendChild(recenterBtn);

    // For the Ideas/#browse page, show the dynamic First Nation + ideas text
    // (info) above the map instead of the static title. For Candidates, keep
    // the title then info.
    if (isCandidatesPage) {
        wrapper.appendChild(title);
    }
    wrapper.appendChild(info);
    wrapper.appendChild(controls);
    wrapper.appendChild(canvas);
    detail.appendChild(wrapper);

    try {
        // For Ideas page: show all First Nations with ideas overlay.
        // For Candidates page: only show First Nations that have one or more
        // candidates located there, and overlay candidate info instead.
        let fns;
        let provinceCandidates = [];
        const points = [];
        const ideasCache = {};
        const candidatesByLocationId = {};

        if (isCandidatesPage) {
            [fns, provinceCandidates] = await Promise.all([
                App.api(`/locations/provinces/${provinceId}/first-nations`),
                App.api(`/locations/provinces/${provinceId}/candidates`)
            ]);

            if (Array.isArray(provinceCandidates)) {
                provinceCandidates.forEach((cand) => {
                    const locId = cand.location && cand.location.id;
                    if (!locId) return;
                    if (!candidatesByLocationId[locId]) {
                        candidatesByLocationId[locId] = [];
                    }
                    candidatesByLocationId[locId].push(cand);
                });
            }
        } else {
            // Default (Ideas and any other pages using this map) – just load First Nations.
            fns = await App.api(`/locations/provinces/${provinceId}/first-nations`);
        }

        const getLatLon = (n) => {
            const latRaw = n.lat ?? n.latitude ?? n.Latitude ?? n.LAT;
            const lonRaw = n.lon ?? n.lng ?? n.longitude ?? n.Longitude ?? n.LON;
            const lat = typeof latRaw === 'number' ? latRaw : parseFloat(latRaw);
            const lon = typeof lonRaw === 'number' ? lonRaw : parseFloat(lonRaw);
            if (!isFinite(lat) || !isFinite(lon)) return null;
            return {
                id: n.id,
                lat,
                lon,
                name: n.name || n.id || 'Community'
            };
        };

        for (const n of fns) {
            const p = getLatLon(n);
            if (!p) continue;

            if (isCandidatesPage) {
                const locCandidates = candidatesByLocationId[n.id] || [];
                if (!locCandidates.length) continue; // only show dots where someone is running
                points.push({
                    ...p,
                    candidates: locCandidates
                });
            } else {
                points.push(p);
            }
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

        // Adjust the canvas height so the province keeps a more realistic
        // geographic aspect ratio (so Manitoba doesn't look squished).
        // We approximate "real" width using longitude distance scaled by cos(latitude).
        try {
            const avgLat = (minLat + maxLat) / 2;
            const cosLat = Math.cos((avgLat * Math.PI) / 180) || 1;
            const latKmRange = latRange;
            const lonKmRange = lonRange * cosLat;

            if (latKmRange > 0 && lonKmRange > 0) {
                // Wait for layout so we know the canvas width, then set height.
                requestAnimationFrame(() => {
                    const rect = canvas.getBoundingClientRect();
                    if (!rect.width) return;
                    const desiredHeight = rect.width * (latKmRange / lonKmRange);
                    canvas.style.height = `${desiredHeight}px`;
                });
            }
        } catch (e) {
            // If anything goes wrong, we just keep the default CSS height.
            // eslint-disable-next-line no-console
            console.warn('Province map aspect adjustment failed:', e);
        }

        // Basic pan + zoom controls state and transform helper
        const state = {
            // Shared initial zoom for all provinces so they feel consistent
            scale: 0.3,
            translateX: 0,
            translateY: 0,
            // Remember the "home" view so we can re-center later
            initialScale: 0.3,
            initialTranslateX: 0,
            initialTranslateY: 0,
            panning: false,
            startX: 0,
            startY: 0,
            startTranslateX: 0,
            startTranslateY: 0,
            pinchZooming: false,
            pinchStartDistance: 0,
            pinchStartScale: 1,
            pinchCenterX: 0,
            pinchCenterY: 0
        };

        const applyTransform = () => {
            inner.style.transform = `translate(${state.translateX}px, ${state.translateY}px) scale(${state.scale})`;
        };

        // Helper to attach touch-based pan + pinch zoom (for mobile)
        const attachTouchPanAndZoom = () => {
            canvas.addEventListener('touchstart', (e) => {
                if (e.touches.length === 1) {
                    // One-finger pan
                    const t = e.touches[0];
                    state.panning = true;
                    state.pinchZooming = false;
                    state.startX = t.clientX;
                    state.startY = t.clientY;
                    state.startTranslateX = state.translateX;
                    state.startTranslateY = state.translateY;
                    canvas.classList.add('panning');
                } else if (e.touches.length === 2) {
                    // Two-finger pinch zoom
                    state.panning = false;
                    state.pinchZooming = true;
                    const t1 = e.touches[0];
                    const t2 = e.touches[1];
                    const dx = t2.clientX - t1.clientX;
                    const dy = t2.clientY - t1.clientY;
                    state.pinchStartDistance = Math.hypot(dx, dy) || 1;
                    state.pinchStartScale = state.scale;

                    const rect = canvas.getBoundingClientRect();
                    state.pinchCenterX = ((t1.clientX + t2.clientX) / 2) - rect.left;
                    state.pinchCenterY = ((t1.clientY + t2.clientY) / 2) - rect.top;
                }
            }, { passive: false });

            canvas.addEventListener('touchmove', (e) => {
                if (state.pinchZooming && e.touches.length === 2) {
                    e.preventDefault();
                    const t1 = e.touches[0];
                    const t2 = e.touches[1];
                    const dx = t2.clientX - t1.clientX;
                    const dy = t2.clientY - t1.clientY;
                    const dist = Math.hypot(dx, dy) || 1;
                    const factor = dist / state.pinchStartDistance;
                    const newScale = Math.min(8, Math.max(0.2, state.pinchStartScale * factor));
                    if (newScale === state.scale) return;

                    const scaleRatio = newScale / state.scale;
                    state.translateX = state.pinchCenterX - (state.pinchCenterX - state.translateX) * scaleRatio;
                    state.translateY = state.pinchCenterY - (state.pinchCenterY - state.translateY) * scaleRatio;
                    state.scale = newScale;
                    applyTransform();
                } else if (state.panning && e.touches.length === 1) {
                    e.preventDefault();
                    const t = e.touches[0];
                    const dx = t.clientX - state.startX;
                    const dy = t.clientY - state.startY;
                    state.translateX = state.startTranslateX + dx;
                    state.translateY = state.startTranslateY + dy;
                    applyTransform();
                }
            }, { passive: false });

            canvas.addEventListener('touchend', (e) => {
                if (state.pinchZooming && (!e.touches || e.touches.length === 0)) {
                    state.pinchZooming = false;
                }
                if (state.panning) {
                    state.panning = false;
                    canvas.classList.remove('panning');
                }
            });
        };

        // Initial render positions (0–100%) inside the inner container
        let sumXPercent = 0;
        let sumYPercent = 0;
        let pointCount = 0;

        points.forEach((p) => {
            const x = ((p.lon - minLon) / lonRange) * 100;
            const y = (1 - (p.lat - minLat) / latRange) * 100;

            sumXPercent += x;
            sumYPercent += y;
            pointCount += 1;

            // Wrapper so we can show label on hover without stacking everything
            const point = document.createElement('div');
            point.className = 'province-map-point';
            point.style.left = `${x}%`;
            point.style.top = `${y}%`;

            const dot = document.createElement('div');
            dot.className = 'province-map-dot';

            const label = document.createElement('div');
            label.className = 'province-map-dot-label';
            label.textContent = p.name;

            point.appendChild(dot);
            point.appendChild(label);

            if (isCandidatesPage) {
                const showCandidates = () => {
                    const cands = p.candidates || [];

                    if (!cands.length) {
                        info.innerHTML = `
                            <div class="province-map-info-name">${p.name}</div>
                            <div class="province-map-info-meta">No candidates are running here yet.</div>
                        `;
                        return;
                    }

                    const listHtml = cands.map((cand, idx) => `
                        <li>
                            <span class="province-map-idea-rank">${idx + 1}.</span>
                            <span class="province-map-idea-title">${cand.name}</span>
                            <span class="province-map-idea-support">(⭐ ${cand.points || 0} pts, 👍 ${cand.endorsementCount || 0} endorsements)</span>
                        </li>
                    `).join('');

                    info.innerHTML = `
                        <div class="province-map-info-name">${p.name}</div>
                        <div class="province-map-info-meta">Candidates running in this First Nation:</div>
                        <ol class="province-map-ideas-list">
                            ${listHtml}
                        </ol>
                    `;
                };

                // Hover to show candidates under the place name
                point.addEventListener('mouseenter', () => {
                    showCandidates();
                });

                // Click also shows the same info (friendly for touch devices)
                point.addEventListener('click', (e) => {
                    e.stopPropagation();
                    showCandidates();
                });
            } else {
                const showTopIdeas = async () => {
                    try {
                        info.innerHTML = `
                            <div class="province-map-info-name">${p.name}</div>
                            <div class="province-map-info-meta">Loading top ideas...</div>
                        `;

                        if (!ideasCache[p.id]) {
                            const ideas = await App.api(
                                `/locations/first-nations/${encodeURIComponent(p.id)}/ideas?limit=10`
                            );
                            ideasCache[p.id] = ideas;
                        }

                        const ideas = ideasCache[p.id] || [];

                        // Adjust dot color based on recency of newest idea (if any)
                        if (Array.isArray(ideas) && ideas.length && dot) {
                            const parseCreatedAt = (val) => {
                                if (!val) return null;
                                if (typeof val === 'string') return new Date(val);
                                return null;
                            };
                            const newest = ideas
                                .map((idea) => parseCreatedAt(idea.createdAt))
                                .filter((d) => d && !isNaN(d.getTime()))
                                .sort((a, b) => b - a)[0];
                            if (newest) {
                                const ageDays = (Date.now() - newest.getTime()) / (1000 * 60 * 60 * 24);
                                let color = 'var(--accent-secondary)';
                                let glow = 'rgba(0, 168, 255, 0.9)';
                                if (ageDays <= 2) {
                                    // Very new: bright red
                                    color = '#ff4b5c';
                                    glow = 'rgba(255, 75, 92, 0.9)';
                                } else if (ageDays <= 7) {
                                    // Recent: amber
                                    color = '#ffb347';
                                    glow = 'rgba(255, 179, 71, 0.9)';
                                } else {
                                    // Older: softer teal/blue
                                    color = '#4cc9f0';
                                    glow = 'rgba(76, 201, 240, 0.9)';
                                }
                                dot.style.backgroundColor = color;
                                dot.style.boxShadow = `0 0 6px ${glow}`;
                            }
                        }

                        if (!ideas.length) {
                            info.innerHTML = `
                                <div class="province-map-info-name">${p.name}</div>
                                <div class="province-map-info-meta">No ideas posted from this First Nation yet.</div>
                            `;
                            return;
                        }

                        const listHtml = ideas.map((idea, idx) => `
                            <li>
                                <span class="province-map-idea-rank">${idx + 1}.</span>
                                <span class="province-map-idea-title">${idea.title}</span>
                                <span class="province-map-idea-support">(${idea.supportCount || 0} supporters)</span>
                            </li>
                        `).join('');

                        info.innerHTML = `
                            <div class="province-map-info-name">${p.name}</div>
                            <div class="province-map-info-meta">Top ideas from this First Nation:</div>
                            <ol class="province-map-ideas-list">
                                ${listHtml}
                            </ol>
                        `;
                    } catch (err) {
                        info.innerHTML = `
                            <div class="province-map-info-name">${p.name}</div>
                            <div class="province-map-info-meta">Error loading ideas: ${err.message}</div>
                        `;
                    }
                };

                // Hover to show top 10 ideas under the place name
                point.addEventListener('mouseenter', () => {
                    showTopIdeas();
                });

                // Click also shows the same info (friendly for touch devices)
                point.addEventListener('click', (e) => {
                    e.stopPropagation();
                    showTopIdeas();
                });
            }

            inner.appendChild(point);
        });

        // Center the map so the province's middle is in view instead of the northwest corner.
        // We start from a data-driven center, then apply a gentle nudge so provinces like
        // Manitoba land in a more visually pleasing spot. The same formula is used for all
        // provinces so behavior is still consistent.
        if (pointCount > 0) {
            const avgXPercent = sumXPercent / pointCount;
            const avgYPercent = sumYPercent / pointCount;
        
            requestAnimationFrame(() => {
                const rect = canvas.getBoundingClientRect();
                if (!rect.width || !rect.height) return;
        
                // Base translation to bring the average point near the canvas center (50%, 50%)
                let translateX = ((50 - avgXPercent) / 100) * rect.width;
                let translateY = ((50 - avgYPercent) / 100) * rect.height;
        
                // Gentle nudge: shift a bit left and up so the main body of the province
                // tends to land in a nicer spot (this worked well for Manitoba).
                translateX -= rect.width * 0.3;    // 30% extra to the left
                translateY -= rect.height * 0.175; // 17.5% extra upward
        
                state.translateX = translateX;
                state.translateY = translateY;
                // Capture this as our "home" view for the Re-center button.
                state.initialTranslateX = translateX;
                state.initialTranslateY = translateY;
                state.initialScale = state.scale;
                applyTransform();
            });
        }

        canvas.addEventListener('mousedown', (e) => {
            state.panning = true;
            state.startX = e.clientX;
            state.startY = e.clientY;
            state.startTranslateX = state.translateX;
            state.startTranslateY = state.translateY;
            canvas.classList.add('panning');
        });

        const handleMove = (e) => {
            if (!state.panning) return;
            const dx = e.clientX - state.startX;
            const dy = e.clientY - state.startY;
            state.translateX = state.startTranslateX + dx;
            state.translateY = state.startTranslateY + dy;
            applyTransform();
        };

        const handleUp = () => {
            if (!state.panning) return;
            state.panning = false;
            canvas.classList.remove('panning');
        };

        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);

        // Wire up "Re-center map" button to return to the initial province view
        recenterBtn.addEventListener('click', () => {
            state.scale = state.initialScale;
            state.translateX = state.initialTranslateX;
            state.translateY = state.initialTranslateY;
            applyTransform();
        });

        // Enable touch support on mobile for pan + pinch zoom
        attachTouchPanAndZoom();

        // Mouse wheel / trackpad zoom for laptop users (zoom around cursor)
        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const rect = canvas.getBoundingClientRect();
            const cx = e.clientX - rect.left;
            const cy = e.clientY - rect.top;

            // Use a gentler zoom factor so trackpads feel less "jumpy"
            const baseFactor = 1.07;
            const zoomFactor = e.deltaY < 0 ? baseFactor : 1 / baseFactor;
            const newScale = Math.min(8, Math.max(0.2, state.scale * zoomFactor));
            if (newScale === state.scale) return;

            const scaleRatio = newScale / state.scale;
            state.translateX = cx - (cx - state.translateX) * scaleRatio;
            state.translateY = cy - (cy - state.translateY) * scaleRatio;
            state.scale = newScale;
            applyTransform();
        }, { passive: false });

        // Initial transform
        applyTransform();
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
    
    if (typeof App.enableBrowseLayoutDragScroll === 'function') {
        App.enableBrowseLayoutDragScroll();
    }
    
    await App.initLocationTree(pageId, App.onCandidatesLocationSelect);
};

App.onCandidatesLocationSelect = async function(type, id, name, autoSelectFirst = false) {
    const pageId = 'candidates';
    App.showSelectedBadge(pageId, name);
    App.showListLoading(pageId);
    App.showDetailEmpty(pageId, '👤', 'Select a candidate to view profile');
    
    try {
        const candidates = await App.api(`/locations/${type}/${id}/candidates`);

        // Always show the province map when a province is selected,
        // even if there are no candidates yet for that province.
        if (type === 'provinces') {
            App.showProvinceMap(pageId, id, name);
        }
        
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
// FALLBACK PAGES (Profile, Planning, Referendums, Convention, Documentation)
// ============================================

// If the extended bundle hasn't registered these pages yet, provide
// simple placeholder implementations so navigation still works.

if (!App.pages.profile) {
    App.pages.profile = async function() {
        const content = document.getElementById('content');
        const email = App.authUser && App.authUser.email;
        content.innerHTML = `
            <header class="page-header">
                <h1 class="page-title">👤 My Profile (basic)</h1>
            </header>
            <div class="card">
                <div class="card-body">
                    <p class="empty-text">
                        This is a simplified Profile page because the extended UI bundle is not loaded.
                        ${email ? ` You are signed in as <strong>${email}</strong>.` : ' You are not signed in.'}
                    </p>
                </div>
            </div>
        `;
    };
}

if (!App.pages.planning) {
    App.pages.planning = async function() {
        const content = document.getElementById('content');
        content.innerHTML = `
            <header class="page-header">
                <h1 class="page-title">📋 Strategic Planning (basic)</h1>
            </header>
            <div class="card">
                <div class="card-body">
                    <p class="empty-text">
                        The full Strategic Planning interface is temporarily unavailable because the extended UI bundle is not running.
                        You can still discuss priorities using Ideas and Events.
                    </p>
                </div>
            </div>
        `;
    };
}

if (!App.pages.referendums) {
    App.pages.referendums = async function() {
        const content = document.getElementById('content');
        content.innerHTML = `
            <header class="page-header">
                <h1 class="page-title">📑 Referendums (basic)</h1>
            </header>
            <div class="card">
                <div class="card-body">
                    <p class="empty-text">
                        The full Referendums page is temporarily unavailable because the extended UI bundle is not running.
                    </p>
                </div>
            </div>
        `;
    };
}

if (!App.pages.convention) {
    App.pages.convention = async function() {
        const content = document.getElementById('content');
        content.innerHTML = `
            <header class="page-header">
                <h1 class="page-title">🏛 Convention (basic)</h1>
            </header>
            <div class="card">
                <div class="card-body">
                    <p class="empty-text">
                        The full Convention tools are temporarily unavailable because the extended UI bundle is not running.
                    </p>
                </div>
            </div>
        `;
    };
}

if (!App.pages.documentation) {
    App.pages.documentation = async function() {
        const content = document.getElementById('content');
        content.innerHTML = `
            <header class="page-header">
                <h1 class="page-title">📚 Documentation (basic)</h1>
            </header>
            <div class="card">
                <div class="card-body">
                    <p class="empty-text">
                        The detailed documentation UI is temporarily unavailable because the extended UI bundle is not running.
                    </p>
                </div>
            </div>
        `;
    };
}

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
    
    if (typeof App.enableBrowseLayoutDragScroll === 'function') {
        App.enableBrowseLayoutDragScroll();
    }
    
    await App.initLocationTree(pageId, App.onMembersLocationSelect);
};

App.onMembersLocationSelect = async function(type, id, name, autoSelectFirst = false) {
    const pageId = 'members';
    App.showSelectedBadge(pageId, name);
    App.showListLoading(pageId);
    App.showDetailEmpty(pageId, '👤', 'Select a member to view profile');
    
    try {
        const members = await App.api(`/locations/${type}/${id}/users`);

        // Always show the province map when a province is selected,
        // even if there are no members yet for that province.
        if (type === 'provinces') {
            App.showProvinceMap(pageId, id, name);
        }
        
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
    const canFollow = !!(App.authUser && App.authUser.id !== member.id);
    const canNominate = !!(App.authUser && App.authUser.id !== member.id);

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
                ${canFollow ? `
                    <button class="btn btn-secondary" data-action="follow" data-user-id="${member.id}">Follow</button>
                ` : ''}
                ${canNominate ? `
                    <button class="btn btn-secondary" onclick="App.nominateMember('${member.id}')">Nominate</button>
                ` : ''}
            </div>
        </div>
    `;

    // Wire up follow button (uses news API)
    const followBtn = detail.querySelector('button[data-action="follow"]');
    if (followBtn) {
        followBtn.addEventListener('click', async () => {
            if (!App.requireVerifiedAuth || !App.requireVerifiedAuth()) return;
            followBtn.disabled = true;
            followBtn.textContent = 'Following...';
            try {
                await App.apiPost(`/news/follow/${member.id}`, { follow: true });
                followBtn.textContent = 'Following';
            } catch (err) {
                console.error('Error following member:', err);
                followBtn.textContent = 'Follow';
                followBtn.disabled = false;
                alert('Sorry, there was a problem following this member.');
            }
        });
    }
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
    
    if (typeof App.enableBrowseLayoutDragScroll === 'function') {
        App.enableBrowseLayoutDragScroll();
    }
    
    await App.initLocationTree(pageId, App.onEventsLocationSelect);
};

App.onEventsLocationSelect = async function(type, id, name, autoSelectFirst = false) {
    const pageId = 'events';
    App.showSelectedBadge(pageId, name);
    App.showListLoading(pageId);
    App.showDetailEmpty(pageId, '📅', 'Select an event to view details');
    
    try {
        const events = await App.api(`/locations/${type}/${id}/events`);

        // Always show the province map when a province is selected,
        // even if there are no events yet for that province.
        if (type === 'provinces') {
            App.showProvinceMap(pageId, id, name);
        }
        
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
            ${App.authUser ? `
                <div class="detail-actions">
                    <button class="btn btn-primary" onclick="App.joinEvent('${event.id}')">Join Event</button>
                </div>
            ` : ''}
        </div>
    `;
};

// ============================================
// CANADA MAP PAGE
// ============================================

App.pages.map = async function() {
    const content = document.getElementById('content');
    content.innerHTML = `
        <div class="canada-map-layout">
            <section class="canada-map-main">
                <div class="province-map-canvas" id="canada-map-canvas">
                    <div class="province-map-inner" id="canada-map-inner"></div>
                </div>
                <div class="province-map-info" id="canada-map-info">
                    Hover, click or tap a dot to see First Nation details. On touch screens, pinch to zoom and drag to pan.
                </div>
            </section>
            <aside class="canada-map-controls canada-map-controls-bottom">
                <h3 class="canada-map-controls-title">Layers</h3>
                <label class="canada-map-layer">
                    <input type="checkbox" id="map-layer-firstnations" checked>
                    <span>First Nations</span>
                </label>
                <label class="canada-map-layer disabled">
                    <input type="checkbox" id="map-layer-towns" disabled>
                    <span>Towns &amp; cities (coming soon)</span>
                </label>
                <label class="canada-map-layer disabled">
                    <input type="checkbox" id="map-layer-federal" disabled>
                    <span>Federal ridings (coming soon)</span>
                </label>
                <label class="canada-map-layer disabled">
                    <input type="checkbox" id="map-layer-provincial" disabled>
                    <span>Provincial ridings (coming soon)</span>
                </label>
                <label class="canada-map-layer disabled">
                    <input type="checkbox" id="map-layer-ideas" disabled>
                    <span>Idea authors (coming soon)</span>
                </label>
            </aside>
        </div>
    `;

    const canvas = document.getElementById('canada-map-canvas');
    const inner = document.getElementById('canada-map-inner');
    const info = document.getElementById('canada-map-info');

    const layers = {
        FirstNation: []
    };

    const getLatLon = (n) => {
        const latRaw = n.lat ?? n.latitude ?? n.Latitude ?? n.LAT;
        const lonRaw = n.lon ?? n.lng ?? n.longitude ?? n.Longitude ?? n.LON;
        const lat = typeof latRaw === 'number' ? latRaw : parseFloat(latRaw);
        const lon = typeof lonRaw === 'number' ? lonRaw : parseFloat(lonRaw);
        if (!isFinite(lat) || !isFinite(lon)) return null;
        return {
            id: n.id,
            lat,
            lon,
            name: n.name || n.id || 'Community'
        };
    };

    try {
        const provinces = await App.api('/locations/provinces');
        const allPoints = [];

        // Load First Nations for each province/territory
        for (const prov of provinces) {
            const fns = await App.api(`/locations/provinces/${encodeURIComponent(prov.id)}/first-nations`);
            for (const n of fns) {
                const p = getLatLon(n);
                if (!p) continue;
                allPoints.push({
                    ...p,
                    provinceName: prov.name,
                    provinceId: prov.id
                });
            }
        }

        if (!allPoints.length) {
            canvas.innerHTML = `
                <div class="province-map-empty">
                    No coordinate data found yet for First Nations in Canada. Once coordinates are available, this map will render a national view.
                </div>
            `;
            return;
        }

        const lats = allPoints.map((p) => p.lat);
        const lons = allPoints.map((p) => p.lon);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLon = Math.min(...lons);
        const maxLon = Math.max(...lons);
        const latRange = maxLat - minLat || 1;
        const lonRange = maxLon - minLon || 1;

        // Adjust canvas height to keep a roughly correct Canada aspect ratio
        try {
            const avgLat = (minLat + maxLat) / 2;
            const cosLat = Math.cos((avgLat * Math.PI) / 180) || 1;
            const latKmRange = latRange;
            const lonKmRange = lonRange * cosLat;

            if (latKmRange > 0 && lonKmRange > 0) {
                requestAnimationFrame(() => {
                    const rect = canvas.getBoundingClientRect();
                    if (!rect.width) return;
                    const desiredHeight = rect.width * (latKmRange / lonKmRange);
                    canvas.style.height = `${desiredHeight}px`;
                });
            }
        } catch (e) {
            // eslint-disable-next-line no-console
            console.warn('Canada map aspect adjustment failed:', e);
        }

        // Estimate a small rotation so that the 49th parallel (southern border)
        // appears horizontal on screen. We approximate this by looking at
        // First Nations whose latitude is near 49° and fitting a line.
        let initialRotationDeg = 0;
        try {
            const borderCandidates = allPoints.filter((p) => p.lat >= 48 && p.lat <= 50);
            if (borderCandidates.length >= 2) {
                let sumX = 0;
                let sumY = 0;
                let sumXY = 0;
                let sumXX = 0;
                const n = borderCandidates.length;
                borderCandidates.forEach((p) => {
                    const x = ((p.lon - minLon) / lonRange) * 100;
                    const y = (1 - (p.lat - minLat) / latRange) * 100;
                    sumX += x;
                    sumY += y;
                    sumXY += x * y;
                    sumXX += x * x;
                });
                const denom = n * sumXX - sumX * sumX;
                if (Math.abs(denom) > 1e-6) {
                    const slope = (n * sumXY - sumX * sumY) / denom;
                    const angleRad = Math.atan(slope);
                    // Rotate opposite the fitted slope so the border is flat.
                    initialRotationDeg = -angleRad * (180 / Math.PI);
                    // Guard against any wild values if data is noisy.
                    if (!Number.isFinite(initialRotationDeg)) {
                        initialRotationDeg = 0;
                    } else {
                        initialRotationDeg = Math.max(-25, Math.min(25, initialRotationDeg));
                    }
                }
            }
        } catch (e) {
            // eslint-disable-next-line no-console
            console.warn('Canada border rotation calculation failed:', e);
            initialRotationDeg = 0;
        }

        // Create points
        allPoints.forEach((p) => {
            const x = ((p.lon - minLon) / lonRange) * 100;
            const y = (1 - (p.lat - minLat) / latRange) * 100;

            const point = document.createElement('div');
            point.className = 'province-map-point canada-map-point layer-firstnation';
            point.style.left = `${x}%`;
            point.style.top = `${y}%`;

            const dot = document.createElement('div');
            dot.className = 'province-map-dot';

            const label = document.createElement('div');
            label.className = 'province-map-dot-label';
            label.textContent = `${p.name} (${p.provinceName})`;

            point.appendChild(dot);
            point.appendChild(label);

            const showInfo = () => {
                info.innerHTML = `
                    <div class="province-map-info-name">${p.name}</div>
                    <div class="province-map-info-meta">Province/Territory: ${p.provinceName}</div>
                    <div class="province-map-info-meta">Coordinates: ${p.lat.toFixed(3)}, ${p.lon.toFixed(3)}</div>
                    <div class="province-map-info-meta" style="margin-top:4px;">Ideas overlay by location coming soon.</div>
                `;
            };

            point.addEventListener('mouseenter', showInfo);
            point.addEventListener('click', (e) => {
                e.stopPropagation();
                showInfo();
            });

            inner.appendChild(point);
            layers.FirstNation.push(point);
        });

        // Pan + zoom (same behavior as province map) with a fixed rotation
        // so the southern border line appears horizontal.
        const state = {
            // Start more zoomed out so the full country is visible
            scale: 0.6,
            translateX: 0,
            translateY: 0,
            rotation: initialRotationDeg,
            panning: false,
            startX: 0,
            startY: 0,
            startTranslateX: 0,
            startTranslateY: 0,
            pinchZooming: false,
            pinchStartDistance: 0,
            pinchStartScale: 1,
            pinchCenterX: 0,
            pinchCenterY: 0
        };

        const applyTransform = () => {
            inner.style.transform = `translate(${state.translateX}px, ${state.translateY}px) scale(${state.scale}) rotate(${state.rotation}deg)`;
        };

        const attachTouchPanAndZoom = () => {
            canvas.addEventListener('touchstart', (e) => {
                if (e.touches.length === 1) {
                    const t = e.touches[0];
                    state.panning = true;
                    state.pinchZooming = false;
                    state.startX = t.clientX;
                    state.startY = t.clientY;
                    state.startTranslateX = state.translateX;
                    state.startTranslateY = state.translateY;
                    canvas.classList.add('panning');
                } else if (e.touches.length === 2) {
                    state.panning = false;
                    state.pinchZooming = true;
                    const t1 = e.touches[0];
                    const t2 = e.touches[1];
                    const dx = t2.clientX - t1.clientX;
                    const dy = t2.clientY - t1.clientY;
                    state.pinchStartDistance = Math.hypot(dx, dy) || 1;
                    state.pinchStartScale = state.scale;

                    const rect = canvas.getBoundingClientRect();
                    state.pinchCenterX = ((t1.clientX + t2.clientX) / 2) - rect.left;
                    state.pinchCenterY = ((t1.clientY + t2.clientY) / 2) - rect.top;
                }
            }, { passive: false });

            canvas.addEventListener('touchmove', (e) => {
                if (state.pinchZooming && e.touches.length === 2) {
                    e.preventDefault();
                    const t1 = e.touches[0];
                    const t2 = e.touches[1];
                    const dx = t2.clientX - t1.clientX;
                    const dy = t2.clientY - t1.clientY;
                    const dist = Math.hypot(dx, dy) || 1;
                    const factor = dist / state.pinchStartDistance;
                    const newScale = Math.min(8, Math.max(0.2, state.pinchStartScale * factor));
                    if (newScale === state.scale) return;

                    const scaleRatio = newScale / state.scale;
                    state.translateX = state.pinchCenterX - (state.pinchCenterX - state.translateX) * scaleRatio;
                    state.translateY = state.pinchCenterY - (state.pinchCenterY - state.translateY) * scaleRatio;
                    state.scale = newScale;
                    applyTransform();
                } else if (state.panning && e.touches.length === 1) {
                    e.preventDefault();
                    const t = e.touches[0];
                    const dx = t.clientX - state.startX;
                    const dy = t.clientY - state.startY;
                    state.translateX = state.startTranslateX + dx;
                    state.translateY = state.startTranslateY + dy;
                    applyTransform();
                }
            }, { passive: false });

            canvas.addEventListener('touchend', () => {
                state.pinchZooming = false;
                if (state.panning) {
                    state.panning = false;
                    canvas.classList.remove('panning');
                }
            });
        };

        canvas.addEventListener('mousedown', (e) => {
            state.panning = true;
            state.startX = e.clientX;
            state.startY = e.clientY;
            state.startTranslateX = state.translateX;
            state.startTranslateY = state.translateY;
            canvas.classList.add('panning');
        });

        const handleMove = (e) => {
            if (!state.panning) return;
            const dx = e.clientX - state.startX;
            const dy = e.clientY - state.startY;
            state.translateX = state.startTranslateX + dx;
            state.translateY = state.startTranslateY + dy;
            applyTransform();
        };

        const handleUp = () => {
            if (!state.panning) return;
            state.panning = false;
            canvas.classList.remove('panning');
        };

        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);

        // Enable touch pan + pinch zoom
        attachTouchPanAndZoom();

        // Enable mouse wheel zoom on laptop/desktop (zoom around cursor)
        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const rect = canvas.getBoundingClientRect();
            const cx = e.clientX - rect.left;
            const cy = e.clientY - rect.top;

            const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
            const newScale = Math.min(8, Math.max(0.2, state.scale * zoomFactor));
            if (newScale === state.scale) return;

            const scaleRatio = newScale / state.scale;
            state.translateX = cx - (cx - state.translateX) * scaleRatio;
            state.translateY = cy - (cy - state.translateY) * scaleRatio;
            state.scale = newScale;
            applyTransform();
        }, { passive: false });

        // Initial transform
        applyTransform();

        // Layer toggle for First Nations
        const fnCheckbox = document.getElementById('map-layer-firstnations');
        if (fnCheckbox) {
            fnCheckbox.addEventListener('change', () => {
                const visible = fnCheckbox.checked;
                layers.FirstNation.forEach((el) => {
                    el.style.display = visible ? '' : 'none';
                });
            });
        }
    } catch (err) {
        canvas.innerHTML = `<div class="province-map-empty">Error loading Canada map data: ${err.message}</div>`;
    }
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

