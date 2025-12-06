/**
 * Reusable UI Components
 * Location trees, modals, and other shared components
 */

window.App = window.App || {};

// ============================================
// LOCATION TREE (for Browse Ideas)
// ============================================

App.renderLocationTree = async function(countries) {
    let html = '';
    
    for (const country of countries) {
        const countryId = `country-${country.id}`;
        const isExpanded = App.browseState.expandedNodes.has(countryId);
        
        html += `
            <div class="tree-item" data-type="country" data-id="${country.id}">
                <div class="tree-header" data-toggle="${countryId}" data-selectable="true" data-type="countries" data-location-id="${country.id}">
                    <span class="tree-toggle ${isExpanded ? 'expanded' : ''}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M9 18l6-6-6-6"/>
                        </svg>
                    </span>
                    <span class="tree-label">${country.name}</span>
                </div>
                <div class="tree-children ${isExpanded ? 'expanded' : ''}" id="${countryId}">
                    <div class="loading" style="padding: 12px;"><div class="spinner" style="width: 16px; height: 16px;"></div></div>
                </div>
            </div>
        `;
    }
    
    return html;
};

App.renderProvinces = async function(countryId, containerEl) {
    try {
        const provinces = await App.api(`/locations/countries/${countryId}/provinces`);
        
        let html = '';
        for (const province of provinces) {
            const provId = `province-${province.id}`;
            const isExpanded = App.browseState.expandedNodes.has(provId);
            
            html += `
                <div class="tree-item" data-type="province" data-id="${province.id}">
                    <div class="tree-header" data-toggle="${provId}" data-selectable="true" data-type="provinces" data-location-id="${province.id}">
                        <span class="tree-toggle ${isExpanded ? 'expanded' : ''}">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M9 18l6-6-6-6"/>
                            </svg>
                        </span>
                        <span class="tree-label">${province.name}</span>
                    </div>
                    <div class="tree-children ${isExpanded ? 'expanded' : ''}" id="${provId}">
                        <div class="loading" style="padding: 12px;"><div class="spinner" style="width: 16px; height: 16px;"></div></div>
                    </div>
                </div>
            `;
        }
        
        containerEl.innerHTML = html || '<div class="panel-empty-text" style="padding: 12px;">No provinces found</div>';
        App.attachTreeListeners();
    } catch (err) {
        containerEl.innerHTML = `<div style="padding: 12px; color: var(--text-muted);">Error loading provinces</div>`;
    }
};

App.renderCollapsibleCategory = function(categoryId, title, icon, items, itemType) {
    if (!items?.length) return '';
    
    const isExpanded = App.browseState.expandedNodes.has(categoryId);
    
    let itemsHtml = '';
    for (const item of items) {
        itemsHtml += `
            <div class="tree-item">
                <div class="tree-header" data-selectable="true" data-type="${itemType}" data-location-id="${item.id}">
                    <span class="tree-label">${item.name}</span>
                </div>
            </div>
        `;
    }
    
    return `
        <div class="tree-item category-section">
            <div class="tree-header category-header" data-category-toggle="${categoryId}">
                <span class="tree-toggle ${isExpanded ? 'expanded' : ''}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M9 18l6-6-6-6"/>
                    </svg>
                </span>
                <span class="tree-label">${title}</span>
                <span class="tree-count">${items.length}</span>
            </div>
            <div class="tree-children category-items ${isExpanded ? 'expanded' : ''}" id="${categoryId}">
                ${itemsHtml}
            </div>
        </div>
    `;
};

App.renderProvinceDetails = async function(provinceId, containerEl) {
    try {
        containerEl.innerHTML = '<div class="loading" style="padding: 12px;"><div class="spinner" style="width: 16px; height: 16px;"></div></div>';
        
        const [federalRidings, provincialRidings, towns, firstNations, adhocGroups] = await Promise.all([
            App.api(`/locations/provinces/${provinceId}/federal-ridings`),
            App.api(`/locations/provinces/${provinceId}/provincial-ridings`),
            App.api(`/locations/provinces/${provinceId}/towns`),
            App.api(`/locations/provinces/${provinceId}/first-nations`),
            App.api(`/locations/provinces/${provinceId}/adhoc-groups`)
        ]);
        
        let html = '';
        html += App.renderCollapsibleCategory(`cat-${provinceId}-federal`, 'Federal Ridings', App.locationIcons.federalRiding, federalRidings, 'federal-ridings');
        html += App.renderCollapsibleCategory(`cat-${provinceId}-provincial`, 'Provincial Ridings', App.locationIcons.provincialRiding, provincialRidings, 'provincial-ridings');
        html += App.renderCollapsibleCategory(`cat-${provinceId}-towns`, 'Towns & Cities', App.locationIcons.town, towns, 'towns');
        html += App.renderCollapsibleCategory(`cat-${provinceId}-firstnations`, 'First Nations', App.locationIcons.firstNation, firstNations, 'first-nations');
        html += App.renderCollapsibleCategory(`cat-${provinceId}-adhoc`, 'Groups', App.locationIcons.adhocGroup, adhocGroups, 'adhoc-groups');
        
        containerEl.innerHTML = html || '<div class="panel-empty-text" style="padding: 12px;">No locations found</div>';
        App.attachTreeListeners();
        App.attachCategoryListeners();
    } catch (err) {
        containerEl.innerHTML = `<div style="padding: 12px; color: var(--text-muted);">Error: ${err.message}</div>`;
    }
};

App.attachCategoryListeners = function() {
    document.querySelectorAll('.category-header[data-category-toggle]').forEach(header => {
        const newHeader = header.cloneNode(true);
        header.parentNode.replaceChild(newHeader, header);
        
        newHeader.addEventListener('click', (e) => {
            e.stopPropagation();
            const categoryId = newHeader.dataset.categoryToggle;
            const toggle = newHeader.querySelector('.tree-toggle');
            const children = document.getElementById(categoryId);
            
            if (!children) return;
            
            const isExpanded = App.browseState.expandedNodes.has(categoryId);
            
            if (isExpanded) {
                App.browseState.expandedNodes.delete(categoryId);
                toggle?.classList.remove('expanded');
                children.classList.remove('expanded');
            } else {
                App.browseState.expandedNodes.add(categoryId);
                toggle?.classList.add('expanded');
                children.classList.add('expanded');
            }
        });
    });
};

App.attachTreeListeners = function() {
    document.querySelectorAll('.tree-header[data-toggle]').forEach(header => {
        const newHeader = header.cloneNode(true);
        header.parentNode.replaceChild(newHeader, header);
        
        newHeader.addEventListener('click', async (e) => {
            const toggleId = newHeader.dataset.toggle;
            const toggle = newHeader.querySelector('.tree-toggle');
            const children = document.getElementById(toggleId);
            
            if (!children) return;
            
            const isExpanded = App.browseState.expandedNodes.has(toggleId);
            
            if (isExpanded) {
                App.browseState.expandedNodes.delete(toggleId);
                toggle?.classList.remove('expanded');
                children.classList.remove('expanded');
            } else {
                App.browseState.expandedNodes.add(toggleId);
                toggle?.classList.add('expanded');
                children.classList.add('expanded');
                
                if (children.querySelector('.loading')) {
                    if (toggleId.startsWith('country-')) {
                        await App.renderProvinces(toggleId.replace('country-', ''), children);
                    } else if (toggleId.startsWith('province-')) {
                        await App.renderProvinceDetails(toggleId.replace('province-', ''), children);
                    }
                }
            }
            
            if (newHeader.dataset.selectable) {
                App.handleLocationSelection(newHeader);
            }
        });
    });
    
    document.querySelectorAll('.tree-header[data-selectable]:not([data-toggle])').forEach(header => {
        const newHeader = header.cloneNode(true);
        header.parentNode.replaceChild(newHeader, header);
        
        newHeader.addEventListener('click', () => {
            App.handleLocationSelection(newHeader);
        });
    });
};

App.handleLocationSelection = function(header) {
    document.querySelectorAll('.tree-header').forEach(h => h.classList.remove('active'));
    header.classList.add('active');
    
    const type = header.dataset.type;
    const id = header.dataset.locationId;
    const name = header.querySelector('.tree-label')?.textContent || 'Unknown';
    
    App.loadIdeasForLocation(type, id, name);
    
    document.getElementById('idea-detail').innerHTML = `
        <div class="panel-empty">
            <div class="panel-empty-icon">💡</div>
            <div class="panel-empty-text">Select an idea to view details</div>
        </div>
    `;
};

App.loadIdeasForLocation = async function(type, id, locationName) {
    const ideasList = document.getElementById('ideas-list');
    const badge = document.getElementById('selected-location-badge');
    
    ideasList.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    badge.innerHTML = `
        <div class="selected-location">
            <span>${locationName}</span>
        </div>
    `;
    
    App.browseState.selectedLocation = id;
    App.browseState.selectedLocationType = type;
    
    try {
        const ideas = await App.api(`/locations/${type}/${id}/ideas`);
        
        if (!ideas.length) {
            ideasList.innerHTML = `
                <div class="panel-empty">
                    <div class="panel-empty-icon">💭</div>
                    <div class="panel-empty-text">No ideas from this location yet</div>
                </div>
            `;
            return;
        }
        
        ideasList.innerHTML = ideas.map((idea, index) => `
            <div class="idea-list-item" data-idea-index="${index}" data-idea-id="${idea.id}">
                <div class="idea-list-title">${idea.title}</div>
                <div class="idea-list-meta">
                    <span class="idea-list-support">👍 ${idea.supportCount || 0}</span>
                    <span>${idea.author?.name || 'Anonymous'}</span>
                </div>
            </div>
        `).join('');
        
        App.browseState.currentIdeas = ideas;
        
        document.querySelectorAll('.idea-list-item').forEach(item => {
            item.addEventListener('click', () => {
                document.querySelectorAll('.idea-list-item').forEach(i => i.classList.remove('selected'));
                item.classList.add('selected');
                const index = parseInt(item.dataset.ideaIndex);
                App.showIdeaDetail(App.browseState.currentIdeas[index]);
            });
        });
    } catch (err) {
        ideasList.innerHTML = `<div class="panel-empty-text">Error: ${err.message}</div>`;
    }
};

App.showIdeaDetail = function(idea) {
    const detailPanel = document.getElementById('idea-detail');
    
    detailPanel.innerHTML = `
        <div class="idea-detail">
            <div class="idea-detail-header">
                <h2 class="idea-detail-title">${idea.title}</h2>
                <p class="idea-detail-author">
                    ${idea.author ? `Posted by ${idea.author.name}` : 'Posted anonymously'}
                    ${idea.region ? ` • ${idea.region}` : ''}
                </p>
            </div>
            <div class="idea-detail-stats">
                <div class="idea-stat">
                    <div class="idea-stat-value">${idea.supportCount || 0}</div>
                    <div class="idea-stat-label">Supporters</div>
                </div>
            </div>
            <div class="idea-detail-body">${idea.description || 'No description provided.'}</div>
            ${idea.tags?.length ? `
                <div style="margin-top: 16px;">
                    ${idea.tags.map(tag => `<span class="tag accent">${tag}</span>`).join('')}
                </div>
            ` : ''}
        </div>
    `;
};

// ============================================
// CANDIDATES TREE
// ============================================

App.renderLocationTreeForCandidates = async function(countries) {
    let html = '';
    
    for (const country of countries) {
        const countryId = `cand-country-${country.id}`;
        const isExpanded = App.candidatesState.expandedNodes.has(countryId);
        
        html += `
            <div class="tree-item" data-type="country" data-id="${country.id}">
                <div class="tree-header" data-cand-toggle="${countryId}" data-cand-selectable="true" data-cand-type="countries" data-cand-location-id="${country.id}">
                    <span class="tree-toggle ${isExpanded ? 'expanded' : ''}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M9 18l6-6-6-6"/>
                        </svg>
                    </span>
                    <span class="tree-label">${country.name}</span>
                </div>
                <div class="tree-children ${isExpanded ? 'expanded' : ''}" id="${countryId}">
                    <div class="loading" style="padding: 12px;"><div class="spinner" style="width: 16px; height: 16px;"></div></div>
                </div>
            </div>
        `;
    }
    
    return html;
};

App.renderProvincesForCandidates = async function(countryId, containerEl) {
    try {
        const provinces = await App.api(`/locations/countries/${countryId}/provinces`);
        
        let html = '';
        for (const province of provinces) {
            const provId = `cand-province-${province.id}`;
            const isExpanded = App.candidatesState.expandedNodes.has(provId);
            
            html += `
                <div class="tree-item" data-type="province" data-id="${province.id}">
                    <div class="tree-header" data-cand-toggle="${provId}" data-cand-selectable="true" data-cand-type="provinces" data-cand-location-id="${province.id}">
                        <span class="tree-toggle ${isExpanded ? 'expanded' : ''}">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M9 18l6-6-6-6"/>
                            </svg>
                        </span>
                        <span class="tree-label">${province.name}</span>
                    </div>
                    <div class="tree-children ${isExpanded ? 'expanded' : ''}" id="${provId}">
                        <div class="loading" style="padding: 12px;"><div class="spinner" style="width: 16px; height: 16px;"></div></div>
                    </div>
                </div>
            `;
        }
        
        containerEl.innerHTML = html || '<div class="panel-empty-text" style="padding: 12px;">No provinces found</div>';
        App.attachTreeListenersForCandidates();
    } catch (err) {
        containerEl.innerHTML = `<div style="padding: 12px; color: var(--text-muted);">Error loading provinces</div>`;
    }
};

App.renderCollapsibleCategoryForCandidates = function(categoryId, title, icon, items, itemType) {
    if (!items?.length) return '';
    
    const isExpanded = App.candidatesState.expandedNodes.has(categoryId);
    
    let itemsHtml = '';
    for (const item of items) {
        itemsHtml += `
            <div class="tree-item">
                <div class="tree-header" data-cand-selectable="true" data-cand-type="${itemType}" data-cand-location-id="${item.id}">
                    <span class="tree-label">${item.name}</span>
                </div>
            </div>
        `;
    }
    
    return `
        <div class="tree-item category-section">
            <div class="tree-header category-header" data-cand-category-toggle="${categoryId}">
                <span class="tree-toggle ${isExpanded ? 'expanded' : ''}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M9 18l6-6-6-6"/>
                    </svg>
                </span>
                <span class="tree-label">${title}</span>
                <span class="tree-count">${items.length}</span>
            </div>
            <div class="tree-children category-items ${isExpanded ? 'expanded' : ''}" id="${categoryId}">
                ${itemsHtml}
            </div>
        </div>
    `;
};

App.renderProvinceDetailsForCandidates = async function(provinceId, containerEl) {
    try {
        containerEl.innerHTML = '<div class="loading" style="padding: 12px;"><div class="spinner" style="width: 16px; height: 16px;"></div></div>';
        
        const [federalRidings, provincialRidings, firstNations] = await Promise.all([
            App.api(`/locations/provinces/${provinceId}/federal-ridings`),
            App.api(`/locations/provinces/${provinceId}/provincial-ridings`),
            App.api(`/locations/provinces/${provinceId}/first-nations`)
        ]);
        
        let html = '';
        html += App.renderCollapsibleCategoryForCandidates(`cand-cat-${provinceId}-federal`, 'Federal Ridings', App.locationIcons.federalRiding, federalRidings, 'federal-ridings');
        html += App.renderCollapsibleCategoryForCandidates(`cand-cat-${provinceId}-provincial`, 'Provincial Ridings', App.locationIcons.provincialRiding, provincialRidings, 'provincial-ridings');
        html += App.renderCollapsibleCategoryForCandidates(`cand-cat-${provinceId}-firstnations`, 'First Nations', App.locationIcons.firstNation, firstNations, 'first-nations');
        
        containerEl.innerHTML = html || '<div class="panel-empty-text" style="padding: 12px;">No locations found</div>';
        App.attachTreeListenersForCandidates();
        App.attachCategoryListenersForCandidates();
    } catch (err) {
        containerEl.innerHTML = `<div style="padding: 12px; color: var(--text-muted);">Error: ${err.message}</div>`;
    }
};

App.attachTreeListenersForCandidates = function() {
    document.querySelectorAll('.tree-header[data-cand-toggle]').forEach(header => {
        const newHeader = header.cloneNode(true);
        header.parentNode.replaceChild(newHeader, header);
        
        newHeader.addEventListener('click', async (e) => {
            const toggleId = newHeader.dataset.candToggle;
            const toggle = newHeader.querySelector('.tree-toggle');
            const children = document.getElementById(toggleId);
            
            if (!children) return;
            
            const isExpanded = App.candidatesState.expandedNodes.has(toggleId);
            
            if (isExpanded) {
                App.candidatesState.expandedNodes.delete(toggleId);
                toggle?.classList.remove('expanded');
                children.classList.remove('expanded');
            } else {
                App.candidatesState.expandedNodes.add(toggleId);
                toggle?.classList.add('expanded');
                children.classList.add('expanded');
                
                if (children.querySelector('.loading')) {
                    if (toggleId.startsWith('cand-country-')) {
                        await App.renderProvincesForCandidates(toggleId.replace('cand-country-', ''), children);
                    } else if (toggleId.startsWith('cand-province-')) {
                        await App.renderProvinceDetailsForCandidates(toggleId.replace('cand-province-', ''), children);
                    }
                }
            }
            
            if (newHeader.dataset.candSelectable) {
                App.handleCandidateLocationSelection(newHeader);
            }
        });
    });
    
    document.querySelectorAll('.tree-header[data-cand-selectable]:not([data-cand-toggle])').forEach(header => {
        const newHeader = header.cloneNode(true);
        header.parentNode.replaceChild(newHeader, header);
        
        newHeader.addEventListener('click', () => {
            App.handleCandidateLocationSelection(newHeader);
        });
    });
};

App.attachCategoryListenersForCandidates = function() {
    document.querySelectorAll('.category-header[data-cand-category-toggle]').forEach(header => {
        const newHeader = header.cloneNode(true);
        header.parentNode.replaceChild(newHeader, header);
        
        newHeader.addEventListener('click', (e) => {
            e.stopPropagation();
            const categoryId = newHeader.dataset.candCategoryToggle;
            const toggle = newHeader.querySelector('.tree-toggle');
            const children = document.getElementById(categoryId);
            
            if (!children) return;
            
            const isExpanded = App.candidatesState.expandedNodes.has(categoryId);
            
            if (isExpanded) {
                App.candidatesState.expandedNodes.delete(categoryId);
                toggle?.classList.remove('expanded');
                children.classList.remove('expanded');
            } else {
                App.candidatesState.expandedNodes.add(categoryId);
                toggle?.classList.add('expanded');
                children.classList.add('expanded');
            }
        });
    });
};

App.handleCandidateLocationSelection = function(header) {
    document.querySelectorAll('.tree-header').forEach(h => h.classList.remove('active'));
    header.classList.add('active');
    
    const type = header.dataset.candType;
    const id = header.dataset.candLocationId;
    const name = header.querySelector('.tree-label')?.textContent || 'Unknown';
    
    App.loadCandidatesForLocation(type, id, name);
    
    document.getElementById('candidate-detail').innerHTML = `
        <div class="panel-empty">
            <div class="panel-empty-icon">👤</div>
            <div class="panel-empty-text">Select a candidate to view profile</div>
        </div>
    `;
};

App.loadCandidatesForLocation = async function(type, id, locationName) {
    const candidatesList = document.getElementById('candidates-list');
    const badge = document.getElementById('selected-location-badge-candidates');
    
    candidatesList.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    badge.innerHTML = `
        <div class="selected-location">
            <span>${locationName}</span>
        </div>
    `;
    
    App.candidatesState.selectedLocation = id;
    App.candidatesState.selectedLocationType = type;
    
    try {
        const candidates = await App.api(`/locations/${type}/${id}/candidates`);
        
        if (!candidates.length) {
            candidatesList.innerHTML = `
                <div class="panel-empty">
                    <div class="panel-empty-icon">🗳️</div>
                    <div class="panel-empty-text">No candidates in this location yet</div>
                </div>
            `;
            return;
        }
        
        App.candidatesState.currentCandidates = candidates;
        App.renderCandidatesList();
    } catch (err) {
        candidatesList.innerHTML = `<div class="panel-empty-text">Error: ${err.message}</div>`;
    }
};

App.renderCandidatesList = function() {
    const candidatesList = document.getElementById('candidates-list');
    const candidates = [...App.candidatesState.currentCandidates];
    
    if (App.candidatesState.sortBy === 'points') {
        candidates.sort((a, b) => (b.points || 0) - (a.points || 0));
    } else {
        candidates.sort((a, b) => (b.endorsementCount || 0) - (a.endorsementCount || 0));
    }
    
    let html = `
        <div class="sort-controls">
            <span class="sort-label">Sort by:</span>
            <label class="sort-option">
                <input type="radio" name="candidateSort" value="points" ${App.candidatesState.sortBy === 'points' ? 'checked' : ''}>
                <span class="sort-option-label">⭐ Points</span>
            </label>
            <label class="sort-option">
                <input type="radio" name="candidateSort" value="endorsements" ${App.candidatesState.sortBy === 'endorsements' ? 'checked' : ''}>
                <span class="sort-option-label">👍 Endorsements</span>
            </label>
        </div>
    `;
    
    html += candidates.map((candidate, index) => `
        <div class="candidate-list-item" data-candidate-index="${index}" data-candidate-id="${candidate.id}">
            <div class="candidate-avatar">${App.getInitials(candidate.name)}</div>
            <div class="candidate-info">
                <div class="candidate-list-name">${candidate.name}</div>
                <div class="candidate-list-meta">
                    <span class="candidate-points">⭐ ${candidate.points || 0} pts</span>
                    <span class="candidate-endorsements">👍 ${candidate.endorsementCount || 0}</span>
                </div>
            </div>
        </div>
    `).join('');
    
    candidatesList.innerHTML = html;
    App.candidatesState.currentCandidates = candidates;
    
    document.querySelectorAll('input[name="candidateSort"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            App.candidatesState.sortBy = e.target.value;
            App.renderCandidatesList();
        });
    });
    
    document.querySelectorAll('.candidate-list-item').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.candidate-list-item').forEach(i => i.classList.remove('selected'));
            item.classList.add('selected');
            const index = parseInt(item.dataset.candidateIndex);
            App.showCandidateDetail(App.candidatesState.currentCandidates[index]);
        });
    });
};

App.showCandidateDetail = function(candidate) {
    const detailPanel = document.getElementById('candidate-detail');
    
    detailPanel.innerHTML = `
        <div class="candidate-detail">
            <div class="candidate-detail-header">
                <div class="candidate-detail-avatar">${App.getInitials(candidate.name)}</div>
                <div>
                    <h2 class="candidate-detail-name">${candidate.name}</h2>
                    <p class="candidate-detail-region">📍 ${candidate.region || 'Unknown location'}</p>
                </div>
            </div>
            <div class="candidate-detail-stats">
                <div class="candidate-stat">
                    <div class="candidate-stat-value points-value">${candidate.points || 0}</div>
                    <div class="candidate-stat-label">Points</div>
                </div>
                <div class="candidate-stat">
                    <div class="candidate-stat-value">${candidate.endorsementCount || 0}</div>
                    <div class="candidate-stat-label">Endorsements</div>
                </div>
            </div>
            ${candidate.platform ? `
                <div class="candidate-platform">
                    <h3 class="platform-title">Platform</h3>
                    <p class="platform-text">${candidate.platform}</p>
                </div>
            ` : ''}
            <div class="candidate-bio">
                <h3 class="bio-title">About</h3>
                <p class="bio-text">${candidate.bio || 'No bio provided.'}</p>
            </div>
            ${candidate.skills?.length ? `
                <div class="candidate-skills">
                    <h3 class="skills-title">Skills</h3>
                    <div class="skills-list">${candidate.skills.map(s => `<span class="tag">${s}</span>`).join('')}</div>
                </div>
            ` : ''}
            ${candidate.interests?.length ? `
                <div class="candidate-interests">
                    <h3 class="interests-title">Interests</h3>
                    <div class="interests-list">${candidate.interests.map(i => `<span class="tag accent">${i}</span>`).join('')}</div>
                </div>
            ` : ''}
        </div>
    `;
};

