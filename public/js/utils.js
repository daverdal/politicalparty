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
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return response.json();
};

App.apiPost = async function(endpoint, data) {
    const response = await fetch(`/api${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    return { response, data: await response.json() };
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
                <button class="btn btn-secondary btn-sm" id="auth-open-modal-btn">
                    Sign in
                </button>
            `;
            const openBtn = document.getElementById('auth-open-modal-btn');
            if (openBtn) {
                openBtn.addEventListener('click', () => {
                    if (typeof App.showAuthModal === 'function') {
                        App.showAuthModal('login');
                    } else {
                        alert('Sign-in dialog is not available right now.');
                    }
                });
            }
        }
    };
}

