/**
 * Political Party App
 * Main router and initialization
 * 
 * Dependencies (load in order):
 * 1. utils.js - API helpers and formatting
 * 2. state.js - Application state
 * 3. components.js - Reusable UI components  
 * 4. pages.js - Basic page loaders
 * 5. pages-extended.js - Profile, Convention, Admin pages
 * 6. app.js - This file (router + init)
 */

window.App = window.App || {};

// ============================================
// ROUTER
// ============================================

App.navigate = function(page) {
    // Update active nav link
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.dataset.page === page) {
            link.classList.add('active');
        }
    });
    
    // Load page
    if (App.pages[page]) {
        App.pages[page]();
        history.pushState({ page }, '', `#${page}`);
    }
};

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize theme
    App.initTheme();
    
    // Load authenticated user (if any) and update auth UI
    if (typeof App.loadAuthUser === 'function') {
        await App.loadAuthUser();
    }

    // Initialize user selector (depends on authUser to decide admin-only controls)
    if (typeof App.initUserSelector === 'function') {
        await App.initUserSelector();
    }

    // Initialize notifications UI
    if (typeof App.initNotificationsUi === 'function') {
        App.initNotificationsUi();
    }
    
    // Set up navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            App.navigate(link.dataset.page);
        });
    });
    
    // Handle browser back/forward
    window.addEventListener('popstate', (e) => {
        const page = e.state?.page || 'dashboard';
        App.navigate(page);
    });
    
    // Load initial page from hash or default to dashboard
    const initialPage = window.location.hash.slice(1) || 'dashboard';
    App.navigate(initialPage);
});
