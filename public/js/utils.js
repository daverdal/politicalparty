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

