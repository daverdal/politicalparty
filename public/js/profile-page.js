/**
 * Profile Page - core implementation
 * Standalone file so we don't bloat pages.js and we avoid the broken extended bundle.
 */

window.App = window.App || {};
App.pages = App.pages || {};

// Log when this standalone profile bundle loads
try {
    if (typeof App.logClientEvent === 'function') {
        App.logClientEvent('info', 'profile-page.js loaded (standalone)', {});
    }
} catch (e) {
    // ignore debug errors
}

// Core Profile implementation
App.pages.profile = async function () {
    const content = document.getElementById('content');

    // Require sign-in for Profile
    if (!App.authUser) {
        content.innerHTML = `
            <header class="page-header">
                <h1 class="page-title">👤 My Profile</h1>
            </header>
            <div class="card">
                <div class="card-body">
                    <p class="empty-text">
                        Please sign in to view your profile.
                    </p>
                    <button class="btn btn-secondary btn-sm" id="profile-signin-btn">
                        Sign in
                    </button>
                </div>
            </div>
        `;
        const btn = document.getElementById('profile-signin-btn');
        if (btn && typeof App.showAuthModal === 'function') {
            btn.addEventListener('click', () => App.showAuthModal('login'));
        }
        return;
    }

    try {
        if (typeof App.logClientEvent === 'function') {
            App.logClientEvent('info', 'App.pages.profile rendering', {
                userId: App.authUser && App.authUser.id
            });
        }
    } catch (e) {
        // ignore debug errors
    }

    content.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    // Decide which tab should be active first. By default it's "locations"
    // so users are encouraged to set their home locations. Other flows can
    // still override this by setting App.profileInitialTab explicitly.
    const initialTab = App.profileInitialTab || 'locations';
    // Reset after reading so subsequent visits behave normally unless
    // explicitly overridden again.
    App.profileInitialTab = null;

    try {
        const [userDetails, badges] = await Promise.all([
            App.api(`/users/${App.authUser.id}`),
            App.api(`/users/${App.authUser.id}/badges`).catch(() => [])
        ]);

        const locations =
            (userDetails.locations && userDetails.locations.length
                ? userDetails.locations.map((l) => l.name).join(' • ')
                : App.authUser.region || 'No locations set');

        // If the backend reports any saved "real world" locations (federal or
        // provincial riding, town, or First Nation), remember that this user
        // has satisfied the basic home-location requirement. Pure adhoc groups
        // do not count for this guard.
        if (userDetails.locations && userDetails.locations.length) {
            const hasGeographicLocation = userDetails.locations.some(
                (loc) =>
                    loc &&
                    loc.type &&
                    loc.type !== 'AdhocGroup'
            );
            try {
                if (hasGeographicLocation) {
                    localStorage.setItem('hasBasicLocations', '1');
                } else {
                    // Only adhoc groups or legacy data – treat as not configured
                    localStorage.removeItem('hasBasicLocations');
                }
            } catch (e) {
                // ignore storage errors
            }
        } else {
            // No saved locations at all – clear any stale flag
            try {
                localStorage.removeItem('hasBasicLocations');
            } catch (e) {
                // ignore storage errors
            }
        }

        const baseUrl = window.location.origin;
        const existingResumeShareUrl =
            userDetails.resumePublic && userDetails.resumePublicToken
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
                            <p class="profile-region">${locations}</p>
                            <p class="profile-region">${App.authUser.email}</p>
                        </div>
                    </div>
                </div>
                <div class="card-body">
                    <p class="profile-bio">${userDetails.bio || 'You can add a short bio on your profile.'}</p>
                    <div class="profile-stats">
                        <div class="profile-stat">
                            <span class="profile-stat-value">${userDetails.points || 0}</span>
                            <span class="profile-stat-label">Points</span>
                        </div>
                        <div class="profile-stat">
                            <span class="profile-stat-value">${userDetails.endorsementCount || 0}</span>
                            <span class="profile-stat-label">Endorsements</span>
                        </div>
                    </div>

                    <div class="profile-tabs">
                        <button class="profile-tab-button ${initialTab === 'locations' ? 'active' : ''}" data-tab="locations">Locations</button>
                        <button class="profile-tab-button ${initialTab === 'resume' ? 'active' : ''}" data-tab="resume">Resume</button>
                        <button class="profile-tab-button ${initialTab === 'badges' ? 'active' : ''}" data-tab="badges">Badges</button>
                    </div>

                    <div class="profile-tab-panels">
                        <section class="profile-tab-panel ${initialTab === 'locations' ? 'active' : ''}" data-tab="locations">
                            <div class="location-selector-section">
                                <h4>My Locations</h4>
                                <p class="location-help">
                                    Choose your home locations so Strategic Planning and candidates can use them.
                                </p>

                                <div class="location-selector-row">
                                    <label>Country</label>
                                    <select id="profile-country-select" class="form-select">
                                        <option value="">Select country</option>
                                    </select>
                                </div>

                                <div class="location-selector-row">
                                    <label>Province / Territory</label>
                                    <select id="profile-province-select" class="form-select" disabled>
                                        <option value="">Select province</option>
                                    </select>
                                </div>

                                <div class="location-selector-row">
                                    <label>Federal Riding</label>
                                    <select id="profile-federal-select" class="form-select" disabled>
                                        <option value="">Optional – select federal riding</option>
                                    </select>
                                </div>

                                <div class="location-selector-row">
                                    <label>Provincial Riding</label>
                                    <select id="profile-provincial-select" class="form-select" disabled>
                                        <option value="">Optional – select provincial riding</option>
                                    </select>
                                </div>

                                <div class="location-selector-row">
                                    <label>Town</label>
                                    <select id="profile-town-select" class="form-select" disabled>
                                        <option value="">Optional – select town</option>
                                    </select>
                                </div>

                                <div class="location-selector-row">
                                    <label>First Nation</label>
                                    <select id="profile-firstnation-select" class="form-select" disabled>
                                        <option value="">Optional – select First Nation</option>
                                    </select>
                                </div>

                                <div class="location-selector-row">
                                    <label>Ad-hoc Group</label>
                                    <select id="profile-adhoc-select" class="form-select" disabled>
                                        <option value="">Optional – select group</option>
                                    </select>
                                </div>

                                <button class="btn btn-primary btn-lg" id="profile-locations-save-btn" style="margin-top: 12px;">
                                    Save locations
                                </button>
                                <div id="profile-locations-feedback" class="profile-resume-feedback"></div>
                            </div>
                        </section>

                        <section class="profile-tab-panel ${initialTab === 'resume' ? 'active' : ''}" data-tab="resume">
                            <div class="profile-resume-section">
                                <h4>My Resume</h4>
                                <p class="resume-help">
                                    Paste your resume or professional summary below. This helps members understand your background.
                                </p>
                                <textarea id="profile-resume-input" class="form-textarea" rows="8" placeholder="Paste your resume here...">${userDetails.resume || ''}</textarea>
                                <label class="checkbox-inline">
                                    <input type="checkbox" id="profile-resume-public" ${userDetails.resumePublic ? 'checked' : ''}>
                                    <span>Make my resume visible to anyone with the link</span>
                                </label>
                                <div class="resume-share" id="profile-resume-share">
                                    ${
                                        existingResumeShareUrl
                                            ? `<span class="resume-share-label">Public link:</span>
                                               <a href="${existingResumeShareUrl}" target="_blank" rel="noopener">${existingResumeShareUrl}</a>`
                                            : '<span class="resume-share-help">Turn on "Make my resume visible" and save to get a shareable link.</span>'
                                    }
                                </div>
                                <button class="btn btn-primary btn-lg" id="profile-resume-save-btn" style="margin-top: 12px;">
                                    Save resume
                                </button>
                                <div id="profile-resume-feedback" class="profile-resume-feedback"></div>
                            </div>
                        </section>

                        <section class="profile-tab-panel ${initialTab === 'badges' ? 'active' : ''}" data-tab="badges">
                            <div class="badge-shelf">
                                <div class="badge-shelf-title">Badges</div>
                                ${
                                    badges && badges.length
                                        ? `
                                    <div class="badge-row">
                                        ${badges
                                            .map((b) => {
                                                const scopeLabel = b.scope === 'local' ? 'Local' : 'Global';
                                                const levelLabel = b.level
                                                    ? b.level.charAt(0).toUpperCase() + b.level.slice(1)
                                                    : '';
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
                                        : '<p class="empty-text">Earn badges by collecting support for your ideas and participation.</p>'
                                }
                            </div>
                        </section>

                        <section class="profile-tab-panel ${initialTab === 'locations' ? 'active' : ''}" data-tab="locations">
                    </div>
                </div>
            </div>
        `;

        // Tab switching
        const tabButtons = content.querySelectorAll('.profile-tab-button');
        const tabPanels = content.querySelectorAll('.profile-tab-panel');
        tabButtons.forEach((btn) => {
            btn.addEventListener('click', () => {
                const tab = btn.getAttribute('data-tab');
                tabButtons.forEach((b) => b.classList.toggle('active', b === btn));
                tabPanels.forEach((panel) =>
                    panel.classList.toggle('active', panel.getAttribute('data-tab') === tab)
                );
            });
        });

        // Resume save handler (backend will enforce "verified" via middleware)
        const resumeInput = document.getElementById('profile-resume-input');
        const resumePublicCheckbox = document.getElementById('profile-resume-public');
        const resumeSaveBtn = document.getElementById('profile-resume-save-btn');
        const resumeFeedback = document.getElementById('profile-resume-feedback');
        const resumeShare = document.getElementById('profile-resume-share');

        if (resumeSaveBtn && resumeInput && resumePublicCheckbox && resumeFeedback) {
            resumeSaveBtn.addEventListener('click', async () => {
                resumeFeedback.textContent = '';
                resumeFeedback.classList.remove('error', 'success');
                resumeSaveBtn.disabled = true;
                resumeSaveBtn.textContent = 'Saving...';

                try {
                    const { response, data } = await App.apiPut(
                        `/users/${encodeURIComponent(App.authUser.id)}/resume`,
                        {
                            resume: resumeInput.value,
                            makePublic: !!resumePublicCheckbox.checked
                        }
                    );

                    if (!response.ok || !data || !data.success) {
                        resumeFeedback.textContent =
                            (data && data.error) || 'Could not save your resume right now.';
                        resumeFeedback.classList.add('error');
                    } else {
                        resumeFeedback.textContent = 'Resume saved.';
                        resumeFeedback.classList.add('success');

                        if (resumeShare) {
                            if (data.shareUrl) {
                                resumeShare.innerHTML = `
                                    <span class="resume-share-label">Public link:</span>
                                    <a href="${data.shareUrl}" target="_blank" rel="noopener">${data.shareUrl}</a>
                                `;
                            } else {
                                resumeShare.innerHTML =
                                    '<span class="resume-share-help">Turn on "Make my resume visible" and save to get a shareable link.</span>';
                            }
                        }
                    }
                } catch (err) {
                    resumeFeedback.textContent = err.message || 'Unable to save resume.';
                    resumeFeedback.classList.add('error');
                } finally {
                    resumeSaveBtn.disabled = false;
                    resumeSaveBtn.textContent = 'Save resume';
                }
            });
        }

        // Locations tab logic
        const countrySelect = document.getElementById('profile-country-select');
        const provinceSelect = document.getElementById('profile-province-select');
        const federalSelect = document.getElementById('profile-federal-select');
        const provincialSelect = document.getElementById('profile-provincial-select');
        const townSelect = document.getElementById('profile-town-select');
        const firstNationSelect = document.getElementById('profile-firstnation-select');
        const adhocSelect = document.getElementById('profile-adhoc-select');
        const locationsSaveBtn = document.getElementById('profile-locations-save-btn');
        const locationsFeedback = document.getElementById('profile-locations-feedback');

        if (
            countrySelect &&
            provinceSelect &&
            federalSelect &&
            provincialSelect &&
            townSelect &&
            firstNationSelect &&
            adhocSelect &&
            locationsSaveBtn &&
            locationsFeedback
        ) {
            // Map of the user's existing saved locations by type so we can
            // pre-populate the dropdowns when they return to this page.
            const existingLocations = Array.isArray(userDetails.locations)
                ? userDetails.locations
                : [];
            const existingByType = {};
            existingLocations.forEach((loc) => {
                if (!loc || !loc.type || !loc.id) return;
                if (!existingByType[loc.type]) {
                    existingByType[loc.type] = loc;
                }
            });
            const existingCountry = existingByType.Country || null;
            const existingProvince = existingByType.Province || null;
            const existingFederal = existingByType.FederalRiding || null;
            const existingProvincial = existingByType.ProvincialRiding || null;
            const existingTown = existingByType.Town || null;
            const existingFirstNation = existingByType.FirstNation || null;
            const existingAdhoc = existingByType.AdhocGroup || null;

            const typeToLabel = {
                Town: 'Town',
                FederalRiding: 'Federal Riding',
                ProvincialRiding: 'Provincial Riding',
                FirstNation: 'First Nation',
                AdhocGroup: 'Ad-hoc Group'
            };

            const fillSelect = (selectEl, items, placeholder) => {
                selectEl.innerHTML = '';
                const opt = document.createElement('option');
                opt.value = '';
                opt.textContent = placeholder;
                selectEl.appendChild(opt);
                items.forEach((item) => {
                    const o = document.createElement('option');
                    o.value = item.id;
                    o.textContent = item.name;
                    selectEl.appendChild(o);
                });
                selectEl.disabled = false;
            };

            const loadCountriesAndMaybeInitProvince = async () => {
                try {
                    const countries = await App.api('/locations/countries');
                    fillSelect(countrySelect, countries, 'Select country');

                    // Prefer the user's existing country if we know it; otherwise
                    // fall back to auto-selecting the only available option.
                    if (existingCountry) {
                        const match = countries.find((c) => c.id === existingCountry.id);
                        if (match) {
                            countrySelect.value = match.id;
                        }
                    } else if (!countrySelect.value && countries.length === 1) {
                        countrySelect.value = countries[0].id;
                    }

                    if (countrySelect.value) {
                        await loadProvinces(countrySelect.value, existingProvince && existingProvince.id);
                    }
                } catch (err) {
                    locationsFeedback.textContent =
                        'Unable to load countries. Locations may not be editable right now.';
                    locationsFeedback.classList.add('error');
                }
            };

            const loadProvinces = async (countryId, preselectProvinceId) => {
                if (!countryId) {
                    provinceSelect.disabled = true;
                    return;
                }
                try {
                    const provinces = await App.api(
                        `/locations/countries/${encodeURIComponent(countryId)}/provinces`
                    );
                    fillSelect(provinceSelect, provinces, 'Select province');

                    // If the user already has a province saved, preselect it and
                    // load its children so their full location tree appears.
                    const desiredProvinceId = preselectProvinceId || (existingProvince && existingProvince.id);
                    if (desiredProvinceId) {
                        const match = provinces.find((p) => p.id === desiredProvinceId);
                        if (match) {
                            provinceSelect.value = match.id;
                            await loadProvinceChildren(match.id, true);
                        }
                    }
                } catch (err) {
                    locationsFeedback.textContent = 'Unable to load provinces for this country.';
                    locationsFeedback.classList.add('error');
                }
            };

            const loadProvinceChildren = async (provinceId, isInitialHydration = false) => {
                if (!provinceId) {
                    [federalSelect, provincialSelect, townSelect, firstNationSelect, adhocSelect].forEach(
                        (sel) => {
                            sel.innerHTML = '';
                            sel.disabled = true;
                        }
                    );
                    return;
                }

                try {
                    const [federal, provincial, towns, firstNations, adhocGroups] = await Promise.all([
                        App.api(
                            `/locations/provinces/${encodeURIComponent(provinceId)}/federal-ridings`
                        ).catch(() => []),
                        App.api(
                            `/locations/provinces/${encodeURIComponent(provinceId)}/provincial-ridings`
                        ).catch(() => []),
                        App.api(`/locations/provinces/${encodeURIComponent(provinceId)}/towns`).catch(
                            () => []
                        ),
                        App.api(
                            `/locations/provinces/${encodeURIComponent(provinceId)}/first-nations`
                        ).catch(() => []),
                        App.api(
                            `/locations/provinces/${encodeURIComponent(provinceId)}/adhoc-groups`
                        ).catch(() => [])
                    ]);

                    if (federal.length) {
                        fillSelect(
                            federalSelect,
                            federal,
                            'Optional – select federal riding'
                        );
                        if (isInitialHydration && existingFederal) {
                            const match = federal.find((f) => f.id === existingFederal.id);
                            if (match) {
                                federalSelect.value = match.id;
                            }
                        }
                    } else {
                        federalSelect.innerHTML = '';
                        federalSelect.disabled = true;
                    }

                    if (provincial.length) {
                        fillSelect(
                            provincialSelect,
                            provincial,
                            'Optional – select provincial riding'
                        );
                        if (isInitialHydration && existingProvincial) {
                            const match = provincial.find((p) => p.id === existingProvincial.id);
                            if (match) {
                                provincialSelect.value = match.id;
                            }
                        }
                    } else {
                        provincialSelect.innerHTML = '';
                        provincialSelect.disabled = true;
                    }

                    if (towns.length) {
                        fillSelect(townSelect, towns, 'Optional – select town');
                        if (isInitialHydration && existingTown) {
                            const match = towns.find((t) => t.id === existingTown.id);
                            if (match) {
                                townSelect.value = match.id;
                            }
                        }
                    } else {
                        townSelect.innerHTML = '';
                        townSelect.disabled = true;
                    }

                    if (firstNations.length) {
                        fillSelect(
                            firstNationSelect,
                            firstNations,
                            'Optional – select First Nation'
                        );
                        if (isInitialHydration && existingFirstNation) {
                            const match = firstNations.find((fn) => fn.id === existingFirstNation.id);
                            if (match) {
                                firstNationSelect.value = match.id;
                            }
                        }
                    } else {
                        firstNationSelect.innerHTML = '';
                        firstNationSelect.disabled = true;
                    }

                    if (adhocGroups.length) {
                        fillSelect(
                            adhocSelect,
                            adhocGroups,
                            'Optional – select group'
                        );
                        if (isInitialHydration && existingAdhoc) {
                            const match = adhocGroups.find((ag) => ag.id === existingAdhoc.id);
                            if (match) {
                                adhocSelect.value = match.id;
                            }
                        }
                    } else {
                        adhocSelect.innerHTML = '';
                        adhocSelect.disabled = true;
                    }

                    locationsSaveBtn.disabled = false;
                } catch (err) {
                    locationsFeedback.textContent =
                        'Unable to load ridings and groups for this province.';
                    locationsFeedback.classList.add('error');
                }
            };

            countrySelect.addEventListener('change', async () => {
                locationsFeedback.textContent = '';
                locationsFeedback.classList.remove('error', 'success');
                const countryId = countrySelect.value;
                provinceSelect.disabled = true;
                await loadProvinces(countryId);
            });

            provinceSelect.addEventListener('change', async () => {
                locationsFeedback.textContent = '';
                locationsFeedback.classList.remove('error', 'success');
                const provinceId = provinceSelect.value;
                await loadProvinceChildren(provinceId, false);
            });

            locationsSaveBtn.addEventListener('click', async () => {
                locationsFeedback.textContent = '';
                locationsFeedback.classList.remove('error', 'success');

                const locations = [];

                if (federalSelect.value) {
                    locations.push({ id: federalSelect.value, type: 'FederalRiding' });
                }
                if (provincialSelect.value) {
                    locations.push({ id: provincialSelect.value, type: 'ProvincialRiding' });
                }
                if (townSelect.value) {
                    locations.push({ id: townSelect.value, type: 'Town' });
                }
                if (firstNationSelect.value) {
                    locations.push({ id: firstNationSelect.value, type: 'FirstNation' });
                }
                if (adhocSelect.value) {
                    locations.push({ id: adhocSelect.value, type: 'AdhocGroup' });
                }

                locationsSaveBtn.disabled = true;
                locationsSaveBtn.textContent = 'Saving...';

                try {
                    const { response, data } = await App.apiPut(
                        `/users/${encodeURIComponent(App.authUser.id)}/locations`,
                        { locations }
                    );

                    if (!response.ok || !data || !data.success) {
                        locationsFeedback.textContent =
                            (data && data.error) || 'Could not save locations.';
                        locationsFeedback.classList.add('error');
                    } else {
                        locationsFeedback.textContent = data.message || 'Locations saved.';
                        locationsFeedback.classList.add('success');

                        // Mark that this user now has at least a province or one
                        // geographic home location (not just an adhoc group) so the
                        // router will stop forcing them back to the Locations tab.
                        const hasProvince = !!provinceSelect.value;
                        const hasGeographicLocation = locations.some(
                            (loc) =>
                                loc &&
                                loc.type &&
                                loc.type !== 'AdhocGroup'
                        );
                        const meetsRequirement = hasProvince || hasGeographicLocation;
                        try {
                            if (meetsRequirement) {
                                localStorage.setItem('hasBasicLocations', '1');
                            } else {
                                // User saved only adhoc groups / nothing – still not configured
                                localStorage.removeItem('hasBasicLocations');
                            }
                        } catch (e) {
                            // ignore storage errors
                        }
                    }
                } catch (err) {
                    locationsFeedback.textContent = err.message || 'Unable to save locations.';
                    locationsFeedback.classList.add('error');
                } finally {
                    locationsSaveBtn.disabled = false;
                    locationsSaveBtn.textContent = 'Save locations';
                }
            });

            // Initial load of country & province lists
            await loadCountriesAndMaybeInitProvince();
        }
    } catch (err) {
        content.innerHTML = `
            <header class="page-header">
                <h1 class="page-title">👤 My Profile</h1>
            </header>
            <div class="card">
                <div class="card-body">
                    <p class="empty-text">Error loading your profile: ${err.message}</p>
                </div>
            </div>
        `;
    }
};


