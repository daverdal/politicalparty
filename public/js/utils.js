/**
 * Utility Functions
 * Shared helpers used across the app
 */

window.App = window.App || {};

// ============================================
// API HELPER
// ============================================

App.api = async function(endpoint) {
    const response = await fetch(`/api${endpoint}`);

    let data = null;
    try {
        data = await response.json();
    } catch (err) {
        data = null;
    }

    if (!response.ok) {
        const message =
            (data && (data.error || data.message)) || `API error: ${response.status}`;
        const error = new Error(message);
        error.status = response.status;
        throw error;
    }

    return data;
};

App.apiPost = async function(endpoint, data) {
    const response = await fetch(`/api${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });

    // Be defensive: some infrastructure or unexpected errors may return
    // an HTML error page instead of JSON, which would cause response.json()
    // to throw "Unexpected token '<'...". We swallow that here and expose a
    // safe fallback shape so the UI can show a friendly error instead.
    let parsed = null;
    let textFallback = null;
    try {
        parsed = await response.json();
    } catch (err) {
        try {
            textFallback = await response.text();
        } catch (_) {
            textFallback = null;
        }

        if (typeof App.logClientEvent === 'function') {
            App.logClientEvent('error', 'Non-JSON response from API POST', {
                endpoint,
                status: response.status,
                textStartsWith: textFallback ? textFallback.slice(0, 80) : null,
                parseError: err && err.message
            });
        }
    }

    const dataSafe = parsed || (textFallback ? { raw: textFallback } : {});
    return { response, data: dataSafe };
};

App.apiPostNoBody = async function(endpoint) {
    const response = await fetch(`/api${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    });
    return { response, data: await response.json().catch(() => ({})) };
};

App.apiPut = async function(endpoint, data) {
    const response = await fetch(`/api${endpoint}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    return { response, data: await response.json() };
};

// ============================================
// FORMATTING
// ============================================

App.getInitials = function(name) {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
};

App.formatDate = function(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
};

App.formatTime = function(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit'
    });
};

App.renderTags = function(tags, accent = false) {
    if (!tags || !tags.length) return '';
    return tags.map(tag => `<span class="tag ${accent ? 'accent' : ''}">${tag}</span>`).join('');
};

// ============================================
// ICONS
// ============================================

App.locationIcons = {
    country: '🌎',
    province: '🏛️',
    federalRiding: '🗳️',
    provincialRiding: '📋',
    town: '🏘️',
    firstNation: '🪶',
    adhocGroup: '👥'
};

// ============================================
// LIGHTWEIGHT CLIENT DEBUG CONSOLE
// ============================================

App.clientLogs = App.clientLogs || [];

App.logClientEvent = function(level, message, meta) {
    try {
        App.clientLogs.push({
            time: new Date().toISOString(),
            level,
            message: String(message || ''),
            meta: meta || null
        });
        if (App.clientLogs.length > 50) {
            App.clientLogs.shift();
        }
        const badge = document.querySelector('.debug-console-toggle-badge');
        if (badge) {
            badge.textContent = String(App.clientLogs.length);
            badge.style.display = 'inline-block';
        }
    } catch (e) {
        // never break the app because of logging
    }
};

App.initClientDebugConsole = function() {
    if (document.querySelector('.debug-console-toggle')) return;

    const toggle = document.createElement('button');
    toggle.className = 'debug-console-toggle';
    toggle.type = 'button';
    toggle.innerHTML = `Debug<span class="debug-console-toggle-badge" style="display:none;">0</span>`;

    const panel = document.createElement('div');
    panel.className = 'debug-console-panel debug-console-hidden';
    panel.innerHTML = `
        <div class="debug-console-header">
            <span>Client Debug Console</span>
            <button type="button" class="debug-console-clear">Clear</button>
            <button type="button" class="debug-console-close">×</button>
        </div>
        <div class="debug-console-body"></div>
    `;

    document.body.appendChild(toggle);
    document.body.appendChild(panel);

    const body = panel.querySelector('.debug-console-body');
    const clearBtn = panel.querySelector('.debug-console-clear');
    const closeBtn = panel.querySelector('.debug-console-close');
    const badge = toggle.querySelector('.debug-console-toggle-badge');

    const render = () => {
        if (!body) return;
        if (!App.clientLogs.length) {
            body.innerHTML = '<div class="debug-console-empty">No messages yet.</div>';
            if (badge) badge.style.display = 'none';
            return;
        }
        body.innerHTML = App.clientLogs
            .map((e) => {
                const meta = e.meta ? `<pre>${JSON.stringify(e.meta, null, 2)}</pre>` : '';
                return `<div class="debug-console-entry debug-${e.level}">
                    <div class="debug-console-line">
                        <span class="debug-time">${e.time}</span>
                        <span class="debug-level">${e.level.toUpperCase()}</span>
                        <span class="debug-message">${e.message}</span>
                    </div>
                    ${meta}
                </div>`;
            })
            .join('');
        if (badge) {
            badge.textContent = String(App.clientLogs.length);
            badge.style.display = 'inline-block';
        }
        body.scrollTop = body.scrollHeight;
    };

    toggle.addEventListener('click', () => {
        panel.classList.toggle('debug-console-hidden');
        render();
    });

    closeBtn.addEventListener('click', () => {
        panel.classList.add('debug-console-hidden');
    });

    clearBtn.addEventListener('click', () => {
        App.clientLogs = [];
        render();
    });

    // Hook global errors
    window.addEventListener('error', (event) => {
        App.logClientEvent('error', event.message, {
            source: event.filename,
            line: event.lineno,
            column: event.colno,
            stack: event.error && event.error.stack
        });
    });

    window.addEventListener('unhandledrejection', (event) => {
        const reason = event.reason || {};
        App.logClientEvent('error', reason.message || String(reason), {
            stack: reason.stack || null
        });
    });

    // Also mirror console.error into the panel without breaking it
    try {
        const origError = window.console && window.console.error;
        window.console.error = function(...args) {
            App.logClientEvent('error', args[0], { args });
            if (origError) {
                origError.apply(window.console, args);
            }
        };
    } catch (e) {
        // ignore
    }
};

// ============================================
// FALLBACK AUTH UI (if pages-extended.js fails to load)
// ============================================

if (typeof App.updateAuthUi !== 'function') {
    App.updateAuthUi = function() {
        const container = document.getElementById('auth-status');
        if (!container) return;

        if (App.authUser) {
            container.innerHTML = `
                <div class="auth-summary">
                    <div class="auth-summary-main">
                        <span class="auth-summary-label">Signed in as</span>
                        <span class="auth-summary-email">${App.authUser.email}</span>
                    </div>
                    <div class="auth-summary-meta">
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
                    window.location.reload();
                });
            }
        } else {
            container.innerHTML = `
                <div class="auth-actions">
                    <button class="btn btn-secondary btn-sm" id="auth-login-btn">
                        Sign in
                    </button>
                    <button class="btn btn-primary btn-sm" id="auth-signup-btn">
                        Sign up
                    </button>
                </div>
            `;

            const loginBtn = document.getElementById('auth-login-btn');
            if (loginBtn) {
                loginBtn.addEventListener('click', () => {
                    if (typeof App.showAuthModal === 'function') {
                        App.showAuthModal('login');
                    } else {
                        alert('Sign-in dialog is not available right now.');
                    }
                });
            }

            const signupBtn = document.getElementById('auth-signup-btn');
            if (signupBtn) {
                signupBtn.addEventListener('click', () => {
                    if (typeof App.showAuthModal === 'function') {
                        App.showAuthModal('signup');
                    } else {
                        alert('Sign-up dialog is not available right now.');
                    }
                });
            }
        }
    };
}

// Simple fallback auth modal (sign-in + basic sign-up) if the full auth UI
// from pages-extended.js is not available. This lets you log in and create
// accounts even when the extended bundle is not running.
if (typeof App.showAuthModal !== 'function') {
    App.showAuthModal = function(initialTab = 'login') {
        const existing = document.querySelector('.modal-overlay.auth-modal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.className = 'modal-overlay auth-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Account</h2>
                    <button class="modal-close" aria-label="Close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="auth-tabs">
                        <button class="auth-tab ${initialTab === 'login' ? 'active' : ''}" data-tab="login">Sign in</button>
                        <button class="auth-tab ${initialTab === 'signup' ? 'active' : ''}" data-tab="signup">Create account</button>
                    </div>
                    <div class="auth-tab-content ${initialTab === 'login' ? 'active' : ''}" id="auth-tab-login">
                        <form id="fallback-login-form" class="auth-form">
                            <label>
                                <span>Email</span>
                                <input type="email" name="email" required autocomplete="email">
                            </label>
                            <label>
                                <span>Password</span>
                                <input type="password" name="password" required autocomplete="current-password">
                            </label>
                            <button type="submit" class="btn btn-primary auth-submit-btn">Sign in</button>
                            <div class="auth-feedback" id="fallback-login-feedback"></div>
                        </form>
                    </div>
                    <div class="auth-tab-content ${initialTab === 'signup' ? 'active' : ''}" id="auth-tab-signup">
                        <form id="fallback-signup-form" class="auth-form">
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
                                You may be asked to verify your email before participating fully.
                            </p>
                            <button type="submit" class="btn btn-primary auth-submit-btn">Create account</button>
                            <div class="auth-feedback" id="fallback-signup-feedback"></div>
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
        modal.querySelectorAll('.auth-tab').forEach((tab) => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                modal.querySelectorAll('.auth-tab').forEach((t) => t.classList.remove('active'));
                modal.querySelectorAll('.auth-tab-content').forEach((c) => c.classList.remove('active'));
                tab.classList.add('active');
                const content = modal.querySelector(`#auth-tab-${tabName}`);
                if (content) content.classList.add('active');
            });
        });

        // Login submit (fallback)
        const loginForm = modal.querySelector('#fallback-login-form');
        const loginFeedback = modal.querySelector('#fallback-login-feedback');
        const loginSubmitBtn = loginForm.querySelector('.auth-submit-btn');

        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            loginFeedback.textContent = '';
            loginFeedback.classList.remove('error', 'success');
            loginSubmitBtn.disabled = true;
            loginSubmitBtn.textContent = 'Signing in...';

            const formData = new FormData(loginForm);
            const email = (formData.get('email') || '').toString().trim();
            const password = (formData.get('password') || '').toString();

            try {
                const { response, data } = await App.apiPost('/auth/login', {
                    email,
                    password
                });

                if (!response.ok) {
                    loginFeedback.textContent = (data && data.error) || 'Invalid email or password.';
                    loginFeedback.classList.add('error');
                    loginSubmitBtn.disabled = false;
                    loginSubmitBtn.textContent = 'Sign in';
                    return;
                }

                if (data && data.user) {
                    // Set auth user and immediately take them to My Profile,
                    // starting on the Locations tab so they fill out their home locations.
                    App.setAuthUser(data.user);
                    App.profileInitialTab = 'locations';
                    if (typeof App.navigate === 'function') {
                        App.navigate('profile');
                    }
                }

                if (typeof App.updateAuthUi === 'function') {
                    App.updateAuthUi();
                }

                loginFeedback.textContent = 'Signed in.';
                loginFeedback.classList.add('success');
                setTimeout(close, 500);
            } catch (err) {
                loginFeedback.textContent = err.message || 'Unable to sign in.';
                loginFeedback.classList.add('error');
                loginSubmitBtn.disabled = false;
                loginSubmitBtn.textContent = 'Sign in';
            }
        });

        // Signup submit (fallback)
        const signupForm = modal.querySelector('#fallback-signup-form');
        const signupFeedback = modal.querySelector('#fallback-signup-feedback');
        const signupSubmitBtn = signupForm.querySelector('.auth-submit-btn');

        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            signupFeedback.textContent = '';
            signupFeedback.classList.remove('error', 'success');
            signupSubmitBtn.disabled = true;
            signupSubmitBtn.textContent = 'Creating account...';

            const formData = new FormData(signupForm);
            const email = formData.get('email');
            const password = formData.get('password');
            const name = formData.get('name') || undefined;

            try {
                const { response, data } = await App.apiPost('/auth/signup', {
                    email,
                    password,
                    name
                });

                if (!response.ok || !data.success) {
                    signupFeedback.textContent = (data && data.error) || 'Unable to create account.';
                    signupFeedback.classList.add('error');
                    signupSubmitBtn.disabled = false;
                    signupSubmitBtn.textContent = 'Create account';
                    return;
                }

                signupFeedback.textContent = data.message || 'Account created. Please check your email to verify your address.';
                signupFeedback.classList.remove('error');
                signupFeedback.classList.add('success');
                signupSubmitBtn.disabled = true;
                signupSubmitBtn.textContent = 'Check your email';
            } catch (err) {
                signupFeedback.textContent = err.message || 'Unable to create account.';
                signupFeedback.classList.add('error');
                signupSubmitBtn.disabled = false;
                signupSubmitBtn.textContent = 'Create account';
            }
        });
    };
}

