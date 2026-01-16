/**
 * Extended Pages
 * Profile, Convention, Admin pages and Modals
 */

window.App = window.App || {};

// Mark that the extended pages bundle has loaded (for in-app debug)
try {
    if (!App.pages) {
        App.pages = {};
    }
    if (typeof App.logClientEvent === 'function') {
        App.logClientEvent('info', 'pages-extended.js loaded', {
            existingPages: Object.keys(App.pages || {})
        });
    }
} catch (e) {
    // Never break the app because of debug logging
}

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
        const isVerified = !!App.authUser.verified;
        const verifiedText = isVerified ? '✅ Verified' : '✉️ Not verified – please verify your email.';
        const verifyButtonHtml = isVerified
            ? ''
            : '<button class="btn btn-secondary btn-sm" id="auth-resend-verification-btn">Resend verification email</button>';

        container.innerHTML = `
            <div class="auth-summary">
                <div class="auth-summary-main">
                    <span class="auth-summary-label">Signed in as</span>
                    <span class="auth-summary-email">${App.authUser.email}</span>
                </div>
                <div class="auth-summary-meta">
                    <span class="auth-summary-status">${verifiedText}</span>
                    ${verifyButtonHtml}
                    <button class="btn btn-secondary btn-sm" id="auth-change-password-btn">Change password</button>
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

        const resendBtn = document.getElementById('auth-resend-verification-btn');
        if (resendBtn) {
            resendBtn.addEventListener('click', async () => {
                try {
                    resendBtn.disabled = true;
                    resendBtn.textContent = 'Sending...';
                    const { response, data } = await App.apiPost('/auth/resend-verification', {
                        email: App.authUser.email
                    });
                    if (!response.ok || !data.success) {
                        alert(data.error || 'Unable to resend verification email right now.');
                    } else {
                        alert(data.message || 'If that email is registered and not yet verified, a verification link has been sent.');
                    }
                } catch (err) {
                    console.error('Failed to resend verification email', err);
                    alert('Unable to resend verification email right now.');
                } finally {
                    resendBtn.disabled = false;
                    resendBtn.textContent = 'Resend verification email';
                }
            });
        }

        const changePwBtn = document.getElementById('auth-change-password-btn');
        if (changePwBtn) {
            changePwBtn.addEventListener('click', () => {
                if (typeof App.showChangePasswordModal === 'function') {
                    App.showChangePasswordModal();
                }
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
                            <div class="password-field">
                                <input type="password" name="password" required autocomplete="current-password">
                                <button type="button" class="password-toggle" aria-label="Show password">👁</button>
                            </div>
                        </label>
                        <p class="auth-help">
                            Use the email and password you signed up with. We do not use Google or other third-party sign-in.
                        </p>
                        <p class="auth-help">
                            <button type="button" class="link-button" id="auth-forgot-password-btn">Forgot your password?</button>
                        </p>
                        <button type="submit" class="btn btn-primary auth-submit-btn">Sign in</button>
                        <div class="auth-feedback" id="auth-login-feedback"></div>
                        <pre class="auth-debug" id="auth-login-debug" aria-live="polite"></pre>
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
                            <div class="password-field">
                                <input type="password" name="password" required minlength="8" autocomplete="new-password">
                                <button type="button" class="password-toggle" aria-label="Show password">👁</button>
                            </div>
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
                        <pre class="auth-debug" id="auth-signup-debug" aria-live="polite"></pre>
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

    // Initialize password visibility toggles
    if (typeof App.initPasswordVisibilityToggles === 'function') {
        App.initPasswordVisibilityToggles(modal);
    }

    // Login submit
    const loginForm = modal.querySelector('#auth-login-form');
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const feedback = modal.querySelector('#auth-login-feedback');
        const debugEl = modal.querySelector('#auth-login-debug');
        const submitBtn = loginForm.querySelector('.auth-submit-btn');
        feedback.textContent = '';
        feedback.classList.remove('error', 'success');
        if (debugEl) {
            debugEl.textContent = '';
        }
        submitBtn.disabled = true;
        submitBtn.textContent = 'Signing in...';

        const formData = new FormData(loginForm);
        const email = formData.get('email');
        const password = formData.get('password');

        try {
            const { response, data } = await App.apiPost('/auth/login', { email, password });
            if (!response.ok || !data.success) {
                const message = data && data.error ? data.error : 'Unable to sign in.';
                feedback.textContent = message;
                feedback.classList.add('error');
                if (debugEl) {
                    debugEl.textContent = JSON.stringify(
                        {
                            status: response.status,
                            statusText: response.statusText,
                            message,
                            email: String(email || '').toLowerCase()
                        },
                        null,
                        2
                    );
                }
                submitBtn.disabled = false;
                submitBtn.textContent = 'Sign in';
                return;
            }

            if (data && data.user) {
                // Set auth user and route them to My Profile, starting on Locations
                // so they configure their home locations before exploring.
                App.setAuthUser(data.user);
                App.profileInitialTab = 'locations';
                if (typeof App.navigate === 'function') {
                    App.navigate('profile');
                }
            }

            // Close modal and keep SPA state without full page reload
            close();
        } catch (err) {
            feedback.textContent = err.message;
            feedback.classList.add('error');
            if (debugEl) {
                debugEl.textContent = JSON.stringify(
                    {
                        message: err.message,
                        stack: err.stack
                    },
                    null,
                    2
                );
            }
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
        const debugEl = modal.querySelector('#auth-signup-debug');
        const submitBtn = signupForm.querySelector('.auth-submit-btn');
        feedback.textContent = '';
        feedback.classList.remove('error', 'success');
        if (debugEl) {
            debugEl.textContent = '';
        }
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
                const message = data && data.error ? data.error : 'Unable to create account.';
                feedback.textContent = message;
                feedback.classList.add('error');
                if (debugEl) {
                    debugEl.textContent = JSON.stringify(
                        {
                            status: response.status,
                            statusText: response.statusText,
                            message,
                            email: String(email || '').toLowerCase()
                        },
                        null,
                        2
                    );
                }
                submitBtn.disabled = false;
                submitBtn.textContent = 'Create account';
                return;
            }

            const okMessage =
                (data && data.message) ||
                'Account created. Please check your email to verify your address.';
            feedback.textContent = okMessage;
            feedback.classList.remove('error');
            feedback.classList.add('success');
            if (debugEl) {
                debugEl.textContent = JSON.stringify(
                    {
                        status: response.status,
                        statusText: response.statusText,
                        message: okMessage,
                        email: String(email || '').toLowerCase()
                    },
                    null,
                    2
                );
            }
            submitBtn.disabled = true;
            submitBtn.textContent = 'Check your email';
        } catch (err) {
            feedback.textContent = err.message;
            feedback.classList.add('error');
            if (debugEl) {
                debugEl.textContent = JSON.stringify(
                    {
                        message: err.message,
                        stack: err.stack
                    },
                    null,
                    2
                );
            }
            submitBtn.disabled = false;
            submitBtn.textContent = 'Create account';
        }
    });
};

// Initialize show/hide password toggles within a given container (modal)
App.initPasswordVisibilityToggles = function(container) {
    if (!container) return;
    container.querySelectorAll('.password-field').forEach((wrapper) => {
        const input = wrapper.querySelector('input[type="password"], input[type="text"]');
        const toggle = wrapper.querySelector('.password-toggle');
        if (!input || !toggle) return;

        // Reset to password type each time modal opens
        input.type = 'password';
        toggle.textContent = '👁';
        toggle.setAttribute('aria-label', 'Show password');

        toggle.addEventListener('click', () => {
            const isHidden = input.type === 'password';
            input.type = isHidden ? 'text' : 'password';
            toggle.textContent = isHidden ? '🙈' : '👁';
            toggle.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
        });
    });
};

// Change Password Modal (for signed-in users)
App.showChangePasswordModal = function() {
    if (!App.authUser) {
        if (typeof App.showAuthModal === 'function') {
            App.showAuthModal('login');
        }
        return;
    }

    const existing = document.querySelector('.modal-overlay.change-password-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.className = 'modal-overlay change-password-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>Change password</h2>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <form id="change-password-form" class="auth-form">
                    <label>
                        <span>Current password</span>
                        <input type="password" name="currentPassword" required autocomplete="current-password">
                    </label>
                    <label>
                        <span>New password</span>
                        <input type="password" name="newPassword" required minlength="8" autocomplete="new-password">
                    </label>
                    <label>
                        <span>Confirm new password</span>
                        <input type="password" name="confirmPassword" required minlength="8" autocomplete="new-password">
                    </label>
                    <p class="auth-help">
                        Password must be at least 8 characters long.
                    </p>
                    <button type="submit" class="btn btn-primary auth-submit-btn">Update password</button>
                    <div class="auth-feedback" id="change-password-feedback"></div>
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

    const form = modal.querySelector('#change-password-form');
    const feedback = modal.querySelector('#change-password-feedback');
    const submitBtn = form.querySelector('.auth-submit-btn');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        feedback.textContent = '';
        feedback.classList.remove('error', 'success');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Updating...';

        const formData = new FormData(form);
        const currentPassword = formData.get('currentPassword');
        const newPassword = formData.get('newPassword');
        const confirmPassword = formData.get('confirmPassword');

        try {
            const { response, data } = await App.apiPost('/auth/change-password', {
                currentPassword,
                newPassword,
                confirmPassword
            });

            if (!response.ok || !data.success) {
                feedback.textContent = data.error || 'Unable to change password.';
                feedback.classList.add('error');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Update password';
                return;
            }

            feedback.textContent = data.message || 'Password updated successfully.';
            feedback.classList.add('success');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Updated';

            setTimeout(() => {
                close();
                // After changing password, take the user to My Profile so they can review/update their settings.
                if (typeof App.navigate === 'function') {
                    App.navigate('profile');
                }
            }, 1200);
        } catch (err) {
            feedback.textContent = err.message || 'Unable to change password.';
            feedback.classList.add('error');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Update password';
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

    // Require a signed-in, verified user so the idea has an author
    if (!App.requireVerifiedAuth || !App.requireVerifiedAuth()) {
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
                    Posting as <strong>${App.authUser?.name || 'Member'}</strong> in <strong>${locName}</strong>.
                </p>
                <form id="post-idea-form" class="auth-form">
                    <label>
                        <span>Title</span>
                        <input 
                            type="text" 
                            name="title" 
                            class="post-idea-title"
                            required 
                            maxlength="140" 
                            placeholder="Short, clear idea title">
                    </label>
                    <label>
                        <span>Description</span>
                        <textarea
                            name="description"
                            rows="6"
                            required
                            placeholder="Describe your idea and why it matters"
                            style="width:100%; background:#000000; color:#3bff3b; border:1px solid #3bff3b; padding:10px; font-size:14px;"
                        ></textarea>
                    </label>
                    <label>
                        <span>Tags (optional, comma-separated)</span>
                        <input type="text" name="tags" placeholder="e.g. healthcare, transit, environment">
                    </label>
                    <button 
                        type="submit" 
                        class="btn btn-primary auth-submit-btn"
                        style="margin-top: 16px; margin-bottom: 16px;"
                    >
                        Post Idea
                    </button>
                    <div class="form-group dev-only" style="margin-top: 12px;">
                        <label>Optional: Add a short voice note (ideas)</label>
                        <div class="voice-note-controls">
                            <button type="button" class="btn btn-secondary btn-sm" id="idea-voice-record">🎙 Record</button>
                            <button type="button" class="btn btn-secondary btn-sm" id="idea-voice-stop" disabled>Stop</button>
                            <button type="button" class="btn btn-link btn-sm" id="idea-voice-clear" disabled>Clear</button>
                        </div>
                        <div class="voice-note-status" id="idea-voice-status"></div>
                        <audio id="idea-voice-audio" controls style="display:none; margin-top:8px; width:100%;"></audio>
                        <p class="form-help" style="margin-top:4px;">
                            Experimental and dev-only: recordings stay in this browser for up to 2 days and are not uploaded yet.
                        </p>
                    </div>
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

    const voiceRecordBtn = modal.querySelector('#idea-voice-record');
    const voiceStopBtn = modal.querySelector('#idea-voice-stop');
    const voiceClearBtn = modal.querySelector('#idea-voice-clear');
    const voiceStatusEl = modal.querySelector('#idea-voice-status');
    const voiceAudioEl = modal.querySelector('#idea-voice-audio');

    const DEFAULT_MAX_VOICE_SECONDS_IDEA = 10;

    function getIdeaMaxVoiceDurationMs() {
        try {
            const raw = localStorage.getItem('devVoiceMaxSeconds');
            const num = raw ? parseInt(raw, 10) : NaN;
            if (Number.isFinite(num) && num > 0 && num <= 60) {
                return num * 1000;
            }
        } catch (e) {
            // ignore
        }
        return DEFAULT_MAX_VOICE_SECONDS_IDEA * 1000;
    }

    let ideaMediaRecorder = null;
    let ideaRecordedChunks = [];
    let ideaVoiceBlob = null;
    let ideaVoiceCreatedAt = null;
    let ideaVoiceTimerId = null;

    function resetIdeaVoiceState() {
        try {
            if (ideaMediaRecorder && ideaMediaRecorder.state !== 'inactive') {
                ideaMediaRecorder.stop();
            }
        } catch (e) {
            // ignore
        }
        ideaMediaRecorder = null;
        ideaRecordedChunks = [];
        ideaVoiceBlob = null;
        ideaVoiceCreatedAt = null;
        if (ideaVoiceTimerId) {
            clearTimeout(ideaVoiceTimerId);
            ideaVoiceTimerId = null;
        }
        if (voiceAudioEl) {
            voiceAudioEl.src = '';
            voiceAudioEl.style.display = 'none';
        }
        if (voiceStatusEl) {
            voiceStatusEl.textContent = '';
        }
        if (voiceRecordBtn) {
            voiceRecordBtn.disabled = false;
        }
        if (voiceStopBtn) {
            voiceStopBtn.disabled = true;
        }
        if (voiceClearBtn) {
            voiceClearBtn.disabled = true;
        }
    }

    function isIdeaVoiceSupported() {
        return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
    }

    if (!isIdeaVoiceSupported() && voiceStatusEl) {
        voiceStatusEl.textContent = 'Voice notes are not supported in this browser.';
    }

    if (isIdeaVoiceSupported() && voiceRecordBtn && voiceStopBtn && voiceClearBtn) {
        voiceRecordBtn.addEventListener('click', async () => {
            if (ideaMediaRecorder && ideaMediaRecorder.state === 'recording') {
                return;
            }
            try {
                resetIdeaVoiceState();
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                const options = {};
                if (window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
                    options.mimeType = 'audio/webm;codecs=opus';
                }
                ideaMediaRecorder = new MediaRecorder(stream, options);
                ideaRecordedChunks = [];
                ideaVoiceCreatedAt = Date.now();

                ideaMediaRecorder.addEventListener('dataavailable', (event) => {
                    if (event.data && event.data.size > 0) {
                        ideaRecordedChunks.push(event.data);
                    }
                });

                ideaMediaRecorder.addEventListener('stop', () => {
                    try {
                        stream.getTracks().forEach((t) => t.stop());
                    } catch (e) {
                        // ignore
                    }
                    if (!ideaRecordedChunks.length) return;
                    ideaVoiceBlob = new Blob(ideaRecordedChunks, { type: 'audio/webm' });
                    const url = URL.createObjectURL(ideaVoiceBlob);
                    if (voiceAudioEl) {
                        voiceAudioEl.src = url;
                        voiceAudioEl.style.display = 'block';
                    }
                    if (voiceStatusEl) {
                        voiceStatusEl.textContent = 'Recorded voice note (dev-only, stored locally for up to 2 days).';
                    }
                    if (voiceClearBtn) {
                        voiceClearBtn.disabled = false;
                    }
                });

                ideaMediaRecorder.start(500);
                if (voiceStatusEl) {
                    const maxSeconds = Math.round(getIdeaMaxVoiceDurationMs() / 1000);
                    voiceStatusEl.textContent = `Recording… (max ${maxSeconds} seconds)`;
                }
                voiceRecordBtn.disabled = true;
                voiceStopBtn.disabled = false;

                ideaVoiceTimerId = setTimeout(() => {
                    try {
                        if (ideaMediaRecorder && ideaMediaRecorder.state === 'recording') {
                            ideaMediaRecorder.stop();
                            if (voiceStatusEl) {
                                const maxSeconds = Math.round(getIdeaMaxVoiceDurationMs() / 1000);
                                voiceStatusEl.textContent = `Recording stopped (${maxSeconds}-second limit reached).`;
                            }
                            voiceRecordBtn.disabled = false;
                            voiceStopBtn.disabled = true;
                        }
                    } finally {
                        if (ideaVoiceTimerId) {
                            clearTimeout(ideaVoiceTimerId);
                            ideaVoiceTimerId = null;
                        }
                    }
                }, getIdeaMaxVoiceDurationMs());
            } catch (err) {
                if (voiceStatusEl) {
                    voiceStatusEl.textContent = err && err.message ? err.message : 'Unable to access microphone.';
                }
            }
        });

        voiceStopBtn.addEventListener('click', () => {
            if (ideaMediaRecorder && ideaMediaRecorder.state === 'recording') {
                try {
                    ideaMediaRecorder.stop();
                } catch (e) {
                    // ignore
                }
                if (voiceStatusEl) {
                    voiceStatusEl.textContent = 'Recording stopped.';
                }
                voiceRecordBtn.disabled = false;
                voiceStopBtn.disabled = true;
                if (ideaVoiceTimerId) {
                    clearTimeout(ideaVoiceTimerId);
                    ideaVoiceTimerId = null;
                }
            }
        });

        voiceClearBtn.addEventListener('click', () => {
            resetIdeaVoiceState();
        });
    }

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
            authorId: App.authUser.id
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

            // Save dev-only voice note locally
            if (ideaVoiceBlob && typeof App.saveIdeaVoiceNote === 'function') {
                App.saveIdeaVoiceNote(id, ideaVoiceBlob, ideaVoiceCreatedAt || Date.now());
                resetIdeaVoiceState();
            }

            // Prefer the creator's own riding/location (from Profile) for browsing,
            // falling back to the currently selected location in the Ideas tree.
            let type = App.browseState.selectedLocationType;
            let idLoc = App.browseState.selectedLocation;
            let nameLoc = App.browseState.selectedLocationName || locName;

            try {
                if (App.authUser && App.authUser.id) {
                    const userDetails = await App.api(`/users/${App.authUser.id}`);
                    const locations = (userDetails && userDetails.locations) || [];
                    if (locations.length) {
                        const priority = [
                            'FirstNation',
                            'ProvincialRiding',
                            'FederalRiding',
                            'Town',
                            'AdhocGroup',
                            'Province',
                            'Country'
                        ];
                        const chosen =
                            priority
                                .map((t) => locations.find((loc) => loc.type === t))
                                .find(Boolean) || locations[0];
                        if (chosen && chosen.id) {
                            const typeMap = {
                                Country: 'countries',
                                Province: 'provinces',
                                FederalRiding: 'federal-ridings',
                                ProvincialRiding: 'provincial-ridings',
                                Town: 'towns',
                                FirstNation: 'first-nations',
                                AdhocGroup: 'adhoc-groups'
                            };
                            const mappedType = typeMap[chosen.type];
                            if (mappedType) {
                                type = mappedType;
                                idLoc = chosen.id;
                                nameLoc = chosen.name || nameLoc;
                            }
                        }
                    }
                }
            } catch (e) {
                // If anything fails here, we just fall back to the existing browse selection.
            }

            // Refresh the ideas list for the chosen location and focus on the new idea
            if (typeof App.onIdeasLocationSelect === 'function' && type && idLoc) {
                await App.onIdeasLocationSelect(type, idLoc, nameLoc, false, id);
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
    
    if (!App.authUser) {
        content.innerHTML = `
            <header class="page-header"><h1 class="page-title">👤 My Profile</h1></header>
            <div class="card"><div class="card-body"><p class="empty-text">Please sign in to view your profile.</p></div></div>
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
            App.api(`/users/${App.authUser.id}`),
            App.api('/conventions'),
            App.api('/locations/provinces'),
            App.api(`/users/${App.authUser.id}/badges`)
        ]);
        
        const activeConv = conventions.find(c => c.status !== 'completed');
        let nominations = [];
        let currentRace = null;
        
        if (activeConv) {
            try {
                const nomData = await App.api(`/conventions/${activeConv.id}/nominations/${App.authUser.id}`);
                nominations = Array.isArray(nomData) ? nomData : (nomData.nominations || []);
                currentRace = nominations.find(n => n.hasAccepted);
            } catch (e) {}
        }
        
        const pendingNominations = nominations.filter(n => !n.hasAccepted);

        // If the user already has one or more locations on their profile,
        // mark basic locations as configured so navigation guards allow
        // access to #members and #ideas without re-blocking.
        try {
            if (Array.isArray(userDetails.locations) && userDetails.locations.length > 0) {
                localStorage.setItem('hasBasicLocations', '1');
            }
        } catch (e) {
            // ignore localStorage issues
        }

        // Decide which tab should be active first. By default it's "locations"
        // so users are encouraged to set their home locations. Other flows can
        // still override this by setting App.profileInitialTab explicitly.
        const initialTab = App.profileInitialTab || 'locations';
        App.profileInitialTab = null;

        const baseUrl = window.location.origin;
        const existingResumeShareUrl = userDetails.resumePublic && userDetails.resumePublicToken
            ? `${baseUrl.replace(/\/$/, '')}/resumes/${userDetails.resumePublicToken}`
            : '';
        
        content.innerHTML = `
            <header class="page-header">
                <h1 class="page-title">👤 My Profile</h1>
                <p class="page-subtitle">Welcome, ${App.authUser.name}</p>
            </header>
            
            <div class="card">
                <div class="card-header">
                    <div class="profile-header">
                        <div class="profile-avatar">${App.getInitials(App.authUser.name)}</div>
                        <div>
                            <h2 class="profile-name">${App.authUser.name}</h2>
                            <p class="profile-region">${userDetails.locations?.length > 0 
                                ? userDetails.locations.map(l => l.name).join(' • ') 
                                : (App.authUser.region || 'No locations set')}</p>
                        </div>
                    </div>
                    ${App.authUser.candidate ? '<span class="badge success">⭐ Candidate</span>' : ''}
                </div>
                <div class="card-body">
                    <p class="profile-bio">${userDetails.bio || 'No bio provided'}</p>
                    <div class="profile-stats">
                        <div class="profile-stat"><span class="profile-stat-value">${userDetails.points || 0}</span><span class="profile-stat-label">Points</span></div>
                        <div class="profile-stat"><span class="profile-stat-value">${userDetails.endorsementCount || 0}</span><span class="profile-stat-label">Endorsements</span></div>
                    </div>

                    <div class="profile-tabs">
                        <button class="profile-tab-button ${initialTab === 'locations' ? 'active' : ''}" data-tab="locations">Locations</button>
                        <button class="profile-tab-button ${initialTab === 'nominations' ? 'active' : ''}" data-tab="nominations">Nominations & Badges</button>
                        <button class="profile-tab-button ${initialTab === 'resume' ? 'active' : ''}" data-tab="resume">Resume</button>
                        <button class="profile-tab-button ${initialTab === 'adhoc-groups' ? 'active' : ''}" data-tab="adhoc-groups">My Ad-hoc Groups</button>
                        <button class="profile-tab-button ${initialTab === 'display' ? 'active' : ''}" data-tab="display">Display</button>
                    </div>

                    <div class="profile-tab-panels">
                        <section class="profile-tab-panel ${initialTab === 'locations' ? 'active' : ''}" data-tab="locations">
                            <div class="location-selector-section">
                                <h4>My Location</h4>
                                <p class="location-help">Set your location to appear in local candidates list and receive nominations for your area.</p>
                                
                                <div class="location-selector-row">
                                    <label>Country</label>
                                    <select id="country-select" class="form-select">
                                        <option value="">-- Select Country --</option>
                                    </select>
                                </div>

                                <div class="location-selector-row">
                                    <label>Province / Territory</label>
                                    <select id="province-select" class="form-select" disabled>
                                        <option value="">-- Select Province --</option>
                                    </select>
                                </div>
                                
                                <div class="location-selector-row">
                                    <label>First Nation</label>
                                    <select id="first-nation-select" class="form-select" disabled><option value="">-- Select First Nation --</option></select>
                                </div>

                                <div class="location-selector-row">
                                    <label>Town</label>
                                    <select id="town-select" class="form-select" disabled><option value="">-- Select Town --</option></select>
                                </div>

                                <div class="location-selector-row">
                                    <label>Federal Riding</label>
                                    <select id="federal-riding-select" class="form-select" disabled><option value="">-- Select Federal Riding --</option></select>
                                </div>
                                
                                <div class="location-selector-row">
                                    <label>Provincial Riding</label>
                                    <select id="provincial-riding-select" class="form-select" disabled><option value="">-- Select Provincial Riding --</option></select>
                                </div>

                                <!-- Ad-hoc Group (AMC, etc.) -->
                                <div class="location-selector-row">
                                    <label>Ad-hoc Groups</label>
                                    <div class="location-field-with-feedback">
                                        <div id="group-feedback" class="location-feedback"></div>
                                        <select id="group-select" class="form-select" multiple disabled>
                                            <option value="">-- Select Group(s) --</option>
                                        </select>
                                        <div class="location-help" style="margin-top: 4px;">
                                            To join a private Ad-hoc Group, type its exact name:
                                        </div>
                                        <div class="location-selector-row" style="margin-top: 4px; grid-template-columns: minmax(0,1fr) auto; gap: 8px;">
                                            <input
                                                id="group-name-input"
                                                class="form-input"
                                                type="text"
                                                placeholder="e.g. Assembly of Manitoba Chiefs"
                                            >
                                            <button type="button" class="btn btn-secondary btn-xs" id="group-name-add-btn">
                                                Add by name
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                
                                <button class="btn btn-primary" id="save-location-btn" disabled style="margin-top: 12px;">Save Locations</button>
                                <div id="location-feedback" class="location-feedback"></div>
                                ${
                                    userDetails.locations && userDetails.locations.length > 0
                                        ? `
                                    <div class="current-locations">
                                        <strong>Current Locations:</strong>
                                        <ul class="locations-list">
                                            ${userDetails.locations
                                                .map(
                                                    (loc) => `
                                                <li>
                                                    ${loc.name} <span class="location-type">(${loc.type})</span>
                                                    <button 
                                                        class="btn btn-secondary btn-xs open-planning-btn"
                                                        data-loc-id="${loc.id}"
                                                        data-loc-type="${loc.type}"
                                                        data-loc-name="${loc.name}"
                                                        title="Open strategic planning for this location"
                                                    >
                                                        📋 Plan
                                                    </button>
                                                </li>
                                            `
                                                )
                                                .join('')}
                                        </ul>
                                    </div>
                                `
                                        : ''
                                }
                            </div>
                        </section>

                        <section class="profile-tab-panel ${initialTab === 'nominations' ? 'active' : ''}" data-tab="nominations">
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
                            ${
                                pendingNominations && pendingNominations.length
                                    ? `
                            <div class="pending-nominations">
                                <h4>Pending Nominations</h4>
                                <ul class="simple-list">
                                    ${pendingNominations
                                        .map(
                                            (n) => `
                                        <li class="simple-list-item">
                                            <span class="simple-list-name">${n.nominatorName || 'Member'}</span>
                                            <span class="simple-list-meta">${n.message || ''}</span>
                                        </li>
                                    `
                                        )
                                        .join('')}
                                </ul>
                            </div>
                            `
                                    : ''
                            }

                            <!-- Nominations Section (Informational) - only visible on Nominations & Badges tab -->
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
                        </section>

                        <section class="profile-tab-panel ${initialTab === 'resume' ? 'active' : ''}" data-tab="resume">
                            <div class="profile-resume-section">
                                <h4>My Resume</h4>
                                <p class="resume-help">
                                    Paste your resume or professional summary below. This helps members understand your background when viewing your profile.
                                </p>
                                <textarea id="profile-resume-input" class="form-textarea" rows="8" placeholder="Paste your resume here...">${userDetails.resume || ''}</textarea>
                                <label class="checkbox-inline">
                                    <input type="checkbox" id="profile-resume-public" ${userDetails.resumePublic ? 'checked' : ''}>
                                    <span>Make my resume visible to anyone with the link</span>
                                </label>
                                <div class="resume-share" id="profile-resume-share">
                                    ${
                                        existingResumeShareUrl
                                            ? `<span class="resume-share-label">Public link:</span> <a href="${existingResumeShareUrl}" target="_blank" rel="noopener">${existingResumeShareUrl}</a>`
                                            : '<span class="resume-share-help">Turn on "Make my resume visible" and save to get a shareable link.</span>'
                                    }
                                </div>
                                <button class="btn btn-primary btn-sm" id="profile-resume-save-btn" style="margin-top: 8px;">Save resume</button>
                                <div id="profile-resume-feedback" class="profile-resume-feedback"></div>
                            </div>
                        </section>

                        <section class="profile-tab-panel" data-tab="adhoc-groups">
                            <div class="location-selector-section">
                                <h4>My Ad-hoc Groups</h4>
                                <p class="location-help">
                                    Ad-hoc Groups are special community groups attached to a province (for example,
                                    “Manitoba Policy Nerds”). When an admin or seed script creates them for your
                                    province, they will appear here and in your Locations tab.
                                </p>

                                <div class="location-selector-row">
                                    <label>Ad-hoc Group</label>
                                    <select id="adhoc-group-select" class="form-select" disabled>
                                        <option value="">-- No groups available yet --</option>
                                    </select>
                                </div>

                                <p class="location-help">
                                    If you need a new Ad-hoc Group for your organization, please contact an admin. The
                                    group’s domain security (e.g., <code>@manitobachiefs.com</code>) can be configured
                                    when the group is created.
                                </p>
                            </div>
                        </section>

                        <section class="profile-tab-panel" data-tab="display">
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
                        </section>
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
        `;
        
        // Wire Create Referendum form in Admin card (reuses shared helper)
        if (typeof App.wireCreateReferendumForm === 'function') {
            App.wireCreateReferendumForm({
                formId: 'create-ref-form-admin',
                feedbackId: 'create-ref-feedback-admin',
                buttonClass: 'admin-btn primary'
            });
        }
        
        // Profile tab handlers
        const tabButtons = document.querySelectorAll('.profile-tab-button');
        const tabPanels = document.querySelectorAll('.profile-tab-panel');

        tabButtons.forEach((btn) => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                tabButtons.forEach((b) => b.classList.toggle('active', b === btn));
                tabPanels.forEach((panel) => {
                    panel.classList.toggle('active', panel.dataset.tab === tab);
                });
            });
        });

        // Resume handlers
        const resumeInput = document.getElementById('profile-resume-input');
        const resumePublicCheckbox = document.getElementById('profile-resume-public');
        const resumeSaveBtn = document.getElementById('profile-resume-save-btn');
        const resumeFeedback = document.getElementById('profile-resume-feedback');
        const resumeShareEl = document.getElementById('profile-resume-share');

        if (resumeSaveBtn && resumeInput && resumeFeedback) {
            resumeSaveBtn.addEventListener('click', async () => {
                resumeFeedback.textContent = '';
                resumeFeedback.classList.remove('error', 'success');
                resumeSaveBtn.disabled = true;
                resumeSaveBtn.textContent = 'Saving...';

                try {
                    const { response, data } = await App.apiPut(`/users/${App.authUser.id}/resume`, {
                        resume: resumeInput.value || '',
                        makePublic: !!(resumePublicCheckbox && resumePublicCheckbox.checked)
                    });

                    if (!response.ok || !data.success) {
                        resumeFeedback.textContent = (data && data.error) || 'Unable to save resume.';
                        resumeFeedback.classList.add('error');
                        resumeSaveBtn.disabled = false;
                        resumeSaveBtn.textContent = 'Save resume';
                        return;
                    }

                    resumeFeedback.textContent = data.message || 'Resume saved.';
                    resumeFeedback.classList.add('success');
                    resumeSaveBtn.disabled = false;
                    resumeSaveBtn.textContent = 'Save resume';

                    if (resumeShareEl) {
                        if (data.shareUrl) {
                            resumeShareEl.innerHTML = `<span class="resume-share-label">Public link:</span> <a href="${data.shareUrl}" target="_blank" rel="noopener">${data.shareUrl}</a>`;
                        } else {
                            resumeShareEl.innerHTML =
                                '<span class="resume-share-help">Turn on "Make my resume visible" and save to get a shareable link.</span>';
                        }
                    }
                } catch (err) {
                    resumeFeedback.textContent = err.message || 'Unable to save resume.';
                    resumeFeedback.classList.add('error');
                    resumeSaveBtn.disabled = false;
                    resumeSaveBtn.textContent = 'Save resume';
                }
            });
        }

        // Map of the user's existing saved locations by type so we can
        // pre-populate the dropdowns when they return to this page.
        const existingLocations = Array.isArray(userDetails.locations)
            ? userDetails.locations
            : [];
        const existingByType = {};
        const existingAdhocGroups = [];
        existingLocations.forEach((loc) => {
            if (!loc || !loc.type || !loc.id) return;
            if (loc.type === 'AdhocGroup') {
                existingAdhocGroups.push(loc);
            } else if (!existingByType[loc.type]) {
                existingByType[loc.type] = loc;
            }
        });
        const existingProvince = existingByType.Province || null;
        const existingFederal = existingByType.FederalRiding || null;
        const existingProvincial = existingByType.ProvincialRiding || null;
        const existingTown = existingByType.Town || null;
        const existingFirstNation = existingByType.FirstNation || null;

        // Location selector handlers
        const countrySelect = document.getElementById('country-select');
        const provinceSelect = document.getElementById('province-select');
        const federalSelect = document.getElementById('federal-riding-select');
        const provincialSelect = document.getElementById('provincial-riding-select');
        const townSelect = document.getElementById('town-select');
        const firstNationSelect = document.getElementById('first-nation-select');
        const groupSelect = document.getElementById('group-select');
        const saveBtn = document.getElementById('save-location-btn');
        const feedback = document.getElementById('location-feedback');
        const groupFeedback = document.getElementById('group-feedback');
        const groupNameInput = document.getElementById('group-name-input');
        const groupNameAddBtn = document.getElementById('group-name-add-btn');

        const adhocGroupSelect = document.getElementById('adhoc-group-select');
        const adhocCreateToggle = document.getElementById('adhoc-create-toggle');
        const adhocCreateContainer = document.getElementById('adhoc-create-container');
        const adhocNameInput = document.getElementById('adhoc-name');
        const adhocDescriptionInput = document.getElementById('adhoc-description');
        const adhocCreateBtn = document.getElementById('adhoc-create-btn');
        const adhocCreateFeedback = document.getElementById('adhoc-create-feedback');
        const adhocDomainContainer = document.getElementById('adhoc-domain-container');
        const adhocDomainInput = document.getElementById('adhoc-domain');
        const adhocDomainSaveBtn = document.getElementById('adhoc-domain-save-btn');
        const adhocDomainFeedback = document.getElementById('adhoc-domain-feedback');
        const adhocDeleteBtn = document.getElementById('adhoc-delete-btn');
        const adhocDeleteFeedback = document.getElementById('adhoc-delete-feedback');

        // Cache of full location hierarchy (Planet -> Country -> Provinces)
        let locationHierarchy = null;

        const loadLocationHierarchy = async () => {
            if (locationHierarchy) return locationHierarchy;
            try {
                const data = await App.api('/locations');
                locationHierarchy = Array.isArray(data) ? data : [];
                return locationHierarchy;
            } catch (err) {
                if (feedback) {
                    feedback.innerHTML =
                        '<span class="error">Unable to load locations right now. Please try again later.</span>';
                }
                locationHierarchy = [];
                return locationHierarchy;
            }
        };
        
        // Helper to populate a dropdown
        const populateDropdown = (select, items, placeholder, type) => {
            if (!select) return;
            let options = `<option value="">${placeholder}</option>`;
            items.forEach(item => {
                options += `<option value="${item.id}" data-type="${type}">${item.name}</option>`;
            });
            select.innerHTML = options;
            select.disabled = items.length === 0;
        };
        
        // Check if any dropdown has a selection
        const hasAnySelection = () => {
            return [provinceSelect, federalSelect, provincialSelect, townSelect, firstNationSelect, groupSelect].some((sel) => {
                if (!sel) return false;
                if (sel === groupSelect && sel.multiple) {
                    return Array.from(sel.selectedOptions || []).some((opt) => opt.value);
                }
                return !!sel.value;
            });
        };

        let currentAdhocGroups = [];

        const updateAdhocSecurityControls = () => {
            if (!adhocGroupSelect) return;

            const selectedId = adhocGroupSelect.value;
            const selected = selectedId && currentAdhocGroups
                ? currentAdhocGroups.find(g => g.id === selectedId)
                : null;

            const isCreator =
                !!selected &&
                !!selected.createdByUserId &&
                window.App &&
                App.authUser &&
                selected.createdByUserId === App.authUser.id;

            const shouldShowDomainControls = !!selected && isCreator;

            if (adhocDeleteFeedback) {
                adhocDeleteFeedback.textContent = '';
                adhocDeleteFeedback.classList.remove('error', 'success');
            }
            if (adhocDomainFeedback) {
                adhocDomainFeedback.textContent = '';
                adhocDomainFeedback.classList.remove('error', 'success');
            }

            if (adhocDomainContainer) {
                adhocDomainContainer.style.display = shouldShowDomainControls ? 'block' : 'none';
            }

            if (adhocDeleteBtn) {
                adhocDeleteBtn.disabled = !isCreator || !selectedId;
            }

            if (adhocDomainInput) {
                if (selected && selected.allowedEmailDomain && isCreator) {
                    adhocDomainInput.value = `@${selected.allowedEmailDomain}`;
                } else if (!selectedId) {
                    adhocDomainInput.value = '';
                }
                adhocDomainInput.disabled = !isCreator || !selectedId;
            }
            if (adhocDomainSaveBtn) {
                adhocDomainSaveBtn.disabled = !isCreator || !selectedId;
            }
        };

        // Initialize Country and Province dropdowns from the full hierarchy
        const initCountriesAndProvince = async () => {
            if (!countrySelect || !provinceSelect) return;

            const hierarchy = await loadLocationHierarchy();
            const countries = hierarchy
                .map((row) => row.country)
                .filter((c) => c && c.id && c.name);

            // Try to infer the user's country from their saved province (if any)
            let inferredCountryId = null;
            if (existingProvince && existingProvince.id) {
                const rowForProvince = hierarchy.find((row) =>
                    Array.isArray(row.provinces) &&
                    row.provinces.some((p) => p && p.id === existingProvince.id)
                );
                if (rowForProvince && rowForProvince.country && rowForProvince.country.id) {
                    inferredCountryId = rowForProvince.country.id;
                }
            }

            populateDropdown(countrySelect, countries, '-- Select Country --', 'Country');

            // Prefer inferred country from existing province; otherwise if there
            // is only one country, preselect it.
            if (inferredCountryId) {
                countrySelect.value = inferredCountryId;
            } else if (countries.length === 1) {
                countrySelect.value = countries[0].id;
            }

            if (countrySelect.value) {
                const selectedCountryId = countrySelect.value;
                const row = hierarchy.find(
                    (r) => r.country && r.country.id === selectedCountryId
                );
                const provinces = row && Array.isArray(row.provinces) ? row.provinces : [];
                populateDropdown(provinceSelect, provinces, '-- Select Province --', 'Province');

                // Preselect the user's existing province (if any) and trigger
                // a change so the child dropdowns hydrate as well.
                if (existingProvince && existingProvince.id) {
                    const match = provinces.find((p) => p.id === existingProvince.id);
                    if (match) {
                        provinceSelect.value = match.id;
                        // Trigger change to load ridings/towns/groups and hydrate them
                        provinceSelect.dispatchEvent(new Event('change'));
                    }
                }
            } else {
                populateDropdown(provinceSelect, [], '-- Select Province --', 'Province');
            }

            // After initialisation, ensure save button state is correct
            if (saveBtn) {
                saveBtn.disabled = !hasAnySelection();
            }
        };

        // Country change - load provinces for that country and reset deeper levels
        countrySelect?.addEventListener('change', async (e) => {
            const countryId = e.target.value;

            // Reset province and deeper selects
            populateDropdown(provinceSelect, [], '-- Select Province --', 'Province');
            [federalSelect, provincialSelect, townSelect, firstNationSelect, groupSelect].forEach((sel) => {
                if (sel) {
                    sel.innerHTML = '<option value="">--</option>';
                    sel.disabled = true;
                }
            });

            if (!countryId) {
                if (adhocGroupSelect) {
                    populateDropdown(adhocGroupSelect, [], '-- Select Group --', 'AdhocGroup');
                }
                currentAdhocGroups = [];
                if (adhocDomainContainer) {
                    adhocDomainContainer.style.display = 'none';
                }
                if (adhocDomainInput) {
                    adhocDomainInput.value = '';
                    adhocDomainInput.disabled = true;
                }
                if (adhocDomainSaveBtn) {
                    adhocDomainSaveBtn.disabled = true;
                }
                if (adhocDeleteBtn) {
                    adhocDeleteBtn.disabled = true;
                }
                if (saveBtn) {
                    saveBtn.disabled = !hasAnySelection();
                }
                return;
            }

            const hierarchy = await loadLocationHierarchy();
            const row = hierarchy.find(
                (r) => r.country && r.country.id === countryId
            );
            const provinces = row && Array.isArray(row.provinces) ? row.provinces : [];
            populateDropdown(provinceSelect, provinces, '-- Select Province --', 'Province');

            if (saveBtn) {
                saveBtn.disabled = !hasAnySelection();
            }
        });

        // Wire "Plan" buttons to open the Planning page for a specific location
        document.querySelectorAll('.open-planning-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-loc-id');
                const type = btn.getAttribute('data-loc-type');
                const name = btn.getAttribute('data-loc-name');
                if (!id || !type) return;

                window.App = window.App || {};
                App.planningState = App.planningState || {};
                App.planningState.pendingLocation = { id, type, name };

                App.navigate('planning');
            });
        });

        // Kick off initial load of countries/provinces for the Locations tab
        initCountriesAndProvince();
        
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
                populateDropdown(groupSelect, [], '-- Select Group(s) --', 'AdhocGroup');
                populateDropdown(adhocGroupSelect, [], '-- Select Group --', 'AdhocGroup');
                currentAdhocGroups = [];
                if (adhocDomainContainer) {
                    adhocDomainContainer.style.display = 'none';
                }
                if (adhocDomainInput) {
                    adhocDomainInput.value = '';
                    adhocDomainInput.disabled = true;
                }
                if (adhocDomainSaveBtn) {
                    adhocDomainSaveBtn.disabled = true;
                }
                if (adhocDeleteBtn) {
                    adhocDeleteBtn.disabled = true;
                }
                if (saveBtn) {
                    saveBtn.disabled = !hasAnySelection();
                }
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
                // If the user already has a federal riding saved and it belongs
                // to this province, preselect it.
                if (existingFederal && existingFederal.id && !federalSelect.value) {
                    const match = federal.find((f) => f.id === existingFederal.id);
                    if (match) {
                        federalSelect.value = match.id;
                    }
                }
                populateDropdown(provincialSelect, provincial, '-- Select Provincial Riding --', 'ProvincialRiding');
                if (existingProvincial && existingProvincial.id && !provincialSelect.value) {
                    const match = provincial.find((p) => p.id === existingProvincial.id);
                    if (match) {
                        provincialSelect.value = match.id;
                    }
                }
                populateDropdown(townSelect, towns, '-- Select Town --', 'Town');
                if (existingTown && existingTown.id && !townSelect.value) {
                    const match = towns.find((t) => t.id === existingTown.id);
                    if (match) {
                        townSelect.value = match.id;
                    }
                }
                populateDropdown(firstNationSelect, firstNations, '-- Select First Nation --', 'FirstNation');
                if (existingFirstNation && existingFirstNation.id && !firstNationSelect.value) {
                    const match = firstNations.find((fn) => fn.id === existingFirstNation.id);
                    if (match) {
                        firstNationSelect.value = match.id;
                    }
                }
                const allGroups = Array.isArray(groups) ? groups : [];
                currentAdhocGroups = allGroups;

                // Only show public (non-domain-restricted) groups in the dropdowns by default.
                const publicGroups = allGroups.filter((g) => !g.allowedEmailDomain);
                populateDropdown(groupSelect, publicGroups, '-- Select Group(s) --', 'AdhocGroup');
                populateDropdown(adhocGroupSelect, publicGroups, '-- Select Group --', 'AdhocGroup');

                // Ensure any groups the user already belongs to are visible and selected,
                // even if they are domain-restricted (hidden from the general public).
                if (Array.isArray(existingAdhocGroups) && existingAdhocGroups.length > 0) {
                    const groupIdsInSelect = groupSelect
                        ? new Set(Array.from(groupSelect.options || []).map((opt) => opt.value))
                        : new Set();

                    existingAdhocGroups.forEach((loc) => {
                        if (!groupSelect || !loc || !loc.id || !loc.name) return;
                        if (!groupIdsInSelect.has(loc.id)) {
                            const opt = document.createElement('option');
                            opt.value = loc.id;
                            opt.textContent = loc.name;
                            opt.selected = true;
                            groupSelect.appendChild(opt);
                            groupIdsInSelect.add(loc.id);
                        } else {
                            // If it already exists, ensure it's selected.
                            const existingOpt = Array.from(groupSelect.options || []).find(
                                (opt) => opt.value === loc.id
                            );
                            if (existingOpt) existingOpt.selected = true;
                        }
                    });

                    // For the single-select in "My Ad-hoc Groups", pick the first membership if none selected.
                    if (adhocGroupSelect && !adhocGroupSelect.value) {
                        const firstMembership = existingAdhocGroups[0];
                        const opt =
                            Array.from(adhocGroupSelect.options || []).find(
                                (o) => o.value === firstMembership.id
                            ) || null;
                        if (opt) {
                            adhocGroupSelect.value = firstMembership.id;
                        } else {
                            // If it's not in the public list, append it so the user can see their membership.
                            const extraOpt = document.createElement('option');
                            extraOpt.value = firstMembership.id;
                            extraOpt.textContent = firstMembership.name;
                            adhocGroupSelect.appendChild(extraOpt);
                            adhocGroupSelect.value = firstMembership.id;
                        }
                    }
                }
                updateAdhocSecurityControls();
                if (saveBtn) {
                    saveBtn.disabled = !hasAnySelection();
                }
            } catch (err) {
                feedback.innerHTML = `<span class="error">Error loading locations</span>`;
                if (saveBtn) {
                    saveBtn.disabled = !hasAnySelection();
                }
            }
        });
        
        // Enable save button when any dropdown changes
        [provinceSelect, federalSelect, provincialSelect, townSelect, firstNationSelect, groupSelect].forEach(sel => {
            sel?.addEventListener('change', () => {
                saveBtn.disabled = !hasAnySelection();
            });
        });

        // Allow joining a hidden / domain-restricted Ad-hoc Group by exact name.
        if (groupNameAddBtn && groupNameInput && groupSelect) {
            const handleAddByName = () => {
                if (groupFeedback) {
                    groupFeedback.innerHTML = '';
                }
                const raw = groupNameInput.value.trim();
                if (!raw) {
                    if (groupFeedback) {
                        groupFeedback.innerHTML =
                            '<span class="error">Please enter the Ad-hoc Group name.</span>';
                    }
                    return;
                }

                const lower = raw.toLowerCase();
                const match =
                    currentAdhocGroups &&
                    currentAdhocGroups.find(
                        (g) => (g.name || '').toLowerCase() === lower
                    );

                if (!match) {
                    if (groupFeedback) {
                        groupFeedback.innerHTML =
                            '<span class="error">No Ad-hoc Group with that exact name was found in this province.</span>';
                    }
                    return;
                }

                // Ensure an option exists for this group and mark it selected.
                let opt = Array.from(groupSelect.options || []).find(
                    (o) => o.value === match.id
                );
                if (!opt) {
                    opt = document.createElement('option');
                    opt.value = match.id;
                    opt.textContent = match.name;
                    opt.selected = true;
                    groupSelect.appendChild(opt);
                } else {
                    opt.selected = true;
                }

                groupNameInput.value = '';

                if (groupFeedback) {
                    groupFeedback.innerHTML =
                        '<span class="success">Group added. Click "Save Locations" to join.</span>';
                }
                if (saveBtn) {
                    saveBtn.disabled = !hasAnySelection();
                }
            };

            groupNameAddBtn.addEventListener('click', handleAddByName);
            groupNameInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddByName();
                }
            });
        }
        
        // Save button - save ALL selected locations
        saveBtn?.addEventListener('click', async () => {
            const locations = [];
            
            if (provinceSelect?.value) {
                locations.push({ id: provinceSelect.value, type: 'Province' });
            }
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
            if (groupSelect && groupSelect.multiple) {
                Array.from(groupSelect.selectedOptions || []).forEach((opt) => {
                    if (!opt.value) return;
                    locations.push({ id: opt.value, type: 'AdhocGroup' });
                });
            } else if (groupSelect?.value) {
                locations.push({ id: groupSelect.value, type: 'AdhocGroup' });
            }
            
            if (locations.length === 0) return;
            
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving...';
            
            try {
                const { response, data } = await App.apiPut(`/users/${App.authUser.id}/locations`, { locations });
                
                // Clear any previous messages
                if (feedback) feedback.innerHTML = '';
                if (groupFeedback) groupFeedback.innerHTML = '';

                if (response.ok) {
                    if (feedback) {
                        feedback.innerHTML = `<span class="success">Saved ${locations.length} location(s)</span>`;
                    }
                    setTimeout(() => App.pages.profile(), 1500);
                } else {
                    const message = (data && data.error) || 'Unable to save locations.';
                    // If this is an Ad-hoc Group domain restriction, show it
                    // immediately above the Group field instead of at the bottom.
                    const isAdhocDomainError =
                        typeof message === 'string' &&
                        message.includes('Ad-hoc Group can only be joined with an approved work email address');

                    if (isAdhocDomainError && groupFeedback) {
                        groupFeedback.innerHTML = `<span class="error">${message}</span>`;
                        groupFeedback.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    } else if (feedback) {
                        feedback.innerHTML = `<span class="error">${message}</span>`;
                        feedback.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }

                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Save Locations';
                }
            } catch (err) {
                if (feedback) {
                    feedback.innerHTML = `<span class="error">Error: ${err.message}</span>`;
                    feedback.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                saveBtn.disabled = false;
                saveBtn.textContent = 'Save Locations';
            }
        });

        // Ad-hoc Group creation + security logic
        if (adhocCreateToggle && adhocCreateContainer && adhocCreateFeedback) {
            adhocCreateToggle.addEventListener('click', () => {
                adhocCreateFeedback.textContent = '';
                adhocCreateFeedback.classList.remove('error', 'success');

                if (!provinceSelect.value) {
                    adhocCreateFeedback.textContent =
                        'Select a Province first in the Locations tab before creating a group.';
                    adhocCreateFeedback.classList.add('error');
                    return;
                }

                const isVisible = adhocCreateContainer.style.display === 'block';
                adhocCreateContainer.style.display = isVisible ? 'none' : 'block';
            });
        }

        if (
            adhocCreateBtn &&
            adhocNameInput &&
            adhocDescriptionInput &&
            adhocCreateFeedback
        ) {
            adhocCreateBtn.addEventListener('click', async () => {
                adhocCreateFeedback.textContent = '';
                adhocCreateFeedback.classList.remove('error', 'success');

                const provinceId = provinceSelect.value;
                if (!provinceId) {
                    adhocCreateFeedback.textContent =
                        'Please select a Province first in the Locations tab before creating a group.';
                    adhocCreateFeedback.classList.add('error');
                    return;
                }

                const name = adhocNameInput.value.trim();
                const description = adhocDescriptionInput.value.trim();

                if (!name) {
                    adhocCreateFeedback.textContent = 'Group name is required.';
                    adhocCreateFeedback.classList.add('error');
                    return;
                }

                adhocCreateBtn.disabled = true;
                adhocCreateBtn.textContent = 'Creating...';

                try {
                    const { response, data } = await App.apiPost('/locations/adhoc-groups', {
                        name,
                        description,
                        provinceId
                    });

                    if (!response.ok) {
                        const msg =
                            (data && data.error) ||
                            'Could not create this Ad-hoc Group right now.';
                        adhocCreateFeedback.textContent = msg;
                        adhocCreateFeedback.classList.add('error');
                    } else {
                        adhocCreateFeedback.textContent = 'Ad-hoc Group created.';
                        adhocCreateFeedback.classList.add('success');

                        // Refresh province children so the new group appears in both dropdowns
                        provinceSelect && provinceSelect.value && provinceSelect.dispatchEvent(new Event('change'));

                        if (adhocGroupSelect && data && data.id) {
                            adhocGroupSelect.value = data.id;
                        }

                        adhocNameInput.value = '';
                        adhocDescriptionInput.value = '';
                        updateAdhocSecurityControls();
                    }
                } catch (err) {
                    adhocCreateFeedback.textContent =
                        err.message || 'Unable to create this Ad-hoc Group.';
                    adhocCreateFeedback.classList.add('error');
                } finally {
                    adhocCreateBtn.disabled = false;
                    adhocCreateBtn.textContent = 'Create group';
                }
            });
        }

        if (adhocGroupSelect) {
            adhocGroupSelect.addEventListener('change', () => {
                updateAdhocSecurityControls();
            });
        }

        if (
            adhocDomainSaveBtn &&
            adhocDomainInput &&
            adhocGroupSelect &&
            adhocDomainFeedback
        ) {
            adhocDomainSaveBtn.addEventListener('click', async () => {
                adhocDomainFeedback.textContent = '';
                adhocDomainFeedback.classList.remove('error', 'success');

                const groupId = adhocGroupSelect.value;
                const selected = currentAdhocGroups.find((g) => g.id === groupId);

                if (!groupId || !selected) {
                    adhocDomainFeedback.textContent = 'Select a group first.';
                    adhocDomainFeedback.classList.add('error');
                    return;
                }

                if (
                    !selected.createdByUserId ||
                    !window.App ||
                    !App.authUser ||
                    selected.createdByUserId !== App.authUser.id
                ) {
                    adhocDomainFeedback.textContent =
                        'Only the creator of this Ad-hoc Group can change its domain rule.';
                    adhocDomainFeedback.classList.add('error');
                    return;
                }

                const raw = adhocDomainInput.value.trim();

                adhocDomainSaveBtn.disabled = true;
                adhocDomainSaveBtn.textContent = 'Saving...';

                try {
                    const { response, data } = await App.apiPut(
                        `/locations/adhoc-groups/${encodeURIComponent(groupId)}/domain`,
                        { allowedEmailDomain: raw }
                    );

                    if (!response.ok) {
                        adhocDomainFeedback.textContent =
                            (data && data.error) ||
                            'Could not save the email domain rule for this group.';
                        adhocDomainFeedback.classList.add('error');
                    } else {
                        adhocDomainFeedback.textContent = 'Email domain rule saved.';
                        adhocDomainFeedback.classList.add('success');

                        const updatedGroup = data || {};
                        currentAdhocGroups = currentAdhocGroups.map((g) =>
                            g.id === updatedGroup.id ? updatedGroup : g
                        );
                        updateAdhocSecurityControls();
                    }
                } catch (err) {
                    adhocDomainFeedback.textContent =
                        err.message || 'Unable to save the email domain rule.';
                    adhocDomainFeedback.classList.add('error');
                } finally {
                    adhocDomainSaveBtn.disabled = false;
                    adhocDomainSaveBtn.textContent = 'Save domain rule';
                }
            });
        }

        if (adhocDeleteBtn && adhocGroupSelect && adhocDeleteFeedback) {
            adhocDeleteBtn.addEventListener('click', async () => {
                adhocDeleteFeedback.textContent = '';
                adhocDeleteFeedback.classList.remove('error', 'success');

                const groupId = adhocGroupSelect.value;
                const provinceId = provinceSelect ? provinceSelect.value : '';

                if (!groupId) {
                    adhocDeleteFeedback.textContent = 'Select a group to delete.';
                    adhocDeleteFeedback.classList.add('error');
                    return;
                }

                const selected = currentAdhocGroups.find((g) => g.id === groupId);
                if (
                    !selected ||
                    !selected.createdByUserId ||
                    !window.App ||
                    !App.authUser ||
                    selected.createdByUserId !== App.authUser.id
                ) {
                    adhocDeleteFeedback.textContent =
                        'You can only delete Ad-hoc Groups that you created.';
                    adhocDeleteFeedback.classList.add('error');
                    return;
                }

                adhocDeleteBtn.disabled = true;
                adhocDeleteBtn.textContent = 'Deleting...';

                try {
                    const response = await fetch(
                        `/api/locations/adhoc-groups/${encodeURIComponent(groupId)}`,
                        {
                            method: 'DELETE',
                            headers: { 'Content-Type': 'application/json' }
                        }
                    );
                    const data = await response.json().catch(() => ({}));

                    if (!response.ok) {
                        adhocDeleteFeedback.textContent =
                            (data && data.error) ||
                            'Could not delete this Ad-hoc Group right now.';
                        adhocDeleteFeedback.classList.add('error');
                    } else {
                        adhocDeleteFeedback.textContent = 'Ad-hoc Group deleted.';
                        adhocDeleteFeedback.classList.add('success');

                        // Refresh groups for this province so the deleted one disappears
                        if (provinceId && provinceSelect) {
                            provinceSelect.dispatchEvent(new Event('change'));
                        }
                        if (adhocGroupSelect) {
                            adhocGroupSelect.value = '';
                        }
                        updateAdhocSecurityControls();
                    }
                } catch (err) {
                    adhocDeleteFeedback.textContent =
                        err.message || 'Unable to delete this Ad-hoc Group.';
                    adhocDeleteFeedback.classList.add('error');
                } finally {
                    adhocDeleteBtn.disabled = false;
                    adhocDeleteBtn.textContent = '🗑 Delete this Ad-hoc Group';
                }
            });
        }

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
        let votes = [];
        if (activeConv) {
            activeRaces = await App.api(`/conventions/${activeConv.id}/races`);
            try {
                votes = await App.api('/votes');
            } catch (e) {
                votes = [];
            }
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
                    <button class="convention-tab" data-tab="voting" onclick="App.switchConventionTab('voting')">
                        🗳️ Convention Voting <span class="tab-badge">${votes.length}</span>
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
                
                <!-- Convention Voting Tab -->
                <div id="convention-tab-voting" class="convention-tab-content" style="display: none;">
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
                    
                    <div class="card" style="margin-top: 16px;">
                        <div class="card-header">
                            <h3 class="card-title">Convention Voting Sessions</h3>
                            <span class="badge">${votes.length} session(s)</span>
                        </div>
                        <div class="card-body">
                            ${
                                !votes.length
                                    ? '<p class="empty-text">No convention-wide votes have been created yet.</p>'
                                    : `
                            <div class="cards-grid">
                                ${votes
                                    .map((vote) => {
                                        let resultHtml = '<div class="badge warning">⏳ Voting in progress</div>';
                                        if (vote.result?.resultData) {
                                            try {
                                                const data = JSON.parse(vote.result.resultData);
                                                if (data.yes !== undefined) {
                                                    resultHtml = `<div class="vote-results">
                                                        <span class="badge success">✓ Yes: ${data.yes}</span>
                                                        <span class="badge danger">✗ No: ${data.no}</span>
                                                        ${
                                                            data.abstain
                                                                ? `<span class="badge">⊘ Abstain: ${data.abstain}</span>`
                                                                : ''
                                                        }
                                                    </div>`;
                                                }
                                            } catch (e) {
                                                // ignore parse errors, keep default badge
                                            }
                                        }
                                        return `
                                            <div class="card">
                                                <div class="card-header">
                                                    <div>
                                                        <span class="event-type" style="background: rgba(0, 212, 170, 0.1); color: var(--accent-primary);">${vote.type || 'vote'}</span>
                                                        <h3 class="card-title">${vote.question}</h3>
                                                    </div>
                                                </div>
                                                ${
                                                    vote.event
                                                        ? `<p class="card-subtitle" style="margin-bottom: 12px;">Part of: ${vote.event.title}</p>`
                                                        : ''
                                                }
                                                <div class="card-body">${resultHtml}</div>
                                            </div>
                                        `;
                                    })
                                    .join('')}
                            </div>
                            `
                            }
                        </div>
                    </div>
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

// ============================================
// STRATEGIC PLANNING PAGE
// ============================================

App.pages.planning = async function() {
    const content = document.getElementById('content');

    // Require signed-in + verified user to actually start/archive plans
    if (!App.requireVerifiedAuth || !App.requireVerifiedAuth()) {
        content.innerHTML = `
            <header class="page-header">
                <h1 class="page-title">📋 Strategic Planning</h1>
            </header>
            <div class="card">
                <div class="card-body">
                    <p class="empty-text">
                        Sign in with a verified account to start or edit Strategic Plans.
                    </p>
                </div>
            </div>
        `;
        return;
    }

    content.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    // Map backend location types -> REST path segments
    const typeToPath = {
        Country: 'countries',
        Province: 'provinces',
        FederalRiding: 'federal-ridings',
        ProvincialRiding: 'provincial-ridings',
        Town: 'towns',
        FirstNation: 'first-nations',
        AdhocGroup: 'adhoc-groups'
    };

    const typeToLabel = {
        Country: 'Country',
        Province: 'Province',
        FederalRiding: 'Federal Riding',
        ProvincialRiding: 'Provincial Riding',
        Town: 'Town',
        FirstNation: 'First Nation',
        AdhocGroup: 'Ad-hoc Group'
    };

    try {
        const effectiveUserId =
            (App.currentUser && App.currentUser.id) || (App.authUser && App.authUser.id);

        if (!effectiveUserId) {
            content.innerHTML = `
                <header class="page-header">
                    <h1 class="page-title">📋 Strategic Planning</h1>
                </header>
                <div class="card">
                    <div class="card-body">
                        <p class="empty-text">
                            Please sign in and set your locations on the <strong>My Profile</strong> page before using Strategic Planning.
                        </p>
                    </div>
                </div>
            `;
            return;
        }

        const userDetails = await App.api(`/users/${effectiveUserId}`);
        const locations = userDetails.locations || [];

        if (!locations.length) {
            content.innerHTML = `
                <header class="page-header">
                    <h1 class="page-title">📋 Strategic Planning</h1>
                </header>
                <div class="card">
                    <div class="card-body">
                        <p class="empty-text">
                            You do not have any locations set yet. Go to <strong>My Profile</strong> and add your
                            First Nation, Federal Riding, Provincial Riding, Town, or Ad-hoc Group to begin planning.
                        </p>
                    </div>
                </div>
            `;
            return;
        }

        // Determine initial selected location (from profile "Plan" button or first location)
        App.planningState = App.planningState || {};
        const pending = App.planningState.pendingLocation;
        if (pending) {
            // Prefer a pending location that matches the user's known locations
            const match = locations.find(
                (loc) => loc.id === pending.id && loc.type === pending.type
            );
            App.planningState.selectedLocation = match || pending;
            delete App.planningState.pendingLocation;
        } else if (!App.planningState.selectedLocation) {
            const first = locations[0];
            App.planningState.selectedLocation = {
                id: first.id,
                type: first.type,
                name: first.name
            };
        }

        const selected = App.planningState.selectedLocation;

        const buildLocationOptions = () =>
            locations
                .map((loc) => {
                    const label = typeToLabel[loc.type] || loc.type || 'Location';
                    const isSelected = selected && selected.id === loc.id && selected.type === loc.type;
                    return `
                        <option 
                            value="${loc.id}" 
                            data-type="${loc.type}"
                            ${isSelected ? 'selected' : ''}
                        >
                            ${loc.name} (${label})
                        </option>
                    `;
                })
                .join('');

        content.innerHTML = `
            <header class="page-header">
                <h1 class="page-title">📋 Strategic Planning</h1>
                <p class="page-subtitle">
                    One active Strategic Plan per location. Start a plan for any of your locations
                    (Country, Province, First Nation, Federal, Provincial, Town, or Ad-hoc group).
                </p>
            </header>

            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">Select Location</h3>
                </div>
                <div class="card-body">
                    <div class="location-selector-row">
                        <label for="planning-location-select">My locations</label>
                        <select id="planning-location-select" class="form-select">
                            ${buildLocationOptions()}
                        </select>
                    </div>
                    <p class="location-help" id="planning-location-help"></p>
                </div>
            </div>

            <div id="planning-session-container">
                <div class="card">
                    <div class="card-body">
                        <div class="loading"><div class="spinner"></div></div>
                    </div>
                </div>
            </div>
        `;

        const selectEl = document.getElementById('planning-location-select');
        const helpEl = document.getElementById('planning-location-help');
        const sessionContainer = document.getElementById('planning-session-container');

        const loadForCurrentSelection = async () => {
            const selectedOption = selectEl.options[selectEl.selectedIndex];
            if (!selectedOption) return;

            const locId = selectedOption.value;
            const locType = selectedOption.getAttribute('data-type');
            const locName = selectedOption.textContent.trim();

            App.planningState.selectedLocation = { id: locId, type: locType, name: locName };

            const pathSegment = typeToPath[locType];
            if (!pathSegment) {
                sessionContainer.innerHTML = `
                    <div class="card">
                        <div class="card-body">
                            <p class="empty-text">Planning is not yet supported for this location type (${locType}).</p>
                        </div>
                    </div>
                `;
                return;
            }

            if (helpEl) {
                const label = typeToLabel[locType] || locType;
                helpEl.textContent = `Planning for: ${locName} – ${label}. Only one active Strategic Plan can exist for this location at a time.`;
            }

            sessionContainer.innerHTML = `
                <div class="card">
                    <div class="card-body">
                        <div class="loading"><div class="spinner"></div></div>
                    </div>
                </div>
            `;

            try {
                const [activeSession, history] = await Promise.all([
                    App.api(
                        `/strategic-sessions/location/${pathSegment}/${encodeURIComponent(
                            locId
                        )}/active`
                    ),
                    App.api(
                        `/strategic-sessions/location/${pathSegment}/${encodeURIComponent(
                            locId
                        )}/history?limit=10`
                    )
                ]);

                let participation = null;
                if (activeSession && App.authUser) {
                    try {
                        participation = await App.api(
                            `/strategic-sessions/${encodeURIComponent(
                                activeSession.id
                            )}/participation`
                        );
                    } catch (e) {
                        participation = null;
                    }
                }

                const historyItems = (history || [])
                    .map(
                        (s) => `
                        <li>
                            <strong>${s.title || 'Strategic Plan'}</strong>
                            <span class="location-type">(${s.status || 'archived'})</span>
                            ${s.createdAt ? ` – started ${App.formatDate(s.createdAt)}` : ''}
                        </li>
                    `
                    )
                    .join('');

                const buildPlanTimeline = (session) => {
                    if (!session || !session.createdAt) return '';
                    const start = new Date(session.createdAt);
                    const now = new Date();
                    let end = now;
                    if (session.status === 'completed' || session.status === 'archived') {
                        if (session.archivedAt) {
                            end = new Date(session.archivedAt);
                        } else if (session.updatedAt) {
                            end = new Date(session.updatedAt);
                        }
                    }
                    const spanMs = Math.max(end - start, 1);

                    const markers = [];
                    const addMarker = (label, dateStr, kind) => {
                        if (!dateStr) return;
                        const d = new Date(dateStr);
                        if (isNaN(d.getTime())) return;
                        const pct = Math.min(100, Math.max(0, ((d - start) / spanMs) * 100));
                        markers.push({ label, dateStr, kind, pct });
                    };

                    // Goals and actions act as simple milestones
                    (session.goals || []).forEach((g) => {
                        addMarker(g.title || 'Goal', g.dueDate || g.createdAt, 'goal');
                    });
                    (session.actions || []).forEach((a) => {
                        addMarker(a.description || 'Action', a.dueDate || a.createdAt, 'action');
                    });

                    const startLabel = App.formatDate(session.createdAt);
                    const endLabel =
                        session.status === 'completed' || session.status === 'archived'
                            ? App.formatDate(end.toISOString())
                            : 'Now';

                    const markersHtml = markers
                        .map(
                            (m) => `
                        <div class="plan-timeline-marker plan-timeline-marker-${m.kind}" style="left:${m.pct}%;">
                            <div class="plan-timeline-dot"></div>
                            <div class="plan-timeline-tooltip">
                                <strong>${m.label}</strong><br>
                                <span>${App.formatDate(m.dateStr)}</span>
                            </div>
                        </div>
                    `
                        )
                        .join('');

                    return `
                        <div class="plan-timeline">
                            <div class="plan-timeline-header">Timeline</div>
                            <p class="location-help" style="margin-top:4px;">
                                Started ${startLabel}${
                                    session.status === 'completed' || session.status === 'archived'
                                        ? ` • Completed ${endLabel}`
                                        : ' • In progress'
                                }
                            </p>
                            <div class="plan-timeline-bar">
                                <div class="plan-timeline-track"></div>
                                <div class="plan-timeline-endcap plan-timeline-start"></div>
                                <div class="plan-timeline-endcap plan-timeline-end"></div>
                                <div class="plan-timeline-label plan-timeline-label-start">${startLabel}</div>
                                <div class="plan-timeline-label plan-timeline-label-end">${endLabel}</div>
                                ${markersHtml}
                            </div>
                        </div>
                    `;
                };

                if (activeSession) {
                    const isAdmin = App.authUser && App.authUser.role === 'admin';

                    const rawStatus = activeSession.status || 'draft';
                    const stageLabels = {
                        draft: 'Draft',
                        discussion: 'Discussion',
                        decision: 'Decision',
                        review: 'Review',
                        completed: 'Completed',
                        archived: 'Archived'
                    };
                    const stageDescriptions = {
                        draft: 'Gather ideas, issues, and rough goals.',
                        discussion: 'Discuss, refine, and prioritize issues and options.',
                        decision: 'Turn priorities into specific decisions and actions.',
                        review: 'Look back at what worked and what needs adjustment.',
                        completed: 'This plan has been fully worked through (ready to archive when no longer current).'
                    };
                    const orderedStages = ['draft', 'discussion', 'decision', 'review', 'completed'];
                    const currentIndex = orderedStages.indexOf(rawStatus);
                    const stageLabel = stageLabels[rawStatus] || 'Draft';
                    const stageDescription = stageDescriptions[rawStatus] || '';

                    sessionContainer.innerHTML = `
                        <div class="card">
                            <div class="card-header">
                                <h3 class="card-title">Active Strategic Plan</h3>
                                <span class="badge success">${stageLabel}</span>
                            </div>
                            <div class="card-body">
                                <div class="form-group">
                                    <label>Stage</label>
                                    <div class="plan-stage-indicator">
                                        <div class="plan-stage-steps">
                                            ${orderedStages
                                                .map((stage, idx) => {
                                                    const reached =
                                                        currentIndex === -1 ? idx === 0 : idx <= currentIndex;
                                                    return `
                                                <div class="plan-stage-step ${reached ? 'reached' : ''}">
                                                    <div class="plan-stage-dot"></div>
                                                    <div class="plan-stage-label">${stageLabels[stage]}</div>
                                                </div>
                                            `;
                                                })
                                                .join('')}
                                        </div>
                                        <p class="location-help" style="margin-top: 8px;">
                                            ${stageDescription || ''}
                                        </p>
                                        <p class="location-help" id="planning-stage-countdown" style="margin-top: 4px;"></p>
                                    </div>
                                </div>
                                ${buildPlanTimeline(activeSession)}
                                <div class="plan-participants-block">
                                    <p class="location-help">
                                        <strong>${activeSession.participantCount || 0}</strong> participant(s) have contributed to this plan so far.
                                        ${
                                            rawStatus === 'completed'
                                                ? activeSession.revealedParticipants &&
                                                  activeSession.revealedParticipants.length
                                                    ? `<br>These members chose to show their names on the completed plan: ${activeSession.revealedParticipants
                                                          .map((p) => p.name)
                                                          .join(', ')}.`
                                                    : '<br>No one has chosen to reveal their name yet. All participation remains anonymous.'
                                                : '<br>All participation is anonymous while the plan is in progress.'
                                        }
                                    </p>
                                    ${
                                        rawStatus === 'completed' &&
                                        participation &&
                                        participation.participated
                                            ? participation.revealed
                                                ? `
                                        <p class="location-help" style="margin-top: 4px;">
                                            You are currently shown by name on this completed plan.
                                        </p>
                                        <button class="btn btn-secondary btn-sm" id="planning-hide-identity-btn">
                                            Hide my name on this plan
                                        </button>
                                    `
                                                : `
                                        <p class="location-help" style="margin-top: 4px;">
                                            You currently appear as anonymous on this completed plan. You can choose to reveal your name.
                                        </p>
                                        <button class="btn btn-primary btn-sm" id="planning-reveal-identity-btn">
                                            Reveal my name on this plan
                                        </button>
                                    `
                                            : ''
                                    }
                                </div>
                                <div class="form-group">
                                    <label>Title</label>
                                    <input 
                                        type="text" 
                                        id="planning-title-input" 
                                        class="form-input" 
                                        value="${activeSession.title || 'Strategic Plan'}"
                                        ${!isAdmin ? 'readonly' : ''}
                                    >
                                </div>
                                <div class="form-group">
                                    <label>Vision / Purpose</label>
                                    <textarea 
                                        id="planning-vision-input" 
                                        class="form-input" 
                                        rows="5"
                                        placeholder="Why does this riding/location exist? What are you trying to achieve together?"
                                        ${!isAdmin ? 'readonly' : ''}
                                    >${activeSession.vision || ''}</textarea>
                                </div>
                                ${
                                    isAdmin
                                        ? `
                                <div class="form-actions" style="display:flex; gap:8px; flex-wrap:wrap;">
                                    <button class="btn btn-primary" id="planning-save-btn">Save</button>
                                    <button class="btn btn-secondary" id="planning-refresh-btn">Refresh</button>
                                    <button class="btn btn-secondary" id="planning-advance-stage-btn"${
                                        rawStatus === 'completed' ? ' disabled' : ''
                                    }>Advance Stage</button>
                                    <button class="btn btn-secondary" id="planning-export-btn">Export / Print</button>
                                    <button class="btn btn-danger" id="planning-archive-btn">Archive Plan</button>
                                </div>
                                <p class="location-help" style="margin-top: 8px;">
                                    You are an admin, so you can edit the title or vision and archive this plan. Other members
                                    from this riding can still participate in the planning process.
                                </p>
                                `
                                        : `
                                <p class="location-help" style="margin-top: 8px;">
                                    This Strategic Plan is managed by admins. You can view it here; only admins can edit or
                                    archive the plan itself. All contributions remain anonymous unless a member chooses to
                                    reveal their name after the plan is completed.
                                </p>
                                `
                                }
                                <div id="planning-feedback" class="form-feedback" style="margin-top:8px;"></div>
                            </div>
                        </div>

                        <div class="card">
                            <div class="card-header">
                                <h3 class="card-title">Preparation: SWOT Analysis</h3>
                            </div>
                            <div class="card-body">
                                <p class="location-help" style="margin-bottom: 8px;">
                                    SWOT stands for <strong>Strengths</strong>, <strong>Weaknesses</strong>, <strong>Opportunities</strong>, and <strong>Threats</strong>.
                                    Use this section to scan what is going well, what is hard, and what external trends might help or hurt your riding.
                                </p>
                                <div class="swot-grid">
                                    <div class="form-group">
                                        <label>Strengths</label>
                                        <textarea id="planning-swot-strengths" class="form-input" rows="3" placeholder="What are this riding’s strengths? One per line.">${
                                            (activeSession.swot?.strengths || []).join('\n')
                                        }</textarea>
                                    </div>
                                    <div class="form-group">
                                        <label>Weaknesses</label>
                                        <textarea id="planning-swot-weaknesses" class="form-input" rows="3" placeholder="Where is this riding struggling? One per line.">${
                                            (activeSession.swot?.weaknesses || []).join('\n')
                                        }</textarea>
                                    </div>
                                    <div class="form-group">
                                        <label>Opportunities</label>
                                        <textarea id="planning-swot-opportunities" class="form-input" rows="3" placeholder="What external opportunities could help? One per line.">${
                                            (activeSession.swot?.opportunities || []).join('\n')
                                        }</textarea>
                                    </div>
                                    <div class="form-group">
                                        <label>Threats</label>
                                        <textarea id="planning-swot-threats" class="form-input" rows="3" placeholder="What external risks could hurt? One per line.">${
                                            (activeSession.swot?.threats || []).join('\n')
                                        }</textarea>
                                    </div>
                                </div>
                                <button class="btn btn-secondary" id="planning-swot-save-btn" style="margin-top: 8px;">Save SWOT</button>
                            </div>
                        </div>

                        <div class="card">
                            <div class="card-header">
                                <h3 class="card-title">Preparation: PEST Scan</h3>
                            </div>
                            <div class="card-body">
                                <p class="location-help" style="margin-bottom: 8px;">
                                    PEST stands for <strong>Political</strong>, <strong>Economic</strong>, <strong>Social</strong>, and <strong>Technological</strong> factors.
                                    Capture key trends or changes in each area that could affect this riding’s future.
                                </p>
                                <div class="swot-grid">
                                    <div class="form-group">
                                        <label>Political</label>
                                        <textarea id="planning-pest-political" class="form-input" rows="3" placeholder="Laws, policies, elections, government changes… One per line.">${
                                            (activeSession.pest?.political || []).join('\n')
                                        }</textarea>
                                    </div>
                                    <div class="form-group">
                                        <label>Economic</label>
                                        <textarea id="planning-pest-economic" class="form-input" rows="3" placeholder="Jobs, income, businesses, prices… One per line.">${
                                            (activeSession.pest?.economic || []).join('\n')
                                        }</textarea>
                                    </div>
                                    <div class="form-group">
                                        <label>Social</label>
                                        <textarea id="planning-pest-social" class="form-input" rows="3" placeholder="Demographics, culture, community issues… One per line.">${
                                            (activeSession.pest?.social || []).join('\n')
                                        }</textarea>
                                    </div>
                                    <div class="form-group">
                                        <label>Technological</label>
                                        <textarea id="planning-pest-technological" class="form-input" rows="3" placeholder="Internet, tools, infrastructure, innovation… One per line.">${
                                            (activeSession.pest?.technological || []).join('\n')
                                        }</textarea>
                                    </div>
                                </div>
                                <button class="btn btn-secondary" id="planning-pest-save-btn" style="margin-top: 8px;">Save PEST</button>
                            </div>
                        </div>

                        <div class="card">
                            <div class="card-header">
                                <h3 class="card-title">Issues / Priorities</h3>
                            </div>
                            <div class="card-body">
                                <form id="planning-issue-form" class="stacked-form">
                                    <div class="form-group">
                                        <label>New Issue or Priority</label>
                                        <input type="text" id="planning-issue-title" class="form-input" placeholder="e.g., Housing affordability, clean water access">
                                    </div>
                                    <div class="form-group">
                                        <label>Details (optional)</label>
                                        <textarea id="planning-issue-description" class="form-input" rows="2" placeholder="Add context so others understand this priority."></textarea>
                                    </div>
                                    <button type="submit" class="btn btn-secondary">Add Issue</button>
                                </form>
                                <div id="planning-issues-list" class="simple-list" style="margin-top: 12px;">
                                    ${
                                        activeSession.issues && activeSession.issues.length
                                            ? activeSession.issues
                                                  .map(
                                                      (issue) => `
                                        <div class="simple-list-item" data-issue-id="${issue.id}">
                                            <div class="simple-list-main">
                                                <div class="simple-list-name">${issue.title}</div>
                                                ${
                                                    issue.description
                                                        ? `<div class="simple-list-meta">${issue.description}</div>`
                                                        : ''
                                                }
                                            </div>
                                            <div class="simple-list-meta">
                                                <button class="btn btn-ghost btn-xs planning-issue-vote-btn" data-issue-id="${issue.id}">👍 Support</button>
                                                <span class="badge">${issue.votes || 0} supports</span>
                                            </div>
                                        </div>
                                    `
                                                  )
                                                  .join('')
                                            : '<p class="empty-text">No issues added yet. Start by adding your first priority.</p>'
                                    }
                                </div>
                            </div>
                        </div>

                        <div class="card">
                            <div class="card-header">
                                <h3 class="card-title">Discussion</h3>
                            </div>
                            <div class="card-body">
                                <form id="planning-comment-form" class="stacked-form">
                                    <div class="form-group">
                                        <label>Share a thought (anonymous)</label>
                                        <textarea id="planning-comment-text" class="form-input" rows="2" placeholder="What should this riding keep in mind?"></textarea>
                                    </div>
                                    <button type="submit" class="btn btn-secondary">Post Comment</button>
                                </form>
                                <div id="planning-comments-list" class="simple-list" style="margin-top: 12px;">
                                    ${
                                        activeSession.comments && activeSession.comments.length
                                            ? activeSession.comments
                                                  .slice()
                                                  .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                                                  .map(
                                                      (comment) => `
                                        <div class="simple-list-item">
                                            <div class="simple-list-name">Member</div>
                                            <div class="simple-list-meta">
                                                ${comment.text}
                                                ${
                                                    comment.createdAt
                                                        ? `<span class="location-type" style="margin-left: 6px;">(${App.formatDate(
                                                              comment.createdAt
                                                          )})</span>`
                                                        : ''
                                                }
                                            </div>
                                        </div>
                                    `
                                                  )
                                                  .join('')
                                            : '<p class="empty-text">No comments yet. Be the first to share a thought.</p>'
                                    }
                                </div>
                            </div>
                        </div>

                        <div class="card">
                            <div class="card-header">
                                <h3 class="card-title">Goals & Objectives</h3>
                            </div>
                            <div class="card-body">
                                <p class="location-help" style="margin-bottom: 8px;">
                                    Goals turn your priorities into specific outcomes. Try to make them SMART:
                                    <strong>Specific</strong>, <strong>Measurable</strong>, <strong>Achievable</strong>,
                                    <strong>Relevant</strong>, and <strong>Time-bound</strong>.
                                </p>
                                <form id="planning-goal-form" class="stacked-form">
                                    <div class="form-group">
                                        <label>Goal title</label>
                                        <input type="text" id="planning-goal-title" class="form-input" placeholder="e.g., Increase voter turnout in this riding">
                                    </div>
                                    <div class="form-group">
                                        <label>Details (optional)</label>
                                        <textarea id="planning-goal-description" class="form-input" rows="2" placeholder="How will you achieve this goal? Who is involved?"></textarea>
                                    </div>
                                    <div class="form-group">
                                        <label>How will you measure success? (optional)</label>
                                        <input type="text" id="planning-goal-metric" class="form-input" placeholder="e.g., % turnout, number of attendees, etc.">
                                    </div>
                                    <div class="form-group">
                                        <label>Target date (optional)</label>
                                        <input type="date" id="planning-goal-date" class="form-input">
                                    </div>
                                    <button type="submit" class="btn btn-secondary">Add Goal</button>
                                </form>
                                <div id="planning-goals-list" class="simple-list" style="margin-top: 12px;">
                                    ${
                                        activeSession.goals && activeSession.goals.length
                                            ? activeSession.goals
                                                  .map(
                                                      (goal) => `
                                        <div class="simple-list-item">
                                            <div class="simple-list-main">
                                                <div class="simple-list-name">${goal.title}</div>
                                                ${
                                                    goal.description
                                                        ? `<div class="simple-list-meta">${goal.description}</div>`
                                                        : ''
                                                }
                                                <div class="simple-list-meta">
                                                    ${
                                                        goal.metric
                                                            ? `Measure: ${goal.metric}`
                                                            : ''
                                                    }
                                                    ${
                                                        goal.dueDate
                                                            ? ` ${
                                                                  goal.metric ? '• ' : ''
                                                              }Target: ${App.formatDate(goal.dueDate)}`
                                                            : ''
                                                    }
                                                </div>
                                            </div>
                                        </div>
                                    `
                                                  )
                                                  .join('')
                                            : '<p class="empty-text">No goals yet. Turn your top priorities into 2–5 clear goals for this plan.</p>'
                                    }
                                </div>
                                ${
                                    activeSession.goals && activeSession.goals.length
                                        ? `
                                <div class="form-group" style="margin-top: 16px;">
                                    <label>Update goal progress</label>
                                    <p class="location-help" style="margin-bottom: 4px;">
                                        Choose a goal and record its current status and any measurement so your riding can see how things are going.
                                    </p>
                                    <div class="goal-progress-row">
                                        <select id="planning-goal-progress-select" class="form-select">
                                            ${activeSession.goals
                                                .map(
                                                    (g) => `
                                                <option value="${g.id}">
                                                    ${g.title}
                                                </option>
                                            `
                                                )
                                                .join('')}
                                        </select>
                                        <select id="planning-goal-status" class="form-select">
                                            <option value="not_started">Not started</option>
                                            <option value="on_track">On track</option>
                                            <option value="at_risk">At risk</option>
                                            <option value="off_track">Off track</option>
                                            <option value="completed">Completed</option>
                                        </select>
                                    </div>
                                    <div class="form-group" style="margin-top: 8px;">
                                        <label>Current value or note (optional)</label>
                                        <input type="text" id="planning-goal-current" class="form-input" placeholder="e.g., 45% turnout so far, 120 people reached, etc.">
                                    </div>
                                    <button class="btn btn-secondary" id="planning-goal-progress-save-btn" style="margin-top: 4px;">Save progress</button>
                                </div>
                                `
                                        : ''
                                }
                            </div>
                        </div>

                        <div class="card">
                            <div class="card-header">
                                <h3 class="card-title">Decisions / Actions</h3>
                            </div>
                            <div class="card-body">
                                <form id="planning-action-form" class="stacked-form">
                                    <div class="form-group">
                                        <label>Proposed Action</label>
                                        <input type="text" id="planning-action-description" class="form-input" placeholder="e.g., Host a town hall on clean water in March">
                                    </div>
                                    <div class="form-group">
                                        <label>Target Date (optional)</label>
                                        <input type="date" id="planning-action-date" class="form-input">
                                    </div>
                                    <button type="submit" class="btn btn-secondary">Add Action</button>
                                </form>
                                <div id="planning-actions-list" class="simple-list" style="margin-top: 12px;">
                                    ${
                                        activeSession.actions && activeSession.actions.length
                                            ? activeSession.actions
                                                  .map(
                                                      (action) => `
                                        <div class="simple-list-item">
                                            <div class="simple-list-main">
                                                <div class="simple-list-name">${action.description}</div>
                                                <div class="simple-list-meta">
                                                    Status: ${action.status || 'proposed'}
                                                    ${
                                                        action.dueDate
                                                            ? ` • Target: ${App.formatDate(action.dueDate)}`
                                                            : ''
                                                    }
                                                </div>
                                            </div>
                                        </div>
                                    `
                                                  )
                                                  .join('')
                                            : '<p class="empty-text">No actions defined yet. Turn decisions into concrete next steps here.</p>'
                                    }
                                </div>
                            </div>
                        </div>

                        <div class="card">
                            <div class="card-header">
                                <h3 class="card-title">Review & Lessons Learned</h3>
                            </div>
                            <div class="card-body">
                                <p class="location-help" style="margin-bottom: 8px;">
                                    In this final phase, reflect on what happened during this planning cycle. This helps future plans
                                    get smarter over time.
                                </p>
                                <div class="form-group">
                                    <label>What worked well?</label>
                                    <textarea id="planning-review-worked" class="form-input" rows="3" placeholder="Strategies, actions, or habits that helped this riding.">${
                                        activeSession.review?.worked || ''
                                    }</textarea>
                                </div>
                                <div class="form-group">
                                    <label>What didn’t work or was hard?</label>
                                    <textarea id="planning-review-didnt" class="form-input" rows="3" placeholder="Challenges, blockers, or things you’d avoid next time.">${
                                        activeSession.review?.didnt || ''
                                    }</textarea>
                                </div>
                                <div class="form-group">
                                    <label>What should we change for the next plan?</label>
                                    <textarea id="planning-review-changes" class="form-input" rows="3" placeholder="Improvements for the next Strategic Plan cycle.">${
                                        activeSession.review?.changes || ''
                                    }</textarea>
                                </div>
                                <button class="btn btn-secondary" id="planning-review-save-btn">Save Review</button>
                            </div>
                        </div>

                        <div class="card">
                            <div class="card-header">
                                <h3 class="card-title">Past Plans</h3>
                            </div>
                            <div class="card-body">
                                ${
                                    history && history.length
                                        ? `<ul class="locations-list">${historyItems}</ul>`
                                        : '<p class="empty-text">No archived plans yet for this location.</p>'
                                }
                            </div>
                        </div>
                    `;

                    const saveBtn = document.getElementById('planning-save-btn');
                    const refreshBtn = document.getElementById('planning-refresh-btn');
                    const archiveBtn = document.getElementById('planning-archive-btn');
                    const exportBtn = document.getElementById('planning-export-btn');
                    const titleInput = document.getElementById('planning-title-input');
                    const visionInput = document.getElementById('planning-vision-input');
                    const feedbackEl = document.getElementById('planning-feedback');
                    const swotStrengthsInput = document.getElementById('planning-swot-strengths');
                    const swotWeaknessesInput = document.getElementById('planning-swot-weaknesses');
                    const swotOpportunitiesInput = document.getElementById('planning-swot-opportunities');
                    const swotThreatsInput = document.getElementById('planning-swot-threats');
                    const swotSaveBtn = document.getElementById('planning-swot-save-btn');
                    const pestPoliticalInput = document.getElementById('planning-pest-political');
                    const pestEconomicInput = document.getElementById('planning-pest-economic');
                    const pestSocialInput = document.getElementById('planning-pest-social');
                    const pestTechnologicalInput = document.getElementById('planning-pest-technological');
                    const pestSaveBtn = document.getElementById('planning-pest-save-btn');
                    const revealBtn = document.getElementById('planning-reveal-identity-btn');
                    const hideBtn = document.getElementById('planning-hide-identity-btn');

                    if (revealBtn) {
                        revealBtn.addEventListener('click', async () => {
                            try {
                                await App.apiPost(
                                    `/strategic-sessions/${encodeURIComponent(
                                        activeSession.id
                                    )}/reveal`,
                                    { reveal: true }
                                );
                                await loadForCurrentSelection();
                            } catch (err) {
                                alert(err.message || 'Unable to update visibility.');
                            }
                        });
                    }

                    if (hideBtn) {
                        hideBtn.addEventListener('click', async () => {
                            try {
                                await App.apiPost(
                                    `/strategic-sessions/${encodeURIComponent(
                                        activeSession.id
                                    )}/reveal`,
                                    { reveal: false }
                                );
                                await loadForCurrentSelection();
                            } catch (err) {
                                alert(err.message || 'Unable to update visibility.');
                            }
                        });
                    }
                    const advanceStageBtn = document.getElementById('planning-advance-stage-btn');
                    const issueForm = document.getElementById('planning-issue-form');
                    const issueTitleInput = document.getElementById('planning-issue-title');
                    const issueDescInput = document.getElementById('planning-issue-description');
                    const issuesList = document.getElementById('planning-issues-list');
                    const commentForm = document.getElementById('planning-comment-form');
                    const commentTextInput = document.getElementById('planning-comment-text');
                    const commentsList = document.getElementById('planning-comments-list');
                    const actionForm = document.getElementById('planning-action-form');
                    const actionDescInput = document.getElementById('planning-action-description');
                    const actionDateInput = document.getElementById('planning-action-date');
                    const actionsList = document.getElementById('planning-actions-list');
                    const goalForm = document.getElementById('planning-goal-form');
                    const goalTitleInput = document.getElementById('planning-goal-title');
                    const goalDescInput = document.getElementById('planning-goal-description');
                    const goalMetricInput = document.getElementById('planning-goal-metric');
                    const goalDateInput = document.getElementById('planning-goal-date');
                    const goalsList = document.getElementById('planning-goals-list');
                    const goalProgressSelect = document.getElementById('planning-goal-progress-select');
                    const goalStatusSelect = document.getElementById('planning-goal-status');
                    const goalCurrentInput = document.getElementById('planning-goal-current');
                    const goalProgressSaveBtn = document.getElementById('planning-goal-progress-save-btn');
                    const reviewWorkedInput = document.getElementById('planning-review-worked');
                    const reviewDidntInput = document.getElementById('planning-review-didnt');
                    const reviewChangesInput = document.getElementById('planning-review-changes');
                    const reviewSaveBtn = document.getElementById('planning-review-save-btn');

                    if (saveBtn && isAdmin) {
                        saveBtn.addEventListener('click', async () => {
                            if (!App.requireVerifiedAuth || !App.requireVerifiedAuth()) return;
                            feedbackEl.textContent = '';
                            saveBtn.disabled = true;
                            saveBtn.textContent = 'Saving...';
                            try {
                                const { response, data } = await App.apiPut(
                                    `/strategic-sessions/${encodeURIComponent(activeSession.id)}`,
                                    {
                                        title: titleInput.value.trim(),
                                        vision: visionInput.value.trim()
                                    }
                                );
                                if (!response.ok) {
                                    feedbackEl.textContent = data.error || 'Could not save session.';
                                    feedbackEl.classList.add('error');
                                } else {
                                    feedbackEl.textContent = 'Saved.';
                                    feedbackEl.classList.remove('error');
                                    feedbackEl.classList.add('success');
                                }
                            } catch (err) {
                                feedbackEl.textContent = err.message;
                                feedbackEl.classList.add('error');
                            } finally {
                                saveBtn.disabled = false;
                                saveBtn.textContent = 'Save';
                            }
                        });
                    }

                    if (refreshBtn) {
                        refreshBtn.addEventListener('click', () => {
                            loadForCurrentSelection();
                        });
                    }

                    if (archiveBtn && isAdmin) {
                        archiveBtn.addEventListener('click', async () => {
                            if (!App.requireVerifiedAuth || !App.requireVerifiedAuth()) return;
                            if (
                                !confirm(
                                    'Archive this Strategic Plan? You will still be able to view it in history, and you can start a new plan later.'
                                )
                            ) {
                                return;
                            }
                            const feedback = document.getElementById('planning-feedback');
                            if (feedback) {
                                feedback.textContent = 'Archiving...';
                                feedback.classList.remove('error', 'success');
                            }
                            try {
                                const { response, data } = await App.apiPostNoBody(
                                    `/strategic-sessions/${encodeURIComponent(
                                        activeSession.id
                                    )}/archive`
                                );
                                if (!response.ok) {
                                    if (feedback) {
                                        feedback.textContent = data.error || 'Could not archive session.';
                                        feedback.classList.add('error');
                                    }
                                } else {
                                    if (feedback) {
                                        feedback.textContent = 'Archived. Reloading...';
                                        feedback.classList.remove('error');
                                        feedback.classList.add('success');
                                    }
                                    setTimeout(() => loadForCurrentSelection(), 800);
                                }
                            } catch (err) {
                                if (feedback) {
                                    feedback.textContent = err.message;
                                    feedback.classList.add('error');
                                }
                            }
                        });
                    }

                    if (exportBtn) {
                        exportBtn.addEventListener('click', () => {
                            if (typeof App.exportStrategicPlan === 'function') {
                                App.exportStrategicPlan(activeSession, {
                                    locationName: locName,
                                    stageLabel
                                });
                            } else {
                                window.print();
                            }
                        });
                    }

                    // Show countdown to automatic 2-week stage advance
                    (function updateCountdown() {
                        const countdownEl = document.getElementById('planning-stage-countdown');
                        if (!countdownEl) return;

                        if (!activeSession.stageStartedAt || rawStatus === 'completed') {
                            countdownEl.textContent = '';
                            return;
                        }

                        const startedAt = new Date(activeSession.stageStartedAt || activeSession.createdAt);
                        const msPerDay = 1000 * 60 * 60 * 24;
                        const now = new Date();
                        const elapsedMs = now.getTime() - startedAt.getTime();
                        const elapsedDays = elapsedMs / msPerDay;
                        const totalStageDays = 14;
                        const remainingDays = Math.max(0, totalStageDays - elapsedDays);

                        if (remainingDays <= 0) {
                            countdownEl.textContent =
                                'This stage is due to advance. It will update automatically when members view this plan.';
                        } else {
                            const wholeDays = Math.floor(remainingDays);
                            const hours = Math.floor((remainingDays - wholeDays) * 24);
                            const nextLabel =
                                currentIndex >= 0 && currentIndex < orderedStages.length - 1
                                    ? stageLabels[orderedStages[currentIndex + 1]]
                                    : 'next stage';
                            countdownEl.textContent = `Approximately ${wholeDays} day(s) and ${hours} hour(s) until this plan moves to “${nextLabel}”.`;
                        }
                    })();

                    if (advanceStageBtn && isAdmin) {
                        advanceStageBtn.addEventListener('click', async () => {
                            if (!App.requireVerifiedAuth || !App.requireVerifiedAuth()) return;
                            const stages = ['draft', 'discussion', 'decision', 'review', 'completed'];
                            const idx = stages.indexOf(rawStatus);
                            if (idx === -1 || idx === stages.length - 1) {
                                alert('This plan is already at the final stage.');
                                return;
                            }
                            const nextStatus = stages[idx + 1];
                            advanceStageBtn.disabled = true;
                            try {
                                const { response, data } = await App.apiPut(
                                    `/strategic-sessions/${encodeURIComponent(activeSession.id)}`,
                                    { status: nextStatus }
                                );
                                if (!response.ok) {
                                    alert(data.error || 'Could not advance stage.');
                                } else {
                                    await loadForCurrentSelection();
                                }
                            } catch (err) {
                                alert(err.message);
                            } finally {
                                advanceStageBtn.disabled = false;
                            }
                        });
                    }

                    // Anonymous issue creation
                    if (issueForm && issuesList) {
                        issueForm.addEventListener('submit', async (e) => {
                            e.preventDefault();
                            if (!App.requireVerifiedAuth || !App.requireVerifiedAuth()) return;
                            const title = (issueTitleInput.value || '').trim();
                            const description = (issueDescInput.value || '').trim();
                            if (!title) {
                                alert('Please enter an issue or priority title.');
                                return;
                            }
                            try {
                                const { response, data } = await App.apiPost(
                                    `/strategic-sessions/${encodeURIComponent(activeSession.id)}/issues`,
                                    { title, description }
                                );
                                if (!response.ok) {
                                    alert(data.error || 'Could not add issue.');
                                    return;
                                }
                                issueTitleInput.value = '';
                                issueDescInput.value = '';
                                // Reload issues via full refresh for simplicity
                                await loadForCurrentSelection();
                            } catch (err) {
                                alert(err.message);
                            }
                        });

                        // Delegate vote buttons
                        issuesList.addEventListener('click', async (e) => {
                            const btn = e.target.closest('.planning-issue-vote-btn');
                            if (!btn) return;
                            if (!App.requireVerifiedAuth || !App.requireVerifiedAuth()) return;
                            const issueId = btn.getAttribute('data-issue-id');
                            if (!issueId) return;
                            try {
                                const { response, data } = await App.apiPost(
                                    `/strategic-sessions/${encodeURIComponent(
                                        activeSession.id
                                    )}/issues/${encodeURIComponent(issueId)}/vote`,
                                    {}
                                );
                                if (!response.ok) {
                                    alert(data.error || 'Could not support issue.');
                                    return;
                                }
                                await loadForCurrentSelection();
                            } catch (err) {
                                alert(err.message);
                            }
                        });
                    }

                    // Anonymous comments
                    if (commentForm && commentsList) {
                        commentForm.addEventListener('submit', async (e) => {
                            e.preventDefault();
                            if (!App.requireVerifiedAuth || !App.requireVerifiedAuth()) return;
                            const text = (commentTextInput.value || '').trim();
                            if (!text) {
                                alert('Please enter a comment.');
                                return;
                            }
                            try {
                                const { response, data } = await App.apiPost(
                                    `/strategic-sessions/${encodeURIComponent(activeSession.id)}/comments`,
                                    { text }
                                );
                                if (!response.ok) {
                                    alert(data.error || 'Could not add comment.');
                                    return;
                                }
                                commentTextInput.value = '';
                                await loadForCurrentSelection();
                            } catch (err) {
                                alert(err.message);
                            }
                        });
                    }

                    // Anonymous action proposals
                    if (actionForm && actionsList) {
                        actionForm.addEventListener('submit', async (e) => {
                            e.preventDefault();
                            if (!App.requireVerifiedAuth || !App.requireVerifiedAuth()) return;
                            const description = (actionDescInput.value || '').trim();
                            const dueDate = actionDateInput.value || null;
                            if (!description) {
                                alert('Please describe the action.');
                                return;
                            }
                            try {
                                const { response, data } = await App.apiPost(
                                    `/strategic-sessions/${encodeURIComponent(activeSession.id)}/actions`,
                                    { description, dueDate }
                                );
                                if (!response.ok) {
                                    alert(data.error || 'Could not add action.');
                                    return;
                                }
                                actionDescInput.value = '';
                                actionDateInput.value = '';
                                await loadForCurrentSelection();
                            } catch (err) {
                                alert(err.message);
                            }
                        });
                    }

                    // Goals (SMART-style objectives)
                    if (goalForm && goalsList) {
                        goalForm.addEventListener('submit', async (e) => {
                            e.preventDefault();
                            if (!App.requireVerifiedAuth || !App.requireVerifiedAuth()) return;
                            const title = (goalTitleInput.value || '').trim();
                            const description = (goalDescInput.value || '').trim();
                            const metric = (goalMetricInput.value || '').trim();
                            const dueDate = goalDateInput.value || null;
                            if (!title) {
                                alert('Please enter a goal title.');
                                return;
                            }
                            try {
                                const { response, data } = await App.apiPost(
                                    `/strategic-sessions/${encodeURIComponent(activeSession.id)}/goals`,
                                    { title, description, metric, dueDate }
                                );
                                if (!response.ok) {
                                    alert(data.error || 'Could not add goal.');
                                    return;
                                }
                                goalTitleInput.value = '';
                                goalDescInput.value = '';
                                goalMetricInput.value = '';
                                goalDateInput.value = '';
                                await loadForCurrentSelection();
                            } catch (err) {
                                alert(err.message);
                            }
                        });
                    }

                    // Review & lessons learned (any verified user)
                    if (reviewSaveBtn && reviewWorkedInput && reviewDidntInput && reviewChangesInput) {
                        reviewSaveBtn.addEventListener('click', async () => {
                            if (!App.requireVerifiedAuth || !App.requireVerifiedAuth()) return;
                            const review = {
                                worked: reviewWorkedInput.value || '',
                                didnt: reviewDidntInput.value || '',
                                changes: reviewChangesInput.value || ''
                            };
                            reviewSaveBtn.disabled = true;
                            reviewSaveBtn.textContent = 'Saving...';
                            try {
                                const { response, data } = await App.apiPut(
                                    `/strategic-sessions/${encodeURIComponent(activeSession.id)}/review`,
                                    { review }
                                );
                                if (!response.ok) {
                                    alert(data.error || 'Could not save review.');
                                } else {
                                    alert('Review saved.');
                                }
                            } catch (err) {
                                alert(err.message);
                            } finally {
                                reviewSaveBtn.disabled = false;
                                reviewSaveBtn.textContent = 'Save Review';
                            }
                        });
                    }

                    // Goal progress updates (status + current value)
                    if (goalProgressSaveBtn && goalProgressSelect && goalStatusSelect && goalCurrentInput) {
                        goalProgressSaveBtn.addEventListener('click', async () => {
                            if (!App.requireVerifiedAuth || !App.requireVerifiedAuth()) return;
                            const goalId = goalProgressSelect.value;
                            if (!goalId) {
                                alert('Please select a goal.');
                                return;
                            }
                            const status = goalStatusSelect.value;
                            const currentValue = goalCurrentInput.value || '';
                            goalProgressSaveBtn.disabled = true;
                            goalProgressSaveBtn.textContent = 'Saving...';
                            try {
                                const { response, data } = await App.apiPost(
                                    `/strategic-sessions/${encodeURIComponent(activeSession.id)}/goals/${encodeURIComponent(
                                        goalId
                                    )}/progress`,
                                    { status, currentValue }
                                );
                                if (!response.ok) {
                                    alert(data.error || 'Could not update goal progress.');
                                } else {
                                    alert('Goal progress saved.');
                                    await loadForCurrentSelection();
                                }
                            } catch (err) {
                                alert(err.message);
                            } finally {
                                goalProgressSaveBtn.disabled = false;
                                goalProgressSaveBtn.textContent = 'Save progress';
                            }
                        });
                    }

                    // SWOT save handler (any verified user)
                    if (swotSaveBtn) {
                        swotSaveBtn.addEventListener('click', async () => {
                            if (!App.requireVerifiedAuth || !App.requireVerifiedAuth()) return;
                            const splitLines = (value) =>
                                (value || '')
                                    .split('\n')
                                    .map((s) => s.trim())
                                    .filter((s) => s.length > 0);
                            const swot = {
                                strengths: splitLines(swotStrengthsInput.value),
                                weaknesses: splitLines(swotWeaknessesInput.value),
                                opportunities: splitLines(swotOpportunitiesInput.value),
                                threats: splitLines(swotThreatsInput.value)
                            };
                            swotSaveBtn.disabled = true;
                            swotSaveBtn.textContent = 'Saving...';
                            try {
                                const { response, data } = await App.apiPut(
                                    `/strategic-sessions/${encodeURIComponent(activeSession.id)}/swot`,
                                    { swot }
                                );
                                if (!response.ok) {
                                    alert(data.error || 'Could not save SWOT.');
                                } else {
                                    // No need to reload entire view; we already show current values
                                    alert('SWOT saved.');
                                }
                            } catch (err) {
                                alert(err.message);
                            } finally {
                                swotSaveBtn.disabled = false;
                                swotSaveBtn.textContent = 'Save SWOT';
                            }
                        });
                    }

                    // PEST save handler (any verified user)
                    if (pestSaveBtn) {
                        pestSaveBtn.addEventListener('click', async () => {
                            if (!App.requireVerifiedAuth || !App.requireVerifiedAuth()) return;
                            const splitLines = (value) =>
                                (value || '')
                                    .split('\n')
                                    .map((s) => s.trim())
                                    .filter((s) => s.length > 0);
                            const pest = {
                                political: splitLines(pestPoliticalInput.value),
                                economic: splitLines(pestEconomicInput.value),
                                social: splitLines(pestSocialInput.value),
                                technological: splitLines(pestTechnologicalInput.value)
                            };
                            pestSaveBtn.disabled = true;
                            pestSaveBtn.textContent = 'Saving...';
                            try {
                                const { response, data } = await App.apiPut(
                                    `/strategic-sessions/${encodeURIComponent(activeSession.id)}/pest`,
                                    { pest }
                                );
                                if (!response.ok) {
                                    alert(data.error || 'Could not save PEST.');
                                } else {
                                    alert('PEST saved.');
                                }
                            } catch (err) {
                                alert(err.message);
                            } finally {
                                pestSaveBtn.disabled = false;
                                pestSaveBtn.textContent = 'Save PEST';
                            }
                        });
                    }
                } else {
                    // No active session - show create form
                    sessionContainer.innerHTML = `
                        <div class="card">
                            <div class="card-header">
                                <h3 class="card-title">Start a Strategic Plan</h3>
                            </div>
                            <div class="card-body">
                                <p class="card-subtitle" style="margin-bottom: 8px;">
                                    Each riding/location can have one active Strategic Plan at a time. Any member located here can start one.
                                </p>
                                <div class="form-group">
                                    <label>Title</label>
                                    <input 
                                        type="text" 
                                        id="planning-new-title" 
                                        class="form-input" 
                                        placeholder="e.g., 2025 Strategic Plan for ${locName}"
                                        value="Strategic Plan for ${locName}"
                                    >
                                </div>
                                <div class="form-group">
                                    <label>Vision / Purpose</label>
                                    <textarea 
                                        id="planning-new-vision" 
                                        class="form-input" 
                                        rows="5"
                                        placeholder="What is this riding/location trying to achieve together?"
                                    ></textarea>
                                </div>
                                <button class="btn btn-primary" id="planning-create-btn">Start Strategic Plan</button>
                                <div id="planning-feedback" class="form-feedback" style="margin-top:8px;"></div>
                            </div>
                        </div>

                        <div class="card">
                            <div class="card-header">
                                <h3 class="card-title">Past Plans</h3>
                            </div>
                            <div class="card-body">
                                ${
                                    history && history.length
                                        ? `<ul class="locations-list">${historyItems}</ul>`
                                        : '<p class="empty-text">No archived plans yet for this location.</p>'
                                }
                            </div>
                        </div>
                    `;

                    const createBtn = document.getElementById('planning-create-btn');
                    const titleInput = document.getElementById('planning-new-title');
                    const visionInput = document.getElementById('planning-new-vision');
                    const feedbackEl = document.getElementById('planning-feedback');

                    if (createBtn) {
                        createBtn.addEventListener('click', async () => {
                            if (!App.requireVerifiedAuth || !App.requireVerifiedAuth()) return;
                            const title = titleInput.value.trim();
                            const vision = visionInput.value.trim();
                            if (!title) {
                                feedbackEl.textContent = 'Please provide a title for this plan.';
                                feedbackEl.classList.add('error');
                                return;
                            }
                            createBtn.disabled = true;
                            createBtn.textContent = 'Starting...';
                            feedbackEl.textContent = '';
                            feedbackEl.classList.remove('error', 'success');
                            try {
                                const { response, data } = await App.apiPost(
                                    `/strategic-sessions/location/${pathSegment}/${encodeURIComponent(
                                        locId
                                    )}`,
                                    { title, vision }
                                );
                                if (!response.ok) {
                                    feedbackEl.textContent =
                                        data.error ||
                                        'Could not start Strategic Plan. Make sure there is no active plan already.';
                                    feedbackEl.classList.add('error');
                                } else {
                                    feedbackEl.textContent = 'Strategic Plan started.';
                                    feedbackEl.classList.remove('error');
                                    feedbackEl.classList.add('success');
                                    setTimeout(() => loadForCurrentSelection(), 800);
                                }
                            } catch (err) {
                                feedbackEl.textContent = err.message;
                                feedbackEl.classList.add('error');
                            } finally {
                                createBtn.disabled = false;
                                createBtn.textContent = 'Start Strategic Plan';
                            }
                        });
                    }
                }
            } catch (err) {
                // Log rich debug info for admins/devs
                try {
                    if (typeof App.logClientEvent === 'function') {
                        App.logClientEvent('error', 'Planning load failed', {
                            status: err && err.status,
                            message: err && err.message,
                            locationId: locId,
                            locationType: locType
                        });
                    }
                } catch (e) {
                    // ignore debug logging errors
                }

                let friendly = err && err.message ? String(err.message) : 'Unknown error.';
                if (err && (err.status === 401 || err.status === 403)) {
                    friendly +=
                        ' You may not have permission to view this Strategic Plan. ' +
                        'If this is an Ad-hoc Group with an email domain restriction, make sure you are signed in with a matching email or adjust the group settings in Admin → Ad-hoc Group Admin.';
                }

                sessionContainer.innerHTML = `
                    <div class="card">
                        <div class="card-body">
                            <p class="empty-text">Error loading planning data: ${friendly}</p>
                            <p class="form-help" style="margin-top:8px; font-size:11px; opacity:0.8;">
                                (Debug: status ${err && err.status ? err.status : 'unknown'}, location ${locType ||
                    'n/a'} → ${locId || 'n/a'})
                            </p>
                        </div>
                    </div>
                `;
            }
        };

        selectEl.addEventListener('change', () => {
            loadForCurrentSelection();
        });

        // Initial load
        await loadForCurrentSelection();
    } catch (err) {
        content.innerHTML = `
            <div class="card">
                <div class="card-body">
                    <p class="empty-text">Error: ${err.message}</p>
                </div>
            </div>
        `;
    }
};

// ============================================
// STRATEGIC PLANNING EXPORT (PRINT-FRIENDLY)
// ============================================

App.exportStrategicPlan = function(session, { locationName, stageLabel } = {}) {
    if (!session) return;

    const safe = (value) => (value == null ? '' : String(value));
    const title = safe(session.title || 'Strategic Plan');
    const vision = safe(session.vision || '');
    const stage = safe(stageLabel || session.status || 'Draft');
    const locName = safe(locationName || '');

    const issues = Array.isArray(session.issues) ? session.issues : [];
    const comments = Array.isArray(session.comments) ? session.comments : [];
    const actions = Array.isArray(session.actions) ? session.actions : [];

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>${title} – Strategic Plan Export</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
            margin: 32px;
            color: #111827;
        }
        h1, h2, h3 {
            margin-bottom: 8px;
            color: #111827;
        }
        h1 {
            font-size: 24px;
        }
        h2 {
            font-size: 20px;
            margin-top: 24px;
        }
        h3 {
            font-size: 16px;
            margin-top: 16px;
        }
        p {
            margin: 4px 0 8px 0;
        }
        .meta {
            color: #6b7280;
            font-size: 13px;
            margin-bottom: 16px;
        }
        .section {
            margin-top: 16px;
            padding-top: 8px;
            border-top: 1px solid #e5e7eb;
        }
        ul {
            margin: 4px 0 8px 18px;
        }
        li {
            margin-bottom: 4px;
        }
        .small {
            font-size: 12px;
            color: #6b7280;
        }
        @media print {
            body {
                margin: 16mm;
            }
            button {
                display: none;
            }
        }
    </style>
</head>
<body>
    <h1>${title}</h1>
    <div class="meta">
        ${locName ? `Location: ${locName} • ` : ''}Stage: ${stage}
        ${session.createdAt ? ` • Started: ${safe(App.formatDate(session.createdAt))}` : ''}
    </div>

    <div class="section">
        <h2>Vision / Purpose</h2>
        <p>${vision || '<span class="small">(No vision text provided.)</span>'}</p>
    </div>

    <div class="section">
        <h2>Issues / Priorities</h2>
        ${
            issues.length
                ? `<ul>${issues
                      .map(
                          (iss) =>
                              `<li><strong>${safe(iss.title)}</strong>${
                                  iss.description ? ` – ${safe(iss.description)}` : ''
                              } <span class="small">(Supports: ${iss.votes || 0})</span></li>`
                      )
                      .join('')}</ul>`
                : '<p class="small">(No issues recorded.)</p>'
        }
    </div>

    <div class="section">
        <h2>Decisions / Actions</h2>
        ${
            actions.length
                ? `<ul>${actions
                      .map((act) => {
                          const parts = [safe(act.description)];
                          if (act.dueDate) {
                              parts.push(`Target: ${safe(App.formatDate(act.dueDate))}`);
                          }
                          if (act.status) {
                              parts.push(`Status: ${safe(act.status)}`);
                          }
                          return `<li>${parts.join(' • ')}</li>`;
                      })
                      .join('')}</ul>`
                : '<p class="small">(No actions defined.)</p>'
        }
    </div>

    <div class="section">
        <h2>Discussion Highlights</h2>
        ${
            comments.length
                ? `<ul>${comments
                      .slice()
                      .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))
                      .map(
                          (c) =>
                              `<li>${safe(c.text)}${
                                  c.createdAt
                                      ? ` <span class="small">(${safe(App.formatDate(c.createdAt))})</span>`
                                      : ''
                              }</li>`
                      )
                      .join('')}</ul>`
                : '<p class="small">(No comments recorded.)</p>'
        }
    </div>

    <button onclick="window.print()">Print</button>
</body>
</html>
    `;

    const w = window.open('', '_blank');
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
    try {
        w.focus();
        setTimeout(() => w.print(), 500);
    } catch (e) {
        // Ignore print errors
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

            // Reload the referendums page so the new question appears in the list
            if (App.pages && typeof App.pages.referendums === 'function') {
                setTimeout(() => App.pages.referendums(), 400);
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

    // Require a signed-in, verified user to create or participate
    if (!App.requireVerifiedAuth || !App.requireVerifiedAuth()) {
        content.innerHTML = `
            <header class="page-header">
                <h1 class="page-title">📑 Referendums</h1>
                <p class="page-subtitle">Ask big questions, explore perspectives, and add your voice.</p>
            </header>
            <div class="card">
                <div class="card-body">
                    <p class="empty-text">
                        Sign in with a verified account to propose new questions and add perspectives to referendums.
                    </p>
                </div>
            </div>
        `;
        return;
    }

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

// ============================================
// NEWS PAGE
// ============================================

App.pages.news = async function() {
    const content = document.getElementById('content');

    if (!App.requireVerifiedAuth || !App.requireVerifiedAuth()) {
        content.innerHTML = `
            <header class="page-header">
                <h1 class="page-title">📰 News & Activity</h1>
            </header>
            <div class="card">
                <div class="card-body">
                    <p class="empty-text">
                        Sign in with a verified account to see your personalized news feed and follow other players.
                    </p>
                </div>
            </div>
        `;
        return;
    }

    content.innerHTML = `
        <header class="page-header">
            <h1 class="page-title">📰 News & Activity</h1>
            <p class="page-subtitle">
                See updates from people you follow, new ideas they post, and new Strategic Plans in your locations.
            </p>
        </header>

        <div class="cards-grid">
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">Write a Post</h3>
                </div>
                <div class="card-body">
                    <p class="card-subtitle" style="margin-bottom:8px;">
                        Share a short update with your followers. Posts can link to ideas or plans if you include their titles.
                    </p>
                    <div class="form-group">
                        <label for="news-post-body">Your update</label>
                        <textarea id="news-post-body" class="form-input" rows="3" placeholder="What are you working on or thinking about?"></textarea>
                    </div>
                    <div class="form-group dev-only">
                        <label>Optional: Add a short voice note</label>
                        <div id="news-voice-controls" class="voice-note-controls">
                            <button type="button" class="btn btn-secondary btn-sm" id="news-voice-record">🎙 Record</button>
                            <button type="button" class="btn btn-secondary btn-sm" id="news-voice-stop" disabled>Stop</button>
                            <button type="button" class="btn btn-link btn-sm" id="news-voice-clear" disabled>Clear</button>
                        </div>
                        <div class="voice-note-status" id="news-voice-status"></div>
                        <audio id="news-voice-audio" controls style="display:none; margin-top:8px; width:100%;"></audio>
                        <p class="location-help" style="margin-top:4px;">
                            Voice notes are experimental, saved only in this browser, and automatically removed after 2 days.
                        </p>
                    </div>
                    <button class="btn btn-primary" id="news-post-submit">Post</button>
                    <div id="news-post-feedback" class="form-feedback"></div>
                </div>
            </div>

            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">Feed Settings</h3>
                </div>
                <div class="card-body">
                    <p class="card-subtitle" style="margin-bottom:8px;">
                        Choose what appears in your feed. Changes apply immediately.
                    </p>
                    <div class="form-group">
                        <label><input type="checkbox" id="news-filter-posts" checked> Posts from people I follow</label>
                    </div>
                    <div class="form-group">
                        <label><input type="checkbox" id="news-filter-ideas" checked> New ideas from people I follow</label>
                    </div>
                    <div class="form-group">
                        <label><input type="checkbox" id="news-filter-plans" checked> New Strategic Plans in my locations</label>
                    </div>
                    <div class="form-group">
                        <label>People you follow</label>
                        <ul id="news-following-list" class="locations-list" style="max-height:160px; overflow-y:auto;"></ul>
                        <p class="location-help" style="margin-top:8px;">
                            To follow someone, open their profile or a candidate card and click “Follow”.
                        </p>
                    </div>
                </div>
            </div>
        </div>

        <div class="card" style="margin-top:24px;">
            <div class="card-header">
                <h3 class="card-title">Your News Feed</h3>
            </div>
            <div class="card-body">
                <div id="news-feed" class="simple-list">
                    <p class="empty-text">Loading your feed…</p>
                </div>
            </div>
        </div>
    `;

    const postBodyEl = document.getElementById('news-post-body');
    const postSubmitEl = document.getElementById('news-post-submit');
    const postFeedbackEl = document.getElementById('news-post-feedback');
    const filterPostsEl = document.getElementById('news-filter-posts');
    const filterIdeasEl = document.getElementById('news-filter-ideas');
    const filterPlansEl = document.getElementById('news-filter-plans');
    const feedEl = document.getElementById('news-feed');
    const followingListEl = document.getElementById('news-following-list');

    const voiceRecordBtn = document.getElementById('news-voice-record');
    const voiceStopBtn = document.getElementById('news-voice-stop');
    const voiceClearBtn = document.getElementById('news-voice-clear');
    const voiceStatusEl = document.getElementById('news-voice-status');
    const voiceAudioEl = document.getElementById('news-voice-audio');

    const DEV_VOICE_PREFIX = 'devNewsVoice_';
    const DEFAULT_MAX_VOICE_SECONDS = 10; // default max length, adjustable later via settings

    function getMaxVoiceDurationMs() {
        // Simple hook for future admin settings:
        // - If localStorage.devVoiceMaxSeconds is set to a positive number <= 60, use that.
        // - Otherwise fall back to DEFAULT_MAX_VOICE_SECONDS.
        try {
            const raw = localStorage.getItem('devVoiceMaxSeconds');
            const num = raw ? parseInt(raw, 10) : NaN;
            if (Number.isFinite(num) && num > 0 && num <= 60) {
                return num * 1000;
            }
        } catch (e) {
            // ignore and use default
        }
        return DEFAULT_MAX_VOICE_SECONDS * 1000;
    }

    let mediaRecorder = null;
    let recordedChunks = [];
    let voiceBlob = null;
    let voiceCreatedAt = null;
    let voiceTimerId = null;

    function resetVoiceState() {
        try {
            if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                mediaRecorder.stop();
            }
        } catch (e) {
            // ignore
        }
        mediaRecorder = null;
        recordedChunks = [];
        voiceBlob = null;
        voiceCreatedAt = null;
        if (voiceTimerId) {
            clearTimeout(voiceTimerId);
            voiceTimerId = null;
        }
        if (voiceAudioEl) {
            voiceAudioEl.src = '';
            voiceAudioEl.style.display = 'none';
        }
        if (voiceStatusEl) {
            voiceStatusEl.textContent = '';
        }
        if (voiceRecordBtn) {
            voiceRecordBtn.disabled = false;
            voiceRecordBtn.textContent = '🎙 Start recording';
        }
        if (voiceStopBtn) {
            voiceStopBtn.disabled = true;
        }
        if (voiceClearBtn) {
            voiceClearBtn.disabled = true;
        }
    }

    function isVoiceSupported() {
        return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
    }

    if (!isVoiceSupported() && voiceStatusEl) {
        voiceStatusEl.textContent = 'Voice notes are not supported in this browser.';
    }

    function saveVoiceForPost(postId, blob, createdAt) {
        if (!postId || !blob) return;
        try {
            const reader = new FileReader();
            reader.onloadend = () => {
                const dataUrl = reader.result;
                const payload = {
                    createdAt,
                    dataUrl
                };
                try {
                    localStorage.setItem(DEV_VOICE_PREFIX + postId, JSON.stringify(payload));
                } catch (e) {
                    // best-effort only; ignore quota errors
                    // eslint-disable-next-line no-console
                    console.warn('Failed to save dev voice note:', e);
                }
            };
            reader.readAsDataURL(blob);
        } catch (e) {
            // eslint-disable-next-line no-console
            console.warn('Failed to prepare dev voice note for saving:', e);
        }
    }

    function loadVoiceForPost(postId) {
        if (!postId) return null;
        try {
            const raw = localStorage.getItem(DEV_VOICE_PREFIX + postId);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed || !parsed.dataUrl || !parsed.createdAt) {
                localStorage.removeItem(DEV_VOICE_PREFIX + postId);
                return null;
            }
            const ageMs = Date.now() - parsed.createdAt;
            const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
            if (ageMs > twoDaysMs) {
                localStorage.removeItem(DEV_VOICE_PREFIX + postId);
                return null;
            }
            return parsed.dataUrl;
        } catch (e) {
            localStorage.removeItem(DEV_VOICE_PREFIX + postId);
            return null;
        }
    }

    function attachVoiceHandlers() {
        if (!isVoiceSupported() || !voiceRecordBtn || !voiceStopBtn || !voiceClearBtn) {
            return;
        }

        voiceRecordBtn.addEventListener('click', async () => {
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                return;
            }
            try {
                resetVoiceState();
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                const options = {};
                if (window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
                    options.mimeType = 'audio/webm;codecs=opus';
                }
                mediaRecorder = new MediaRecorder(stream, options);
                recordedChunks = [];
                voiceCreatedAt = Date.now();

                mediaRecorder.addEventListener('dataavailable', (event) => {
                    if (event.data && event.data.size > 0) {
                        recordedChunks.push(event.data);
                    }
                });

                mediaRecorder.addEventListener('stop', () => {
                    try {
                        stream.getTracks().forEach((t) => t.stop());
                    } catch (e) {
                        // ignore
                    }
                    if (!recordedChunks.length) return;
                    voiceBlob = new Blob(recordedChunks, { type: 'audio/webm' });
                    const url = URL.createObjectURL(voiceBlob);
                    if (voiceAudioEl) {
                        voiceAudioEl.src = url;
                        voiceAudioEl.style.display = 'block';
                    }
                    if (voiceStatusEl) {
                        voiceStatusEl.textContent = 'Recorded voice note (saved locally for up to 2 days).';
                    }
                    if (voiceClearBtn) {
                        voiceClearBtn.disabled = false;
                    }
                });

                mediaRecorder.start(500);
                if (voiceStatusEl) {
                    const maxSeconds = Math.round(getMaxVoiceDurationMs() / 1000);
                    voiceStatusEl.textContent = `Recording… (max ${maxSeconds} seconds)`;
                }
                voiceRecordBtn.disabled = true;
                voiceStopBtn.disabled = false;

                voiceTimerId = setTimeout(() => {
                    try {
                        if (mediaRecorder && mediaRecorder.state === 'recording') {
                            mediaRecorder.stop();
                            if (voiceStatusEl) {
                                const maxSeconds = Math.round(getMaxVoiceDurationMs() / 1000);
                                voiceStatusEl.textContent = `Recording stopped (${maxSeconds}-second limit reached).`;
                            }
                            voiceRecordBtn.disabled = false;
                            voiceStopBtn.disabled = true;
                        }
                    } finally {
                        if (voiceTimerId) {
                            clearTimeout(voiceTimerId);
                            voiceTimerId = null;
                        }
                    }
                }, MAX_VOICE_DURATION_MS);
            } catch (err) {
                if (voiceStatusEl) {
                    voiceStatusEl.textContent = err && err.message ? err.message : 'Unable to access microphone.';
                }
            }
        });

        voiceStopBtn.addEventListener('click', () => {
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                try {
                    mediaRecorder.stop();
                } catch (e) {
                    // ignore
                }
                if (voiceStatusEl) {
                    voiceStatusEl.textContent = 'Recording stopped.';
                }
                voiceRecordBtn.disabled = false;
                voiceStopBtn.disabled = true;
                if (voiceTimerId) {
                    clearTimeout(voiceTimerId);
                    voiceTimerId = null;
                }
            }
        });

        voiceClearBtn.addEventListener('click', () => {
            resetVoiceState();
        });
    }

    attachVoiceHandlers();

    async function loadFollowing() {
        try {
            const following = await App.api('/news/following');
            if (!following.length) {
                followingListEl.innerHTML = '<li>No follows yet.</li>';
                return;
            }
            followingListEl.innerHTML = following
                .map(
                    (u) => `
                <li>
                    ${u.name}
                    ${u.email ? `<span class="location-type">(${u.email})</span>` : ''}
                </li>
            `
                )
                .join('');
        } catch (err) {
            followingListEl.innerHTML = `<li class="location-type">Error loading following list.</li>`;
        }
    }

    async function loadFeed() {
        feedEl.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
        try {
            const params = new URLSearchParams();
            if (!filterPostsEl.checked) params.set('includePosts', 'false');
            if (!filterIdeasEl.checked) params.set('includeIdeas', 'false');
            if (!filterPlansEl.checked) params.set('includePlans', 'false');

            const feed = await App.api(`/news/feed?${params.toString()}`);
            if (!feed.length) {
                feedEl.innerHTML = '<p class="empty-text">No news yet. Follow some members and start posting!</p>';
                return;
            }

            feedEl.innerHTML = feed
                .map((item) => {
                    if (item.kind === 'post') {
                        const backendAudioUrl =
                            item.audioUrl &&
                            (!item.audioExpiresAt || new Date(item.audioExpiresAt) > new Date())
                                ? item.audioUrl
                                : null;
                        const devVoiceDataUrl = !backendAudioUrl ? loadVoiceForPost(item.id) : null;
                        const audioSrc = backendAudioUrl || devVoiceDataUrl || null;
                        const hasVoice = !!audioSrc;
                        const voiceHtml = audioSrc
                            ? `
                                <div class="simple-list-meta" style="margin-top:4px;">
                                    <audio controls src="${audioSrc}" style="width:100%;"></audio>
                                </div>
                              `
                            : '';
                        return `
                            <div class="simple-list-item">
                                <div class="simple-list-main">
                                    <div class="simple-list-name">
                                        📝 ${item.author?.name || 'Member'}
                                        ${
                                            hasVoice
                                                ? '<span style="margin-left:6px; font-size:12px; color: var(--accent-primary);">🎙 Voice note</span>'
                                                : ''
                                        }
                                    </div>
                                    <div class="simple-list-meta">${item.body}</div>
                                    ${voiceHtml}
                                </div>
                                <div class="simple-list-meta">
                                    <span>${App.formatDate(item.createdAt)} ${App.formatTime(
                                        item.createdAt
                                    )}</span>
                                </div>
                            </div>
                        `;
                    }
                    if (item.kind === 'idea') {
                        return `
                            <div class="simple-list-item">
                                <div class="simple-list-main">
                                    <div class="simple-list-name">💡 ${item.title}</div>
                                    <div class="simple-list-meta">
                                        by ${item.author?.name || 'Member'} • ${App.formatDate(
                                            item.createdAt
                                        )}
                                    </div>
                                    ${
                                        item.description
                                            ? `<div class="simple-list-meta">${item.description}</div>`
                                            : ''
                                    }
                                </div>
                            </div>
                        `;
                    }
                    // plan
                    const loc = item.location;
                    return `
                        <div class="simple-list-item">
                            <div class="simple-list-main">
                                <div class="simple-list-name">📋 New Strategic Plan${
                                    loc ? ` – ${loc.name}` : ''
                                }</div>
                                <div class="simple-list-meta">
                                    Status: ${item.status || 'draft'} • ${
                                        loc ? `${loc.type} • ` : ''
                                    }${App.formatDate(item.createdAt)}
                                </div>
                            </div>
                        </div>
                    `;
                })
                .join('');
        } catch (err) {
            feedEl.innerHTML = `<p class="empty-text">Error loading feed: ${err.message}</p>`;
        }
    }

    postSubmitEl.addEventListener('click', async () => {
        const body = (postBodyEl.value || '').trim();
        postFeedbackEl.textContent = '';
        postFeedbackEl.classList.remove('error', 'success');

        if (!body) {
            postFeedbackEl.textContent = 'Please write something before posting.';
            postFeedbackEl.classList.add('error');
            return;
        }

        try {
            postSubmitEl.disabled = true;
            const { response, data } = await App.apiPost('/news/posts', { body });
            if (!response.ok) {
                postFeedbackEl.textContent = data.error || 'Failed to post.';
                postFeedbackEl.classList.add('error');
            } else {
                postFeedbackEl.textContent = 'Posted!';
                postFeedbackEl.classList.add('success');
                postBodyEl.value = '';

                const postId = data && data.id;
                if (voiceBlob && postId) {
                    let uploaded = false;
                    try {
                        const uploadResp = await fetch(
                            `/api/news/posts/${encodeURIComponent(postId)}/audio`,
                            {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'audio/webm'
                                },
                                body: voiceBlob
                            }
                        );
                        if (uploadResp.ok) {
                            uploaded = true;
                        }
                    } catch (e) {
                        // ignore and fall back to local-only storage
                    }

                    if (!uploaded) {
                        saveVoiceForPost(postId, voiceBlob, voiceCreatedAt || Date.now());
                    }

                    resetVoiceState();
                }

                await loadFeed();
            }
        } catch (err) {
            postFeedbackEl.textContent = err.message || 'Failed to post.';
            postFeedbackEl.classList.add('error');
        } finally {
            postSubmitEl.disabled = false;
        }
    });

    [filterPostsEl, filterIdeasEl, filterPlansEl].forEach((el) => {
        el.addEventListener('change', loadFeed);
    });

    await loadFollowing();
    await loadFeed();
};

// ============================================
// DOCUMENTATION PAGE
// ============================================

App.pages.documentation = async function() {
    const content = document.getElementById('content');
    content.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    const renderSection = (tab) => {
        if (tab === 'data') {
            return `
                <section class="doc-section">
                    <h2>Data Definitions</h2>
                    <p>This game models a grassroots political movement. These are the main building blocks:</p>
                    <ul>
                        <li><strong>Members (Players)</strong>: Real people with accounts. Each member has a profile, locations, ideas, points, and (optionally) candidacies.</li>
                        <li><strong>Locations</strong>: The political map of the world.
                            <ul>
                                <li><strong>Country</strong> → <strong>Province/State</strong> → <strong>Ridings / Towns / First Nations / Groups</strong>.</li>
                                <li>You can belong to multiple locations at once (for example: Federal Riding, Provincial Riding, First Nation, Town, Ad-hoc Group).</li>
                            </ul>
                        </li>
                        <li><strong>Ideas</strong>: Proposals and suggestions posted by members. Other members can “like” ideas to show support and award points.</li>
                        <li><strong>Strategic Plans</strong>: Structured planning sessions for a specific location (Country, Province, Riding, Town, First Nation, Group) that move through stages (Draft → Discussion → Decision → Review → Completed).</li>
                        <li><strong>Issues, Goals, Actions & Comments</strong>:
                            <ul>
                                <li><strong>Issues</strong>: Problems or priorities the plan should address.</li>
                                <li><strong>Goals</strong>: Measurable outcomes (what success looks like).</li>
                                <li><strong>Actions</strong>: Concrete steps the group commits to take.</li>
                                <li><strong>Comments</strong>: Anonymous discussion attached to the plan, issues, and goals.</li>
                            </ul>
                        </li>
                        <li><strong>Points</strong>: A combined score showing how much you contribute, from:
                            <ul>
                                <li><strong>Idea support</strong> (others liking your ideas).</li>
                                <li><strong>Strategic Planning participation</strong> (adding issues, goals, actions, comments, and helping reach decisions).</li>
                            </ul>
                        </li>
                    </ul>
                </section>
            `;
        }

        if (tab === 'features') {
            return `
                <section class="doc-section">
                    <h2>Feature Definitions</h2>
                    <ul>
                        <li><strong>Playing As</strong>: At the top left you can choose which member you are “playing as”.
                            <ul>
                                <li>This is mainly for development and demos. In real use, you will just play as your own account.</li>
                            </ul>
                        </li>
                        <li><strong>Ideas</strong>:
                            <ul>
                                <li>Browse ideas by location, post new ideas from your riding or group, and “like” ideas you support.</li>
                                <li>Each like gives the idea’s author points, which count toward their influence and badges.</li>
                            </ul>
                        </li>
                        <li><strong>Candidates & Conventions</strong>:
                            <ul>
                                <li>Members can declare candidacy in their riding and appear on candidate lists.</li>
                                <li>Conventions and voting features simulate internal party nomination races.</li>
                            </ul>
                        </li>
                        <li><strong>Strategic Planning</strong>:
                            <ul>
                                <li>Every location can have one active Strategic Plan at a time (per year, for non‑Ad-hoc locations).</li>
                                <li>Plans move automatically through stages (Draft → Discussion → Decision → Review → Completed), with a countdown and notifications.</li>
                                <li>All contributions inside a plan (issues, goals, actions, comments) are anonymous to other players to keep the focus on ideas, not personalities.</li>
                            </ul>
                        </li>
                        <li><strong>Points & Badges</strong>:
                            <ul>
                                <li>Points measure contribution: ideas you’ve inspired and planning work you’ve done.</li>
                                <li>Badges are awarded automatically when you pass local/global points thresholds.</li>
                            </ul>
                        </li>
                        <li><strong>Notifications</strong>:
                            <ul>
                                <li>The bell icon shows updates about Strategic Plan stages, badges, and other events.</li>
                            </ul>
                        </li>
                    </ul>
                </section>
            `;
        }

        if (tab === 'processes') {
            return `
                <section class="doc-section">
                    <h2>Core Processes</h2>
                    <ol>
                        <li><strong>Create your account & set your locations</strong>
                            <ul>
                                <li>Sign up or sign in from the top of the sidebar.</li>
                                <li>Go to <strong>My Profile</strong> and use “My Location” to choose your Province/State and local areas (Riding, Town, First Nation, Group).</li>
                            </ul>
                        </li>
                        <li><strong>Post and support ideas</strong>
                            <ul>
                                <li>Open the <strong>Ideas</strong> page, pick a location in the left tree, and browse existing ideas.</li>
                                <li>Click <strong>Post Idea</strong> to suggest something new for that place.</li>
                                <li>Click the like button on ideas you support to give their authors points.</li>
                            </ul>
                        </li>
                        <li><strong>Start or join a Strategic Plan</strong>
                            <ul>
                                <li>Go to the <strong>Planning</strong> page.</li>
                                <li>Use the “My locations” dropdown to select a Country, Province, Riding, Town, First Nation, or Group you belong to.</li>
                                <li>If there’s no plan yet, start one (if your role allows). Otherwise, join the active plan and contribute.</li>
                            </ul>
                        </li>
                        <li><strong>Contribute inside a plan</strong>
                            <ul>
                                <li>Add <strong>Issues</strong> (what’s wrong or what needs attention).</li>
                                <li>Suggest <strong>Goals</strong> (clear, measurable outcomes).</li>
                                <li>Define <strong>Actions</strong> (who will do what, by when).</li>
                                <li>Comment and vote on issues to help the group move toward a decision.</li>
                            </ul>
                        </li>
                        <li><strong>Reach decisions and track progress</strong>
                            <ul>
                                <li>As the plan progresses into the <strong>Decision</strong> stage, participants help choose priorities and actions.</li>
                                <li>In the <strong>Review</strong> and <strong>Completed</strong> stages, you record outcomes and lessons learned.</li>
                            </ul>
                        </li>
                    </ol>
                </section>
            `;
        }

        // Game Play tab
        return `
            <section class="doc-section">
                <h2>Game Play</h2>
                <p>This application is a cooperative political strategy game. You “win” by helping your community make good decisions, not by defeating other players.</p>
                <ul>
                    <li><strong>Your role</strong>:
                        <ul>
                            <li>As a member, you propose ideas, participate in local and national plans, and can choose to run as a candidate.</li>
                            <li>Your <strong>points</strong> show how much impact you’ve had through liked ideas and planning work.</li>
                        </ul>
                    </li>
                    <li><strong>Short‑term goals</strong>:
                        <ul>
                            <li>Get your ideas noticed and supported.</li>
                            <li>Help your locations create solid Strategic Plans that reach real decisions and completed actions.</li>
                        </ul>
                    </li>
                    <li><strong>Long‑term goals</strong>:
                        <ul>
                            <li>Build a reputation as a strong community member (high points, useful ideas, successful plans).</li>
                            <li>Prepare for internal elections and conventions by showing leadership through planning, not just campaigning.</li>
                        </ul>
                    </li>
                    <li><strong>What makes this a game?</strong>:
                        <ul>
                            <li>Points, badges, and leaderboards make contribution visible and fun.</li>
                            <li>Strategic Planning stages create time‑boxed “rounds” with clear objectives.</li>
                            <li>Anonymous issues/comments and strict rules about not naming other members keep the game focused on policy, not personalities.</li>
                        </ul>
                    </li>
                    <li><strong>How to get started quickly</strong>:
                        <ol>
                            <li>Sign in and set your locations in <strong>My Profile</strong>.</li>
                            <li>Like a few ideas you genuinely support in your area.</li>
                            <li>Join the Strategic Plan for your Riding, Town, or Group and add one issue and one goal.</li>
                            <li>Check the notifications bell to see when your plan moves stages and keep coming back to move it toward real decisions.</li>
                        </ol>
                    </li>
                </ul>
            </section>
        `;
    };

    const initialTab = 'gameplay';

    content.innerHTML = `
        <header class="page-header">
            <h1 class="page-title">📚 Documentation</h1>
            <p class="page-subtitle">Learn how the Political Party game works: data, features, processes, and how to play.</p>
        </header>

        <div class="convention-tabs">
            <button class="convention-tab active" data-doc-tab="gameplay">Game Play</button>
            <button class="convention-tab" data-doc-tab="data">Data Definitions</button>
            <button class="convention-tab" data-doc-tab="features">Feature Definitions</button>
            <button class="convention-tab" data-doc-tab="processes">Processes</button>
        </div>

        <div id="documentation-content" class="doc-content">
            ${renderSection(initialTab)}
        </div>
    `;

    const container = document.getElementById('documentation-content');
    document.querySelectorAll('.convention-tab').forEach((btn) => {
        btn.addEventListener('click', () => {
            const tab = btn.getAttribute('data-doc-tab');
            document.querySelectorAll('.convention-tab').forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            container.innerHTML = renderSection(tab);
        });
    });
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
                        <hr style="margin: 16px 0; border-color: var(--border-color);">
                        <h4 style="margin-bottom: 6px;">🎙 Audio Settings (News posts)</h4>
                        <p class="form-help" style="margin-bottom: 8px; color: var(--text-muted); font-size: 0.85rem;">
                            Configure how long members can record voice notes on News posts in this environment.
                        </p>
                        <div class="form-group" style="margin-bottom: 8px;">
                            <label for="admin-audio-max-seconds">Max voice note length (seconds)</label>
                            <input id="admin-audio-max-seconds" type="number" min="5" max="60" step="1" class="form-input" placeholder="10">
                            <p class="form-help" style="margin-top: 4px;">
                                Default is 10 seconds. This setting is stored per browser (local only) for testing.
                            </p>
                        </div>
                        <button class="admin-btn" id="admin-audio-save">💾 Save audio settings</button>
                        <div id="admin-audio-settings-result" class="form-feedback" style="margin-top: 8px;"></div>
                        <hr style="margin: 16px 0; border-color: var(--border-color);">
                        <button class="admin-btn" id="admin-audio-cleanup">🧹 Clean up expired news audio files</button>
                        <div id="admin-audio-cleanup-result" class="form-feedback" style="margin-top: 8px;"></div>
                        <p class="form-help" style="margin-top: 4px; color: var(--text-muted); font-size: 0.85rem;">
                            Runs a best-effort cleanup on the server for any News audio whose retention period has passed.
                        </p>
                    </div>
                </div>

                <!-- Countries & Locations Card -->
                <div class="card">
                    <div class="card-header"><h3 class="card-title">🌍 Countries & Locations</h3></div>
                    <div class="card-body">
                        <p class="card-subtitle" style="margin-bottom: 8px;">
                            Add additional countries (e.g., United States, Bangladesh) so members outside Canada can participate.
                        </p>
                        <div class="form-group">
                            <label for="admin-country-id">Country ID</label>
                            <input id="admin-country-id" class="form-input" placeholder="e.g., us, bd">
                            <p class="form-help">Short identifier used in URLs and relationships (e.g., <code>ca</code> for Canada).</p>
                        </div>
                        <div class="form-group">
                            <label for="admin-country-name">Country Name</label>
                            <input id="admin-country-name" class="form-input" placeholder="e.g., United States">
                        </div>
                        <div class="form-group">
                            <label for="admin-country-code">Country Code (optional)</label>
                            <input id="admin-country-code" class="form-input" placeholder="e.g., US">
                            <p class="form-help">Defaults to the uppercased ID if left blank.</p>
                        </div>
                        <button class="admin-btn primary" onclick="App.addCountry()">➕ Add / Update Country</button>
                        <div id="admin-country-feedback" class="form-feedback" style="margin-top: 8px;"></div>
                        <p class="form-help" style="margin-top: 8px; color: var(--text-muted); font-size: 0.85rem;">
                            New countries will appear in the Locations tree and can later have provinces, ridings, and Strategic Plans added.
                        </p>
                    </div>
                </div>
                
                <!-- Location Moderators Card (Admin tools) -->
                <div class="card">
                    <div class="card-header"><h3 class="card-title">👥 Location Moderators (Admin)</h3></div>
                    <div class="card-body">
                        <p class="card-subtitle" style="margin-bottom: 8px;">
                            Assign moderators to specific locations (ridings, towns, First Nations, or adhoc groups).
                            Moderators will later be able to help with local questions and content review.
                        </p>
                        <div class="form-group">
                            <label for="mod-location-type">Location type</label>
                            <select id="mod-location-type" class="form-select">
                                <option value="federal-ridings">Federal Riding</option>
                                <option value="provincial-ridings">Provincial Riding</option>
                                <option value="towns">Town</option>
                                <option value="first-nations">First Nation</option>
                                <option value="adhoc-groups">Adhoc Group</option>
                                <option value="provinces">Province</option>
                                <option value="countries">Country</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="mod-location-id">Location ID</label>
                            <input id="mod-location-id" class="form-input" placeholder="e.g. riding or group ID">
                            <p class="form-help" style="margin-top:4px;">
                                Use the location ID from the database or admin tools. This stays internal (not shown to players).
                            </p>
                        </div>
                        <div class="form-group">
                            <label for="mod-user-select">Moderator user</label>
                            <select id="mod-user-select" class="form-select">
                                <option value="">-- Select user --</option>
                            </select>
                        </div>
                        <button class="admin-btn primary" id="mod-assign-btn">➕ Assign Moderator</button>
                        <div id="mod-assign-result" class="form-feedback" style="margin-top: 8px;"></div>
                        
                        <hr style="margin: 16px 0; border-color: var(--border-color);">
                        <button class="admin-btn" id="mod-refresh-list-btn">🔍 Show Moderators for Location</button>
                        <div id="mod-list-result" class="form-feedback" style="margin-top: 8px;"></div>
                        <ul id="mod-list" class="locations-list" style="margin-top: 8px; max-height: 160px; overflow-y:auto;"></ul>
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

        if (typeof App.initAdminAudioSettings === 'function') {
            App.initAdminAudioSettings();
        }
        if (typeof App.initModeratorAdminPanel === 'function') {
            App.initModeratorAdminPanel();
        }

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

// ============================================
// ADMIN: LOCATIONS & COUNTRIES
// ============================================

App.addCountry = async function() {
    const idInput = document.getElementById('admin-country-id');
    const nameInput = document.getElementById('admin-country-name');
    const codeInput = document.getElementById('admin-country-code');
    const feedback = document.getElementById('admin-country-feedback');

    if (!idInput || !nameInput || !feedback) return;

    const id = idInput.value.trim();
    const name = nameInput.value.trim();
    const code = codeInput ? codeInput.value.trim() : '';

    feedback.textContent = '';
    feedback.classList.remove('error', 'success');

    if (!id || !name) {
        feedback.textContent = 'Please provide both a Country ID and a Country Name.';
        feedback.classList.add('error');
        return;
    }

    if (!confirm(`Create or update country "${name}" (ID: ${id})?`)) {
        return;
    }

    try {
        feedback.textContent = 'Saving country...';
        const payload = { id, name };
        if (code) payload.code = code;

        const { data } = await App.apiPost('/locations/countries', payload);
        const result = data || {};

        feedback.textContent = `✅ Saved country "${result.name || name}" (ID: ${result.id || id}, provinces: ${result.provinceCount || 0}).`;
        feedback.classList.add('success');

        // Keep ID for quick edits, clear name/code for next entry
        nameInput.value = '';
        if (codeInput) codeInput.value = '';

        // Refresh pages that rely on the unified location tree
        const currentPage = (window.location.hash || '').slice(1);
        if (['members', 'ideas', 'planning'].includes(currentPage) && App.pages[currentPage]) {
            setTimeout(() => App.pages[currentPage](), 500);
        }
    } catch (err) {
        console.error('Failed to save country', err);
        feedback.textContent = `Error saving country: ${err.message || 'Unknown error'}`;
        feedback.classList.add('error');
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

/**
 * Admin: Location Moderators panel
 * - Admins can assign moderators to locations and view existing moderators.
 * - Uses App.allUsers loaded by initUserSelector for the user dropdown.
 */
App.initModeratorAdminPanel = function() {
    const userSelect = document.getElementById('mod-user-select');
    const typeSelect = document.getElementById('mod-location-type');
    const locIdInput = document.getElementById('mod-location-id');
    const assignBtn = document.getElementById('mod-assign-btn');
    const assignResultEl = document.getElementById('mod-assign-result');
    const refreshBtn = document.getElementById('mod-refresh-list-btn');
    const listResultEl = document.getElementById('mod-list-result');
    const listEl = document.getElementById('mod-list');

    if (!userSelect || !typeSelect || !locIdInput || !assignBtn || !refreshBtn || !listEl) {
        return;
    }

    // Populate user dropdown from App.allUsers if available
    try {
        const users = Array.isArray(App.allUsers) ? App.allUsers : [];
        userSelect.innerHTML =
            '<option value=\"\">-- Select user --</option>' +
            users
                .map(
                    (u) =>
                        `<option value=\"${u.id}\">${(u.name || '(no name)').replace(
                            /\"/g,
                            '&quot;'
                        )}${u.email ? ' – ' + u.email : ''}</option>`
                )
                .join('');
    } catch (e) {
        // ignore; leave default option
    }

    const clearAssignFeedback = () => {
        if (assignResultEl) {
            assignResultEl.textContent = '';
            assignResultEl.classList.remove('error', 'success');
        }
    };

    const clearListFeedback = () => {
        if (listResultEl) {
            listResultEl.textContent = '';
            listResultEl.classList.remove('error', 'success');
        }
    };

    assignBtn.addEventListener('click', async () => {
        clearAssignFeedback();

        const userId = userSelect.value;
        const type = typeSelect.value;
        const locId = locIdInput.value.trim();

        if (!userId || !type || !locId) {
            if (assignResultEl) {
                assignResultEl.textContent =
                    'Please select a user, choose a location type, and enter a location ID.';
                assignResultEl.classList.add('error');
            }
            return;
        }

        assignBtn.disabled = true;
        try {
            const { response, data } = await App.apiPost(
                `/locations/${encodeURIComponent(type)}/${encodeURIComponent(locId)}/moderators`,
                { userId }
            );
            if (!response.ok) {
                if (assignResultEl) {
                    assignResultEl.textContent =
                        (data && data.error) || 'Unable to assign moderator (admin only).';
                    assignResultEl.classList.add('error');
                }
            } else if (assignResultEl) {
                assignResultEl.textContent = 'Moderator assigned.';
                assignResultEl.classList.add('success');
            }
        } catch (err) {
            if (assignResultEl) {
                assignResultEl.textContent = err.message || 'Unexpected error assigning moderator.';
                assignResultEl.classList.add('error');
            }
        } finally {
            assignBtn.disabled = false;
        }
    });

    refreshBtn.addEventListener('click', async () => {
        clearListFeedback();
        listEl.innerHTML = '';

        const type = typeSelect.value;
        const locId = locIdInput.value.trim();

        if (!type || !locId) {
            if (listResultEl) {
                listResultEl.textContent = 'Enter a location ID and type first.';
                listResultEl.classList.add('error');
            }
            return;
        }

        try {
            const mods = await App.api(
                `/locations/${encodeURIComponent(type)}/${encodeURIComponent(locId)}/moderators`
            );
            if (!mods.length) {
                listEl.innerHTML = '<li>No moderators assigned yet.</li>';
                return;
            }

            listEl.innerHTML = mods
                .map(
                    (m) => `
                <li>
                    ${m.name}${m.email ? ` <span class=\"location-type\">(${m.email})</span>` : ''}
                </li>
            `
                )
                .join('');
        } catch (err) {
            if (listResultEl) {
                listResultEl.textContent =
                    err.message || 'Unable to load moderators (admin only, check permissions).';
                listResultEl.classList.add('error');
            }
        }
    });
};
/**
 * Dev-only helpers for attaching voice notes to Ideas using localStorage.
 */
App.saveIdeaVoiceNote = function(ideaId, blob, createdAt) {
    if (!ideaId || !blob) return;
    const PREFIX = 'devIdeaVoice_';
    try {
        const reader = new FileReader();
        reader.onloadend = () => {
            const dataUrl = reader.result;
            const payload = {
                createdAt,
                dataUrl
            };
            try {
                localStorage.setItem(PREFIX + ideaId, JSON.stringify(payload));
            } catch (e) {
                // eslint-disable-next-line no-console
                console.warn('Failed to save dev idea voice note:', e);
            }
        };
        reader.readAsDataURL(blob);
    } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('Failed to prepare dev idea voice note for saving:', e);
    }
};

App.loadIdeaVoiceNote = function(ideaId) {
    if (!ideaId) return null;
    const PREFIX = 'devIdeaVoice_';
    try {
        const raw = localStorage.getItem(PREFIX + ideaId);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || !parsed.dataUrl || !parsed.createdAt) {
            localStorage.removeItem(PREFIX + ideaId);
            return null;
        }
        const ageMs = Date.now() - parsed.createdAt;
        const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
        if (ageMs > twoDaysMs) {
            localStorage.removeItem(PREFIX + ideaId);
            return null;
        }
        return parsed.dataUrl;
    } catch (e) {
        localStorage.removeItem(PREFIX + ideaId);
        return null;
    }
};

/**
 * Admin: Audio settings for News voice notes.
 * - Stores max seconds in localStorage.devVoiceMaxSeconds (per browser).
 * - Can trigger backend cleanup of expired News audio files.
 */
App.initAdminAudioSettings = function() {
    const maxInput = document.getElementById('admin-audio-max-seconds');
    const saveBtn = document.getElementById('admin-audio-save');
    const saveResultEl = document.getElementById('admin-audio-settings-result');
    const cleanupBtn = document.getElementById('admin-audio-cleanup');
    const cleanupResultEl = document.getElementById('admin-audio-cleanup-result');

    if (!maxInput || !saveBtn || !cleanupBtn) {
        return;
    }

    // Initialize from localStorage if present
    try {
        const raw = localStorage.getItem('devVoiceMaxSeconds');
        const num = raw ? parseInt(raw, 10) : NaN;
        if (Number.isFinite(num) && num > 0 && num <= 60) {
            maxInput.value = String(num);
        }
    } catch (e) {
        // ignore
    }

    saveBtn.addEventListener('click', () => {
        if (saveResultEl) {
            saveResultEl.textContent = '';
            saveResultEl.classList.remove('error', 'success');
        }

        const value = maxInput.value.trim();
        const num = value ? parseInt(value, 10) : NaN;

        if (!Number.isFinite(num) || num < 5 || num > 60) {
            if (saveResultEl) {
                saveResultEl.textContent = 'Please enter a value between 5 and 60 seconds.';
                saveResultEl.classList.add('error');
            }
            return;
        }

        try {
            localStorage.setItem('devVoiceMaxSeconds', String(num));
            if (saveResultEl) {
                saveResultEl.textContent = `Saved. New max length is ${num} second(s) for this browser.`;
                saveResultEl.classList.add('success');
            }
        } catch (e) {
            if (saveResultEl) {
                saveResultEl.textContent = 'Unable to save setting in this browser.';
                saveResultEl.classList.add('error');
            }
        }
    });

    cleanupBtn.addEventListener('click', async () => {
        if (!confirm('Run cleanup of expired News audio files on the server?')) {
            if (cleanupResultEl) {
                cleanupResultEl.textContent = 'Cancelled.';
                cleanupResultEl.classList.remove('error');
                cleanupResultEl.classList.add('success');
            }
            return;
        }

        if (cleanupResultEl) {
            cleanupResultEl.textContent = 'Running cleanup...';
            cleanupResultEl.classList.remove('error', 'success');
        }

        try {
            const { response, data } = await App.apiPost('/news/cleanup-audio', {});
            if (!response.ok) {
                if (cleanupResultEl) {
                    cleanupResultEl.textContent =
                        data && data.error ? data.error : 'Failed to run audio cleanup (feature may be disabled).';
                    cleanupResultEl.classList.add('error');
                }
            } else {
                const removed = data && typeof data.removed === 'number' ? data.removed : 0;
                if (cleanupResultEl) {
                    cleanupResultEl.textContent = `Cleanup complete. Removed ${removed} expired audio entr${
                        removed === 1 ? 'y' : 'ies'
                    }.`;
                    cleanupResultEl.classList.add('success');
                }
            }
        } catch (err) {
            if (cleanupResultEl) {
                cleanupResultEl.textContent = `Error: ${err.message}`;
                cleanupResultEl.classList.add('error');
            }
        }
    });
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

// Mark the extended bundle as loaded when this file is included via a static
// <script> tag. This prevents App.loadExtendedBundleIfMissing() from
// dynamically re-fetching and eval'ing pages-extended.js later, which would
// otherwise override page implementations (like App.pages.admin) that are
// defined in later scripts such as admin-page.js.
try {
    window.App = window.App || {};
    App._extendedBundleLoaded = true;
} catch (e) {
    // Ignore if window/App are not available for some reason.
}

// ============================================
// CANDIDACY & NOMINATION ACTIONS
// ============================================

/**
 * Declare candidacy for the current convention
 * Anyone can run - no nominations required!
 */
App.declareCandidacy = async function(convId) {
    if (!App.requireVerifiedAuth || !App.requireVerifiedAuth()) {
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
    if (!App.requireVerifiedAuth || !App.requireVerifiedAuth()) {
        return;
    }
    if (!confirm('Are you sure you want to decline this nomination?')) return;

    try {
        const { data } = await App.apiPost(`/conventions/${convId}/decline-nomination`, { userId: App.authUser.id, raceId });
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
    if (!App.requireVerifiedAuth || !App.requireVerifiedAuth()) {
        return;
    }
    if (!confirm('Are you sure you want to withdraw from this race?')) return;

    try {
        const { data } = await App.apiPost(`/conventions/${convId}/withdraw`, { userId: App.authUser.id, raceId });
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
        const canNominate = hasLocation && App.authUser && App.authUser.id !== userId;
        
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
                        ${!App.authUser ? '<p class="nominate-hint">Sign in to nominate this member.</p>' :
                          App.authUser.id === userId ? '<p class="nominate-hint">You cannot nominate yourself.</p>' :
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
                        ${!App.authUser ? '<p class="nominate-hint">Sign in to endorse this member.</p>' :
                          App.authUser.id === userId ? '<p class="nominate-hint">You cannot endorse yourself.</p>' :
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
                        nominatorId: App.authUser.id,
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
                    const { response, data } = await App.apiPost(`/users/${App.authUser.id}/endorse`, {
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

