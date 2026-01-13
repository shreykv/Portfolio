// Tournament Generator Mini Site
class Tournament {
  constructor() {
    this.tournaments = [];
    this.currentTournament = null;
    this.init();
  }

  async init() {
    await this.loadTournaments();
    this.render();
    this.setupEventListeners();
  }

  async loadTournaments() {
    try {
      this.tournaments = await api.getTournaments();
    } catch (error) {
      console.error('Error loading tournaments:', error);
      this.tournaments = [];
    }
  }

  setupEventListeners() {
    // Tournament creation form
    const form = document.getElementById('tournament-form');
    if (form) {
      form.addEventListener('submit', (e) => this.handleCreateTournament(e));
    }

    // Participant input
    const participantInput = document.getElementById('participants');
    if (participantInput) {
      participantInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.addParticipant();
        }
      });
    }
  }

  addParticipant() {
    const input = document.getElementById('participants');
    const name = input.value.trim();
    if (!name) return;

    const list = document.getElementById('participant-list');
    if (list) {
      const item = document.createElement('div');
      item.className = 'participant-item';
      item.innerHTML = `
        <span>${name}</span>
        <button type="button" class="btn-icon" onclick="this.parentElement.remove()">×</button>
      `;
      list.appendChild(item);
      input.value = '';
    }
  }

  getParticipants() {
    const items = document.querySelectorAll('.participant-item span');
    return Array.from(items).map(item => item.textContent.trim());
  }

  async handleCreateTournament(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);

    const participants = this.getParticipants();
    if (participants.length < 2) {
      alert('Please add at least 2 participants');
      return;
    }

    const tournament = {
      name: formData.get('name'),
      type: formData.get('type'),
      participants: participants,
      bracket: this.generateBracket(participants, formData.get('type')),
      createdAt: new Date().toISOString()
    };

    try {
      const created = await api.createTournament(tournament);
      await this.loadTournaments();
      this.viewTournament(created.id);
      this.showMessage('Tournament created!', 'success');
    } catch (error) {
      console.error('Error creating tournament:', error);
      this.showMessage('Error creating tournament.', 'error');
    }
  }

  generateBracket(participants, type) {
    // Shuffle participants
    const shuffled = [...participants].sort(() => Math.random() - 0.5);
    
    if (type === 'single-elimination') {
      return this.generateSingleElimination(shuffled);
    } else if (type === 'round-robin') {
      return this.generateRoundRobin(shuffled);
    } else {
      return this.generateDoubleElimination(shuffled);
    }
  }

  generateSingleElimination(participants) {
    const rounds = [];
    let currentRound = participants.map((p, i) => ({
      id: `match-${i}`,
      player1: p,
      player2: i + 1 < participants.length ? participants[i + 1] : null,
      winner: null,
      round: 0
    }));

    // Handle odd number of participants
    if (participants.length % 2 === 1) {
      currentRound[currentRound.length - 1].player2 = 'BYE';
    }

    rounds.push([...currentRound]);

    // Generate subsequent rounds
    let roundNum = 1;
    while (currentRound.length > 1) {
      const nextRound = [];
      for (let i = 0; i < currentRound.length; i += 2) {
        nextRound.push({
          id: `match-r${roundNum}-${i / 2}`,
          player1: currentRound[i].winner || `Winner of ${currentRound[i].id}`,
          player2: currentRound[i + 1] ? (currentRound[i + 1].winner || `Winner of ${currentRound[i + 1].id}`) : null,
          winner: null,
          round: roundNum
        });
      }
      rounds.push(nextRound);
      currentRound = nextRound;
      roundNum++;
    }

    return { rounds, type: 'single-elimination' };
  }

  generateRoundRobin(participants) {
    const matches = [];
    for (let i = 0; i < participants.length; i++) {
      for (let j = i + 1; j < participants.length; j++) {
        matches.push({
          id: `match-${i}-${j}`,
          player1: participants[i],
          player2: participants[j],
          winner: null,
          round: 0
        });
      }
    }
    return { rounds: [matches], type: 'round-robin' };
  }

  generateDoubleElimination(participants) {
    // Simplified double elimination - starts like single
    const winners = this.generateSingleElimination(participants);
    const losers = { rounds: [], type: 'losers' };
    return { winners, losers, type: 'double-elimination' };
  }

  async viewTournament(id) {
    this.currentTournament = this.tournaments.find(t => t.id === id);
    this.render();
  }

  async recordMatchResult(matchId, winner) {
    if (!this.currentTournament) return;

    const updateMatch = (rounds) => {
      for (const round of rounds) {
        for (const match of round) {
          if (match.id === matchId) {
            match.winner = winner;
            return true;
          }
        }
      }
      return false;
    };

    if (this.currentTournament.bracket.winners) {
      updateMatch(this.currentTournament.bracket.winners.rounds);
    } else {
      updateMatch(this.currentTournament.bracket.rounds);
    }

    try {
      await api.updateTournament(this.currentTournament);
      await this.loadTournaments();
      this.render();
    } catch (error) {
      console.error('Error updating tournament:', error);
    }
  }

  async deleteTournament(id) {
    if (!confirm('Delete this tournament?')) return;

    try {
      await api.deleteTournament(id);
      await this.loadTournaments();
      this.currentTournament = null;
      this.render();
      this.showMessage('Tournament deleted.', 'success');
    } catch (error) {
      console.error('Error deleting tournament:', error);
    }
  }

  showMessage(message, type = 'info') {
    const messageEl = document.getElementById('tournament-message');
    if (messageEl) {
      messageEl.textContent = message;
      messageEl.className = `message message-${type}`;
      messageEl.style.display = 'block';
      setTimeout(() => {
        messageEl.style.display = 'none';
      }, 3000);
    }
  }

  renderBracket(bracket) {
    if (!bracket) return '';

    if (bracket.type === 'round-robin') {
      return `
        <div class="bracket-round">
          <h3>All Matches</h3>
          ${bracket.rounds[0].map(match => `
            <div class="match">
              <div class="match-players">
                <button class="match-player ${match.winner === match.player1 ? 'winner' : ''}" 
                        onclick="tournament.recordMatchResult('${match.id}', '${match.player1}')">
                  ${match.player1}
                </button>
                <span class="vs">vs</span>
                <button class="match-player ${match.winner === match.player2 ? 'winner' : ''}" 
                        onclick="tournament.recordMatchResult('${match.id}', '${match.player2}')">
                  ${match.player2}
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }

    return bracket.rounds.map((round, roundIdx) => `
      <div class="bracket-round">
        <h3>Round ${roundIdx + 1}</h3>
        ${round.map(match => `
          <div class="match">
            <div class="match-players">
              <button class="match-player ${match.winner === match.player1 ? 'winner' : ''}" 
                      onclick="tournament.recordMatchResult('${match.id}', '${match.player1}')">
                ${match.player1}
              </button>
              <span class="vs">vs</span>
              <button class="match-player ${match.winner === match.player2 ? 'winner' : ''}" 
                      onclick="tournament.recordMatchResult('${match.id}', '${match.player2}')">
                ${match.player2 || 'TBD'}
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    `).join('');
  }

  render() {
    const container = document.getElementById('tournament-content');
    if (!container) return;

    if (this.currentTournament) {
      container.innerHTML = `
        <div class="tournament-header">
          <div>
            <h2>${this.currentTournament.name}</h2>
            <span class="tournament-type">${this.currentTournament.type}</span>
          </div>
          <div>
            <button class="btn" onclick="tournament.currentTournament = null; tournament.render();">Back to List</button>
            <button class="btn" onclick="tournament.deleteTournament('${this.currentTournament.id}')">Delete</button>
          </div>
        </div>

        <div id="tournament-message" class="message" style="display:none;"></div>

        <div class="bracket-container">
          ${this.renderBracket(this.currentTournament.bracket)}
        </div>
      `;
    } else {
      container.innerHTML = `
        <div class="tournament-header">
          <h2>Tournament Generator</h2>
        </div>

        <div id="tournament-message" class="message" style="display:none;"></div>

        <form id="tournament-form" class="tournament-form">
          <div class="form-group">
            <label for="name">Tournament Name</label>
            <input type="text" id="name" name="name" placeholder="e.g., 2024 Championship" required>
          </div>
          <div class="form-group">
            <label for="type">Bracket Type</label>
            <select id="type" name="type" required>
              <option value="single-elimination">Single Elimination</option>
              <option value="double-elimination">Double Elimination</option>
              <option value="round-robin">Round Robin</option>
            </select>
          </div>
          <div class="form-group">
            <label for="participants">Add Participants</label>
            <div class="participant-input-group">
              <input type="text" id="participants" placeholder="Enter participant name and press Enter">
              <button type="button" class="btn" onclick="tournament.addParticipant()">Add</button>
            </div>
            <div id="participant-list" class="participant-list"></div>
          </div>
          <button type="submit" class="btn primary">Create Tournament</button>
        </form>

        <div class="tournament-list">
          <h3>Your Tournaments</h3>
          ${this.tournaments.length === 0
            ? '<p class="empty-state">No tournaments yet. Create one above!</p>'
            : this.tournaments.map(t => `
              <div class="tournament-card">
                <div>
                  <h4>${t.name}</h4>
                  <span class="tournament-meta">${t.type} • ${t.participants.length} participants</span>
                </div>
                <button class="btn" onclick="tournament.viewTournament('${t.id}')">View</button>
              </div>
            `).join('')
          }
        </div>
      `;

      this.setupEventListeners();
    }
  }
}

// Export tournament instance
const tournament = new Tournament();
