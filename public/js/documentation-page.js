/**
 * Documentation Page - core implementation
 * Standalone version of the multi-tab documentation UI.
 */

window.App = window.App || {};
App.pages = App.pages || {};

try {
    if (typeof App.logClientEvent === 'function') {
        App.logClientEvent('info', 'documentation-page.js loaded (standalone)', {});
    }
} catch (e) {
    // ignore debug errors
}

App.pages.documentation = async function () {
    const content = document.getElementById('content');

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
            document
                .querySelectorAll('.convention-tab')
                .forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            container.innerHTML = renderSection(tab);
        });
    });
};


