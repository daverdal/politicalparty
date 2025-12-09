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
// CURRENT USER STATE (legacy \"playing as\" selector)
// ============================================

App.currentUser = null;
App.allUsers = [];

App.initUserSelector = async function() {
    try {
        App.allUsers = await App.api('/users');
        const selector = document.getElementById('current-user-select');
        if (!selector) return;
        
        selector.innerHTML = `
            <option value="">-- Select a user --</option>
            ${App.allUsers.map(u => `
                <option value="${u.id}">${u.name}${u.candidate ? ' ⭐' : ''}</option>
            `).join('')}
        `;
        
        // Restore from localStorage
        const savedUserId = localStorage.getItem('currentUserId');
        if (savedUserId) {
            selector.value = savedUserId;
            App.currentUser = App.allUsers.find(u => u.id === savedUserId);
        }
        
        // Handle selection change
        selector.addEventListener('change', (e) => {
            const userId = e.target.value;
            if (userId) {
                App.currentUser = App.allUsers.find(u => u.id === userId);
                localStorage.setItem('currentUserId', userId);
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

