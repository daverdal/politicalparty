/**
 * Voting Module
 * Frontend logic for convention voting
 */

window.App = window.App || {};
App.voting = {};

/**
 * Load voting interface for a convention
 */
App.voting.loadVotingUI = async function(convId, container) {
    container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    
    try {
        const races = await App.api(`/voting/races/${convId}`);
        
        if (races.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No races in voting phase yet.</p>
                    <p class="text-muted">Races will appear here when the voting phase begins.</p>
                </div>
            `;
            return;
        }
        
        // Group by province
        const byProvince = {};
        races.forEach(r => {
            const prov = r.province?.name || 'Unknown';
            if (!byProvince[prov]) byProvince[prov] = [];
            byProvince[prov].push(r);
        });
        
        let html = '';
        for (const [province, provRaces] of Object.entries(byProvince)) {
            html += `
                <div class="voting-province-section">
                    <h3 class="province-header">${province}</h3>
                    <div class="voting-races-grid">
                        ${provRaces.map(r => App.voting.renderRaceCard(r, convId)).join('')}
                    </div>
                </div>
            `;
        }
        
        container.innerHTML = html;
        
        // Attach event listeners
        container.querySelectorAll('.vote-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const raceId = btn.dataset.raceId;
                App.voting.showVotingModal(raceId, convId);
            });
        });
        
        container.querySelectorAll('.view-results-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const raceId = btn.dataset.raceId;
                App.voting.showResultsModal(raceId);
            });
        });
        
    } catch (err) {
        container.innerHTML = `<div class="error-state">Error loading races: ${err.message}</div>`;
    }
};

/**
 * Render a race card for voting
 */
App.voting.renderRaceCard = function(race, convId) {
    const candidates = race.candidates || [];
    const hasWinner = race.race?.winnerId;
    const roundNum = race.currentRound || 0;
    
    let statusBadge = '';
    let actionButton = '';
    
    if (hasWinner) {
        const winner = candidates.find(c => c.id === race.race.winnerId);
        statusBadge = `<span class="badge success">Winner: ${winner?.name || 'Unknown'}</span>`;
    } else if (roundNum > 0) {
        statusBadge = `<span class="badge warning">Round ${roundNum}</span>`;
        actionButton = App.currentUser 
            ? `<button class="btn btn-primary btn-sm vote-btn" data-race-id="${race.race.id}">Vote</button>`
            : '';
    } else if (candidates.length > 0) {
        statusBadge = `<span class="badge">Ready to Start</span>`;
        actionButton = `<button class="btn btn-secondary btn-sm start-voting-btn" data-race-id="${race.race.id}">Start Voting</button>`;
    } else {
        statusBadge = `<span class="badge muted">No Candidates</span>`;
    }
    
    return `
        <div class="voting-race-card ${hasWinner ? 'completed' : ''}" data-race-id="${race.race.id}">
            <div class="voting-race-header">
                <div class="voting-race-riding">${race.riding?.name || 'Unknown'}</div>
                ${statusBadge}
            </div>
            <div class="voting-race-candidates">
                ${candidates.length === 0 ? '<span class="no-candidates">No candidates</span>' : 
                    candidates.map(c => `
                        <div class="voting-candidate-chip">
                            <span class="candidate-avatar-sm">${App.getInitials(c.name)}</span>
                            <span class="candidate-name-sm">${c.name}</span>
                        </div>
                    `).join('')
                }
            </div>
            <div class="voting-race-actions">
                ${actionButton}
                <button class="btn btn-ghost btn-sm view-results-btn" data-race-id="${race.race.id}">View Results</button>
            </div>
        </div>
    `;
};

/**
 * Show voting modal for a race
 */
App.voting.showVotingModal = async function(raceId, convId) {
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal voting-modal">
            <div class="modal-header">
                <h3>Cast Your Vote</h3>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
            </div>
            <div class="modal-body">
                <div class="loading"><div class="spinner"></div></div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    const modalBody = modal.querySelector('.modal-body');
    
    try {
        // Check if user already voted
        const voteStatus = await App.api(`/voting/race/${raceId}/has-voted/${App.currentUser.id}`);
        
        if (voteStatus.hasVoted) {
            modalBody.innerHTML = `
                <div class="already-voted">
                    <p>✅ You have already voted in this round.</p>
                    <p class="text-muted">Wait for the round to close to see results.</p>
                    <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Close</button>
                </div>
            `;
            return;
        }
        
        if (!voteStatus.hasActiveRound) {
            modalBody.innerHTML = `
                <div class="no-active-round">
                    <p>⏳ No active voting round.</p>
                    <p class="text-muted">Voting hasn't started yet for this race.</p>
                    <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Close</button>
                </div>
            `;
            return;
        }
        
        // Get race status with candidates
        const status = await App.api(`/voting/race/${raceId}/status`);
        
        if (!status || status.activeCandidates.length === 0) {
            modalBody.innerHTML = `<p>No active candidates in this race.</p>`;
            return;
        }
        
        modalBody.innerHTML = `
            <p class="voting-instructions">Select the candidate you want to vote for:</p>
            <p class="round-info">Round ${status.currentRound?.roundNumber || 1} • ${status.activeCandidates.length} candidates remaining</p>
            <div class="voting-candidates-list">
                ${status.activeCandidates.map(c => `
                    <div class="voting-candidate-option" data-candidate-id="${c.id}">
                        <div class="candidate-avatar">${App.getInitials(c.name)}</div>
                        <div class="candidate-info">
                            <div class="candidate-name">${c.name}</div>
                            <div class="candidate-region">${c.region || ''}</div>
                        </div>
                        <div class="vote-radio"></div>
                    </div>
                `).join('')}
            </div>
            <div class="voting-actions">
                <button class="btn btn-primary" id="confirm-vote-btn" disabled>Confirm Vote</button>
                <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
            </div>
            <div id="vote-feedback" class="form-feedback"></div>
        `;
        
        // Selection handling
        let selectedCandidateId = null;
        const candidates = modalBody.querySelectorAll('.voting-candidate-option');
        const confirmBtn = modalBody.querySelector('#confirm-vote-btn');
        
        candidates.forEach(el => {
            el.addEventListener('click', () => {
                candidates.forEach(c => c.classList.remove('selected'));
                el.classList.add('selected');
                selectedCandidateId = el.dataset.candidateId;
                confirmBtn.disabled = false;
            });
        });
        
        // Confirm vote
        confirmBtn.addEventListener('click', async () => {
            if (!selectedCandidateId) return;
            
            confirmBtn.disabled = true;
            confirmBtn.textContent = 'Voting...';
            const feedback = modalBody.querySelector('#vote-feedback');
            
            try {
                const response = await fetch(`/api/voting/race/${raceId}/vote`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        oderId: App.currentUser.id,
                        candidateId: selectedCandidateId
                    })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    feedback.innerHTML = '<span class="success">✅ Vote cast successfully!</span>';
                    setTimeout(() => {
                        modal.remove();
                        App.pages.convention(); // Refresh
                    }, 1500);
                } else {
                    feedback.innerHTML = `<span class="error">${data.error}</span>`;
                    confirmBtn.disabled = false;
                    confirmBtn.textContent = 'Confirm Vote';
                }
            } catch (err) {
                feedback.innerHTML = `<span class="error">${err.message}</span>`;
                confirmBtn.disabled = false;
                confirmBtn.textContent = 'Confirm Vote';
            }
        });
        
    } catch (err) {
        modalBody.innerHTML = `<div class="error-state">Error: ${err.message}</div>`;
    }
};

/**
 * Show results modal for a race
 */
App.voting.showResultsModal = async function(raceId) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal results-modal">
            <div class="modal-header">
                <h3>Voting Results</h3>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
            </div>
            <div class="modal-body">
                <div class="loading"><div class="spinner"></div></div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    const modalBody = modal.querySelector('.modal-body');
    
    try {
        const tallies = await App.api(`/voting/race/${raceId}/tallies`);
        
        if (!tallies.round) {
            modalBody.innerHTML = `
                <div class="no-results">
                    <p>Voting hasn't started yet for this race.</p>
                    <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Close</button>
                </div>
            `;
            return;
        }
        
        const maxVotes = Math.max(...tallies.tallies.map(t => t.votes), 1);
        
        modalBody.innerHTML = `
            <div class="results-round-info">
                <span class="round-badge">Round ${tallies.round.roundNumber}</span>
                <span class="total-votes">${tallies.totalVotes} total votes</span>
            </div>
            <div class="results-list">
                ${tallies.tallies.map((t, i) => {
                    const percentage = tallies.totalVotes > 0 
                        ? Math.round((t.votes / tallies.totalVotes) * 100) 
                        : 0;
                    const barWidth = tallies.totalVotes > 0 
                        ? Math.round((t.votes / maxVotes) * 100) 
                        : 0;
                    
                    return `
                        <div class="result-row ${i === 0 ? 'leading' : ''}">
                            <div class="result-rank">${i + 1}</div>
                            <div class="result-candidate">
                                <div class="candidate-avatar-sm">${App.getInitials(t.candidate.name)}</div>
                                <span>${t.candidate.name}</span>
                            </div>
                            <div class="result-bar-container">
                                <div class="result-bar" style="width: ${barWidth}%"></div>
                            </div>
                            <div class="result-votes">${t.votes} (${percentage}%)</div>
                        </div>
                    `;
                }).join('')}
            </div>
            <div class="results-actions">
                <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Close</button>
            </div>
        `;
        
    } catch (err) {
        modalBody.innerHTML = `<div class="error-state">Error: ${err.message}</div>`;
    }
};

/**
 * Start voting for a race (admin action)
 */
App.voting.startVoting = async function(raceId) {
    try {
        const response = await fetch(`/api/voting/race/${raceId}/start`, {
            method: 'POST'
        });
        const data = await response.json();
        
        if (response.ok) {
            alert('Voting started!');
            App.pages.convention();
        } else {
            alert(`Error: ${data.error}`);
        }
    } catch (err) {
        alert(`Error: ${err.message}`);
    }
};

/**
 * Close round and advance (admin action)
 */
App.voting.closeRound = async function(raceId) {
    if (!confirm('Close this round and eliminate the lowest candidate?')) return;
    
    try {
        const response = await fetch(`/api/voting/race/${raceId}/close-round`, {
            method: 'POST'
        });
        const data = await response.json();
        
        if (response.ok) {
            if (data.result === 'winner') {
                alert(`🏆 Winner declared: ${data.winner.name} with ${data.votes} votes!`);
            } else {
                alert(`Round closed. ${data.eliminated.name} eliminated with ${data.eliminatedVotes} votes. Moving to Round ${data.nextRound}.`);
            }
            App.pages.convention();
        } else {
            alert(`Error: ${data.error}`);
        }
    } catch (err) {
        alert(`Error: ${err.message}`);
    }
};

