// Tournament Generator Mini Site
class Tournament {
  constructor() {
    this.tournaments = [];
    this.currentTournament = null;
    this.viewMode = 'bracket'; // 'bracket' or 'stats'
    
    // Power rankings state (for tournament creation)
    this.powerRankings = {
      offense: [],
      defense: []
    };
    this.draggedItem = null;
    this.draggedList = null;
    
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

    // Seeding mode change listener
    const seedingModeSelect = document.getElementById('seeding-mode');
    if (seedingModeSelect) {
      seedingModeSelect.addEventListener('change', (e) => this.handleSeedingModeChange(e));
    }

    // Game mode change listener
    const gameModeSelect = document.getElementById('game-mode');
    if (gameModeSelect) {
      gameModeSelect.addEventListener('change', (e) => this.handleGameModeChange(e));
    }
  }

  handleSeedingModeChange(e) {
    const seedingMode = e.target.value;
    const rankingsContainer = document.getElementById('power-rankings-container');
    const teamsPreview = document.getElementById('teams-preview');
    
    if (seedingMode === 'ranked') {
      // Initialize rankings with current participants
      const participants = this.getParticipants();
      this.powerRankings.offense = [...participants];
      this.powerRankings.defense = [...participants];
      
      if (rankingsContainer) {
        rankingsContainer.style.display = 'block';
        this.renderPowerRankings();
      }
    } else {
      if (rankingsContainer) {
        rankingsContainer.style.display = 'none';
      }
    }
    
    // Update teams preview if in doubles mode
    this.updateTeamsPreview();
  }

  handleGameModeChange(e) {
    this.updateTeamsPreview();
  }

  updateTeamsPreview() {
    const teamsPreview = document.getElementById('teams-preview');
    const gameModeSelect = document.getElementById('game-mode');
    const seedingModeSelect = document.getElementById('seeding-mode');
    
    if (!teamsPreview || !gameModeSelect || !seedingModeSelect) return;
    
    const isDoubles = gameModeSelect.value === 'doubles';
    const isRanked = seedingModeSelect.value === 'ranked';
    
    if (isDoubles) {
      teamsPreview.style.display = 'block';
      
      if (isRanked) {
        // Generate teams based on power rankings
        const teams = this.generateDoublesPairs();
        this.renderTeamsPreview(teams);
      } else {
        // Show message that teams will be randomly paired
        teamsPreview.innerHTML = `
          <h4>Teams Preview</h4>
          <p class="teams-preview-note">Teams will be randomly paired when tournament is created.</p>
        `;
      }
    } else {
      teamsPreview.style.display = 'none';
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
        <button type="button" class="btn-icon" onclick="tournament.removeParticipant(this)">×</button>
      `;
      list.appendChild(item);
      input.value = '';
      
      // Update power rankings if in ranked mode
      this.syncPowerRankingsWithParticipants();
    }
  }

  removeParticipant(button) {
    const item = button.parentElement;
    const name = item.querySelector('span').textContent.trim();
    item.remove();
    
    // Remove from power rankings
    this.powerRankings.offense = this.powerRankings.offense.filter(p => p !== name);
    this.powerRankings.defense = this.powerRankings.defense.filter(p => p !== name);
    
    // Re-render if in ranked mode
    const seedingModeSelect = document.getElementById('seeding-mode');
    if (seedingModeSelect && seedingModeSelect.value === 'ranked') {
      this.renderPowerRankings();
    }
    this.updateTeamsPreview();
  }

  syncPowerRankingsWithParticipants() {
    const participants = this.getParticipants();
    const seedingModeSelect = document.getElementById('seeding-mode');
    
    // Add new participants to the end of rankings
    participants.forEach(p => {
      if (!this.powerRankings.offense.includes(p)) {
        this.powerRankings.offense.push(p);
      }
      if (!this.powerRankings.defense.includes(p)) {
        this.powerRankings.defense.push(p);
      }
    });
    
    // Remove participants no longer in the list
    this.powerRankings.offense = this.powerRankings.offense.filter(p => participants.includes(p));
    this.powerRankings.defense = this.powerRankings.defense.filter(p => participants.includes(p));
    
    // Re-render if in ranked mode
    if (seedingModeSelect && seedingModeSelect.value === 'ranked') {
      this.renderPowerRankings();
    }
    this.updateTeamsPreview();
  }

  getParticipants() {
    const items = document.querySelectorAll('.participant-item span');
    return Array.from(items).map(item => item.textContent.trim());
  }

  // Power Rankings Methods
  renderPowerRankings() {
    const container = document.getElementById('power-rankings-lists');
    if (!container) return;

    const participants = this.getParticipants();
    if (participants.length === 0) {
      container.innerHTML = '<p class="empty-state">Add participants first to set rankings.</p>';
      return;
    }

    const offenseHtml = this.renderRankingList('offense', this.powerRankings.offense);
    const defenseHtml = this.renderRankingList('defense', this.powerRankings.defense);
    const combinedHtml = this.renderCombinedScores();

    container.innerHTML = `
      <div class="rankings-grid">
        <div class="ranking-column">
          <h4 class="ranking-title">Offense Ranking</h4>
          <div class="ranking-list" id="offense-ranking" data-list="offense">
            ${offenseHtml}
          </div>
        </div>
        <div class="ranking-column">
          <h4 class="ranking-title">Defense Ranking</h4>
          <div class="ranking-list" id="defense-ranking" data-list="defense">
            ${defenseHtml}
          </div>
        </div>
      </div>
      <div class="combined-scores">
        <h4 class="ranking-title">Combined Scores & Seeds</h4>
        ${combinedHtml}
      </div>
    `;

    // Setup drag-drop listeners
    this.setupDragDropListeners();
  }

  renderRankingList(listType, players) {
    const numPlayers = players.length;
    return players.map((player, idx) => {
      const points = numPlayers - idx; // Rank 1 gets N points, Rank N gets 1 point
      return `
        <div class="ranking-item" draggable="true" data-player="${player}" data-index="${idx}">
          <span class="ranking-position">${idx + 1}</span>
          <span class="ranking-drag-handle">≡</span>
          <span class="ranking-player-name">${player}</span>
          <span class="ranking-points">${points} pts</span>
        </div>
      `;
    }).join('');
  }

  calculateCombinedScores() {
    const participants = this.getParticipants();
    const numPlayers = participants.length;
    const scores = {};

    participants.forEach(player => {
      const offenseRank = this.powerRankings.offense.indexOf(player);
      const defenseRank = this.powerRankings.defense.indexOf(player);
      
      // Points: Rank 1 = N points, Rank 2 = N-1 points, etc.
      const offensePoints = offenseRank >= 0 ? numPlayers - offenseRank : 0;
      const defensePoints = defenseRank >= 0 ? numPlayers - defenseRank : 0;
      
      scores[player] = {
        offense: offensePoints,
        defense: defensePoints,
        total: offensePoints + defensePoints,
        offenseRank: offenseRank + 1,
        defenseRank: defenseRank + 1
      };
    });

    // Sort by total score descending
    return Object.entries(scores)
      .map(([player, data]) => ({ player, ...data }))
      .sort((a, b) => b.total - a.total);
  }

  renderCombinedScores() {
    const scores = this.calculateCombinedScores();
    
    if (scores.length === 0) {
      return '<p class="empty-state">No participants to score.</p>';
    }

    return `
      <div class="combined-scores-list">
        ${scores.map((score, idx) => `
          <div class="combined-score-item ${idx === 0 ? 'top-seed' : ''}">
            <span class="seed-number">Seed ${idx + 1}</span>
            <span class="score-player">${score.player}</span>
            <span class="score-breakdown">
              <span class="offense-score" title="Offense: Rank ${score.offenseRank}">O: ${score.offense}</span>
              <span class="defense-score" title="Defense: Rank ${score.defenseRank}">D: ${score.defense}</span>
            </span>
            <span class="total-score">${score.total} pts</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  setupDragDropListeners() {
    const lists = document.querySelectorAll('.ranking-list');
    
    lists.forEach(list => {
      const items = list.querySelectorAll('.ranking-item');
      
      items.forEach(item => {
        item.addEventListener('dragstart', (e) => this.handleDragStart(e));
        item.addEventListener('dragend', (e) => this.handleDragEnd(e));
        item.addEventListener('dragover', (e) => this.handleDragOver(e));
        item.addEventListener('drop', (e) => this.handleDrop(e));
        item.addEventListener('dragenter', (e) => this.handleDragEnter(e));
        item.addEventListener('dragleave', (e) => this.handleDragLeave(e));
      });
    });
  }

  handleDragStart(e) {
    this.draggedItem = e.target;
    this.draggedList = e.target.closest('.ranking-list').dataset.list;
    e.target.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', e.target.dataset.player);
  }

  handleDragEnd(e) {
    e.target.classList.remove('dragging');
    document.querySelectorAll('.ranking-item').forEach(item => {
      item.classList.remove('drag-over');
    });
    this.draggedItem = null;
    this.draggedList = null;
  }

  handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  handleDragEnter(e) {
    e.preventDefault();
    const target = e.target.closest('.ranking-item');
    if (target && target !== this.draggedItem) {
      target.classList.add('drag-over');
    }
  }

  handleDragLeave(e) {
    const target = e.target.closest('.ranking-item');
    if (target) {
      target.classList.remove('drag-over');
    }
  }

  handleDrop(e) {
    e.preventDefault();
    const target = e.target.closest('.ranking-item');
    if (!target || !this.draggedItem || target === this.draggedItem) return;

    const targetList = target.closest('.ranking-list').dataset.list;
    
    // Only allow dropping within the same list
    if (targetList !== this.draggedList) return;

    const draggedPlayer = this.draggedItem.dataset.player;
    const targetPlayer = target.dataset.player;
    
    // Get the ranking array
    const rankings = this.powerRankings[targetList];
    const draggedIdx = rankings.indexOf(draggedPlayer);
    const targetIdx = rankings.indexOf(targetPlayer);

    // Remove dragged item and insert at target position
    rankings.splice(draggedIdx, 1);
    rankings.splice(targetIdx, 0, draggedPlayer);

    // Re-render
    this.renderPowerRankings();
    this.updateTeamsPreview();
  }

  // Doubles Pairing Methods
  generateDoublesPairs() {
    const scores = this.calculateCombinedScores();
    const teams = [];
    
    if (scores.length < 2) return teams;
    
    // Pair best with worst, second best with second worst, etc.
    const numTeams = Math.floor(scores.length / 2);
    
    for (let i = 0; i < numTeams; i++) {
      const bestPlayer = scores[i];
      const worstPlayer = scores[scores.length - 1 - i];
      
      teams.push({
        name: `Team ${i + 1}`,
        players: [bestPlayer.player, worstPlayer.player],
        combinedScore: bestPlayer.total + worstPlayer.total
      });
    }
    
    // Handle odd number of players - last player gets a bye or solo team
    if (scores.length % 2 === 1) {
      const middlePlayer = scores[Math.floor(scores.length / 2)];
      teams.push({
        name: `Team ${numTeams + 1}`,
        players: [middlePlayer.player],
        combinedScore: middlePlayer.total,
        isSolo: true
      });
    }
    
    return teams;
  }

  renderTeamsPreview(teams) {
    const container = document.getElementById('teams-preview');
    if (!container) return;

    if (teams.length === 0) {
      container.innerHTML = `
        <h4>Teams Preview</h4>
        <p class="empty-state">Add at least 2 participants to form teams.</p>
      `;
      return;
    }

    container.innerHTML = `
      <h4>Teams Preview</h4>
      <p class="teams-preview-note">Best player paired with worst player for balanced teams.</p>
      <div class="teams-grid">
        ${teams.map(team => `
          <div class="team-card ${team.isSolo ? 'solo-team' : ''}">
            <div class="team-name">${team.name}</div>
            <div class="team-players">
              ${team.players.map(p => `<span class="team-player">${p}</span>`).join(' & ')}
            </div>
            <div class="team-score">Combined: ${team.combinedScore} pts</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  async handleCreateTournament(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);

    const participants = this.getParticipants();
    const seedingMode = formData.get('seeding-mode') || 'random';
    const gameMode = formData.get('game-mode') || 'singles';

    // Validate participant count
    const minParticipants = gameMode === 'doubles' ? 4 : 2;
    if (participants.length < minParticipants) {
      alert(`Please add at least ${minParticipants} participants for ${gameMode} mode`);
      return;
    }

    // For doubles, validate even number of players (or handle odd)
    if (gameMode === 'doubles' && participants.length % 2 !== 0) {
      if (!confirm('Odd number of players. One team will have only 1 player. Continue?')) {
        return;
      }
    }

    // Determine final participants (teams for doubles, players for singles)
    let finalParticipants;
    let teams = null;
    let powerRankingsData = null;

    if (gameMode === 'doubles') {
      if (seedingMode === 'ranked') {
        teams = this.generateDoublesPairs();
        finalParticipants = teams.map(t => t.players.join(' & '));
        powerRankingsData = { ...this.powerRankings };
      } else {
        // Random pairing for doubles
        const shuffled = [...participants].sort(() => Math.random() - 0.5);
        teams = [];
        for (let i = 0; i < shuffled.length; i += 2) {
          const teamPlayers = [shuffled[i]];
          if (shuffled[i + 1]) teamPlayers.push(shuffled[i + 1]);
          teams.push({
            name: `Team ${teams.length + 1}`,
            players: teamPlayers,
            isSolo: teamPlayers.length === 1
          });
        }
        finalParticipants = teams.map(t => t.players.join(' & '));
      }
    } else {
      // Singles mode
      if (seedingMode === 'ranked') {
        powerRankingsData = { ...this.powerRankings };
      }
      finalParticipants = participants;
    }

    const tournament = {
      name: formData.get('name'),
      type: formData.get('type'),
      seedingMode: seedingMode,
      gameMode: gameMode,
      participants: participants,
      finalParticipants: finalParticipants,
      teams: teams,
      powerRankings: powerRankingsData,
      bracket: this.generateBracket(finalParticipants, formData.get('type'), seedingMode, powerRankingsData),
      createdAt: new Date().toISOString()
    };

    try {
      const created = await api.createTournament(tournament);
      await this.loadTournaments();
      
      // Reset power rankings state
      this.powerRankings = { offense: [], defense: [] };
      
      this.viewTournament(created.id);
      this.showMessage('Tournament created!', 'success');
    } catch (error) {
      console.error('Error creating tournament:', error);
      this.showMessage('Error creating tournament.', 'error');
    }
  }

  generateBracket(participants, type, seedingMode = 'random', powerRankings = null) {
    let orderedParticipants;
    
    if (seedingMode === 'ranked' && powerRankings) {
      // Order by combined scores for balanced matchups
      orderedParticipants = this.getBalancedMatchupOrder(participants, powerRankings);
    } else {
      // Random shuffle
      orderedParticipants = [...participants].sort(() => Math.random() - 0.5);
    }
    
    if (type === 'single-elimination') {
      return this.generateSingleElimination(orderedParticipants);
    } else if (type === 'round-robin') {
      return this.generateRoundRobin(orderedParticipants);
    } else {
      return this.generateDoubleElimination(orderedParticipants);
    }
  }

  // Get participant order that minimizes power difference in matchups
  getBalancedMatchupOrder(participants, powerRankings) {
    // Calculate scores for each participant
    const numPlayers = powerRankings.offense.length;
    const scores = {};
    
    participants.forEach(p => {
      // For team names like "Player A & Player B", calculate combined team score
      const playerNames = p.split(' & ');
      let totalScore = 0;
      
      playerNames.forEach(name => {
        const offenseRank = powerRankings.offense.indexOf(name);
        const defenseRank = powerRankings.defense.indexOf(name);
        const offensePoints = offenseRank >= 0 ? numPlayers - offenseRank : 0;
        const defensePoints = defenseRank >= 0 ? numPlayers - defenseRank : 0;
        totalScore += offensePoints + defensePoints;
      });
      
      scores[p] = totalScore;
    });

    // Sort by score descending
    const sorted = [...participants].sort((a, b) => scores[b] - scores[a]);
    
    // Arrange for balanced matchups: pair adjacent seeds
    // For 8 players sorted [1,2,3,4,5,6,7,8] by strength:
    // We want matchups: 1v2, 3v4, 5v6, 7v8 (minimizing power difference)
    // So the order should be: [1,2,3,4,5,6,7,8] (already sorted)
    
    return sorted;
  }

  generateSingleElimination(participants) {
    const rounds = [];
    
    // First round only - subsequent rounds will be created dynamically
    const firstRound = [];
    for (let i = 0; i < participants.length; i += 2) {
      firstRound.push({
        id: `match-r0-${firstRound.length}`,
        player1: participants[i],
        player2: participants[i + 1] || 'BYE',
        winner: null,
        round: 0,
        matchNum: firstRound.length + 1,
        bracket: 'winners'
      });
    }

    rounds.push(firstRound);

    // Calculate how many rounds we'll need
    let numParticipants = participants.length;
    let numRounds = Math.ceil(Math.log2(numParticipants));
    
    // Create empty subsequent rounds with TBD players
    for (let roundNum = 1; roundNum < numRounds; roundNum++) {
      const numMatches = Math.ceil(rounds[roundNum - 1].length / 2);
      const nextRound = [];
      for (let i = 0; i < numMatches; i++) {
        nextRound.push({
          id: `match-r${roundNum}-${i}`,
          player1: 'TBD',
          player2: 'TBD',
          winner: null,
          round: roundNum,
          matchNum: i + 1,
          bracket: 'winners'
        });
      }
      rounds.push(nextRound);
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
          round: 0,
          matchNum: matches.length + 1
        });
      }
    }
    return { rounds: [matches], type: 'round-robin' };
  }

  generateDoubleElimination(participants) {
    const winners = this.generateSingleElimination(participants);
    const losers = this.generateLosersBracket(participants.length);
    return { winners, losers, type: 'double-elimination' };
  }

  generateLosersBracket(numParticipants) {
    const rounds = [];
    const numWinnersRounds = Math.ceil(Math.log2(numParticipants));
    
    // Losers bracket structure for double elimination:
    // - LR0: Losers from WR0 play each other (numMatches = WR0_matches / 2)
    // - For each winners bracket round wRound (1 to numWinnersRounds-1):
    //   - "Major" round: LR winners play against WR losers (numMatches = numLosersFromWR)
    //   - "Minor" round: LR winners play each other (numMatches = previous / 2) - only if not last
    //
    // Example for 8 players (numWinnersRounds = 3):
    // - LR0: 2 matches (4 losers from WR0 paired up)
    // - LR1: 2 matches (2 LR0 winners vs 2 WR1 losers) - "major" round
    // - LR2: 1 match (2 LR1 winners play each other) - "minor" round  
    // - LR3: 1 match (1 LR2 winner vs 1 WR2 loser) - "major" round (losers finals)
    
    // Calculate number of matches in first losers round (losers from winners round 0)
    // Winners round 0 has numParticipants/2 matches, so losers round 0 has numParticipants/4 matches
    const firstLosersRoundMatches = Math.ceil(numParticipants / 4);
    const firstRound = [];
    for (let i = 0; i < firstLosersRoundMatches; i++) {
      firstRound.push({
        id: `losers-r0-${i}`,
        player1: 'TBD',
        player2: 'TBD',
        winner: null,
        round: 0,
        matchNum: i + 1,
        bracket: 'losers'
      });
    }
    rounds.push(firstRound);

    // Generate subsequent losers bracket rounds
    let currentRoundSize = firstLosersRoundMatches;
    let roundNum = 1;
    
    // For each winners bracket round (1 to numWinnersRounds-1), create corresponding losers bracket rounds
    for (let wRound = 1; wRound < numWinnersRounds; wRound++) {
      // Calculate how many losers will come from this winners bracket round
      const numLosersFromWinners = Math.ceil(Math.pow(2, numWinnersRounds - wRound - 1));
      
      // "Major" round: Each WB loser plays against a LB winner from previous round
      // numMatches = numLosersFromWinners (NOT divided by 2!)
      const numMatches = numLosersFromWinners;
      const nextRound = [];
      for (let i = 0; i < numMatches; i++) {
        nextRound.push({
          id: `losers-r${roundNum}-${i}`,
          player1: 'TBD',
          player2: 'TBD',
          winner: null,
          round: roundNum,
          matchNum: i + 1,
          bracket: 'losers'
        });
      }
      rounds.push(nextRound);
      currentRoundSize = numMatches;
      roundNum++;
      
      // "Minor" round: Winners from the major round play each other
      // Only create if not the last winners bracket round (losers finals doesn't need a minor round after)
      if (wRound < numWinnersRounds - 1) {
        const numMatches2 = Math.ceil(currentRoundSize / 2);
        const nextRound2 = [];
        for (let i = 0; i < numMatches2; i++) {
          nextRound2.push({
            id: `losers-r${roundNum}-${i}`,
            player1: 'TBD',
            player2: 'TBD',
            winner: null,
            round: roundNum,
            matchNum: i + 1,
            bracket: 'losers'
          });
        }
        rounds.push(nextRound2);
        currentRoundSize = numMatches2;
        roundNum++;
      }
    }

    return { rounds, type: 'losers' };
  }

  async viewTournament(id) {
    this.currentTournament = this.tournaments.find(t => t.id === id);
    this.viewMode = 'bracket';
    this.render();
  }

  // Helper method that looks up the match and gets the player by index (0 or 1)
  // This avoids issues with special characters in player names in onclick handlers
  async recordMatchResultByIndex(matchId, playerIndex) {
    console.log('recordMatchResultByIndex called:', matchId, playerIndex);
    if (!this.currentTournament) {
      console.error('No current tournament');
      return;
    }
    
    const match = this.findMatchById(matchId);
    if (!match) {
      console.error('Match not found:', matchId);
      console.log('Bracket structure:', JSON.stringify(this.currentTournament.bracket, null, 2));
      return;
    }
    
    const winner = playerIndex === 0 ? match.player1 : match.player2;
    console.log('Recording winner:', winner);
    return this.recordMatchResult(matchId, winner);
  }

  findMatchById(matchId) {
    if (!this.currentTournament) return null;
    
    const searchRounds = (rounds) => {
      if (!rounds) return null;
      for (const round of rounds) {
        for (const match of round) {
          if (match.id === matchId) return match;
        }
      }
      return null;
    };

    const bracket = this.currentTournament.bracket;
    
    if (bracket.type === 'double-elimination') {
      // Check grand finals first
      if (bracket.grandFinal2) {
        for (const match of bracket.grandFinal2) {
          if (match.id === matchId) return match;
        }
      }
      if (bracket.grandFinal) {
        for (const match of bracket.grandFinal) {
          if (match.id === matchId) return match;
        }
      }
      // Check brackets
      let found = searchRounds(bracket.winners?.rounds);
      if (found) return found;
      return searchRounds(bracket.losers?.rounds);
    } else if (bracket.winners) {
      // For brackets stored with winners sub-object
      return searchRounds(bracket.winners.rounds);
    } else if (bracket.rounds) {
      // For single-elimination and round-robin stored directly
      return searchRounds(bracket.rounds);
    }
    
    return null;
  }

  async recordMatchResult(matchId, winner) {
    if (!this.currentTournament) return;

    const updateMatch = (rounds, bracketType) => {
      for (const round of rounds) {
        for (const match of round) {
          if (match.id === matchId) {
            match.winner = winner;
            
            // Handle double elimination
            if (this.currentTournament.bracket.type === 'double-elimination') {
              if (bracketType === 'winners') {
                // Advance winner to next winners bracket round
                this.advanceWinner(match, rounds);
                // Advance loser to losers bracket
                this.advanceLoser(match, this.currentTournament.bracket.winners.rounds, this.currentTournament.bracket.losers.rounds);
              } else if (bracketType === 'losers') {
                // Advance winner to next losers bracket round
                this.advanceWinner(match, rounds);
                // Loser is eliminated (no further advancement)
              }
            } else {
              // Single elimination - just advance winner
              this.advanceWinner(match, rounds);
            }
            return true;
          }
        }
      }
      return false;
    };

    if (this.currentTournament.bracket.type === 'double-elimination') {
      // Check grand final matches first
      if (this.currentTournament.bracket.grandFinal2) {
        for (const match of this.currentTournament.bracket.grandFinal2) {
          if (match.id === matchId) {
            match.winner = winner;
            // Grand final 2 winner is the tournament winner - no further advancement needed
            try {
              await api.updateTournament(this.currentTournament);
              await this.loadTournaments();
              this.render();
            } catch (error) {
              console.error('Error updating tournament:', error);
            }
            return;
          }
        }
      }
      if (this.currentTournament.bracket.grandFinal) {
        for (const match of this.currentTournament.bracket.grandFinal) {
          if (match.id === matchId) {
            match.winner = winner;
            // If losers bracket champion wins, create grand final 2
            const winnersChampion = this.getBracketChampion(this.currentTournament.bracket.winners.rounds);
            if (winner !== winnersChampion && !this.currentTournament.bracket.grandFinal2) {
              this.currentTournament.bracket.grandFinal2 = [{
                id: 'grand-final-2',
                player1: winnersChampion,
                player2: winner,
                winner: null,
                round: 0,
                matchNum: 1,
                bracket: 'grand-final'
              }];
            }
            try {
              await api.updateTournament(this.currentTournament);
              await this.loadTournaments();
              this.render();
            } catch (error) {
              console.error('Error updating tournament:', error);
            }
            return;
          }
        }
      }
      // Check winners bracket
      let found = updateMatch(this.currentTournament.bracket.winners.rounds, 'winners');
      if (!found) {
        // Check losers bracket
        updateMatch(this.currentTournament.bracket.losers.rounds, 'losers');
      }
    } else if (this.currentTournament.bracket.winners) {
      updateMatch(this.currentTournament.bracket.winners.rounds, 'winners');
    } else {
      updateMatch(this.currentTournament.bracket.rounds, 'single');
    }

    try {
      await api.updateTournament(this.currentTournament);
      await this.loadTournaments();
      this.render();
    } catch (error) {
      console.error('Error updating tournament:', error);
    }
  }

  advanceWinner(match, rounds) {
    if (match.round + 1 >= rounds.length) return;
    
    const currentRound = rounds[match.round];
    const nextRound = rounds[match.round + 1];
    
    let nextMatchIndex;
    let usePlayer1;
    
    // Check if next round has same number of matches (1:1 mapping for losers bracket "major" rounds)
    if (nextRound.length === currentRound.length) {
      // 1:1 mapping: Each winner goes to corresponding match in next round
      // Winner goes to player1 (player2 will be filled by WB loser via advanceLoser)
      nextMatchIndex = match.matchNum - 1;
      usePlayer1 = true;
    } else {
      // 2:1 mapping (standard halving): Match 1&2 → Match 1, Match 3&4 → Match 2, etc.
      nextMatchIndex = Math.ceil(match.matchNum / 2) - 1;
      // Odd match numbers go to player1, even go to player2
      usePlayer1 = (match.matchNum % 2 === 1);
    }
    
    if (nextMatchIndex >= 0 && nextMatchIndex < nextRound.length) {
      const nextMatch = nextRound[nextMatchIndex];
      if (usePlayer1) {
        nextMatch.player1 = match.winner;
      } else {
        nextMatch.player2 = match.winner;
      }
    }
  }

  advanceLoser(match, winnersRounds, losersRounds) {
    if (!match.winner) return;
    
    const loser = match.winner === match.player1 ? match.player2 : match.player1;
    console.log(`advanceLoser: match ${match.id}, winner=${match.winner}, player1=${match.player1}, player2=${match.player2}, loser=${loser}`);
    if (!loser || loser === 'BYE' || loser === 'TBD') return;

    const winnersRound = match.round;
    const numWinnersRounds = winnersRounds.length;
    
    // Determine which losers bracket round this loser should go to
    // Based on generateLosersBracket structure:
    // - Round 0: receives losers from winners round 0
    // - For winners round wRound (1 to numWinnersRounds-2):
    //   - Round 1: receives losers from winners round 1 (created when wRound=1)
    //   - Round 3: receives losers from winners round 2 (created when wRound=2)
    //   - Round 5: receives losers from winners round 3 (created when wRound=3)
    // Pattern: Winners Round N → Losers Round (2*N - 1) for N >= 1, Round 0 → Round 0
    
    let losersRoundIndex;
    if (winnersRound === 0) {
      losersRoundIndex = 0;
    } else {
      // For winners round N (N >= 1), losers go to losers round (2*N - 1)
      losersRoundIndex = (winnersRound * 2) - 1;
    }
    
    // Validate that the round exists
    if (losersRoundIndex < 0 || losersRoundIndex >= losersRounds.length) {
      console.warn(`Losers bracket round ${losersRoundIndex} doesn't exist for winners round ${winnersRound}`);
      // Try to find any available slot as fallback
      for (let i = losersRounds.length - 1; i >= 0; i--) {
        const round = losersRounds[i];
        for (const m of round) {
          if (m.player1 === 'TBD' || m.player2 === 'TBD') {
            if (m.player1 === 'TBD') {
              m.player1 = loser;
            } else {
              m.player2 = loser;
            }
            return;
          }
        }
      }
      return;
    }
    
    const targetLosersRound = losersRounds[losersRoundIndex];
    if (!targetLosersRound || targetLosersRound.length === 0) {
      console.warn(`Losers bracket round ${losersRoundIndex} is empty`);
      return;
    }
    
    // Find an available match in this round
    if (winnersRound === 0) {
      // For round 0, pair losers from adjacent winners matches
      // Match 1&2 → losers match 1, Match 3&4 → losers match 2, etc.
      const matchIndex = Math.floor((match.matchNum - 1) / 2);
      if (matchIndex >= 0 && matchIndex < targetLosersRound.length) {
        const targetMatch = targetLosersRound[matchIndex];
        // Check that this loser isn't already in the match (prevent duplicates)
        if (targetMatch.player1 === loser || targetMatch.player2 === loser) {
          console.warn(`Loser ${loser} already in losers match, skipping`);
          return;
        }
        if (targetMatch.player1 === 'TBD') {
          targetMatch.player1 = loser;
        } else if (targetMatch.player2 === 'TBD') {
          targetMatch.player2 = loser;
        }
      }
    } else {
      // For later rounds (semifinals, finals), use 1:1 mapping
      // WR match N loser → LR match N (same index)
      // The WB loser goes to player2 because player1 is the LB winner from previous round
      // 
      // Example for 8 players:
      // - WR1 match 1 loser → LR1 match 1, player2
      // - WR1 match 2 loser → LR1 match 2, player2
      // - WR2 match 1 loser → LR3 match 1, player2
      
      const matchIndex = match.matchNum - 1;
      
      if (matchIndex >= 0 && matchIndex < targetLosersRound.length) {
        const targetMatch = targetLosersRound[matchIndex];
        // WB loser goes to player2 (player1 is the LB winner from advanceWinner)
        if (targetMatch.player2 === 'TBD') {
          targetMatch.player2 = loser;
        } else if (targetMatch.player1 === 'TBD') {
          // Fallback: if player2 is already filled, use player1
          targetMatch.player1 = loser;
        }
      } else {
        // Fallback: if calculated index is out of bounds, find any available slot
        for (const m of targetLosersRound) {
          if (m.player2 === 'TBD') {
            m.player2 = loser;
            break;
          } else if (m.player1 === 'TBD') {
            m.player1 = loser;
            break;
          }
        }
      }
    }
  }

  // Extract unique participant names from bracket matches (for older tournaments)
  extractParticipantsFromBracket() {
    if (!this.currentTournament || !this.currentTournament.bracket) {
      return this.currentTournament?.participants || [];
    }

    const participants = new Set();
    
    const extractFromRounds = (rounds) => {
      if (!rounds) return;
      rounds.forEach(round => {
        round.forEach(match => {
          if (match.player1 && match.player1 !== 'TBD' && match.player1 !== 'BYE') {
            participants.add(match.player1);
          }
          if (match.player2 && match.player2 !== 'TBD' && match.player2 !== 'BYE') {
            participants.add(match.player2);
          }
        });
      });
    };

    const bracket = this.currentTournament.bracket;
    
    if (bracket.type === 'double-elimination') {
      extractFromRounds(bracket.winners?.rounds);
      extractFromRounds(bracket.losers?.rounds);
    } else if (bracket.winners) {
      extractFromRounds(bracket.winners.rounds);
    } else if (bracket.rounds) {
      extractFromRounds(bracket.rounds);
    }

    return Array.from(participants);
  }

  getTournamentStats() {
    if (!this.currentTournament) return null;

    const stats = {};
    
    // Get participant list - use finalParticipants if available, otherwise derive from bracket
    let participantList = this.currentTournament.finalParticipants;
    
    if (!participantList) {
      // For older tournaments without finalParticipants, extract from bracket
      participantList = this.extractParticipantsFromBracket();
    }
    
    participantList.forEach(p => {
      if (p && p !== 'TBD' && p !== 'BYE') {
        stats[p] = { wins: 0, losses: 0, matches: 0 };
      }
    });

    const processMatches = (rounds) => {
      rounds.forEach(round => {
        round.forEach(match => {
          if (match.winner && stats[match.winner]) {
            stats[match.winner].wins++;
            stats[match.winner].matches++;
            const loser = match.winner === match.player1 ? match.player2 : match.player1;
            if (loser && loser !== 'BYE' && stats[loser]) {
              stats[loser].losses++;
              stats[loser].matches++;
            }
          }
        });
      });
    };

    if (this.currentTournament.bracket.type === 'double-elimination') {
      // Process winners bracket
      processMatches(this.currentTournament.bracket.winners.rounds);
      // Process losers bracket
      processMatches(this.currentTournament.bracket.losers.rounds);
      // Process grand final(s)
      if (this.currentTournament.bracket.grandFinal) {
        this.currentTournament.bracket.grandFinal.forEach(match => {
          if (match.winner && stats[match.winner]) {
            stats[match.winner].wins++;
            stats[match.winner].matches++;
            const loser = match.winner === match.player1 ? match.player2 : match.player1;
            if (loser && loser !== 'BYE' && stats[loser]) {
              stats[loser].losses++;
              stats[loser].matches++;
            }
          }
        });
      }
      if (this.currentTournament.bracket.grandFinal2) {
        this.currentTournament.bracket.grandFinal2.forEach(match => {
          if (match.winner && stats[match.winner]) {
            stats[match.winner].wins++;
            stats[match.winner].matches++;
            const loser = match.winner === match.player1 ? match.player2 : match.player1;
            if (loser && loser !== 'BYE' && stats[loser]) {
              stats[loser].losses++;
              stats[loser].matches++;
            }
          }
        });
      }
    } else if (this.currentTournament.bracket.winners) {
      processMatches(this.currentTournament.bracket.winners.rounds);
    } else {
      processMatches(this.currentTournament.bracket.rounds);
    }

    return Object.entries(stats)
      .map(([player, stat]) => ({
        player,
        ...stat,
        winRate: stat.matches > 0 ? ((stat.wins / stat.matches) * 100).toFixed(1) : 0
      }))
      .sort((a, b) => b.wins - a.wins || b.winRate - a.winRate);
  }

  getTournamentProgress() {
    if (!this.currentTournament) return { completed: 0, total: 0, percentage: 0 };

    let total = 0;
    let completed = 0;

    const processMatches = (rounds) => {
      rounds.forEach(round => {
        round.forEach(match => {
          total++;
          if (match.winner) completed++;
        });
      });
    };

    if (this.currentTournament.bracket.type === 'double-elimination') {
      // Process winners bracket
      processMatches(this.currentTournament.bracket.winners.rounds);
      // Process losers bracket
      processMatches(this.currentTournament.bracket.losers.rounds);
      // Process grand final(s)
      if (this.currentTournament.bracket.grandFinal) {
        this.currentTournament.bracket.grandFinal.forEach(match => {
          total++;
          if (match.winner) completed++;
        });
      }
      if (this.currentTournament.bracket.grandFinal2) {
        this.currentTournament.bracket.grandFinal2.forEach(match => {
          total++;
          if (match.winner) completed++;
        });
      }
    } else if (this.currentTournament.bracket.winners) {
      processMatches(this.currentTournament.bracket.winners.rounds);
    } else {
      processMatches(this.currentTournament.bracket.rounds);
    }

    return {
      completed,
      total,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0
    };
  }

  getWinner() {
    if (!this.currentTournament) return null;

    // For round robin, return current leader based on stats (even if not 100% complete)
    if (this.currentTournament.bracket.type === 'round-robin') {
      const stats = this.getTournamentStats();
      if (stats && stats.length > 0) {
        // Return the current leader (player with best win rate)
        // Only return null if no matches have been played yet
        const hasPlayedMatches = stats.some(stat => stat.matches > 0);
        if (hasPlayedMatches) {
          return stats[0].player; // Player with most wins (sorted by wins then win rate)
        }
      }
      return null;
    }

    // For double elimination, check grand final(s)
    if (this.currentTournament.bracket.type === 'double-elimination') {
      // Check grand final 2 first (if it exists and has a winner)
      if (this.currentTournament.bracket.grandFinal2 && this.currentTournament.bracket.grandFinal2[0]?.winner) {
        return this.currentTournament.bracket.grandFinal2[0].winner;
      }
      // Check grand final 1 (only if winners bracket champion won)
      if (this.currentTournament.bracket.grandFinal && this.currentTournament.bracket.grandFinal[0]?.winner) {
        const winnersChampion = this.getBracketChampion(this.currentTournament.bracket.winners.rounds);
        // If winners bracket champion won grand final 1, they're the winner
        if (this.currentTournament.bracket.grandFinal[0].winner === winnersChampion) {
          return winnersChampion;
        }
        // Otherwise, need grand final 2
        return null;
      }
      return null;
    }

    const rounds = this.currentTournament.bracket.winners 
      ? this.currentTournament.bracket.winners.rounds 
      : this.currentTournament.bracket.rounds;
    
    if (rounds.length === 0) return null;
    
    const finalRound = rounds[rounds.length - 1];
    const finalMatch = finalRound[0];
    return finalMatch?.winner || null;
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

  // Helper to escape player names for use in onclick handlers
  escapeForJs(str) {
    if (!str) return '';
    return str
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/"/g, '&quot;')
      .replace(/&/g, '&amp;');
  }

  // Helper to escape player names for HTML attribute values
  escapeForAttr(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/'/g, '&#39;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // Setup click handlers for bracket matches using event delegation
  setupBracketClickHandlers(container) {
    container.addEventListener('click', (e) => {
      // Find the clicked bracket-player or match-player element
      const playerEl = e.target.closest('[data-match-id][data-clickable="true"]');
      if (!playerEl) return;
      
      const matchId = playerEl.dataset.matchId;
      const playerIndex = parseInt(playerEl.dataset.playerIndex, 10);
      
      console.log('Bracket click detected:', matchId, playerIndex);
      this.recordMatchResultByIndex(matchId, playerIndex);
    });
  }

  renderVisualBracket(bracket) {
    if (!bracket || bracket.type === 'round-robin') {
      return this.renderRoundRobinBracket(bracket);
    }

    const rounds = bracket.winners ? bracket.winners.rounds : bracket.rounds;
    
    // Filter to only show rounds that are ready (first round or previous round is complete)
    const visibleRounds = [];
    rounds.forEach((round, roundIdx) => {
      const shouldShowRound = roundIdx === 0 || this.isRoundComplete(rounds[roundIdx - 1]);
      if (shouldShowRound) {
        visibleRounds.push({ round, roundIdx });
      }
    });
    
    const numVisibleRounds = visibleRounds.length;
    if (numVisibleRounds === 0) return '<div class="visual-bracket"></div>';
    
    let html = '<div class="visual-bracket">';
    
    visibleRounds.forEach(({ round, roundIdx }) => {
      const roundWidth = 100 / numVisibleRounds;
      
      html += `
        <div class="bracket-round-visual" style="width: ${roundWidth}%">
          <div class="round-label">${roundIdx === rounds.length - 1 ? 'Final' : roundIdx === rounds.length - 2 ? 'Semifinal' : `Round ${roundIdx + 1}`}</div>
          <div class="round-matches" data-round="${roundIdx}">
      `;

      round.forEach((match, matchIdx) => {
        // Allow clicking if at least one player is determined (not TBD) and match isn't finished
        // This enables progression when a match has one determined player and one TBD
        const player1Determined = match.player1 !== 'TBD' && match.player1 !== null;
        const player2Determined = match.player2 !== 'TBD' && match.player2 !== null && match.player2 !== 'BYE';
        const canClickPlayer1 = player1Determined && !match.winner;
        const canClickPlayer2 = player2Determined && !match.winner;
        
        // Escape player names for display
        const escapedPlayer1 = this.escapeForAttr(match.player1);
        const escapedPlayer2 = this.escapeForAttr(match.player2);
        
        const cursorStyle1 = canClickPlayer1 ? 'cursor: pointer;' : 'cursor: default; opacity: 0.6;';
        const cursorStyle2 = canClickPlayer2 ? 'cursor: pointer;' : 'cursor: default; opacity: 0.6;';
        
        html += `
          <div class="bracket-match">
            <div class="bracket-player ${match.winner === match.player1 ? 'winner' : ''}" 
                 data-match-id="${match.id}" data-player-index="0" ${canClickPlayer1 ? 'data-clickable="true"' : ''} style="${cursorStyle1}">
              ${escapedPlayer1 || 'TBD'}
            </div>
            <div class="bracket-vs">vs</div>
            <div class="bracket-player ${match.winner === match.player2 ? 'winner' : ''}" 
                 data-match-id="${match.id}" data-player-index="1" ${canClickPlayer2 ? 'data-clickable="true"' : ''} style="${cursorStyle2}">
              ${escapedPlayer2 || 'TBD'}
            </div>
            ${roundIdx < rounds.length - 1 && this.isRoundComplete(round) ? '<div class="bracket-connector"></div>' : ''}
          </div>
        `;
      });

      html += `
          </div>
        </div>
      `;
    });
    
    html += '</div>';
    return html;
  }

  isRoundComplete(round) {
    if (!round || round.length === 0) return false;
    return round.every(match => match.winner !== null);
  }

  renderRoundRobinBracket(bracket) {
    if (!bracket || !bracket.rounds || bracket.rounds.length === 0) return '';
    
    return `
      <div class="round-robin-bracket">
        ${bracket.rounds[0].map(match => {
          const escapedPlayer1 = this.escapeForAttr(match.player1);
          const escapedPlayer2 = this.escapeForAttr(match.player2);
          const canClick1 = !match.winner;
          const canClick2 = !match.winner;
          return `
          <div class="match">
            <div class="match-players">
              <button class="match-player ${match.winner === match.player1 ? 'winner' : ''}" 
                      data-match-id="${match.id}" data-player-index="0" ${canClick1 ? 'data-clickable="true"' : ''}>
                ${escapedPlayer1}
              </button>
              <span class="vs">vs</span>
              <button class="match-player ${match.winner === match.player2 ? 'winner' : ''}" 
                      data-match-id="${match.id}" data-player-index="1" ${canClick2 ? 'data-clickable="true"' : ''}>
                ${escapedPlayer2}
              </button>
            </div>
          </div>
        `}).join('')}
      </div>
    `;
  }

  renderBracket(bracket) {
    if (!bracket) return '';

    if (bracket.type === 'round-robin') {
      return this.renderRoundRobinBracket(bracket);
    }

    if (bracket.type === 'double-elimination') {
      return this.renderDoubleEliminationBracket(bracket);
    }

    return this.renderVisualBracket(bracket);
  }

  renderDoubleEliminationBracket(bracket) {
    if (!bracket || !bracket.winners || !bracket.losers) return '';
    
    let html = '<div class="double-elimination-container">';
    
    // Render Winners Bracket
    html += '<div class="bracket-section">';
    html += '<h3 class="bracket-section-title">Winners Bracket</h3>';
    html += this.renderVisualBracket(bracket.winners);
    html += '</div>';
    
    // Render Losers Bracket
    html += '<div class="bracket-section">';
    html += '<h3 class="bracket-section-title">Losers Bracket</h3>';
    html += this.renderVisualBracket(bracket.losers);
    html += '</div>';
    
    // Render Grand Final if both brackets have champions
    const winnersChampion = this.getBracketChampion(bracket.winners.rounds);
    const losersChampion = this.getBracketChampion(bracket.losers.rounds);
    
    if (winnersChampion && losersChampion) {
      html += '<div class="bracket-section grand-final">';
      html += '<h3 class="bracket-section-title">Grand Final</h3>';
      
      // Check if grand final exists in bracket, if not create it
      if (!bracket.grandFinal) {
        bracket.grandFinal = [{
          id: 'grand-final-1',
          player1: winnersChampion,
          player2: losersChampion,
          winner: null,
          round: 0,
          matchNum: 1,
          bracket: 'grand-final'
        }];
      }
      
      const grandFinal = bracket.grandFinal[0];
      const canClickPlayer1 = grandFinal.player1 && !grandFinal.winner;
      const canClickPlayer2 = grandFinal.player2 && !grandFinal.winner;
      const escapedGF1 = this.escapeForAttr(grandFinal.player1);
      const escapedGF2 = this.escapeForAttr(grandFinal.player2);
      
      html += `
        <div class="bracket-match grand-final-match">
          <div class="bracket-player ${grandFinal.winner === grandFinal.player1 ? 'winner' : ''}" 
               data-match-id="${grandFinal.id}" data-player-index="0" ${canClickPlayer1 ? 'data-clickable="true"' : ''}
               style="${canClickPlayer1 ? 'cursor: pointer;' : 'cursor: default; opacity: 0.6;'}">
            ${escapedGF1 || 'TBD'}
          </div>
          <div class="bracket-vs">vs</div>
          <div class="bracket-player ${grandFinal.winner === grandFinal.player2 ? 'winner' : ''}" 
               data-match-id="${grandFinal.id}" data-player-index="1" ${canClickPlayer2 ? 'data-clickable="true"' : ''}
               style="${canClickPlayer2 ? 'cursor: pointer;' : 'cursor: default; opacity: 0.6;'}">
            ${escapedGF2 || 'TBD'}
          </div>
        </div>
      `;
      
      // Check if second grand final is needed (if losers bracket champion won first grand final)
      if (grandFinal.winner === losersChampion && !bracket.grandFinal2) {
        bracket.grandFinal2 = [{
          id: 'grand-final-2',
          player1: winnersChampion,
          player2: losersChampion,
          winner: null,
          round: 0,
          matchNum: 1,
          bracket: 'grand-final'
        }];
      }
      
      if (bracket.grandFinal2) {
        const grandFinal2 = bracket.grandFinal2[0];
        const canClickPlayer1_2 = grandFinal2.player1 && !grandFinal2.winner;
        const canClickPlayer2_2 = grandFinal2.player2 && !grandFinal2.winner;
        const escapedGF2_1 = this.escapeForAttr(grandFinal2.player1);
        const escapedGF2_2 = this.escapeForAttr(grandFinal2.player2);
        
        html += '<h4 class="bracket-section-subtitle">Grand Final 2 (if needed)</h4>';
        html += `
          <div class="bracket-match grand-final-match">
            <div class="bracket-player ${grandFinal2.winner === grandFinal2.player1 ? 'winner' : ''}" 
                 data-match-id="${grandFinal2.id}" data-player-index="0" ${canClickPlayer1_2 ? 'data-clickable="true"' : ''}
                 style="${canClickPlayer1_2 ? 'cursor: pointer;' : 'cursor: default; opacity: 0.6;'}">
              ${escapedGF2_1 || 'TBD'}
            </div>
            <div class="bracket-vs">vs</div>
            <div class="bracket-player ${grandFinal2.winner === grandFinal2.player2 ? 'winner' : ''}" 
                 data-match-id="${grandFinal2.id}" data-player-index="1" ${canClickPlayer2_2 ? 'data-clickable="true"' : ''}
                 style="${canClickPlayer2_2 ? 'cursor: pointer;' : 'cursor: default; opacity: 0.6;'}">
              ${escapedGF2_2 || 'TBD'}
            </div>
          </div>
        `;
      }
      
      html += '</div>';
    }
    
    html += '</div>';
    return html;
  }

  getBracketChampion(rounds) {
    if (!rounds || rounds.length === 0) return null;
    const finalRound = rounds[rounds.length - 1];
    if (!finalRound || finalRound.length === 0) return null;
    const finalMatch = finalRound[0];
    return finalMatch.winner || null;
  }

  render() {
    const container = document.getElementById('tournament-content');
    if (!container) return;

    if (this.currentTournament) {
      const progress = this.getTournamentProgress();
      const stats = this.getTournamentStats();
      const winner = this.getWinner();

      const gameMode = this.currentTournament.gameMode || 'singles';
      const seedingMode = this.currentTournament.seedingMode || 'random';
      
      container.innerHTML = `
        <div class="tournament-header">
          <div>
            <h2>${this.currentTournament.name}</h2>
            <div class="tournament-badges">
              <span class="tournament-type">${this.currentTournament.type}</span>
              <span class="tournament-badge ${gameMode}">${gameMode === 'doubles' ? 'Doubles' : 'Singles'}</span>
              <span class="tournament-badge ${seedingMode}">${seedingMode === 'ranked' ? 'Ranked' : 'Random'}</span>
            </div>
          </div>
          <div class="tournament-header-actions">
            <button class="btn ${this.viewMode === 'bracket' ? 'active' : ''}" onclick="tournament.viewMode = 'bracket'; tournament.render();">Bracket</button>
            <button class="btn ${this.viewMode === 'stats' ? 'active' : ''}" onclick="tournament.viewMode = 'stats'; tournament.render();">Stats</button>
            ${this.currentTournament.teams ? `<button class="btn ${this.viewMode === 'teams' ? 'active' : ''}" onclick="tournament.viewMode = 'teams'; tournament.render();">Teams</button>` : ''}
            <button class="btn" onclick="tournament.currentTournament = null; tournament.render();">Back to List</button>
            <button class="btn" onclick="tournament.deleteTournament('${this.currentTournament.id}')">Delete</button>
          </div>
        </div>

        <div id="tournament-message" class="message" style="display:none;"></div>

        ${winner ? `
          <div class="tournament-winner">
            <div class="winner-crown">👑</div>
            <h3>${this.currentTournament.bracket.type === 'round-robin' ? 'Current Leader' : 'Winner'}: ${winner}</h3>
          </div>
        ` : ''}

        ${this.viewMode === 'stats' ? `
          <div class="tournament-stats-view">
            <div class="stats-grid">
              <div class="stat-card">
                <div class="stat-label">Progress</div>
                <div class="stat-value">${progress.percentage}%</div>
                <div class="stat-detail">${progress.completed} / ${progress.total} matches</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Participants</div>
                <div class="stat-value">${this.currentTournament.participants.length}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Type</div>
                <div class="stat-value">${this.currentTournament.type.replace('-', ' ')}</div>
              </div>
            </div>

            <div class="tournament-leaderboard">
              <h3>Leaderboard</h3>
              <div class="leaderboard-list">
                ${stats ? stats.map((stat, idx) => `
                  <div class="leaderboard-item ${idx === 0 ? 'first' : ''}">
                    <div class="leaderboard-rank">${idx + 1}</div>
                    <div class="leaderboard-player">${stat.player}</div>
                    <div class="leaderboard-stats">
                      <span>W: ${stat.wins}</span>
                      <span>L: ${stat.losses}</span>
                      <span>Win Rate: ${stat.winRate}%</span>
                    </div>
                  </div>
                `).join('') : ''}
              </div>
            </div>
          </div>
        ` : this.viewMode === 'teams' && this.currentTournament.teams ? `
          <div class="tournament-teams-view">
            <h3>Teams</h3>
            ${this.currentTournament.powerRankings ? `
              <p class="teams-info">Teams were formed by pairing highest-ranked players with lowest-ranked players for balanced competition.</p>
            ` : `
              <p class="teams-info">Teams were randomly paired.</p>
            `}
            <div class="teams-grid-view">
              ${this.currentTournament.teams.map((team, idx) => `
                <div class="team-card-view ${team.isSolo ? 'solo-team' : ''}">
                  <div class="team-header">
                    <span class="team-name-view">${team.name}</span>
                    ${team.combinedScore ? `<span class="team-score-view">${team.combinedScore} pts</span>` : ''}
                  </div>
                  <div class="team-players-view">
                    ${team.players.map(p => `
                      <div class="team-player-card">
                        <span class="player-name">${p}</span>
                        ${this.currentTournament.powerRankings ? `
                          <span class="player-ranks">
                            O: #${this.currentTournament.powerRankings.offense.indexOf(p) + 1} 
                            D: #${this.currentTournament.powerRankings.defense.indexOf(p) + 1}
                          </span>
                        ` : ''}
                      </div>
                    `).join('')}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : `
          <div class="bracket-container">
            ${this.renderBracket(this.currentTournament.bracket)}
          </div>
        `}
      `;
      
      // Setup click handlers for bracket matches using event delegation
      this.setupBracketClickHandlers(container);
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
          
          <div class="form-row">
            <div class="form-group">
              <label for="type">Bracket Type</label>
              <select id="type" name="type" required>
                <option value="single-elimination">Single Elimination</option>
                <option value="double-elimination">Double Elimination</option>
                <option value="round-robin">Round Robin</option>
              </select>
            </div>
            <div class="form-group">
              <label for="game-mode">Game Mode</label>
              <select id="game-mode" name="game-mode">
                <option value="singles">Singles</option>
                <option value="doubles">Doubles (Pairs)</option>
              </select>
            </div>
            <div class="form-group">
              <label for="seeding-mode">Seeding Mode</label>
              <select id="seeding-mode" name="seeding-mode">
                <option value="random">Random</option>
                <option value="ranked">Ranked (Power Rankings)</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label for="participants">Add Participants</label>
            <div class="participant-input-group">
              <input type="text" id="participants" placeholder="Enter participant name and press Enter">
              <button type="button" class="btn" onclick="tournament.addParticipant()">Add</button>
            </div>
            <div id="participant-list" class="participant-list"></div>
          </div>

          <!-- Power Rankings Section (hidden by default) -->
          <div id="power-rankings-container" class="power-rankings-container" style="display: none;">
            <h3 class="power-rankings-title">Power Rankings</h3>
            <p class="power-rankings-desc">Drag players to adjust their offense and defense rankings. Combined scores determine seeding.</p>
            <div id="power-rankings-lists"></div>
          </div>

          <!-- Teams Preview (for doubles mode) -->
          <div id="teams-preview" class="teams-preview" style="display: none;"></div>

          <button type="submit" class="btn primary">Create Tournament</button>
        </form>

        <div class="tournament-list">
          <h3>Your Tournaments</h3>
          ${this.tournaments.length === 0
            ? '<p class="empty-state">No tournaments yet. Create one above!</p>'
            : this.tournaments.map(t => {
                // Calculate progress for this tournament
                let total = 0;
                let completed = 0;
                const processMatches = (rounds) => {
                  rounds.forEach(round => {
                    round.forEach(match => {
                      total++;
                      if (match.winner) completed++;
                    });
                  });
                };
                if (t.bracket && t.bracket.winners) {
                  processMatches(t.bracket.winners.rounds);
                } else if (t.bracket && t.bracket.rounds) {
                  processMatches(t.bracket.rounds);
                }
                const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
                
                const gameMode = t.gameMode || 'singles';
                const seedingMode = t.seedingMode || 'random';
                
                return `
                  <div class="tournament-card">
                    <div>
                      <h4>${t.name}</h4>
                      <div class="tournament-card-meta">
                        <span class="tournament-meta">${t.type} • ${t.participants.length} participants</span>
                        <div class="tournament-card-badges">
                          ${gameMode === 'doubles' ? '<span class="badge badge-doubles">Doubles</span>' : ''}
                          ${seedingMode === 'ranked' ? '<span class="badge badge-ranked">Ranked</span>' : ''}
                        </div>
                      </div>
                      ${total > 0 ? `<div class="tournament-progress-bar"><div class="tournament-progress-fill" style="width: ${percentage}%"></div></div>` : ''}
                    </div>
                    <div style="display: flex; gap: 8px; align-items: center;">
                      <button class="btn" onclick="tournament.viewTournament('${t.id}')">View</button>
                      <button class="btn" onclick="tournament.deleteTournament('${t.id}')" style="background: rgba(239, 68, 68, 0.15); border-color: var(--danger); color: var(--danger); padding: 8px 12px; font-size: 13px;" title="Delete tournament">×</button>
                    </div>
                  </div>
                `;
              }).join('')
          }
        </div>
      `;

      this.setupEventListeners();
    }
  }
}

// Export tournament instance
const tournament = new Tournament();
