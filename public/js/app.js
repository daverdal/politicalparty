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
    const targetPage = page || 'map';

    // Update active nav link
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.dataset.page === targetPage) {
            link.classList.add('active');
        }
    });
    
    // Load page with basic error shielding so navigation never silently fails
    if (App.pages && typeof App.pages[targetPage] === 'function') {
        try {
            App.pages[targetPage]();
        } catch (err) {
            console.error('Error rendering page', targetPage, err);
            const content = document.getElementById('content');
            if (content) {
                content.innerHTML = `
                    <div class="card">
                        <div class="card-body">
                            <p class="empty-text">
                                Error loading page: <strong>${targetPage}</strong> – ${err.message || err}.
                            </p>
                        </div>
                    </div>
                `;
            }
        }
        history.pushState({ page: targetPage }, '', `#${targetPage}`);
    } else {
        // Fallback to map if page is unknown
        if (targetPage !== 'map') {
            App.navigate('map');
        }
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

    // Ensure auth UI is rendered once scripts are fully loaded
    if (typeof App.updateAuthUi === 'function') {
        App.updateAuthUi();
    }

    // Initialize lightweight client debug console so errors are visible in the UI
    if (typeof App.initClientDebugConsole === 'function') {
        App.initClientDebugConsole();
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
        const page = e.state?.page || 'map';
        App.navigate(page);
    });
    
    // Load initial page from hash or default to map
    const initialPage = window.location.hash.slice(1) || 'map';
    App.navigate(initialPage);
});
