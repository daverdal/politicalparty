/**
 * Application State
 * Manages global state for the app
 */

window.App = window.App || {};

// ============================================
// CURRENT USER STATE
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

