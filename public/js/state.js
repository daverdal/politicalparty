/**
 * Application State
 * Manages global state for the app
 */

window.App = window.App || {};

// ============================================
// THEME STATE
// ============================================

App.currentTheme = localStorage.getItem('theme') || 'vt100';

App.initTheme = function() {
    const savedTheme = localStorage.getItem('theme');
    // VT100 is default - only disable if explicitly set to 'default'
    if (savedTheme !== 'default') {
        document.documentElement.setAttribute('data-theme', 'vt100');
        App.currentTheme = 'vt100';
    }
};

App.toggleTheme = function(useVT100) {
    if (useVT100) {
        document.documentElement.setAttribute('data-theme', 'vt100');
        localStorage.setItem('theme', 'vt100');
        App.currentTheme = 'vt100';
    } else {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('theme', 'default');
        App.currentTheme = 'default';
    }
};

// ============================================
// AUTH STATE
// ============================================

App.authUser = null;

App.setAuthUser = function(user) {
    App.authUser = user || null;
    if (typeof App.updateAuthUi === 'function') {
        App.updateAuthUi();
    }
    if (typeof App.refreshNotifications === 'function') {
        App.refreshNotifications();
    }
};

App.loadAuthUser = async function() {
    try {
        const user = await App.api('/auth/me');
        App.setAuthUser(user);
    } catch (err) {
        // Not logged in or token invalid - ignore
        App.setAuthUser(null);
    }
};

// Track whether the user has configured at least one home location / riding.
// We persist this in localStorage as a simple boolean so the router can guard
// navigation even before we've loaded full profile details.
App.hasBasicLocationsConfigured = function() {
    try {
        return localStorage.getItem('hasBasicLocations') === '1';
    } catch (e) {
        return false;
    }
};

App.requireVerifiedAuth = function() {
    if (!App.authUser) {
        alert('Please sign in to perform this action.');
        if (typeof App.showAuthModal === 'function') {
            App.showAuthModal('login');
        }
        return false;
    }
    if (!App.authUser.verified) {
        alert('Please verify your email before performing this action. Check your inbox for a verification email.');
        return false;
    }
    return true;
};

// ============================================
// CURRENT USER STATE
// ============================================

App.currentUser = null;
App.allUsers = [];

App.initUserSelector = async function() {
    try {
        const selector = document.getElementById('current-user-select');
        const wrapper = selector ? selector.closest('.user-selector') : null;
        const isAdmin = App.authUser && App.authUser.role === 'admin';

        // Sync currentUser with the authenticated user for everyone by default
        if (App.authUser) {
            App.currentUser = {
                id: App.authUser.id,
                name: App.authUser.name,
                email: App.authUser.email,
                candidate: App.authUser.candidate,
                region: App.authUser.region
            };
            localStorage.setItem('currentUserId', App.currentUser.id);
        } else {
            App.currentUser = null;
            localStorage.removeItem('currentUserId');
        }

        // Only admins see (and can use) the "Playing as" selector
        if (!isAdmin) {
            if (wrapper) {
                wrapper.style.display = 'none';
            }
            return;
        }

        if (!selector) return;

        // Admin view: full "Playing as" selector for testing/management
        // Load all users once (needed for admin "playing as" selector)
        App.allUsers = await App.api('/users');

        if (wrapper) {
            wrapper.style.display = '';
        }

        selector.innerHTML = `
            <option value="">-- Select a user --</option>
            ${App.allUsers.map(u => `
                <option value="${u.id}">
                    ${u.name || '(no name)'}${u.candidate ? ' ⭐' : ''}
                    ${u.email ? ' – ' + u.email : ''}
                </option>
            `).join('')}
        `;

        // Restore from localStorage, but only for admins
        const savedUserId = localStorage.getItem('currentUserId');
        if (savedUserId) {
            selector.value = savedUserId;
            const match = App.allUsers.find(u => u.id === savedUserId);
            App.currentUser = match || App.currentUser;
        }

        // Handle selection change (admin-only impersonation)
        selector.addEventListener('change', (e) => {
            const userId = e.target.value;
            if (userId) {
                App.currentUser = App.allUsers.find(u => u.id === userId) || App.currentUser;
                localStorage.setItem('currentUserId', App.currentUser.id);
            } else if (App.authUser) {
                App.currentUser = {
                    id: App.authUser.id,
                    name: App.authUser.name,
                    email: App.authUser.email,
                    candidate: App.authUser.candidate,
                    region: App.authUser.region
                };
                localStorage.setItem('currentUserId', App.currentUser.id);
            } else {
                App.currentUser = null;
                localStorage.removeItem('currentUserId');
            }
            // Refresh current page
            const currentPage = window.location.hash.slice(1) || 'dashboard';
            if (App.pages[currentPage]) App.pages[currentPage]();
        });
    } catch (err) {
        console.error('Failed to load users:', err);
    }
};

App.getCurrentUser = function() {
    return App.currentUser;
};

// ============================================
// BROWSE STATE (Ideas)
// ============================================

App.browseState = {
    selectedLocation: null,
    selectedLocationType: null,
    selectedLocationName: null,
    selectedIdea: null,
    expandedNodes: new Set(),
    currentIdeas: [],
    provinceData: {}
};

// ============================================
// CANDIDATES STATE
// ============================================

App.candidatesState = {
    selectedLocation: null,
    selectedLocationType: null,
    selectedCandidate: null,
    expandedNodes: new Set(),
    currentCandidates: [],
    sortBy: 'points' // 'points' or 'endorsements'
};

