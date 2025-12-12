/**
 * Extended Pages
 * Profile, Convention, Admin pages and Modals
 */

window.App = window.App || {};

// ============================================
// AUTH UI (Sign-in / Sign-up)
// ============================================

App.updateAuthUi = function() {
    const container = document.getElementById('auth-status');
    if (!container) return;

    // Toggle Admin nav link visibility based on auth role
    const adminLink = document.getElementById('nav-admin-link') || document.querySelector('[data-page="admin"]');
    if (adminLink) {
        if (App.authUser && App.authUser.role === 'admin') {
            adminLink.style.display = '';
        } else {
            adminLink.style.display = 'none';
        }
    }

    if (App.authUser) {
        const verifiedText = App.authUser.verified ? '✅ Verified' : '✉️ Not verified';
        container.innerHTML = `
            <div class="auth-summary">
                <div class="auth-summary-main">
                    <span class="auth-summary-label">Signed in as</span>
                    <span class="auth-summary-email">${App.authUser.email}</span>
                </div>
                <div class="auth-summary-meta">
                    <span class="auth-summary-status">${verifiedText}</span>
                    <button class="btn btn-secondary btn-sm" id="auth-logout-btn">Sign out</button>
                </div>
            </div>
        `;

        const logoutBtn = document.getElementById('auth-logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                try {
                    await App.apiPost('/auth/logout', {});
                } catch (e) {
                    // ignore errors, we'll still clear local state
                }
                App.setAuthUser(null);
                // Reload to ensure state is consistent (user list, pages, etc.)
                window.location.reload();
            });
        }
    } else {
        container.innerHTML = `
            <button class="btn btn-secondary btn-sm" id="auth-open-modal-btn">
                Sign in / Sign up
            </button>
        `;
        const openBtn = document.getElementById('auth-open-modal-btn');
        if (openBtn) {
            openBtn.addEventListener('click', () => App.showAuthModal('login'));
        }
    }
};

// ============================================
// NOTIFICATIONS UI
// ============================================

App.notifications = [];

App.refreshNotifications = async function() {
    const countEl = document.getElementById('notifications-count');
    const listEl = document.getElementById('notifications-list');
    const panelEl = document.getElementById('notifications-panel');

    if (!countEl || !listEl || !panelEl) return;

    // If not signed in, clear UI
    if (!App.authUser) {
        App.notifications = [];
        countEl.style.display = 'none';
        listEl.innerHTML = '<div class="empty-text">Sign in to see notifications.</div>';
        panelEl.classList.add('hidden');
        return;
    }

    try {
        const items = await App.api('/notifications?unreadOnly=false&limit=50');
        App.notifications = items;
        App.renderNotifications();
    } catch (err) {
        console.error('Failed to load notifications', err);
    }
};

App.renderNotifications = function() {
    const countEl = document.getElementById('notifications-count');
    const listEl = document.getElementById('notifications-list');
    if (!countEl || !listEl) return;

    const unreadCount = App.notifications.filter((n) => !n.read).length;
    if (unreadCount > 0) {
        countEl.style.display = 'inline-block';
        countEl.textContent = unreadCount > 9 ? '9+' : String(unreadCount);
    } else {
        countEl.style.display = 'none';
    }

    if (!App.notifications.length) {
        listEl.innerHTML = '<div class="empty-text">No notifications yet.</div>';
        return;
    }

    listEl.innerHTML = App.notifications
        .map((n) => {
            const createdAt = n.createdAt || n.createdAtISO || n.createdAtUtc;
            return `
                <div class="notification-item ${n.read ? '' : 'unread'}">
                    <div class="notification-title">${n.title || n.type || 'Notification'}</div>
                    ${n.body ? `<div class="notification-body">${n.body}</div>` : ''}
                    ${createdAt ? `<div class="notification-meta">${App.formatDate(createdAt)} ${App.formatTime(createdAt)}</div>` : ''}
                </div>
            `;
        })
        .join('');
};

App.initNotificationsUi = function() {
    const toggleBtn = document.getElementById('notifications-toggle');
    const panelEl = document.getElementById('notifications-panel');
    const markAllBtn = document.getElementById('notifications-mark-all');

    if (!toggleBtn || !panelEl) return;

    toggleBtn.addEventListener('click', async () => {
        if (!App.authUser) {
            if (typeof App.showAuthModal === 'function') {
                App.showAuthModal('login');
            }
            return;
        }
        panelEl.classList.toggle('hidden');
        if (!panelEl.classList.contains('hidden')) {
            await App.refreshNotifications();
        }
    });

    if (markAllBtn) {
        markAllBtn.addEventListener('click', async () => {
            if (!App.authUser) return;
            try {
                await App.apiPostNoBody('/notifications/mark-all-read');
                // Optimistically mark all as read
                App.notifications = App.notifications.map((n) => ({ ...n, read: true }));
                App.renderNotifications();
            } catch (err) {
                console.error('Failed to mark notifications read', err);
            }
        });
    }
};

App.showAuthModal = function(initialTab = 'login') {
    const existing = document.querySelector('.modal-overlay.auth-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.className = 'modal-overlay auth-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>Account</h2>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="auth-tabs">
                    <button class="auth-tab ${initialTab === 'login' ? 'active' : ''}" data-tab="login">Sign in</button>
                    <button class="auth-tab ${initialTab === 'signup' ? 'active' : ''}" data-tab="signup">Create account</button>
                </div>
                <div class="auth-tab-content ${initialTab === 'login' ? 'active' : ''}" id="auth-tab-login">
                    <form id="auth-login-form" class="auth-form">
                        <label>
                            <span>Email</span>
                            <input type="email" name="email" required autocomplete="email">
                        </label>
                        <label>
                            <span>Password</span>
                            <input type="password" name="password" required autocomplete="current-password">
                        </label>
                        <p class="auth-help">
                            Use the email and password you signed up with. We do not use Google or other third-party sign-in.
                        </p>
                        <p class="auth-help">
                            <button type="button" class="link-button" id="auth-forgot-password-btn">Forgot your password?</button>
                        </p>
                        <button type="submit" class="btn btn-primary auth-submit-btn">Sign in</button>
                        <div class="auth-feedback" id="auth-login-feedback"></div>
                    </form>
                </div>
                <div class="auth-tab-content ${initialTab === 'signup' ? 'active' : ''}" id="auth-tab-signup">
                    <form id="auth-signup-form" class="auth-form">
                        <label>
                            <span>Email</span>
                            <input type="email" name="email" required autocomplete="email">
                        </label>
                        <label>
                            <span>Password</span>
                            <input type="password" name="password" required minlength="8" autocomplete="new-password">
                        </label>
                        <label>
                            <span>Display name</span>
                            <input type="text" name="name" placeholder="Optional – how you appear to other members">
                        </label>
                        <p class="auth-help">
                            To keep bots out, sign-up may require solving a CAPTCHA and confirming your email address.
                        </p>
                        <button type="submit" class="btn btn-primary auth-submit-btn">Create account</button>
                        <div class="auth-feedback" id="auth-signup-feedback"></div>
                    </form>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector('.modal-close').addEventListener('click', close);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) close();
    });

    // Tab switching
    modal.querySelectorAll('.auth-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            modal.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
            modal.querySelectorAll('.auth-tab-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            const content = modal.querySelector(`#auth-tab-${tabName}`);
            if (content) content.classList.add('active');
        });
    });

    // Login submit
    const loginForm = modal.querySelector('#auth-login-form');
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const feedback = modal.querySelector('#auth-login-feedback');
        const submitBtn = loginForm.querySelector('.auth-submit-btn');
        feedback.textContent = '';
        submitBtn.disabled = true;
        submitBtn.textContent = 'Signing in...';

        const formData = new FormData(loginForm);
        const email = formData.get('email');
        const password = formData.get('password');

        try {
            const { response, data } = await App.apiPost('/auth/login', { email, password });
            if (!response.ok || !data.success) {
                feedback.textContent = data.error || 'Unable to sign in.';
                feedback.classList.add('error');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Sign in';
                return;
            }

            App.setAuthUser(data.user);
            // Reload to ensure full app picks up authenticated state and user list
            window.location.reload();
        } catch (err) {
            feedback.textContent = err.message;
            feedback.classList.add('error');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Sign in';
        }
    });

    // Forgot password
    const forgotBtn = modal.querySelector('#auth-forgot-password-btn');
    if (forgotBtn) {
        forgotBtn.addEventListener('click', async () => {
            const loginFeedback = modal.querySelector('#auth-login-feedback');
            loginFeedback.textContent = '';
            loginFeedback.classList.remove('error');

            const emailInput = loginForm.querySelector('input[name="email"]');
            const email = emailInput ? String(emailInput.value).trim() : '';

            if (!email) {
                loginFeedback.textContent = 'Enter your email above first, then click "Forgot your password?".';
                loginFeedback.classList.add('error');
                return;
            }

            try {
                const { response, data } = await App.apiPost('/auth/request-password-reset', { email });
                if (!response.ok) {
                    loginFeedback.textContent = (data && data.error) || 'Unable to start password reset.';
                    loginFeedback.classList.add('error');
                    return;
                }

                loginFeedback.textContent = data.message || 'If that email is registered, a reset link has been sent.';
                loginFeedback.classList.remove('error');
            } catch (err) {
                loginFeedback.textContent = err.message;
                loginFeedback.classList.add('error');
            }
        });
    }

    // Signup submit
    const signupForm = modal.querySelector('#auth-signup-form');
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const feedback = modal.querySelector('#auth-signup-feedback');
        const submitBtn = signupForm.querySelector('.auth-submit-btn');
        feedback.textContent = '';
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating account...';

        const formData = new FormData(signupForm);
        const email = formData.get('email');
        const password = formData.get('password');
        const name = formData.get('name') || undefined;

        // If an hCaptcha widget is present, use its response token
        let captchaToken = '';
        if (window.hcaptcha && typeof window.hcaptcha.getResponse === 'function') {
            captchaToken = window.hcaptcha.getResponse() || '';
        }

        try {
            const { response, data } = await App.apiPost('/auth/signup', {
                email,
                password,
                name,
                captchaToken
            });

            if (!response.ok || !data.success) {
                feedback.textContent = data.error || 'Unable to create account.';
                feedback.classList.add('error');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Create account';
                return;
            }

            feedback.textContent = data.message || 'Account created. Please check your email to verify your address.';
            feedback.classList.remove('error');
            feedback.classList.add('success');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Check your email';
        } catch (err) {
            feedback.textContent = err.message;
            feedback.classList.add('error');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Create account';
        }
    });
};

// ============================================
// IDEAS: POST NEW IDEA MODAL
// ============================================

App.showPostIdeaModal = function() {
    // Require a selected location first
    if (!App.browseState || !App.browseState.selectedLocation || !App.browseState.selectedLocationType) {
        alert('Please select a location in the Locations panel first.');
        return;
    }

    // Require a "playing as" user so the idea has an author
    if (!App.currentUser) {
        alert('Please select a user in the "Playing as" dropdown first, then try again.');
        return;
    }

    const locName = App.browseState.selectedLocationName || 'this location';

    const existing = document.querySelector('.modal-overlay.post-idea-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.className = 'modal-overlay post-idea-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>Post a new idea</h2>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <p class="auth-help" style="margin-bottom: 12px;">
                    Posting as <strong>${App.currentUser.name}</strong> in <strong>${locName}</strong>.
                </p>
                <form id="post-idea-form" class="auth-form">
                    <label>
                        <span>Title</span>
                        <input type="text" name="title" required maxlength="140" placeholder="Short, clear idea title">
                    </label>
                    <label>
                        <span>Description</span>
                        <textarea name="description" rows="4" required placeholder="Describe your idea and why it matters"></textarea>
                    </label>
                    <label>
                        <span>Tags (optional, comma-separated)</span>
                        <input type="text" name="tags" placeholder="e.g. healthcare, transit, environment">
                    </label>
                    <button type="submit" class="btn btn-primary auth-submit-btn">Post Idea</button>
                    <div class="auth-feedback" id="post-idea-feedback"></div>
                </form>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector('.modal-close').addEventListener('click', close);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) close();
    });

    const form = modal.querySelector('#post-idea-form');
    const feedback = modal.querySelector('#post-idea-feedback');
    const submitBtn = form.querySelector('.auth-submit-btn');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        feedback.textContent = '';
        feedback.classList.remove('error', 'success');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Posting...';

        const formData = new FormData(form);
        const title = (formData.get('title') || '').toString().trim();
        const description = (formData.get('description') || '').toString().trim();
        const tagsRaw = (formData.get('tags') || '').toString().trim();

        if (!title || !description) {
            feedback.textContent = 'Please provide both a title and description.';
            feedback.classList.add('error');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Post Idea';
            return;
        }

        const tags = tagsRaw
            ? tagsRaw
                  .split(',')
                  .map((t) => t.trim())
                  .filter((t) => t.length > 0)
            : [];

        // Generate a simple unique ID for the idea
        const id = `idea-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;

        const payload = {
            id,
            title,
            description,
            tags,
            region: locName,
            authorId: App.currentUser.id
        };

        try {
            const { response, data } = await App.apiPost('/ideas', payload);
            if (!response.ok) {
                feedback.textContent = data.error || 'Unable to post idea.';
                feedback.classList.add('error');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Post Idea';
                return;
            }

            feedback.textContent = 'Idea posted!';
            feedback.classList.remove('error');
            feedback.classList.add('success');

            // Refresh the ideas list for the current location
            const type = App.browseState.selectedLocationType;
            const idLoc = App.browseState.selectedLocation;
            const nameLoc = App.browseState.selectedLocationName || locName;
            if (typeof App.onIdeasLocationSelect === 'function' && type && idLoc) {
                await App.onIdeasLocationSelect(type, idLoc, nameLoc, true);
            }

            setTimeout(() => {
                close();
            }, 800);
        } catch (err) {
            feedback.textContent = err.message || 'Unexpected error while posting idea.';
            feedback.classList.add('error');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Post Idea';
        }
    });
};

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
        const [userDetails, conventions, provinces, badges] = await Promise.all([
            App.api(`/users/${App.currentUser.id}`),
            App.api('/conventions'),
            App.api('/locations/provinces'),
            App.api(`/users/${App.currentUser.id}/badges`)
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

                    <div class="badge-shelf">
                        <div class="badge-shelf-title">Badges</div>
                        ${
                            badges && badges.length
                                ? `
                            <div class="badge-row">
                                ${badges
                                    .map((b) => {
                                        const scopeLabel = b.scope === 'local' ? 'Local' : 'Global';
                                        const levelLabel = b.level ? b.level.charAt(0).toUpperCase() + b.level.slice(1) : '';
                                        return `
                                            <span class="badge-chip ${b.scope}">
                                                <span class="badge-chip-level">${levelLabel}</span>
                                                <span class="badge-chip-scope">${scopeLabel}</span>
                                            </span>
                                        `;
                                    })
                                    .join('')}
                            </div>
                        `
                                : '<p class="empty-text">Earn badges by collecting local and global support for your ideas.</p>'
                        }
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
            
            <!-- Candidacy Section -->
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
            ` : activeConv && userDetails.locations?.length > 0 ? `
                <div class="card">
                    <div class="card-header"><h3 class="card-title">🗳️ Run for Office</h3></div>
                    <div class="card-body">
                        <p>Want to run in ${activeConv.name}? Anyone can declare candidacy - you don't need nominations to run!</p>
                        <p class="nominations-info" style="margin: 12px 0;">
                            You have <strong>${nominations[0]?.nominationCount || 0}</strong> lifetime nomination(s) supporting you.
                        </p>
                        <div id="candidacy-location-container" style="margin: 12px 0;"></div>
                        <button class="btn btn-primary" onclick="App.declareCandidacy('${activeConv.id}')">🏃 Declare Candidacy</button>
                    </div>
                </div>
            ` : activeConv ? `
                <div class="card">
                    <div class="card-header"><h3 class="card-title">🗳️ Run for Office</h3></div>
                    <div class="card-body">
                        <p class="empty-text">Set your location above to run for office in your riding.</p>
                    </div>
                </div>
            ` : ''}
            
            <!-- Nominations Section (Informational) -->
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">📬 My Nominations</h3>
                    ${nominations[0]?.nominationCount > 0 ? `<span class="badge success">${nominations[0].nominationCount} supporters</span>` : ''}
                </div>
                <div class="card-body">
                    ${nominations[0]?.nominationCount === 0 || !nominations[0]?.nominations?.length ? `
                        <p class="empty-text">No one has nominated you yet. Nominations are a way for members to show their support - you don't need them to run!</p>
                    ` : `
                        <p class="nominations-help">These members have nominated you. Nominations are permanent and show voter support.</p>
                        <div class="nominations-list">
                            ${nominations[0].nominations.map(nom => `
                                <div class="nomination-item">
                                    <span class="nominator-name">👍 ${nom.nominatorName}</span>
                                    ${nom.message ? `<span class="nominator-message">"${nom.message}"</span>` : ''}
                                    <span class="nomination-date">${nom.createdAt ? new Date(nom.createdAt).toLocaleDateString() : ''}</span>
                                </div>
                            `).join('')}
                        </div>
                    `}
                </div>
            </div>
        `;
        
        // Wire Create Referendum form in Admin card (reuses shared helper)
        if (typeof App.wireCreateReferendumForm === 'function') {
            App.wireCreateReferendumForm({
                formId: 'create-ref-form-admin',
                feedbackId: 'create-ref-feedback-admin',
                buttonClass: 'admin-btn primary'
            });
        }
        
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

        // Populate "Run for Office" location selector (federal/provincial/town/First Nation)
        const candidacyLocContainer = document.getElementById('candidacy-location-container');
        if (candidacyLocContainer) {
            const allLocations = userDetails.locations || [];
            const allowedTypes = ['FederalRiding', 'ProvincialRiding', 'Town', 'FirstNation'];
            const typeLabels = {
                FederalRiding: 'Federal Riding',
                ProvincialRiding: 'Provincial Riding',
                Town: 'Town',
                FirstNation: 'First Nation'
            };
            const candidateLocations = allLocations.filter((loc) => allowedTypes.includes(loc.type));

            if (!candidateLocations.length) {
                candidacyLocContainer.innerHTML =
                    '<p class="empty-text">Set a federal riding, provincial riding, town or First Nation above to choose where to run.</p>';
            } else {
                const optionsHtml = candidateLocations
                    .map(
                        (loc) =>
                            `<option value="${loc.id}" data-type="${loc.type}">${typeLabels[loc.type] || loc.type}: ${
                                loc.name
                            }</option>`
                    )
                    .join('');

                candidacyLocContainer.innerHTML = `
                    <label class="form-label">
                        <span>Where do you want to run?</span>
                        <select id="candidacy-location-select" class="form-control">
                            <option value="">-- Choose riding / community --</option>
                            ${optionsHtml}
                        </select>
                    </label>
                `;

                // If there is exactly one option, pre-select it
                if (candidateLocations.length === 1) {
                    const sel = candidacyLocContainer.querySelector('#candidacy-location-select');
                    if (sel) {
                        sel.value = candidateLocations[0].id;
                    }
                }
            }
        }
        
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
                <p class="page-subtitle">${activeConv ? activeConv.name : 'West to East regional voting waves'}</p>
            </header>
            
            ${activeConv ? `
                <!-- Tab Navigation -->
                <div class="convention-tabs">
                    <button class="convention-tab active" data-tab="progress" onclick="App.switchConventionTab('progress')">
                        📊 Convention Progress
                    </button>
                    <button class="convention-tab" data-tab="races" onclick="App.switchConventionTab('races')">
                        🏁 Active Races <span class="tab-badge">${activeRaces.length}</span>
                    </button>
                </div>
                
                <!-- Convention Progress Tab -->
                <div id="convention-tab-progress" class="convention-tab-content active">
                    <div class="card convention-hero">
                        <div class="card-header">
                            <div><h2 class="card-title">${activeConv.name}</h2><p class="card-subtitle">${activeConv.description || 'West to East regional voting waves'}</p></div>
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
                </div>
                
                <!-- Active Races Tab -->
                <div id="convention-tab-races" class="convention-tab-content" style="display: none;">
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
                                    ${activeRaces.length === 0 ? '<p class="empty-text">No races created yet. Races are created automatically when a wave begins.</p>' : 
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
                </div>
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

// Tab switching for Convention page
App.switchConventionTab = function(tabName) {
    // Update tab buttons
    document.querySelectorAll('.convention-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });
    
    // Update tab content
    document.querySelectorAll('.convention-tab-content').forEach(content => {
        content.style.display = content.id === `convention-tab-${tabName}` ? 'block' : 'none';
        content.classList.toggle('active', content.id === `convention-tab-${tabName}`);
    });
};

// ============================================
// SHARED HELPERS
// ============================================

/**
 * Wire up a Create Referendum form so it can POST to /referendums.
 * Options allow re-use on the Referendums page and Admin page.
 */
App.wireCreateReferendumForm = function(options = {}) {
    const {
        formId = 'create-ref-form',
        feedbackId = 'create-ref-feedback'
    } = options;

    const existing = document.getElementById(formId);
    if (!existing) return;

    // Clone to avoid stacking multiple listeners if this is called more than once.
    const form = existing.cloneNode(true);
    existing.parentNode.replaceChild(form, existing);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!App.requireVerifiedAuth || !App.requireVerifiedAuth()) {
            return;
        }

        const feedback = document.getElementById(feedbackId);
        if (feedback) {
            feedback.textContent = '';
            feedback.classList.remove('error', 'success');
        }

        const formData = new FormData(form);
        const title = (formData.get('title') || '').toString().trim();
        const body = (formData.get('body') || '').toString().trim();
        const scope = (formData.get('scope') || 'national').toString();

        if (!title || !body) {
            if (feedback) {
                feedback.textContent = 'Title and description are required.';
                feedback.classList.add('error');
            }
            return;
        }

        try {
            const { response, data } = await App.apiPost('/referendums', {
                title,
                body,
                scope
            });
            if (!response.ok) {
                if (feedback) {
                    feedback.textContent = (data && data.error) || 'Could not create referendum.';
                    feedback.classList.add('error');
                }
                return;
            }

            form.reset();
            if (feedback) {
                feedback.textContent = 'Referendum created.';
                feedback.classList.remove('error');
                feedback.classList.add('success');
            }
        } catch (err) {
            if (feedback) {
                feedback.textContent = err.message || 'Unexpected error creating referendum.';
                feedback.classList.add('error');
            }
        }
    });
};

// ============================================
// REFERENDUMS PAGE
// ============================================

App.pages.referendums = async function() {
    const content = document.getElementById('content');
    content.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    try {
        const referendums = await App.api('/referendums');
        const hasAny = referendums.length > 0;

        content.innerHTML = `
            <header class="page-header">
                <h1 class="page-title">📑 Referendums</h1>
                <p class="page-subtitle">Ask big questions, explore perspectives, and add your voice.</p>
            </header>
            
            <div class="card">
                <div class="card-header"><h3 class="card-title">Create a Referendum</h3></div>
                <div class="card-body">
                    <p class="card-subtitle" style="margin-bottom: 8px;">
                        Any signed-in member can propose a new question. Email verification may be required to post.
                    </p>
                    <form id="create-ref-form">
                        <div class="form-group">
                            <label>Title</label>
                            <input type="text" name="title" class="form-input" placeholder="Should we adopt ranked-choice voting for party leadership?" required>
                        </div>
                        <div class="form-group">
                            <label>Description</label>
                            <textarea name="body" class="form-input" rows="3" placeholder="Explain what this referendum is about..." required></textarea>
                        </div>
                        <div class="form-group">
                            <label>Scope</label>
                            <select name="scope" class="form-select">
                                <option value="national">National (all members)</option>
                                <option value="province">Province-wide</option>
                                <option value="riding">Riding-level</option>
                            </select>
                        </div>
                        <button type="submit" class="btn btn-primary">Create Referendum</button>
                        <div id="create-ref-feedback" class="form-feedback"></div>
                    </form>
                </div>
            </div>
            
            ${hasAny ? `
            <div class="cards-grid">
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">All Questions</h3>
                    </div>
                    <div class="card-body">
                        <div id="referendum-list">
                            ${referendums
                                .map(
                                    (q) => `
                                <div class="list-item" data-ref-id="${q.id}">
                                    <div class="list-item-title">${q.title}</div>
                                    <div class="list-item-meta">
                                        <span>${q.locationName || q.scope || 'All members'}</span>
                                        <span class="list-item-stat">${q.argumentCount || 0} perspectives</span>
                                    </div>
                                </div>
                            `
                                )
                                .join('')}
                        </div>
                    </div>
                </div>
                
                <div class="card" id="referendum-detail-card" style="grid-column: span 2;">
                    <div class="card-body" id="referendum-detail-body">
                        <!-- Filled by App.loadReferendumDetail -->
                    </div>
                </div>
            </div>
            ` : `
            <div class="card" style="margin-top: 16px;">
                <div class="card-body">
                    <p class="empty-text">No referendums have been created yet. Be the first to ask a question!</p>
                </div>
            </div>
            `}
        `;

        // Wire Create Referendum form for this page
        if (typeof App.wireCreateReferendumForm === 'function') {
            App.wireCreateReferendumForm();
        }

        // Wire list clicks / auto-select first (when any referendums exist)
        if (hasAny) {
            document.querySelectorAll('#referendum-list .list-item').forEach((item) => {
                item.addEventListener('click', () => {
                    document
                        .querySelectorAll('#referendum-list .list-item')
                        .forEach((i) => i.classList.remove('selected'));
                    item.classList.add('selected');
                    const id = item.getAttribute('data-ref-id');
                    App.loadReferendumDetail(id);
                });
            });

            const first = referendums[0];
            const firstItem = document.querySelector('#referendum-list .list-item');
            if (firstItem) {
                firstItem.classList.add('selected');
                App.loadReferendumDetail(first.id);
            }
        }
    } catch (err) {
        content.innerHTML = `<div class="card"><div class="card-body">Error: ${err.message}</div></div>`;
    }
};

App.loadReferendumDetail = async function(refId) {
    const body = document.getElementById('referendum-detail-body');
    if (!body) return;

    body.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    try {
        const [ref, args] = await Promise.all([
            App.api(`/referendums/${refId}`),
            App.api(`/referendums/${refId}/arguments`)
        ]);

        const groupBySide = { pro: [], con: [], neutral: [] };
        for (const a of args) {
            if (groupBySide[a.side]) {
                groupBySide[a.side].push(a);
            } else {
                groupBySide.neutral.push(a);
            }
        }

        const renderArgumentList = (list, sideLabel) => {
            if (!list.length) {
                return `<p class="empty-text">No ${sideLabel} perspectives yet.</p>`;
            }
            return list
                .map(
                    (a) => `
                <div class="argument-card">
                    <div class="argument-header">
                        <span class="argument-author">${a.displayName}</span>
                        <span class="argument-meta">${a.visibility === 'ANON' ? 'Anonymous' : a.visibility === 'PSEUDO' ? 'Pseudonymous' : 'Public'} • ${a.votes || 0} votes</span>
                    </div>
                    <div class="argument-body">${a.body}</div>
                    <div class="argument-actions">
                        <button class="btn btn-secondary btn-sm" data-arg-id="${a.id}" data-ref-id="${refId}">👍 Support</button>
                    </div>
                </div>
            `
                )
                .join('');
        };

        body.innerHTML = `
            <div class="referendum-detail">
                <h2 class="detail-title">${ref.title}</h2>
                <p class="detail-subtitle">
                    ${ref.locationName || ref.scope || 'All members'} • Status: ${ref.status || 'open'}
                </p>
                <div class="detail-body" style="margin-top: 8px;">${ref.body}</div>

                <div class="card" style="margin-top: 20px;">
                    <div class="card-header">
                        <h3 class="card-title">Share Your Perspective</h3>
                    </div>
                    <div class="card-body">
                        <form id="argument-form">
                            <div class="form-group">
                                <label>Side</label>
                                <div class="radio-row">
                                    <label><input type="radio" name="side" value="pro" checked> For</label>
                                    <label><input type="radio" name="side" value="con"> Against</label>
                                    <label><input type="radio" name="side" value="neutral"> Neutral</label>
                                </div>
                            </div>
                            <div class="form-group">
                                <label>Your perspective</label>
                                <textarea name="body" class="form-input" rows="4" required placeholder="Explain your reasoning..."></textarea>
                            </div>
                            <div class="form-group">
                                <label>Privacy</label>
                                <div class="radio-column">
                                    <label><input type="radio" name="visibility" value="PUBLIC" checked> Public (show your name)</label>
                                    <label><input type="radio" name="visibility" value="PSEUDO"> Pseudonymous (first name + initial only)</label>
                                    <label><input type="radio" name="visibility" value="ANON"> Anonymous (shown as \"Anonymous member\")</label>
                                </div>
                            </div>
                            <button type="submit" class="btn btn-primary">Post perspective</button>
                            <div id="argument-feedback" class="form-feedback"></div>
                        </form>
                    </div>
                </div>

                <div class="cards-grid" style="margin-top: 24px;">
                    <div class="card">
                        <div class="card-header"><h3 class="card-title">✅ For</h3></div>
                        <div class="card-body">
                            ${renderArgumentList(groupBySide.pro, 'supporting')}
                        </div>
                    </div>
                    <div class="card">
                        <div class="card-header"><h3 class="card-title">❌ Against</h3></div>
                        <div class="card-body">
                            ${renderArgumentList(groupBySide.con, 'opposing')}
                        </div>
                    </div>
                    <div class="card">
                        <div class="card-header"><h3 class="card-title">💬 Neutral</h3></div>
                        <div class="card-body">
                            ${renderArgumentList(groupBySide.neutral, 'neutral')}
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Wire argument form
        const form = document.getElementById('argument-form');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                if (!App.requireVerifiedAuth()) return;

                const feedback = document.getElementById('argument-feedback');
                feedback.textContent = '';

                const formData = new FormData(form);
                const side = formData.get('side') || 'pro';
                const bodyText = (formData.get('body') || '').toString().trim();
                const visibility = formData.get('visibility') || 'PUBLIC';

                if (!bodyText) {
                    feedback.textContent = 'Please write a perspective before submitting.';
                    feedback.classList.add('error');
                    return;
                }

                try {
                    const { response, data } = await App.apiPost(`/referendums/${refId}/arguments`, {
                        side,
                        body: bodyText,
                        visibility
                    });
                    if (!response.ok) {
                        feedback.textContent = data.error || 'Could not save perspective.';
                        feedback.classList.add('error');
                        return;
                    }
                    form.reset();
                    feedback.textContent = 'Perspective posted.';
                    feedback.classList.remove('error');
                    feedback.classList.add('success');
                    // Reload arguments
                    App.loadReferendumDetail(refId);
                } catch (err) {
                    feedback.textContent = err.message;
                    feedback.classList.add('error');
                }
            });
        }

        // Wire upvote buttons
        document.querySelectorAll('.argument-actions button').forEach((btn) => {
            btn.addEventListener('click', async () => {
                if (!App.requireVerifiedAuth()) return;
                const argId = btn.getAttribute('data-arg-id');
                const rId = btn.getAttribute('data-ref-id');
                try {
                    const { response, data } = await App.apiPost(`/referendums/${rId}/arguments/${argId}/upvote`, {});
                    if (!response.ok) {
                        alert(data.error || 'Could not support argument.');
                        return;
                    }
                    App.loadReferendumDetail(rId);
                } catch (err) {
                    alert(err.message);
                }
            });
        });
    } catch (err) {
        body.innerHTML = `<div class="card"><div class="card-body">Error: ${err.message}</div></div>`;
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
                        <button class="admin-btn primary" id="toggle-create-conv-form" style="margin-bottom: 12px;">
                            ➕ Create New Convention
                        </button>
                        <div id="create-conv-form" style="display: none;">
                            <div class="form-group">
                                <label>Convention Name</label>
                                <input type="text" id="new-conv-name" class="form-input" placeholder="e.g., ${currentYear + 1} National Convention" value="${currentYear + 1} National Convention">
                            </div>
                            <div class="form-group">
                                <label>Year</label>
                                <input type="number" id="new-conv-year" class="form-input" min="2020" max="2100" value="${currentYear + 1}">
                            </div>
                            <div class="form-group">
                                <label>Start Date <span style="color: var(--text-muted); font-weight: normal;">(Wave 1 nominations begin)</span></label>
                                <input type="date" id="new-conv-start" class="form-input" value="${currentYear + 1}-01-15">
                            </div>
                            <p class="form-help" style="margin: 8px 0; color: var(--text-muted); font-size: 0.85rem;">
                                📅 Schedule is auto-generated: 2 weeks nominations + 1 week voting per wave (6 waves total, ~18 weeks)
                            </p>
                            <button class="admin-btn primary" onclick="App.createNewConvention()" style="margin-top: 12px;">➕ Create Convention</button>
                        </div>
                        <div id="create-conv-result" style="margin-top: 12px; display: none;"></div>
                    </div>
                </div>

                <!-- Create Referendum Card (Admin can also create from here) -->
                <div class="card">
                    <div class="card-header"><h3 class="card-title">📑 Create Referendum</h3></div>
                    <div class="card-body">
                        <p class="card-subtitle" style="margin-bottom: 8px;">
                            Create a new question for members to share perspectives on.
                        </p>
                        <form id="create-ref-form-admin">
                            <div class="form-group">
                                <label>Title</label>
                                <input type="text" name="title" class="form-input" placeholder="Should we adopt ranked-choice voting for party leadership?" required>
                            </div>
                            <div class="form-group">
                                <label>Description</label>
                                <textarea name="body" class="form-input" rows="3" placeholder="Explain what this referendum is about..." required></textarea>
                            </div>
                            <div class="form-group">
                                <label>Scope</label>
                                <select name="scope" class="form-select">
                                    <option value="national">National (all members)</option>
                                    <option value="province">Province-wide</option>
                                    <option value="riding">Riding-level</option>
                                </select>
                            </div>
                            <button type="submit" class="admin-btn primary">Create Referendum</button>
                            <div id="create-ref-feedback-admin" class="form-feedback"></div>
                        </form>
                    </div>
                </div>

                <!-- Dev Utilities Card -->
                <div class="card">
                    <div class="card-header"><h3 class="card-title">🧹 Dev Utilities</h3></div>
                    <div class="card-body">
                        <p class="card-subtitle" style="margin-bottom: 8px;">
                            Tools to keep the development database tidy. These do <strong>not</strong> run automatically.
                        </p>
                        <button class="admin-btn" onclick="App.cleanupDuplicateUsers()">🧹 Clean up duplicate users (same email)</button>
                        <div id="cleanup-duplicates-result" class="form-feedback" style="margin-top: 8px;"></div>
                        <hr style="margin: 12px 0; border-color: var(--border-color);">
                        <button class="admin-btn danger" onclick="App.resetDatabase()">💣 Reset Neo4j database and re-seed</button>
                        <div id="reset-db-result" class="form-feedback" style="margin-top: 8px;"></div>
                        <p class="form-help" style="margin-top: 8px; color: var(--text-muted); font-size: 0.85rem;">
                            User cleanup keeps one user per email address and deletes extra test users.
                            The reset button will wipe <strong>all</strong> Neo4j data and re-run the full seed script.
                            Use only on your local development database.
                        </p>
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
                        
                        ${autoMode.enabled ? `
                            <div class="auto-mode-notice" style="background: rgba(0, 212, 170, 0.1); border: 1px solid var(--accent-primary); padding: 12px; border-radius: 8px; margin-bottom: 16px;">
                                <strong>🤖 Auto Mode Active</strong> - All controls are locked. The system will advance phases automatically based on the schedule below.
                                <br><small style="color: var(--text-muted);">Disable Auto Mode to manually control, reset, or delete the convention.</small>
                            </div>
                        ` : `
                            <div class="admin-phase-buttons" style="margin-bottom: 16px;">
                                ${phases.map(p => `<button class="admin-btn ${activeConv.status === p.status ? 'active' : ''}" onclick="App.setConventionPhase('${activeConv.id}', '${p.status}', ${p.wave})">${p.label}</button>`).join('')}
                            </div>
                            
                            <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                                <button class="admin-btn primary" onclick="App.advanceConvention('${activeConv.id}')">⏩ Advance Phase</button>
                                ${activeConv.status?.includes('-voting') ? `
                                    <button class="admin-btn" onclick="App.startAllVoting('${activeConv.id}')">▶️ Start All Voting</button>
                                    <button class="admin-btn warning" onclick="App.closeAllRounds('${activeConv.id}')">⏭️ Close All Rounds</button>
                                ` : ''}
                            </div>
                            
                            <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border-color);">
                                <button class="admin-btn danger" onclick="App.confirmResetConvention('${activeConv.id}')">🔄 Reset</button>
                                <button class="admin-btn danger" onclick="App.confirmDeleteConvention('${activeConv.id}', '${activeConv.name}')">🗑️ Delete</button>
                            </div>
                        `}
                        
                        <div id="admin-result" style="margin-top: 16px; padding: 12px; background: var(--bg-secondary); border-radius: 8px; display: none;"></div>
                    </div>
                </div>
                
                <!-- Schedule Card -->
                <div class="card" style="grid-column: span 2;">
                    <div class="card-header">
                        <h3 class="card-title">📅 Convention Schedule</h3>
                        <button class="admin-btn small" onclick="App.toggleScheduleEdit()">✏️ Edit</button>
                    </div>
                    <div class="card-body">
                        <div id="schedule-view">
                            <div class="schedule-grid">
                                ${[1,2,3,4,5,6].map(wave => {
                                    const nomStart = activeConv[`wave${wave}NominationStart`];
                                    const nomEnd = activeConv[`wave${wave}NominationEnd`];
                                    const voteStart = activeConv[`wave${wave}VotingStart`];
                                    const voteEnd = activeConv[`wave${wave}VotingEnd`];
                                    const waveNames = {1:'BC/North',2:'Prairies',3:'North ON',4:'South ON',5:'Quebec',6:'Atlantic'};
                                    const isCurrentWave = stats?.currentWave === wave;
                                    const isPast = activeConv.status === 'completed' || (stats?.currentWave && wave < stats.currentWave);
                                    return `
                                        <div class="schedule-wave ${isCurrentWave ? 'current' : ''} ${isPast ? 'past' : ''}">
                                            <div class="wave-header">Wave ${wave}: ${waveNames[wave]}</div>
                                            <div class="wave-dates">
                                                <div class="wave-phase">
                                                    <span class="phase-label">📝 Nominations:</span>
                                                    <span class="phase-dates">${nomStart ? new Date(nomStart).toLocaleDateString() : '—'} - ${nomEnd ? new Date(nomEnd).toLocaleDateString() : '—'}</span>
                                                </div>
                                                <div class="wave-phase">
                                                    <span class="phase-label">🗳️ Voting:</span>
                                                    <span class="phase-dates">${voteStart ? new Date(voteStart).toLocaleDateString() : '—'} - ${voteEnd ? new Date(voteEnd).toLocaleDateString() : '—'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                        <div id="schedule-edit" style="display: none;">
                            <div class="schedule-edit-grid">
                                ${[1,2,3,4,5,6].map(wave => {
                                    const nomStart = activeConv[`wave${wave}NominationStart`];
                                    const nomEnd = activeConv[`wave${wave}NominationEnd`];
                                    const voteStart = activeConv[`wave${wave}VotingStart`];
                                    const voteEnd = activeConv[`wave${wave}VotingEnd`];
                                    const waveNames = {1:'BC/North',2:'Prairies',3:'North ON',4:'South ON',5:'Quebec',6:'Atlantic'};
                                    const toDateInput = (d) => d ? new Date(d).toISOString().split('T')[0] : '';
                                    return `
                                        <div class="schedule-wave-edit">
                                            <div class="wave-header">Wave ${wave}: ${waveNames[wave]}</div>
                                            <div class="wave-edit-row">
                                                <label>Nom Start</label>
                                                <input type="date" class="form-input small" id="w${wave}ns" value="${toDateInput(nomStart)}">
                                            </div>
                                            <div class="wave-edit-row">
                                                <label>Nom End</label>
                                                <input type="date" class="form-input small" id="w${wave}ne" value="${toDateInput(nomEnd)}">
                                            </div>
                                            <div class="wave-edit-row">
                                                <label>Vote Start</label>
                                                <input type="date" class="form-input small" id="w${wave}vs" value="${toDateInput(voteStart)}">
                                            </div>
                                            <div class="wave-edit-row">
                                                <label>Vote End</label>
                                                <input type="date" class="form-input small" id="w${wave}ve" value="${toDateInput(voteEnd)}">
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                            <div style="margin-top: 16px; display: flex; gap: 12px;">
                                <button class="admin-btn primary" onclick="App.saveSchedule('${activeConv.id}')">💾 Save Schedule</button>
                                <button class="admin-btn" onclick="App.toggleScheduleEdit()">Cancel</button>
                            </div>
                            <div id="schedule-result" style="margin-top: 12px;"></div>
                        </div>
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

        // Hook up toggle for Create New Convention form
        const toggleConvFormBtn = document.getElementById('toggle-create-conv-form');
        const createConvForm = document.getElementById('create-conv-form');
        if (toggleConvFormBtn && createConvForm) {
            toggleConvFormBtn.addEventListener('click', () => {
                const isHidden = createConvForm.style.display === 'none' || createConvForm.style.display === '';
                createConvForm.style.display = isHidden ? 'block' : 'none';
                toggleConvFormBtn.textContent = isHidden ? 'Hide Create Convention Form' : '➕ Create New Convention';
            });
        }
    } catch (err) {
        content.innerHTML = `<div class="card"><div class="card-body">Error: ${err.message}</div></div>`;
    }
};

// ============================================
// ADMIN ACTIONS
// ============================================

App.toggleScheduleEdit = function() {
    const view = document.getElementById('schedule-view');
    const edit = document.getElementById('schedule-edit');
    if (view && edit) {
        const isEditing = edit.style.display !== 'none';
        view.style.display = isEditing ? 'block' : 'none';
        edit.style.display = isEditing ? 'none' : 'block';
    }
};

App.saveSchedule = async function(convId) {
    const schedule = {};
    
    for (let wave = 1; wave <= 6; wave++) {
        const ns = document.getElementById(`w${wave}ns`)?.value;
        const ne = document.getElementById(`w${wave}ne`)?.value;
        const vs = document.getElementById(`w${wave}vs`)?.value;
        const ve = document.getElementById(`w${wave}ve`)?.value;
        
        if (ns) schedule[`wave${wave}NominationStart`] = ns;
        if (ne) schedule[`wave${wave}NominationEnd`] = ne;
        if (vs) schedule[`wave${wave}VotingStart`] = vs;
        if (ve) schedule[`wave${wave}VotingEnd`] = ve;
    }
    
    const resultEl = document.getElementById('schedule-result');
    try {
        if (resultEl) resultEl.innerHTML = 'Saving...';
        
        const { data } = await App.apiPost(`/admin/convention/${convId}/schedule`, { schedule });
        
        if (data.success) {
            if (resultEl) resultEl.innerHTML = `<span style="color: var(--success);">✅ ${data.message}</span>`;
            setTimeout(() => App.pages.admin(), 1500);
        } else {
            if (resultEl) resultEl.innerHTML = `<span style="color: var(--danger);">❌ ${data.error}</span>`;
        }
    } catch (err) {
        if (resultEl) resultEl.innerHTML = `<span style="color: var(--danger);">❌ ${err.message}</span>`;
    }
};

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

/**
 * Dev utility: clean up duplicate users that share the same email.
 * Called directly by the Admin page "Clean up duplicate users" button.
 */
App.cleanupDuplicateUsers = async function() {
    const resultEl = document.getElementById('cleanup-duplicates-result');

    if (!confirm('This will delete duplicate users with the same email in the dev database. Continue?')) {
        if (resultEl) {
            resultEl.textContent = 'Cancelled.';
            resultEl.classList.remove('error');
            resultEl.classList.add('success');
        }
        return;
    }

    if (resultEl) {
        resultEl.textContent = 'Running cleanup...';
        resultEl.classList.remove('error', 'success');
    }

    try {
        const { response, data } = await App.apiPost('/users/admin/cleanup-duplicates', {});
        if (!response.ok) {
            if (resultEl) {
                resultEl.textContent = data.error || 'Failed to clean up duplicates.';
                resultEl.classList.add('error');
            }
        } else {
            const summary = (data.cleaned || [])
                .map((item) => `${item.email}: removed ${item.removedCount} duplicate(s)`)
                .join('; ') || 'No duplicates found.';
            if (resultEl) {
                resultEl.textContent = `Done. ${summary}`;
                resultEl.classList.add('success');
            }
            alert(`Duplicate cleanup complete.\n\n${summary}`);
        }
    } catch (err) {
        if (resultEl) {
            resultEl.textContent = `Error: ${err.message}`;
            resultEl.classList.add('error');
        }
    }
};

/**
 * Dev utility: reset and re-seed the Neo4j database.
 * Called directly by the Admin page "Reset database" button.
 */
App.resetDatabase = async function() {
    const resultEl = document.getElementById('reset-db-result');

    if (
        !confirm(
            'This will DELETE all data in Neo4j and re-seed it using the development script.\n\nAre you absolutely sure?'
        )
    ) {
        if (resultEl) {
            resultEl.textContent = 'Cancelled.';
            resultEl.classList.remove('error');
            resultEl.classList.add('success');
        }
        return;
    }

    if (resultEl) {
        resultEl.textContent = 'Resetting and re-seeding database... this may take a minute.';
        resultEl.classList.remove('error', 'success');
    }

    try {
        const { response, data } = await App.apiPost('/admin/reset-db', {});
        if (!response.ok) {
            if (resultEl) {
                resultEl.textContent = data.error || 'Failed to reset database.';
                resultEl.classList.add('error');
            }
        } else {
            const msg = data.message || 'Database reset and reseeded successfully.';
            if (resultEl) {
                resultEl.textContent = `${msg} You may need to refresh the page.`;
                resultEl.classList.add('success');
            }
            alert(`${msg}\n\nYou may need to reload this page so the UI matches the new data.`);
        }
    } catch (err) {
        if (resultEl) {
            resultEl.textContent = `Error: ${err.message}`;
            resultEl.classList.add('error');
        }
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
    const startDate = document.getElementById('new-conv-start')?.value;
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
            resultEl.innerHTML = 'Creating convention and generating schedule...';
        }
        
        const { data } = await App.apiPost('/admin/conventions', { name, year, startDate });
        
        if (data.success) {
            if (resultEl) {
                // Format the message with line breaks
                const formattedMsg = data.message.replace(/\n/g, '<br>');
                resultEl.innerHTML = `<div style="color: var(--success); white-space: pre-line;">${formattedMsg}</div>`;
            }
            setTimeout(() => App.pages.admin(), 3000); // Longer delay to read schedule
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
// CANDIDACY & NOMINATION ACTIONS
// ============================================

/**
 * Declare candidacy for the current convention
 * Anyone can run - no nominations required!
 */
App.declareCandidacy = async function(convId) {
    if (!App.currentUser) {
        alert('Please select a user first');
        return;
    }
    if (!App.requireVerifiedAuth()) {
        return;
    }

    // Require the user to choose a specific location (federal/provincial/town/First Nation)
    let locationId = null;
    const locSelect = document.getElementById('candidacy-location-select');
    if (locSelect) {
        locationId = locSelect.value || null;
        if (!locationId) {
            alert('Please choose where you want to run (federal riding, provincial riding, town, or First Nation).');
            locSelect.focus();
            return;
        }
    }
    
    if (!confirm('Are you sure you want to run for office? You will be added as a candidate in the location you selected.')) {
        return;
    }
    
    try {
        const { response, data } = await App.apiPost(`/conventions/${convId}/declare-candidacy`, { 
            locationId
        });
        
        if (data.success) {
            alert(`🏃 ${data.message}`);
            App.pages.profile();
        } else {
            alert('❌ ' + (data.error || 'Failed to declare candidacy'));
        }
    } catch (err) {
        alert('❌ Error: ' + err.message);
    }
};

App.acceptNomination = async function(convId, raceId) {
    // Legacy support - now just calls declare candidacy
    App.declareCandidacy(convId);
};

App.declineNomination = async function(convId, raceId) {
    if (!App.currentUser || !confirm('Are you sure you want to decline this nomination?')) return;
    if (!App.requireVerifiedAuth()) {
        return;
    }
    
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
    if (!App.requireVerifiedAuth()) {
        return;
    }
    
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
    if (!App.requireVerifiedAuth()) {
        return;
    }
    try {
        const [user, conventions, endorsements] = await Promise.all([
            App.api(`/users/${userId}`),
            App.api('/conventions'),
            App.api(`/users/${userId}/endorsements`).catch(() => [])
        ]);
        
        const activeConv = conventions.find(c => c.status !== 'completed');
        const hasLocation = user.location && user.location.id;
        
        // Nominations are PERMANENT - can be made anytime, no convention required!
        const canNominate = hasLocation && App.currentUser && App.currentUser.id !== userId;
        
        // Get user's nomination count
        const nominationCount = user.nominationCount || 0;
        
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
                        <div class="member-stat"><span class="stat-value">${nominationCount}</span><span class="stat-label">Nominations</span></div>
                    </div>
                    ${user.skills?.length ? `<div class="member-section"><h4>Skills</h4><div class="tags">${user.skills.map(s => `<span class="tag">${s}</span>`).join('')}</div></div>` : ''}
                    
                    ${endorsements.length > 0 ? `
                        <div class="member-section endorsements-section">
                            <h4>✍️ Endorsements (${endorsements.length})</h4>
                            <div class="endorsements-list">
                                ${endorsements.map(e => `
                                    <div class="endorsement-item">
                                        <div class="endorsement-header">
                                            <span class="endorser-name">${e.endorser?.name || 'Anonymous'}</span>
                                            <span class="endorsement-date">${e.createdAt ? new Date(e.createdAt).toLocaleDateString() : ''}</span>
                                        </div>
                                        <div class="endorsement-message">"${e.message || 'No message'}"</div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                    
                    <hr class="modal-divider">
                    <div class="nominate-section">
                        <h4>📝 Nominate This Member</h4>
                        <p class="nominate-explanation">Nominations are <strong>permanent</strong> and show your support for this person to run for office.</p>
                        ${!App.currentUser ? '<p class="nominate-hint">Select yourself from the "Playing as" dropdown to nominate this member.</p>' :
                          App.currentUser.id === userId ? '<p class="nominate-hint">You cannot nominate yourself.</p>' :
                          !hasLocation ? '<p class="nominate-hint">This member hasn\'t set their riding yet.</p>' :
                          `<div class="nomination-form">
                               <textarea id="nomination-message" class="form-textarea" placeholder="Optional: Why are you nominating this person?" rows="2"></textarea>
                               <button class="btn btn-primary" id="nominate-member-btn">📝 Nominate ${user.name}</button>
                           </div>
                           <div id="nominate-feedback" class="nomination-feedback"></div>`}
                    </div>
                    
                    <hr class="modal-divider">
                    <div class="endorse-section">
                        <h4>✍️ Write an Endorsement</h4>
                        <p class="nominate-explanation">Endorsements are personal recommendations. Write why you think this person would be a good representative.</p>
                        ${!App.currentUser ? '<p class="nominate-hint">Select yourself from the "Playing as" dropdown to endorse this member.</p>' :
                          App.currentUser.id === userId ? '<p class="nominate-hint">You cannot endorse yourself.</p>' :
                          `<div class="endorsement-form">
                               <textarea id="endorsement-message" class="form-textarea" placeholder="Write your endorsement... (required)" rows="3"></textarea>
                               <button class="btn btn-secondary" id="endorse-member-btn">✍️ Endorse ${user.name}</button>
                           </div>
                           <div id="endorse-feedback" class="nomination-feedback"></div>`}
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        const nominateBtn = modal.querySelector('#nominate-member-btn');
        if (nominateBtn) {
            nominateBtn.addEventListener('click', async () => {
                const feedback = modal.querySelector('#nominate-feedback');
                const messageInput = modal.querySelector('#nomination-message');
                const message = messageInput?.value || '';
                
                nominateBtn.disabled = true;
                nominateBtn.textContent = 'Nominating...';
                
                try {
                    // Use a dummy convention ID - nominations are not tied to conventions anymore
                    const convId = activeConv?.id || 'general';
                    const { response, data } = await App.apiPost(`/conventions/${convId}/nominate`, {
                        nominatorId: App.currentUser.id,
                        nomineeId: userId,
                        message
                    });
                    
                    if (response.ok && data.success) {
                        feedback.innerHTML = `<span class="success">✅ ${data.message}</span>`;
                        nominateBtn.textContent = '✅ Nominated!';
                    } else {
                        feedback.innerHTML = `<span class="error">❌ ${data.error || 'Failed'}</span>`;
                        nominateBtn.disabled = false;
                        nominateBtn.textContent = `📝 Nominate ${user.name}`;
                    }
                } catch (err) {
                    feedback.innerHTML = `<span class="error">❌ ${err.message}</span>`;
                    nominateBtn.disabled = false;
                    nominateBtn.textContent = `📝 Nominate ${user.name}`;
                }
            });
        }
        
        // Endorse button handler
        const endorseBtn = modal.querySelector('#endorse-member-btn');
        if (endorseBtn) {
            endorseBtn.addEventListener('click', async () => {
                const feedback = modal.querySelector('#endorse-feedback');
                const messageInput = modal.querySelector('#endorsement-message');
                const message = messageInput?.value?.trim() || '';
                
                if (!message) {
                    feedback.innerHTML = `<span class="error">Please write an endorsement message.</span>`;
                    return;
                }
                
                endorseBtn.disabled = true;
                endorseBtn.textContent = 'Endorsing...';
                
                try {
                    const { response, data } = await App.apiPost(`/users/${App.currentUser.id}/endorse`, {
                        targetUserId: userId,
                        message
                    });
                    
                    if (response.ok && data.success) {
                        feedback.innerHTML = `<span class="success">✅ Endorsement submitted!</span>`;
                        endorseBtn.textContent = '✅ Endorsed!';
                        messageInput.value = '';
                    } else {
                        feedback.innerHTML = `<span class="error">❌ ${data.error || 'Failed'}</span>`;
                        endorseBtn.disabled = false;
                        endorseBtn.textContent = `✍️ Endorse ${user.name}`;
                    }
                } catch (err) {
                    feedback.innerHTML = `<span class="error">❌ ${err.message}</span>`;
                    endorseBtn.disabled = false;
                    endorseBtn.textContent = `✍️ Endorse ${user.name}`;
                }
            });
        }
        
        modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    } catch (err) {
        alert('Error loading member details');
    }
};

// Shortcut to open member detail for nomination
App.nominateMember = function(userId) {
    App.showMemberDetail(userId);
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

