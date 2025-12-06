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
                        <div><h3 class="card-title">Welcome to Political Party</h3><p class="card-subtitle">Community engagement platform</p></div>
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
        content.innerHTML = `<div class="card"><div class="card-body">Error: ${err.message}</div></div>`;
    }
};

// ============================================
// BROWSE IDEAS
// ============================================

App.pages.browse = async function() {
    const content = document.getElementById('content');
    content.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    
    try {
        const countries = await App.api('/locations/countries');
        
        content.innerHTML = `
            <div class="browse-layout">
                <div class="browse-panel" id="location-panel">
                    <div class="browse-panel-header">🌍 Locations</div>
                    <div class="location-tree" id="location-tree">${await App.renderLocationTree(countries)}</div>
                </div>
                <div class="browse-panel" id="ideas-panel">
                    <div class="browse-panel-header">💡 Ideas</div>
                    <div id="selected-location-badge"></div>
                    <div class="ideas-list" id="ideas-list">
                        <div class="panel-empty"><div class="panel-empty-icon">🗺️</div><div class="panel-empty-text">Select a location to view ideas</div></div>
                    </div>
                </div>
                <div class="browse-panel" id="detail-panel">
                    <div class="browse-panel-header">📄 Details</div>
                    <div id="idea-detail">
                        <div class="panel-empty"><div class="panel-empty-icon">💡</div><div class="panel-empty-text">Select an idea to view details</div></div>
                    </div>
                </div>
            </div>
        `;
        
        App.attachTreeListeners();
    } catch (err) {
        content.innerHTML = `<div class="card"><div class="card-body">Error: ${err.message}</div></div>`;
    }
};

// ============================================
// CANDIDATES
// ============================================

App.pages.candidates = async function() {
    const content = document.getElementById('content');
    content.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    
    try {
        const countries = await App.api('/locations/countries');
        
        content.innerHTML = `
            <div class="browse-layout">
                <div class="browse-panel" id="location-panel">
                    <div class="browse-panel-header">🌍 Locations</div>
                    <div class="location-tree" id="location-tree">${await App.renderLocationTreeForCandidates(countries)}</div>
                </div>
                <div class="browse-panel" id="candidates-panel">
                    <div class="browse-panel-header">🎯 Candidates</div>
                    <div id="selected-location-badge-candidates"></div>
                    <div class="candidates-list" id="candidates-list">
                        <div class="panel-empty"><div class="panel-empty-icon">🗳️</div><div class="panel-empty-text">Select a location to view candidates</div></div>
                    </div>
                </div>
                <div class="browse-panel" id="detail-panel">
                    <div class="browse-panel-header">📄 Profile</div>
                    <div id="candidate-detail">
                        <div class="panel-empty"><div class="panel-empty-icon">👤</div><div class="panel-empty-text">Select a candidate to view profile</div></div>
                    </div>
                </div>
            </div>
        `;
        
        App.attachTreeListenersForCandidates();
    } catch (err) {
        content.innerHTML = `<div class="card"><div class="card-body">Error: ${err.message}</div></div>`;
    }
};

// ============================================
// MEMBERS (Users)
// ============================================

App.pages.users = async function() {
    const content = document.getElementById('content');
    content.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    
    try {
        const users = await App.api('/users');
        
        content.innerHTML = `
            <header class="page-header">
                <h1 class="page-title">Members</h1>
                <p class="page-subtitle">${users.length} community members - Click to view & nominate</p>
            </header>
            
            <div class="cards-grid">
                ${users.map(user => `
                    <div class="card member-card" data-user-id="${user.id}" style="cursor: pointer;">
                        <div class="user-card">
                            <div class="avatar">${App.getInitials(user.name)}</div>
                            <div class="user-info">
                                <h3 class="card-title">${user.name}</h3>
                                <p class="card-subtitle">${user.bio || ''}</p>
                                <div class="user-meta">
                                    <span>${user.location?.name || user.region || 'No location'}</span>
                                    ${user.candidate ? '<span class="badge-small">Candidate</span>' : ''}
                                </div>
                            </div>
                        </div>
                        ${user.skills?.length ? `<div class="card-footer">${App.renderTags(user.skills)}</div>` : ''}
                    </div>
                `).join('')}
            </div>
        `;
        
        document.querySelectorAll('.member-card').forEach(card => {
            card.addEventListener('click', () => App.showMemberDetail(card.dataset.userId));
        });
    } catch (err) {
        content.innerHTML = `<div class="card"><div class="card-body">Error: ${err.message}</div></div>`;
    }
};

// ============================================
// IDEAS
// ============================================

App.pages.ideas = async function() {
    const content = document.getElementById('content');
    content.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    
    try {
        const ideas = await App.api('/ideas');
        
        content.innerHTML = `
            <header class="page-header">
                <div class="page-header-row">
                    <div>
                        <h1 class="page-title">Ideas</h1>
                        <p class="page-subtitle">${ideas.length} community proposals</p>
                    </div>
                    ${App.currentUser ? `<button class="btn btn-primary" id="add-idea-btn">+ New Idea</button>` : ''}
                </div>
            </header>
            
            <!-- Add Idea Form (hidden by default) -->
            <div id="add-idea-form" class="card" style="display: none; margin-bottom: 20px;">
                <div class="card-header"><h3 class="card-title">Submit New Idea</h3></div>
                <div class="card-body">
                    <div class="form-group">
                        <label>Title</label>
                        <input type="text" id="idea-title" class="form-input" placeholder="Your idea title...">
                    </div>
                    <div class="form-group">
                        <label>Description</label>
                        <textarea id="idea-description" class="form-textarea" rows="4" placeholder="Describe your idea..."></textarea>
                    </div>
                    <div class="form-group">
                        <label>Tags (comma separated)</label>
                        <input type="text" id="idea-tags" class="form-input" placeholder="policy, environment, education">
                    </div>
                    <div class="form-actions">
                        <button class="btn btn-primary" id="submit-idea-btn">Submit Idea</button>
                        <button class="btn btn-secondary" id="cancel-idea-btn">Cancel</button>
                    </div>
                    <div id="idea-feedback" class="form-feedback"></div>
                </div>
            </div>
            
            <div class="cards-grid">
                ${ideas.map(idea => `
                    <div class="card">
                        <div class="card-header">
                            <div><h3 class="card-title">${idea.title}</h3><p class="card-subtitle">${idea.author ? `by ${idea.author.name}` : 'Anonymous'} • ${idea.region}</p></div>
                            <div class="support-count">👍 ${idea.supportCount || 0}</div>
                        </div>
                        <div class="card-body"><p>${idea.description}</p></div>
                        ${idea.tags?.length ? `<div class="card-footer">${App.renderTags(idea.tags, true)}</div>` : ''}
                    </div>
                `).join('')}
            </div>
        `;
        
        // Add idea form handlers
        const addBtn = document.getElementById('add-idea-btn');
        const form = document.getElementById('add-idea-form');
        const cancelBtn = document.getElementById('cancel-idea-btn');
        const submitBtn = document.getElementById('submit-idea-btn');
        const feedback = document.getElementById('idea-feedback');
        
        addBtn?.addEventListener('click', () => {
            form.style.display = 'block';
            addBtn.style.display = 'none';
        });
        
        cancelBtn?.addEventListener('click', () => {
            form.style.display = 'none';
            addBtn.style.display = 'block';
        });
        
        submitBtn?.addEventListener('click', async () => {
            const title = document.getElementById('idea-title').value.trim();
            const description = document.getElementById('idea-description').value.trim();
            const tagsStr = document.getElementById('idea-tags').value.trim();
            
            if (!title || !description) {
                feedback.innerHTML = '<span class="error">Title and description are required</span>';
                return;
            }
            
            submitBtn.disabled = true;
            submitBtn.textContent = 'Submitting...';
            
            try {
                const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(t => t) : [];
                const response = await fetch('/api/ideas', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: 'idea-' + Date.now(),
                        title,
                        description,
                        tags,
                        authorId: App.currentUser.id,
                        region: App.currentUser.region || 'Unknown'
                    })
                });
                
                if (response.ok) {
                    feedback.innerHTML = '<span class="success">Idea submitted!</span>';
                    setTimeout(() => App.pages.ideas(), 1000);
                } else {
                    const data = await response.json();
                    feedback.innerHTML = `<span class="error">${data.error || 'Failed to submit'}</span>`;
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Submit Idea';
                }
            } catch (err) {
                feedback.innerHTML = `<span class="error">${err.message}</span>`;
                submitBtn.disabled = false;
                submitBtn.textContent = 'Submit Idea';
            }
        });
    } catch (err) {
        content.innerHTML = `<div class="card"><div class="card-body">Error: ${err.message}</div></div>`;
    }
};

// ============================================
// EVENTS
// ============================================

App.pages.events = async function() {
    const content = document.getElementById('content');
    content.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    
    try {
        const events = await App.api('/events');
        
        content.innerHTML = `
            <header class="page-header">
                <h1 class="page-title">Assembly Events</h1>
                <p class="page-subtitle">${events.length} scheduled events</p>
            </header>
            
            <div class="cards-grid">
                ${events.map(event => `
                    <div class="card">
                        <div class="card-header">
                            <div><span class="event-type">${event.type || 'event'}</span><h3 class="card-title">${event.title}</h3></div>
                            <div class="badge success">👥 ${event.participantCount || 0}</div>
                        </div>
                        <div class="event-time">📅 ${App.formatDate(event.startTime)} • ${App.formatTime(event.startTime)} - ${App.formatTime(event.endTime)}</div>
                        <div class="card-body"><p>${event.description}</p></div>
                        <div class="card-footer"><span class="tag">📍 ${event.region}</span></div>
                    </div>
                `).join('')}
            </div>
        `;
    } catch (err) {
        content.innerHTML = `<div class="card"><div class="card-body">Error: ${err.message}</div></div>`;
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
                <h1 class="page-title">Vote Sessions</h1>
                <p class="page-subtitle">${votes.length} voting sessions</p>
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

