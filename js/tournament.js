// Tournament Generator Mini Site
class Tournament {
  constructor() {
    this.tournaments = [];
    this.currentTournament = null;
    this.viewMode = 'bracket'; // 'bracket' or 'stats'
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
    
    // Losers bracket structure is more complex
    // First round: Losers from winners bracket round 1
    // Subsequent rounds: Mix of losers from winners bracket and winners from losers bracket
    
    // Calculate number of matches in first losers round (losers from winners round 1)
    const firstLosersRoundMatches = Math.ceil(numParticipants / 4); // Half of winners round 1 matches
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
    // The structure alternates between receiving from winners bracket and from previous losers round
    let currentRoundSize = firstLosersRoundMatches;
    let roundNum = 1;
    
    // For each winners bracket round (after round 1), there will be corresponding losers bracket rounds
    for (let wRound = 1; wRound < numWinnersRounds; wRound++) {
      // Round that receives losers from current winners bracket round
      const numMatches = Math.ceil(currentRoundSize / 2);
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
      
      // Round that receives winners from previous losers round (if not the last round)
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
    
    const nextRound = rounds[match.round + 1];
    // Calculate which match in the next round this winner should go to
    // Match 1 and 2 go to match 1, Match 3 and 4 go to match 2, etc.
    const nextMatchIndex = Math.ceil(match.matchNum / 2) - 1;
    
    if (nextMatchIndex >= 0 && nextMatchIndex < nextRound.length) {
      const nextMatch = nextRound[nextMatchIndex];
      // Determine if this winner should be player1 or player2
      // Odd match numbers (1, 3, 5...) go to player1, even (2, 4, 6...) go to player2
      if (match.matchNum % 2 === 1) {
        nextMatch.player1 = match.winner;
      } else {
        nextMatch.player2 = match.winner;
      }
    }
  }

  advanceLoser(match, winnersRounds, losersRounds) {
    if (!match.winner) return;
    
    const loser = match.winner === match.player1 ? match.player2 : match.player1;
    if (!loser || loser === 'BYE' || loser === 'TBD') return;

    const winnersRound = match.round;
    
    // Determine which losers bracket round this loser should go to
    // Based on generateLosersBracket structure:
    // - Round 0: receives losers from winners round 0
    // - Round 1: receives losers from winners round 1 (created when wRound=1)
    // - Round 3: receives losers from winners round 2 (created when wRound=2)
    // - Round 5: receives losers from winners round 3 (created when wRound=3)
    // Pattern: Winners Round N → Losers Round (2*N - 1) for N >= 1, Round 0 → Round 0
    
    let losersRoundIndex;
    if (winnersRound === 0) {
      losersRoundIndex = 0;
    } else {
      // For winners round N (N >= 1), losers go to losers round (2*N - 1)
      losersRoundIndex = (winnersRound * 2) - 1;
    }
    
    // Ensure the round exists
    if (losersRoundIndex >= losersRounds.length || losersRoundIndex < 0) {
      // If the round doesn't exist, try to find the last available round that can accept this loser
      console.warn(`Losers bracket round ${losersRoundIndex} doesn't exist for winners round ${winnersRound}, finding alternative`);
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
    
    if (losersRounds[losersRoundIndex].length > 0) {
      const targetLosersRound = losersRounds[losersRoundIndex];
      
      // Find an available match in this round
      // For round 0, pair losers from adjacent winners matches
      if (winnersRound === 0) {
        const matchIndex = Math.floor((match.matchNum - 1) / 2);
        if (matchIndex < targetLosersRound.length) {
          const targetMatch = targetLosersRound[matchIndex];
          if (targetMatch.player1 === 'TBD') {
            targetMatch.player1 = loser;
          } else if (targetMatch.player2 === 'TBD') {
            targetMatch.player2 = loser;
          }
        }
      } else {
        // For later rounds, find an available slot
        // Try to match based on match number first, then find any available slot
        const matchIndex = Math.floor((match.matchNum - 1) / 2);
        let targetMatch = null;
        
        if (matchIndex < targetLosersRound.length) {
          targetMatch = targetLosersRound[matchIndex];
        } else {
          // If calculated index is out of bounds, find first available match
          for (const m of targetLosersRound) {
            if (m.player1 === 'TBD' || m.player2 === 'TBD') {
              targetMatch = m;
              break;
            }
          }
        }
        
        if (targetMatch) {
          if (targetMatch.player1 === 'TBD') {
            targetMatch.player1 = loser;
          } else if (targetMatch.player2 === 'TBD') {
            targetMatch.player2 = loser;
          }
        }
      }
    }
  }

  getTournamentStats() {
    if (!this.currentTournament) return null;

    const stats = {};
    this.currentTournament.participants.forEach(p => {
      stats[p] = { wins: 0, losses: 0, matches: 0 };
    });

    const processMatches = (rounds) => {
      rounds.forEach(round => {
        round.forEach(match => {
          if (match.winner) {
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
          if (match.winner) {
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
          if (match.winner) {
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
        
        const clickHandler1 = canClickPlayer1 ? `onclick="tournament.recordMatchResult('${match.id}', '${match.player1}')"` : '';
        const clickHandler2 = canClickPlayer2 ? `onclick="tournament.recordMatchResult('${match.id}', '${match.player2}')"` : '';
        const cursorStyle1 = canClickPlayer1 ? 'cursor: pointer;' : 'cursor: default; opacity: 0.6;';
        const cursorStyle2 = canClickPlayer2 ? 'cursor: pointer;' : 'cursor: default; opacity: 0.6;';
        
        html += `
          <div class="bracket-match">
            <div class="bracket-player ${match.winner === match.player1 ? 'winner' : ''}" 
                 ${clickHandler1} style="${cursorStyle1}">
              ${match.player1 || 'TBD'}
            </div>
            <div class="bracket-vs">vs</div>
            <div class="bracket-player ${match.winner === match.player2 ? 'winner' : ''}" 
                 ${clickHandler2} style="${cursorStyle2}">
              ${match.player2 || 'TBD'}
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
      
      html += `
        <div class="bracket-match grand-final-match">
          <div class="bracket-player ${grandFinal.winner === grandFinal.player1 ? 'winner' : ''}" 
               ${canClickPlayer1 ? `onclick="tournament.recordMatchResult('${grandFinal.id}', '${grandFinal.player1}')"` : ''} 
               style="${canClickPlayer1 ? 'cursor: pointer;' : 'cursor: default; opacity: 0.6;'}">
            ${grandFinal.player1 || 'TBD'}
          </div>
          <div class="bracket-vs">vs</div>
          <div class="bracket-player ${grandFinal.winner === grandFinal.player2 ? 'winner' : ''}" 
               ${canClickPlayer2 ? `onclick="tournament.recordMatchResult('${grandFinal.id}', '${grandFinal.player2}')"` : ''} 
               style="${canClickPlayer2 ? 'cursor: pointer;' : 'cursor: default; opacity: 0.6;'}">
            ${grandFinal.player2 || 'TBD'}
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
        
        html += '<h4 class="bracket-section-subtitle">Grand Final 2 (if needed)</h4>';
        html += `
          <div class="bracket-match grand-final-match">
            <div class="bracket-player ${grandFinal2.winner === grandFinal2.player1 ? 'winner' : ''}" 
                 ${canClickPlayer1_2 ? `onclick="tournament.recordMatchResult('${grandFinal2.id}', '${grandFinal2.player1}')"` : ''} 
                 style="${canClickPlayer1_2 ? 'cursor: pointer;' : 'cursor: default; opacity: 0.6;'}">
              ${grandFinal2.player1 || 'TBD'}
            </div>
            <div class="bracket-vs">vs</div>
            <div class="bracket-player ${grandFinal2.winner === grandFinal2.player2 ? 'winner' : ''}" 
                 ${canClickPlayer2_2 ? `onclick="tournament.recordMatchResult('${grandFinal2.id}', '${grandFinal2.player2}')"` : ''} 
                 style="${canClickPlayer2_2 ? 'cursor: pointer;' : 'cursor: default; opacity: 0.6;'}">
              ${grandFinal2.player2 || 'TBD'}
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

      container.innerHTML = `
        <div class="tournament-header">
          <div>
            <h2>${this.currentTournament.name}</h2>
            <span class="tournament-type">${this.currentTournament.type}</span>
          </div>
          <div class="tournament-header-actions">
            <button class="btn ${this.viewMode === 'bracket' ? 'active' : ''}" onclick="tournament.viewMode = 'bracket'; tournament.render();">Bracket</button>
            <button class="btn ${this.viewMode === 'stats' ? 'active' : ''}" onclick="tournament.viewMode = 'stats'; tournament.render();">Stats</button>
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
        ` : `
          <div class="bracket-container">
            ${this.renderBracket(this.currentTournament.bracket)}
          </div>
        `}
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
                
                return `
                  <div class="tournament-card">
                    <div>
                      <h4>${t.name}</h4>
                      <span class="tournament-meta">${t.type} • ${t.participants.length} participants</span>
                      ${total > 0 ? `<div class="tournament-progress-bar"><div class="tournament-progress-fill" style="width: ${percentage}%"></div></div>` : ''}
                    </div>
                    <button class="btn" onclick="tournament.viewTournament('${t.id}')">View</button>
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
