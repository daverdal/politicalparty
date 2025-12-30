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
        // Fallback to map if page is unknown, but log it so we can see missing pages
        try {
            if (typeof App.logClientEvent === 'function') {
                App.logClientEvent('error', 'Page function not found', {
                    page: targetPage,
                    availablePages: App.pages ? Object.keys(App.pages) : []
                });
            }
        } catch (e) {
            // ignore
        }

        // Fallback to map if page is unknown
        if (targetPage !== 'map') {
            App.navigate('map');
        }
    }
};

// Attempt to dynamically load the extended UI bundle if key pages are missing.
App.loadExtendedBundleIfMissing = async function() {
    try {
        if (App._extendedBundleLoaded) {
            return;
        }

        const url = `/js/pages-extended.js?dt=${Date.now()}`;
        if (typeof App.logClientEvent === 'function') {
            App.logClientEvent('info', 'Attempting dynamic load of pages-extended.js', { url });
        }

        const resp = await fetch(url);
        if (!resp.ok) {
            if (typeof App.logClientEvent === 'function') {
                App.logClientEvent('error', 'Failed to fetch pages-extended.js', {
                    status: resp.status,
                    statusText: resp.statusText
                });
            }
            return;
        }

        const code = await resp.text();

        try {
            // Evaluate the bundle in the global scope
            (0, eval)(code);
        } catch (e) {
            if (typeof App.logClientEvent === 'function') {
                App.logClientEvent('error', 'Error evaluating pages-extended.js', {
                    message: e.message,
                    stack: e.stack
                });
            }
            return;
        }

        App._extendedBundleLoaded = true;
        if (typeof App.logClientEvent === 'function') {
            App.logClientEvent('info', 'pages-extended.js dynamically loaded', {
                pages: App.pages ? Object.keys(App.pages) : [],
                hasUpdateAuthUi: typeof App.updateAuthUi
            });
        }
    } catch (e) {
        if (typeof App.logClientEvent === 'function') {
            App.logClientEvent('error', 'Unexpected error in loadExtendedBundleIfMissing', {
                message: e.message,
                stack: e.stack
            });
        }
    }
};

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize theme
    App.initTheme();
    
    // Log basic app boot info
    try {
        if (typeof App.logClientEvent === 'function') {
            App.logClientEvent('info', 'App DOMContentLoaded', {
                hasPages: !!App.pages,
                pages: App.pages ? Object.keys(App.pages) : [],
                hasUpdateAuthUi: typeof App.updateAuthUi,
                hasClientDebug: typeof App.initClientDebugConsole
            });
        }
    } catch (e) {
        // ignore
    }

    // Load authenticated user (if any) and update auth UI
    if (typeof App.loadAuthUser === 'function') {
        await App.loadAuthUser();
    }

    // Ensure auth UI is rendered once scripts are fully loaded
    if (typeof App.updateAuthUi === 'function') {
        App.updateAuthUi();
    }

    // Try to dynamically load the extended UI bundle if it hasn't wired in yet
    if (typeof App.loadExtendedBundleIfMissing === 'function') {
        await App.loadExtendedBundleIfMissing();
        // After loading, try to refresh auth UI again in case it was defined by the bundle
        if (typeof App.updateAuthUi === 'function') {
            App.updateAuthUi();
        }
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
