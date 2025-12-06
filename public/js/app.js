// API helper
async function api(endpoint) {
  const response = await fetch(`/api${endpoint}`);
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return response.json();
}

// Get initials from name
function getInitials(name) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase();
}

// Format date
function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

// Format time
function formatTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  });
}

// Location type icons
const locationIcons = {
  country: '🌎',
  province: '🏛️',
  federalRiding: '🗳️',
  provincialRiding: '📋',
  town: '🏘️',
  firstNation: '🪶',
  adhocGroup: '👥'
};

// Render location tree
async function renderLocationTree(countries) {
  let html = '';
  
  for (const country of countries) {
    const countryId = `country-${country.id}`;
    const isExpanded = browseState.expandedNodes.has(countryId);
    
    html += `
      <div class="tree-item" data-type="country" data-id="${country.id}">
        <div class="tree-header" data-toggle="${countryId}" data-selectable="true" data-type="countries" data-location-id="${country.id}">
          <span class="tree-toggle ${isExpanded ? 'expanded' : ''}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </span>
          <span class="tree-icon">${locationIcons.country}</span>
          <span class="tree-label">${country.name}</span>
        </div>
        <div class="tree-children ${isExpanded ? 'expanded' : ''}" id="${countryId}">
          <div class="loading" style="padding: 12px;"><div class="spinner" style="width: 16px; height: 16px;"></div></div>
        </div>
      </div>
    `;
  }
  
  return html;
}

// Render provinces for a country
async function renderProvinces(countryId, containerEl) {
  try {
    const provinces = await api(`/locations/countries/${countryId}/provinces`);
    
    let html = '';
    for (const province of provinces) {
      const provId = `province-${province.id}`;
      const isExpanded = browseState.expandedNodes.has(provId);
      
      html += `
        <div class="tree-item" data-type="province" data-id="${province.id}">
          <div class="tree-header" data-toggle="${provId}" data-selectable="true" data-type="provinces" data-location-id="${province.id}">
            <span class="tree-toggle ${isExpanded ? 'expanded' : ''}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </span>
            <span class="tree-icon">${locationIcons.province}</span>
            <span class="tree-label">${province.name}</span>
          </div>
          <div class="tree-children ${isExpanded ? 'expanded' : ''}" id="${provId}">
            <div class="loading" style="padding: 12px;"><div class="spinner" style="width: 16px; height: 16px;"></div></div>
          </div>
        </div>
      `;
    }
    
    containerEl.innerHTML = html || '<div class="panel-empty-text" style="padding: 12px; font-size: 13px;">No provinces found</div>';
    attachTreeListeners();
  } catch (err) {
    containerEl.innerHTML = `<div style="padding: 12px; color: var(--text-muted);">Error loading provinces</div>`;
  }
}

// Helper to render a collapsible category
function renderCollapsibleCategory(categoryId, title, icon, items, itemType) {
  if (!items?.length) return '';
  
  const isExpanded = browseState.expandedNodes.has(categoryId);
  
  let itemsHtml = '';
  for (const item of items) {
    itemsHtml += `
      <div class="tree-item">
        <div class="tree-header" data-selectable="true" data-type="${itemType}" data-location-id="${item.id}">
          <span class="tree-icon">${icon}</span>
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
        <span class="tree-icon">${icon}</span>
        <span class="tree-label">${title}</span>
        <span class="tree-count">${items.length}</span>
      </div>
      <div class="tree-children category-items ${isExpanded ? 'expanded' : ''}" id="${categoryId}">
        ${itemsHtml}
      </div>
    </div>
  `;
}

// Render province details (ridings, towns, etc.) - Load in parallel
async function renderProvinceDetails(provinceId, containerEl) {
  try {
    // Show loading state
    containerEl.innerHTML = '<div class="loading" style="padding: 12px;"><div class="spinner" style="width: 16px; height: 16px;"></div></div>';
    
    // Load all location types in parallel
    const [federalRidings, provincialRidings, towns, firstNations, adhocGroups] = await Promise.all([
      api(`/locations/provinces/${provinceId}/federal-ridings`),
      api(`/locations/provinces/${provinceId}/provincial-ridings`),
      api(`/locations/provinces/${provinceId}/towns`),
      api(`/locations/provinces/${provinceId}/first-nations`),
      api(`/locations/provinces/${provinceId}/adhoc-groups`)
    ]);
    
    let html = '';
    
    // Federal Ridings (collapsible)
    html += renderCollapsibleCategory(
      `cat-${provinceId}-federal`,
      'Federal Ridings',
      locationIcons.federalRiding,
      federalRidings,
      'federal-ridings'
    );
    
    // Provincial Ridings (collapsible)
    html += renderCollapsibleCategory(
      `cat-${provinceId}-provincial`,
      'Provincial Ridings',
      locationIcons.provincialRiding,
      provincialRidings,
      'provincial-ridings'
    );
    
    // Towns (collapsible)
    html += renderCollapsibleCategory(
      `cat-${provinceId}-towns`,
      'Towns & Cities',
      locationIcons.town,
      towns,
      'towns'
    );
    
    // First Nations (collapsible)
    html += renderCollapsibleCategory(
      `cat-${provinceId}-firstnations`,
      'First Nations',
      locationIcons.firstNation,
      firstNations,
      'first-nations'
    );
    
    // Adhoc Groups (collapsible)
    html += renderCollapsibleCategory(
      `cat-${provinceId}-adhoc`,
      'Groups',
      locationIcons.adhocGroup,
      adhocGroups,
      'adhoc-groups'
    );
    
    containerEl.innerHTML = html || '<div class="panel-empty-text" style="padding: 12px; font-size: 13px;">No locations found</div>';
    attachTreeListeners();
    attachCategoryListeners();
    
  } catch (err) {
    containerEl.innerHTML = `<div style="padding: 12px; color: var(--text-muted);">Error loading details: ${err.message}</div>`;
  }
}

// Attach category toggle listeners
function attachCategoryListeners() {
  document.querySelectorAll('.category-header[data-category-toggle]').forEach(header => {
    const newHeader = header.cloneNode(true);
    header.parentNode.replaceChild(newHeader, header);
    
    newHeader.addEventListener('click', (e) => {
      e.stopPropagation();
      const categoryId = newHeader.dataset.categoryToggle;
      const toggle = newHeader.querySelector('.tree-toggle');
      const children = document.getElementById(categoryId);
      
      if (!children) return;
      
      const isExpanded = browseState.expandedNodes.has(categoryId);
      
      if (isExpanded) {
        browseState.expandedNodes.delete(categoryId);
        toggle?.classList.remove('expanded');
        children.classList.remove('expanded');
      } else {
        browseState.expandedNodes.add(categoryId);
        toggle?.classList.add('expanded');
        children.classList.add('expanded');
      }
    });
  });
}

// Load ideas for a location
async function loadIdeasForLocation(type, id, locationName) {
  const ideasList = document.getElementById('ideas-list');
  const badge = document.getElementById('selected-location-badge');
  
  ideasList.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  badge.innerHTML = `
    <div class="selected-location">
      <span class="selected-location-icon">${locationIcons[type.replace('-', '')] || '📍'}</span>
      <span>${locationName}</span>
    </div>
  `;
  
  browseState.selectedLocation = id;
  browseState.selectedLocationType = type;
  
  try {
    const ideas = await api(`/locations/${type}/${id}/ideas`);
    
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
    
    // Store ideas for detail view
    browseState.currentIdeas = ideas;
    
    // Add click handlers
    document.querySelectorAll('.idea-list-item').forEach(item => {
      item.addEventListener('click', () => {
        document.querySelectorAll('.idea-list-item').forEach(i => i.classList.remove('selected'));
        item.classList.add('selected');
        const index = parseInt(item.dataset.ideaIndex);
        showIdeaDetail(browseState.currentIdeas[index]);
      });
    });
  } catch (err) {
    ideasList.innerHTML = `<div class="panel-empty-text">Error loading ideas: ${err.message}</div>`;
  }
}

// Show idea detail
function showIdeaDetail(idea) {
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
      
      <div class="idea-detail-body">
        ${idea.description || 'No description provided.'}
      </div>
      
      ${idea.tags?.length ? `
        <div style="margin-top: 16px;">
          ${idea.tags.map(tag => `<span class="tag accent">${tag}</span>`).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

// ============================================
// CANDIDATES BROWSER FUNCTIONS
// ============================================

// Candidates browser state
let candidatesState = {
  selectedLocation: null,
  selectedLocationType: null,
  selectedCandidate: null,
  expandedNodes: new Set(),
  currentCandidates: [],
  sortBy: 'points' // 'points' or 'endorsements'
};

// Render location tree for candidates
async function renderLocationTreeForCandidates(countries) {
  let html = '';
  
  for (const country of countries) {
    const countryId = `cand-country-${country.id}`;
    const isExpanded = candidatesState.expandedNodes.has(countryId);
    
    html += `
      <div class="tree-item" data-type="country" data-id="${country.id}">
        <div class="tree-header" data-cand-toggle="${countryId}" data-cand-selectable="true" data-cand-type="countries" data-cand-location-id="${country.id}">
          <span class="tree-toggle ${isExpanded ? 'expanded' : ''}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </span>
          <span class="tree-icon">${locationIcons.country}</span>
          <span class="tree-label">${country.name}</span>
        </div>
        <div class="tree-children ${isExpanded ? 'expanded' : ''}" id="${countryId}">
          <div class="loading" style="padding: 12px;"><div class="spinner" style="width: 16px; height: 16px;"></div></div>
        </div>
      </div>
    `;
  }
  
  return html;
}

// Render provinces for candidates
async function renderProvincesForCandidates(countryId, containerEl) {
  try {
    const provinces = await api(`/locations/countries/${countryId}/provinces`);
    
    let html = '';
    for (const province of provinces) {
      const provId = `cand-province-${province.id}`;
      const isExpanded = candidatesState.expandedNodes.has(provId);
      
      html += `
        <div class="tree-item" data-type="province" data-id="${province.id}">
          <div class="tree-header" data-cand-toggle="${provId}" data-cand-selectable="true" data-cand-type="provinces" data-cand-location-id="${province.id}">
            <span class="tree-toggle ${isExpanded ? 'expanded' : ''}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </span>
            <span class="tree-icon">${locationIcons.province}</span>
            <span class="tree-label">${province.name}</span>
          </div>
          <div class="tree-children ${isExpanded ? 'expanded' : ''}" id="${provId}">
            <div class="loading" style="padding: 12px;"><div class="spinner" style="width: 16px; height: 16px;"></div></div>
          </div>
        </div>
      `;
    }
    
    containerEl.innerHTML = html || '<div class="panel-empty-text" style="padding: 12px; font-size: 13px;">No provinces found</div>';
    attachTreeListenersForCandidates();
  } catch (err) {
    containerEl.innerHTML = `<div style="padding: 12px; color: var(--text-muted);">Error loading provinces</div>`;
  }
}

// Render province details for candidates (collapsible categories)
async function renderProvinceDetailsForCandidates(provinceId, containerEl) {
  try {
    containerEl.innerHTML = '<div class="loading" style="padding: 12px;"><div class="spinner" style="width: 16px; height: 16px;"></div></div>';
    
    const [federalRidings, provincialRidings, firstNations] = await Promise.all([
      api(`/locations/provinces/${provinceId}/federal-ridings`),
      api(`/locations/provinces/${provinceId}/provincial-ridings`),
      api(`/locations/provinces/${provinceId}/first-nations`)
    ]);
    
    let html = '';
    
    // Federal Ridings
    html += renderCollapsibleCategoryForCandidates(`cand-cat-${provinceId}-federal`, 'Federal Ridings', locationIcons.federalRiding, federalRidings, 'federal-ridings');
    
    // Provincial Ridings
    html += renderCollapsibleCategoryForCandidates(`cand-cat-${provinceId}-provincial`, 'Provincial Ridings', locationIcons.provincialRiding, provincialRidings, 'provincial-ridings');
    
    // First Nations
    html += renderCollapsibleCategoryForCandidates(`cand-cat-${provinceId}-firstnations`, 'First Nations', locationIcons.firstNation, firstNations, 'first-nations');
    
    containerEl.innerHTML = html || '<div class="panel-empty-text" style="padding: 12px; font-size: 13px;">No locations found</div>';
    attachTreeListenersForCandidates();
    attachCategoryListenersForCandidates();
    
  } catch (err) {
    containerEl.innerHTML = `<div style="padding: 12px; color: var(--text-muted);">Error loading details: ${err.message}</div>`;
  }
}

// Helper to render collapsible category for candidates
function renderCollapsibleCategoryForCandidates(categoryId, title, icon, items, itemType) {
  if (!items?.length) return '';
  
  const isExpanded = candidatesState.expandedNodes.has(categoryId);
  
  let itemsHtml = '';
  for (const item of items) {
    itemsHtml += `
      <div class="tree-item">
        <div class="tree-header" data-cand-selectable="true" data-cand-type="${itemType}" data-cand-location-id="${item.id}">
          <span class="tree-icon">${icon}</span>
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
        <span class="tree-icon">${icon}</span>
        <span class="tree-label">${title}</span>
        <span class="tree-count">${items.length}</span>
      </div>
      <div class="tree-children category-items ${isExpanded ? 'expanded' : ''}" id="${categoryId}">
        ${itemsHtml}
      </div>
    </div>
  `;
}

// Load candidates for a location
async function loadCandidatesForLocation(type, id, locationName) {
  const candidatesList = document.getElementById('candidates-list');
  const badge = document.getElementById('selected-location-badge-candidates');
  
  candidatesList.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  badge.innerHTML = `
    <div class="selected-location">
      <span class="selected-location-icon">${locationIcons[type.replace('-', '')] || '📍'}</span>
      <span>${locationName}</span>
    </div>
  `;
  
  candidatesState.selectedLocation = id;
  candidatesState.selectedLocationType = type;
  
  try {
    const candidates = await api(`/locations/${type}/${id}/candidates`);
    
    if (!candidates.length) {
      candidatesList.innerHTML = `
        <div class="panel-empty">
          <div class="panel-empty-icon">🗳️</div>
          <div class="panel-empty-text">No candidates in this location yet</div>
        </div>
      `;
      return;
    }
    
    // Store candidates for sorting/detail view
    candidatesState.currentCandidates = candidates;
    
    // Render with sort controls
    renderCandidatesList();
    
  } catch (err) {
    candidatesList.innerHTML = `<div class="panel-empty-text">Error loading candidates: ${err.message}</div>`;
  }
}

// Render candidates list with current sort
function renderCandidatesList() {
  const candidatesList = document.getElementById('candidates-list');
  const candidates = [...candidatesState.currentCandidates];
  
  // Sort based on current setting
  if (candidatesState.sortBy === 'points') {
    candidates.sort((a, b) => (b.points || 0) - (a.points || 0));
  } else {
    candidates.sort((a, b) => (b.endorsementCount || 0) - (a.endorsementCount || 0));
  }
  
  // Build HTML with sort controls
  let html = `
    <div class="sort-controls">
      <span class="sort-label">Sort by:</span>
      <label class="sort-option">
        <input type="radio" name="candidateSort" value="points" ${candidatesState.sortBy === 'points' ? 'checked' : ''}>
        <span class="sort-option-label">⭐ Points</span>
      </label>
      <label class="sort-option">
        <input type="radio" name="candidateSort" value="endorsements" ${candidatesState.sortBy === 'endorsements' ? 'checked' : ''}>
        <span class="sort-option-label">👍 Endorsements</span>
      </label>
    </div>
  `;
  
  html += candidates.map((candidate, index) => `
    <div class="candidate-list-item" data-candidate-index="${index}" data-candidate-id="${candidate.id}">
      <div class="candidate-avatar">${getInitials(candidate.name)}</div>
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
  
  // Update stored order to match display
  candidatesState.currentCandidates = candidates;
  
  // Add sort change handlers
  document.querySelectorAll('input[name="candidateSort"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      candidatesState.sortBy = e.target.value;
      renderCandidatesList();
    });
  });
  
  // Add click handlers for candidate items
  document.querySelectorAll('.candidate-list-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.candidate-list-item').forEach(i => i.classList.remove('selected'));
      item.classList.add('selected');
      const index = parseInt(item.dataset.candidateIndex);
      showCandidateDetail(candidatesState.currentCandidates[index]);
    });
  });
}

// Show candidate detail
function showCandidateDetail(candidate) {
  const detailPanel = document.getElementById('candidate-detail');
  
  detailPanel.innerHTML = `
    <div class="candidate-detail">
      <div class="candidate-detail-header">
        <div class="candidate-detail-avatar">${getInitials(candidate.name)}</div>
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
          <div class="skills-list">
            ${candidate.skills.map(skill => `<span class="tag">${skill}</span>`).join('')}
          </div>
        </div>
      ` : ''}
      
      ${candidate.interests?.length ? `
        <div class="candidate-interests">
          <h3 class="interests-title">Interests</h3>
          <div class="interests-list">
            ${candidate.interests.map(interest => `<span class="tag accent">${interest}</span>`).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

// Attach tree event listeners for candidates
function attachTreeListenersForCandidates() {
  // Toggle handlers (expand/collapse)
  document.querySelectorAll('.tree-header[data-cand-toggle]').forEach(header => {
    const newHeader = header.cloneNode(true);
    header.parentNode.replaceChild(newHeader, header);
    
    newHeader.addEventListener('click', async (e) => {
      const toggleId = newHeader.dataset.candToggle;
      const toggle = newHeader.querySelector('.tree-toggle');
      const children = document.getElementById(toggleId);
      
      if (!children) return;
      
      const isExpanded = candidatesState.expandedNodes.has(toggleId);
      
      if (isExpanded) {
        candidatesState.expandedNodes.delete(toggleId);
        toggle?.classList.remove('expanded');
        children.classList.remove('expanded');
      } else {
        candidatesState.expandedNodes.add(toggleId);
        toggle?.classList.add('expanded');
        children.classList.add('expanded');
        
        // Load children if needed
        if (children.querySelector('.loading')) {
          if (toggleId.startsWith('cand-country-')) {
            const countryId = toggleId.replace('cand-country-', '');
            await renderProvincesForCandidates(countryId, children);
          } else if (toggleId.startsWith('cand-province-')) {
            const provinceId = toggleId.replace('cand-province-', '');
            await renderProvinceDetailsForCandidates(provinceId, children);
          }
        }
      }
      
      // Also handle selection if this header is selectable
      if (newHeader.dataset.candSelectable) {
        handleCandidateLocationSelection(newHeader);
      }
    });
  });
  
  // Selection handlers (for leaf items without toggle)
  document.querySelectorAll('.tree-header[data-cand-selectable]:not([data-cand-toggle])').forEach(header => {
    const newHeader = header.cloneNode(true);
    header.parentNode.replaceChild(newHeader, header);
    
    newHeader.addEventListener('click', () => {
      handleCandidateLocationSelection(newHeader);
    });
  });
}

// Attach category toggle listeners for candidates
function attachCategoryListenersForCandidates() {
  document.querySelectorAll('.category-header[data-cand-category-toggle]').forEach(header => {
    const newHeader = header.cloneNode(true);
    header.parentNode.replaceChild(newHeader, header);
    
    newHeader.addEventListener('click', (e) => {
      e.stopPropagation();
      const categoryId = newHeader.dataset.candCategoryToggle;
      const toggle = newHeader.querySelector('.tree-toggle');
      const children = document.getElementById(categoryId);
      
      if (!children) return;
      
      const isExpanded = candidatesState.expandedNodes.has(categoryId);
      
      if (isExpanded) {
        candidatesState.expandedNodes.delete(categoryId);
        toggle?.classList.remove('expanded');
        children.classList.remove('expanded');
      } else {
        candidatesState.expandedNodes.add(categoryId);
        toggle?.classList.add('expanded');
        children.classList.add('expanded');
      }
    });
  });
}

// Handle location selection for candidates
function handleCandidateLocationSelection(header) {
  // Update visual selection
  document.querySelectorAll('.tree-header').forEach(h => h.classList.remove('active'));
  header.classList.add('active');
  
  // Get location info
  const type = header.dataset.candType;
  const id = header.dataset.candLocationId;
  const name = header.querySelector('.tree-label')?.textContent || 'Unknown';
  
  // Load candidates
  loadCandidatesForLocation(type, id, name);
  
  // Clear candidate detail
  document.getElementById('candidate-detail').innerHTML = `
    <div class="panel-empty">
      <div class="panel-empty-icon">👤</div>
      <div class="panel-empty-text">Select a candidate to view profile</div>
    </div>
  `;
}

// ============================================
// END CANDIDATES BROWSER FUNCTIONS
// ============================================

// Attach tree event listeners
function attachTreeListeners() {
  // Toggle handlers (expand/collapse)
  document.querySelectorAll('.tree-header[data-toggle]').forEach(header => {
    // Remove existing listeners by cloning
    const newHeader = header.cloneNode(true);
    header.parentNode.replaceChild(newHeader, header);
    
    newHeader.addEventListener('click', async (e) => {
      const toggleId = newHeader.dataset.toggle;
      const toggle = newHeader.querySelector('.tree-toggle');
      const children = document.getElementById(toggleId);
      
      if (!children) return;
      
      const isExpanded = browseState.expandedNodes.has(toggleId);
      
      if (isExpanded) {
        browseState.expandedNodes.delete(toggleId);
        toggle?.classList.remove('expanded');
        children.classList.remove('expanded');
      } else {
        browseState.expandedNodes.add(toggleId);
        toggle?.classList.add('expanded');
        children.classList.add('expanded');
        
        // Load children if needed
        if (children.querySelector('.loading')) {
          if (toggleId.startsWith('country-')) {
            const countryId = toggleId.replace('country-', '');
            await renderProvinces(countryId, children);
          } else if (toggleId.startsWith('province-')) {
            const provinceId = toggleId.replace('province-', '');
            await renderProvinceDetails(provinceId, children);
          }
        }
      }
      
      // Also handle selection if this header is selectable
      if (newHeader.dataset.selectable) {
        handleLocationSelection(newHeader);
      }
    });
  });
  
  // Selection handlers (for leaf items without toggle)
  document.querySelectorAll('.tree-header[data-selectable]:not([data-toggle])').forEach(header => {
    const newHeader = header.cloneNode(true);
    header.parentNode.replaceChild(newHeader, header);
    
    newHeader.addEventListener('click', () => {
      handleLocationSelection(newHeader);
    });
  });
}

// Handle location selection
function handleLocationSelection(header) {
  // Update visual selection
  document.querySelectorAll('.tree-header').forEach(h => h.classList.remove('active'));
  header.classList.add('active');
  
  // Get location info
  const type = header.dataset.type;
  const id = header.dataset.locationId;
  const name = header.querySelector('.tree-label')?.textContent || 'Unknown';
  
  // Load ideas
  loadIdeasForLocation(type, id, name);
  
  // Clear idea detail
  document.getElementById('idea-detail').innerHTML = `
    <div class="panel-empty">
      <div class="panel-empty-icon">💡</div>
      <div class="panel-empty-text">Select an idea to view details</div>
    </div>
  `;
}

// Render tags
function renderTags(tags, accent = false) {
  if (!tags || !tags.length) return '';
  return tags.map(tag => `<span class="tag ${accent ? 'accent' : ''}">${tag}</span>`).join('');
}

// Browse page state
let browseState = {
  selectedLocation: null,
  selectedLocationType: null,
  selectedIdea: null,
  expandedNodes: new Set(),
  provinceData: {}
};

// Page loaders
const pages = {
  async browse() {
    const content = document.getElementById('content');
    content.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    
    try {
      // Fetch countries and provinces
      const countries = await api('/locations/countries');
      
      // Build the HTML
      content.innerHTML = `
        <div class="browse-layout">
          <!-- Location Tree Panel -->
          <div class="browse-panel" id="location-panel">
            <div class="browse-panel-header">🌍 Locations</div>
            <div class="location-tree" id="location-tree">
              ${await renderLocationTree(countries)}
            </div>
          </div>
          
          <!-- Ideas List Panel -->
          <div class="browse-panel" id="ideas-panel">
            <div class="browse-panel-header">💡 Ideas</div>
            <div id="selected-location-badge"></div>
            <div class="ideas-list" id="ideas-list">
              <div class="panel-empty">
                <div class="panel-empty-icon">🗺️</div>
                <div class="panel-empty-text">Select a location to view ideas</div>
              </div>
            </div>
          </div>
          
          <!-- Idea Detail Panel -->
          <div class="browse-panel" id="detail-panel">
            <div class="browse-panel-header">📄 Details</div>
            <div id="idea-detail">
              <div class="panel-empty">
                <div class="panel-empty-icon">💡</div>
                <div class="panel-empty-text">Select an idea to view details</div>
              </div>
            </div>
          </div>
        </div>
      `;
      
      // Attach event listeners
      attachTreeListeners();
    } catch (err) {
      content.innerHTML = `<div class="card"><div class="card-body">Error loading browse: ${err.message}</div></div>`;
    }
  },

  async candidates() {
    const content = document.getElementById('content');
    content.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    
    try {
      // Fetch countries
      const countries = await api('/locations/countries');
      
      // Build the HTML - similar to browse but for candidates
      content.innerHTML = `
        <div class="browse-layout">
          <!-- Location Tree Panel -->
          <div class="browse-panel" id="location-panel">
            <div class="browse-panel-header">🌍 Locations</div>
            <div class="location-tree" id="location-tree">
              ${await renderLocationTreeForCandidates(countries)}
            </div>
          </div>
          
          <!-- Candidates List Panel -->
          <div class="browse-panel" id="candidates-panel">
            <div class="browse-panel-header">🎯 Candidates</div>
            <div id="selected-location-badge-candidates"></div>
            <div class="candidates-list" id="candidates-list">
              <div class="panel-empty">
                <div class="panel-empty-icon">🗳️</div>
                <div class="panel-empty-text">Select a location to view candidates</div>
              </div>
            </div>
          </div>
          
          <!-- Candidate Detail Panel -->
          <div class="browse-panel" id="detail-panel">
            <div class="browse-panel-header">📄 Profile</div>
            <div id="candidate-detail">
              <div class="panel-empty">
                <div class="panel-empty-icon">👤</div>
                <div class="panel-empty-text">Select a candidate to view profile</div>
              </div>
            </div>
          </div>
        </div>
      `;
      
      // Attach event listeners
      attachTreeListenersForCandidates();
    } catch (err) {
      content.innerHTML = `<div class="card"><div class="card-body">Error loading candidates: ${err.message}</div></div>`;
    }
  },

  async dashboard() {
    const content = document.getElementById('content');
    content.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    
    try {
      const [users, ideas, events, votes] = await Promise.all([
        api('/users'),
        api('/ideas'),
        api('/events'),
        api('/votes')
      ]);
      
      content.innerHTML = `
        <header class="page-header">
          <h1 class="page-title">Dashboard</h1>
          <p class="page-subtitle">Overview of your community platform</p>
        </header>
        
        <div class="stats-row">
          <div class="stat-card">
            <div class="stat-label">Members</div>
            <div class="stat-value">${users.length}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Ideas</div>
            <div class="stat-value">${ideas.length}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Events</div>
            <div class="stat-value">${events.length}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Votes</div>
            <div class="stat-value">${votes.length}</div>
          </div>
        </div>
        
        <div class="cards-grid">
          <div class="card">
            <div class="card-header">
              <div>
                <h3 class="card-title">Welcome to Speakeasy</h3>
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
        </div>
      `;
    } catch (err) {
      content.innerHTML = `<div class="card"><div class="card-body">Error loading dashboard: ${err.message}</div></div>`;
    }
  },
  
  async users() {
    const content = document.getElementById('content');
    content.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    
    try {
      const users = await api('/users');
      
      content.innerHTML = `
        <header class="page-header">
          <h1 class="page-title">Members</h1>
          <p class="page-subtitle">${users.length} community members</p>
        </header>
        
        <div class="cards-grid">
          ${users.map(user => `
            <div class="card">
              <div class="user-card">
                <div class="avatar">${getInitials(user.name)}</div>
                <div class="user-info">
                  <h3 class="card-title">${user.name}</h3>
                  <p class="card-subtitle">${user.bio || ''}</p>
                  <div class="user-meta">
                    <span>📍 ${user.region}</span>
                  </div>
                </div>
              </div>
              ${user.skills && user.skills.length ? `
                <div class="card-footer">
                  ${renderTags(user.skills)}
                </div>
              ` : ''}
              ${user.interests && user.interests.length ? `
                <div class="card-footer" style="border-top: none; padding-top: 8px;">
                  ${renderTags(user.interests, true)}
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>
      `;
    } catch (err) {
      content.innerHTML = `<div class="card"><div class="card-body">Error loading users: ${err.message}</div></div>`;
    }
  },
  
  async ideas() {
    const content = document.getElementById('content');
    content.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    
    try {
      const ideas = await api('/ideas');
      
      content.innerHTML = `
        <header class="page-header">
          <h1 class="page-title">Ideas</h1>
          <p class="page-subtitle">${ideas.length} community proposals</p>
        </header>
        
        <div class="cards-grid">
          ${ideas.map(idea => `
            <div class="card">
              <div class="card-header">
                <div>
                  <h3 class="card-title">${idea.title}</h3>
                  <p class="card-subtitle">${idea.author ? `by ${idea.author.name}` : 'Anonymous'} • ${idea.region}</p>
                </div>
                <div class="support-count">
                  👍 ${idea.supportCount || 0}
                </div>
              </div>
              <div class="card-body">
                <p>${idea.description}</p>
              </div>
              ${idea.tags && idea.tags.length ? `
                <div class="card-footer">
                  ${renderTags(idea.tags, true)}
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>
      `;
    } catch (err) {
      content.innerHTML = `<div class="card"><div class="card-body">Error loading ideas: ${err.message}</div></div>`;
    }
  },
  
  async events() {
    const content = document.getElementById('content');
    content.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    
    try {
      const events = await api('/events');
      
      content.innerHTML = `
        <header class="page-header">
          <h1 class="page-title">Assembly Events</h1>
          <p class="page-subtitle">${events.length} scheduled events</p>
        </header>
        
        <div class="cards-grid">
          ${events.map(event => `
            <div class="card">
              <div class="card-header">
                <div>
                  <span class="event-type">${event.type || 'event'}</span>
                  <h3 class="card-title">${event.title}</h3>
                </div>
                <div class="badge success">
                  👥 ${event.participantCount || 0}
                </div>
              </div>
              <div class="event-time">
                📅 ${formatDate(event.startTime)} • ${formatTime(event.startTime)} - ${formatTime(event.endTime)}
              </div>
              <div class="card-body">
                <p>${event.description}</p>
              </div>
              <div class="card-footer">
                <span class="tag">📍 ${event.region}</span>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } catch (err) {
      content.innerHTML = `<div class="card"><div class="card-body">Error loading events: ${err.message}</div></div>`;
    }
  },
  
  async votes() {
    const content = document.getElementById('content');
    content.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    
    try {
      const votes = await api('/votes');
      
      content.innerHTML = `
        <header class="page-header">
          <h1 class="page-title">Vote Sessions</h1>
          <p class="page-subtitle">${votes.length} voting sessions</p>
        </header>
        
        <div class="cards-grid">
          ${votes.map(vote => {
            let resultHtml = '';
            if (vote.result && vote.result.resultData) {
              try {
                const data = JSON.parse(vote.result.resultData);
                if (data.yes !== undefined) {
                  resultHtml = `
                    <div class="vote-results">
                      <span class="badge success">✓ Yes: ${data.yes}</span>
                      <span class="badge danger">✗ No: ${data.no}</span>
                      ${data.abstain ? `<span class="badge">⊘ Abstain: ${data.abstain}</span>` : ''}
                    </div>
                  `;
                } else {
                  resultHtml = `<div class="badge">Results recorded</div>`;
                }
              } catch (e) {
                resultHtml = '';
              }
            } else {
              resultHtml = `<div class="badge warning">⏳ Voting in progress</div>`;
            }
            
            return `
              <div class="card">
                <div class="card-header">
                  <div>
                    <span class="event-type" style="background: rgba(0, 212, 170, 0.1); color: var(--accent-primary);">${vote.type || 'vote'}</span>
                    <h3 class="card-title">${vote.question}</h3>
                  </div>
                </div>
                ${vote.event ? `<p class="card-subtitle" style="margin-bottom: 12px;">Part of: ${vote.event.title}</p>` : ''}
                <div class="card-body">
                  ${resultHtml}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    } catch (err) {
      content.innerHTML = `<div class="card"><div class="card-body">Error loading votes: ${err.message}</div></div>`;
    }
  },

  async convention() {
    const content = document.getElementById('content');
    content.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    
    try {
      const conventions = await api('/conventions');
      const activeConv = conventions.find(c => c.status !== 'completed') || conventions[0];
      
      // Get detailed info for active convention
      let activeRaces = [];
      if (activeConv) {
        activeRaces = await api(`/conventions/${activeConv.id}/races`);
      }
      
      // Count stats
      const totalRaces = activeRaces.length;
      const contestedRaces = activeRaces.filter(r => r.candidateCount > 1).length;
      const uncontested = activeRaces.filter(r => r.candidateCount === 1).length;
      const vacant = activeRaces.filter(r => r.candidateCount === 0).length;
      
      // Wave definitions
      const waves = [
        { wave: 1, name: 'Pacific', emoji: '🌊', provinces: 'BC, Yukon' },
        { wave: 2, name: 'Mountain', emoji: '⛰️', provinces: 'Alberta, NWT' },
        { wave: 3, name: 'Prairie', emoji: '🌾', provinces: 'SK, MB, Nunavut' },
        { wave: 4, name: 'Central', emoji: '🏙️', provinces: 'Ontario' },
        { wave: 5, name: 'Quebec', emoji: '⚜️', provinces: 'Quebec' },
        { wave: 6, name: 'Atlantic', emoji: '🦞', provinces: 'NB, NS, PE, NL' }
      ];
      
      // Status badge helper
      const getStatusBadge = (status, currentWave) => {
        if (status === 'nominations') return '<span class="badge warning">📝 Nominations Open</span>';
        if (status === 'completed') return '<span class="badge">✅ Completed</span>';
        if (status === 'upcoming') return '<span class="badge">🗓️ Upcoming</span>';
        // Check if it's a wave status
        const waveNum = currentWave || 0;
        if (waveNum > 0 && waveNum <= 6) {
          return `<span class="badge success">🗳️ Wave ${waveNum} Voting</span>`;
        }
        return `<span class="badge">${status}</span>`;
      };
      
      // Build wave timeline HTML - each wave has nomination + voting
      const buildWaveTimeline = (conv) => {
        const currentWave = conv.currentWave || 1;
        const status = conv.status || '';
        const isCompleted = status === 'completed';
        
        let html = '<div class="wave-timeline">';
        
        // Add each wave with nomination + voting phases
        waves.forEach((w) => {
          const nomStart = conv[`wave${w.wave}NominationStart`];
          const nomEnd = conv[`wave${w.wave}NominationEnd`];
          const voteStart = conv[`wave${w.wave}VotingStart`];
          const voteEnd = conv[`wave${w.wave}VotingEnd`];
          
          const isNominating = status === `wave${w.wave}-nominations`;
          const isVoting = status === `wave${w.wave}-voting`;
          const isActive = isNominating || isVoting;
          const isWaveCompleted = currentWave > w.wave || isCompleted;
          const isFuture = currentWave < w.wave && !isCompleted;
          
          html += `
            <div class="wave-phase ${isActive ? 'active' : isWaveCompleted ? 'completed' : 'future'}" data-wave="${w.wave}">
              <div class="wave-dot" style="background: ${isActive || isWaveCompleted ? `var(--wave-${w.wave}-color, #00d4aa)` : 'var(--border-color)'}"></div>
              <div class="wave-info">
                <div class="wave-name">${w.emoji} Wave ${w.wave}: ${w.name}</div>
                <div class="wave-provinces">${w.provinces}</div>
                <div class="wave-schedule">
                  <div class="wave-phase-row ${isNominating ? 'active-phase' : ''}">
                    <span class="phase-icon">📝</span>
                    <span class="phase-label">Nominations:</span>
                    <span class="phase-dates">${nomStart ? formatDate(nomStart) : ''} - ${nomEnd ? formatDate(nomEnd) : ''}</span>
                  </div>
                  <div class="wave-phase-row ${isVoting ? 'active-phase' : ''}">
                    <span class="phase-icon">🗳️</span>
                    <span class="phase-label">Voting:</span>
                    <span class="phase-dates">${voteStart ? formatDate(voteStart) : ''} - ${voteEnd ? formatDate(voteEnd) : ''}</span>
                  </div>
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
          <!-- Active Convention Card -->
          <div class="card convention-hero">
            <div class="card-header">
              <div>
                <h2 class="card-title">${activeConv.name}</h2>
                <p class="card-subtitle">${activeConv.description || ''}</p>
              </div>
              ${getStatusBadge(activeConv.status, activeConv.currentWave)}
            </div>
            <div class="card-body">
              ${buildWaveTimeline(activeConv)}
            </div>
          </div>
          
          <!-- Convention Stats -->
          <div class="stats-row">
            <div class="stat-card">
              <div class="stat-label">Total Races</div>
              <div class="stat-value">${totalRaces}</div>
            </div>
            <div class="stat-card contested">
              <div class="stat-label">Contested</div>
              <div class="stat-value">${contestedRaces}</div>
            </div>
            <div class="stat-card uncontested">
              <div class="stat-label">Uncontested</div>
              <div class="stat-value">${uncontested}</div>
            </div>
            <div class="stat-card vacant">
              <div class="stat-label">Need Candidates</div>
              <div class="stat-value">${vacant}</div>
            </div>
          </div>
          
          <!-- Nomination Races -->
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">Nomination Races</h3>
              <span class="badge">${activeRaces.length} ridings</span>
            </div>
            <div class="card-body">
              <div class="races-list">
                ${activeRaces.length === 0 ? '<p class="empty-text">No races created yet</p>' : 
                  activeRaces.map(race => `
                    <div class="race-item ${race.candidateCount > 1 ? 'contested' : race.candidateCount === 1 ? 'uncontested' : 'vacant'}" data-race-id="${race.id}">
                      <div class="race-info">
                        <div class="race-riding">${race.riding?.name || 'Unknown Riding'}</div>
                        <div class="race-province">${race.provinceName || ''}</div>
                      </div>
                      <div class="race-candidates">
                        ${race.candidateCount === 0 ? 
                          '<span class="race-status vacant">No candidates</span>' :
                          race.candidateCount === 1 ?
                          `<span class="race-status uncontested">1 candidate (uncontested)</span>` :
                          `<span class="race-status contested">${race.candidateCount} candidates</span>`
                        }
                      </div>
                      <div class="race-candidates-list">
                        ${race.candidates?.map(c => `
                          <span class="candidate-chip">${c.name}</span>
                        `).join('') || ''}
                      </div>
                    </div>
                  `).join('')
                }
              </div>
            </div>
          </div>
        ` : `
          <div class="card">
            <div class="card-body">
              <p>No conventions available yet.</p>
            </div>
          </div>
        `}
        
        <!-- Past Conventions -->
        ${conventions.filter(c => c.status === 'completed').length > 0 ? `
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">Past Conventions</h3>
            </div>
            <div class="card-body">
              ${conventions.filter(c => c.status === 'completed').map(conv => `
                <div class="past-convention-item">
                  <span class="past-convention-name">${conv.name}</span>
                  <span class="past-convention-races">${conv.raceCount || 0} races</span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      `;
      
      // Add click handlers for race items
      document.querySelectorAll('.race-item').forEach(item => {
        item.addEventListener('click', async () => {
          const raceId = item.dataset.raceId;
          await showRaceDetail(raceId);
        });
      });
      
    } catch (err) {
      content.innerHTML = `<div class="card"><div class="card-body">Error loading convention: ${err.message}</div></div>`;
    }
  }
};

// Show race detail modal/view
async function showRaceDetail(raceId) {
  try {
    const race = await api(`/conventions/races/${raceId}`);
    
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2>${race.riding?.name || 'Unknown Riding'}</h2>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <p class="modal-subtitle">${race.province?.name || ''} • ${race.convention?.name || ''}</p>
          
          <h3 class="candidates-header">${race.candidates?.length || 0} Candidates</h3>
          
          ${race.candidates?.length === 0 ? 
            '<p class="empty-text">No candidates have declared for this riding yet.</p>' :
            `<div class="race-candidates-detail">
              ${race.candidates.map((candidate, index) => `
                <div class="race-candidate-card ${index === 0 ? 'leading' : ''}">
                  <div class="candidate-rank">#${index + 1}</div>
                  <div class="candidate-avatar-lg">${getInitials(candidate.name)}</div>
                  <div class="candidate-info-detail">
                    <h4>${candidate.name}</h4>
                    <p class="candidate-bio-short">${candidate.bio || 'No bio'}</p>
                    <div class="candidate-stats-row">
                      <span class="stat-pill points">⭐ ${candidate.points || 0} points</span>
                      <span class="stat-pill endorsements">👍 ${candidate.endorsementCount || 0} endorsements</span>
                    </div>
                    ${candidate.platform ? `
                      <div class="candidate-platform-preview">
                        <strong>Platform:</strong> ${candidate.platform}
                      </div>
                    ` : ''}
                  </div>
                </div>
              `).join('')}
            </div>`
          }
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Close handlers
    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
    
  } catch (err) {
    console.error('Error loading race:', err);
  }
}

// Router
function navigate(page) {
  // Update active nav link
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active');
    if (link.dataset.page === page) {
      link.classList.add('active');
    }
  });
  
  // Load page
  if (pages[page]) {
    pages[page]();
    history.pushState({ page }, '', `#${page}`);
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Set up navigation
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(link.dataset.page);
    });
  });
  
  // Handle browser back/forward
  window.addEventListener('popstate', (e) => {
    const page = e.state?.page || 'dashboard';
    navigate(page);
  });
  
  // Load initial page from hash or default to dashboard
  const initialPage = window.location.hash.slice(1) || 'dashboard';
  navigate(initialPage);
});

