// Gym Log Mini Site
class GymLog {
  constructor() {
    this.workouts = [];
    this.currentFilter = 'all';
    this.viewMode = 'list'; // 'list' or 'analytics'
    this.selectedExercise = null;
    this.charts = {};
    this.init();
  }

  async init() {
    await this.loadWorkouts();
    this.render();
    this.setupEventListeners();
  }

  async loadWorkouts() {
    try {
      this.workouts = await api.getWorkouts();
      // Sort by date (newest first)
      this.workouts.sort((a, b) => new Date(b.date) - new Date(a.date));
    } catch (error) {
      console.error('Error loading workouts:', error);
      this.workouts = [];
    }
  }

  setupEventListeners() {
    // Form submission
    const form = document.getElementById('gym-log-form');
    if (form) {
      form.addEventListener('submit', (e) => this.handleSubmit(e));
    }

    // Filter buttons
    const filterButtons = document.querySelectorAll('[data-filter]');
    filterButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.currentFilter = e.target.getAttribute('data-filter');
        this.render();
      });
    });

    // View mode toggle
    const viewModeButtons = document.querySelectorAll('[data-view]');
    viewModeButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.viewMode = e.target.getAttribute('data-view');
        this.render();
      });
    });

    // Export button
    const exportBtn = document.getElementById('export-workouts');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportData());
    }

    // Exercise autocomplete
    const exerciseInput = document.getElementById('exercise');
    if (exerciseInput) {
      exerciseInput.addEventListener('input', (e) => this.handleExerciseInput(e));
    }
  }

  handleExerciseInput(e) {
    const input = e.target.value.toLowerCase();
    if (!input) return;

    const exercises = [...new Set(this.workouts.map(w => w.exercise))];
    const matches = exercises.filter(ex => ex.toLowerCase().includes(input));
    
    // Simple autocomplete - could be enhanced with dropdown
  }

  async handleSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);

    const workout = {
      date: formData.get('date') || new Date().toISOString().split('T')[0],
      exercise: formData.get('exercise'),
      sets: parseInt(formData.get('sets')),
      reps: parseInt(formData.get('reps')),
      weight: parseFloat(formData.get('weight')),
      notes: formData.get('notes') || ''
    };

    try {
      await api.createWorkout(workout);
      form.reset();
      await this.loadWorkouts();
      this.render();
      this.showMessage('Workout logged successfully!', 'success');
    } catch (error) {
      console.error('Error saving workout:', error);
      this.showMessage('Error saving workout. Please try again.', 'error');
    }
  }

  async deleteWorkout(id) {
    if (!confirm('Delete this workout?')) return;

    try {
      await api.deleteWorkout(id);
      await this.loadWorkouts();
      this.render();
      this.showMessage('Workout deleted.', 'success');
    } catch (error) {
      console.error('Error deleting workout:', error);
      this.showMessage('Error deleting workout.', 'error');
    }
  }

  async editWorkout(id) {
    const workout = this.workouts.find(w => w.id === id);
    if (!workout) return;

    const form = document.getElementById('gym-log-form');
    if (form) {
      form.elements.date.value = workout.date;
      form.elements.exercise.value = workout.exercise;
      form.elements.sets.value = workout.sets;
      form.elements.reps.value = workout.reps;
      form.elements.weight.value = workout.weight;
      form.elements.notes.value = workout.notes || '';
      
      // Scroll to form
      form.scrollIntoView({ behavior: 'smooth' });
      
      // Change submit to update
      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.textContent = 'Update Workout';
      submitBtn.onclick = async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        workout.date = formData.get('date');
        workout.exercise = formData.get('exercise');
        workout.sets = parseInt(formData.get('sets'));
        workout.reps = parseInt(formData.get('reps'));
        workout.weight = parseFloat(formData.get('weight'));
        workout.notes = formData.get('notes') || '';
        
        try {
          await api.updateWorkout(workout);
          form.reset();
          submitBtn.textContent = 'Log Workout';
          submitBtn.onclick = null;
          await this.loadWorkouts();
          this.render();
          this.showMessage('Workout updated!', 'success');
        } catch (error) {
          console.error('Error updating workout:', error);
          this.showMessage('Error updating workout.', 'error');
        }
      };
    }
  }

  getFilteredWorkouts() {
    if (this.currentFilter === 'all') {
      return this.workouts;
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    return this.workouts.filter(workout => {
      const workoutDate = new Date(workout.date);
      switch (this.currentFilter) {
        case 'today':
          return workoutDate >= today;
        case 'week':
          return workoutDate >= weekAgo;
        case 'month':
          return workoutDate >= monthAgo;
        default:
          return true;
      }
    });
  }

  getExerciseStats(exerciseName) {
    const exerciseWorkouts = this.workouts.filter(w => w.exercise === exerciseName);
    if (exerciseWorkouts.length === 0) return null;

    const volumes = exerciseWorkouts.map(w => w.sets * w.reps * w.weight);
    const weights = exerciseWorkouts.map(w => w.weight);
    
    return {
      exercise: exerciseName,
      totalWorkouts: exerciseWorkouts.length,
      prWeight: Math.max(...weights),
      prVolume: Math.max(...volumes),
      avgWeight: weights.reduce((a, b) => a + b, 0) / weights.length,
      avgVolume: volumes.reduce((a, b) => a + b, 0) / volumes.length,
      workouts: exerciseWorkouts.sort((a, b) => new Date(a.date) - new Date(b.date))
    };
  }

  getAllExercises() {
    return [...new Set(this.workouts.map(w => w.exercise))];
  }

  getPersonalRecords() {
    const exercises = this.getAllExercises();
    return exercises.map(ex => {
      const stats = this.getExerciseStats(ex);
      return {
        exercise: ex,
        prWeight: stats.prWeight,
        prVolume: stats.prVolume,
        lastWorkout: this.workouts.find(w => w.exercise === ex)?.date
      };
    }).sort((a, b) => b.prWeight - a.prWeight);
  }

  getVolumeTrend() {
    const workoutsByDate = {};
    this.workouts.forEach(w => {
      const date = w.date;
      if (!workoutsByDate[date]) {
        workoutsByDate[date] = 0;
      }
      workoutsByDate[date] += w.sets * w.reps * w.weight;
    });

    return Object.entries(workoutsByDate)
      .sort((a, b) => new Date(a[0]) - new Date(b[0]))
      .map(([date, volume]) => ({ date, volume }));
  }

  getWeightProgression(exerciseName) {
    const exerciseWorkouts = this.workouts
      .filter(w => w.exercise === exerciseName)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    
    return exerciseWorkouts.map(w => ({
      date: w.date,
      weight: w.weight,
      volume: w.sets * w.reps * w.weight
    }));
  }

  renderCharts() {
    // Destroy existing charts
    Object.values(this.charts).forEach(chart => {
      if (chart) chart.destroy();
    });
    this.charts = {};

    // Volume trend chart
    const volumeTrend = this.getVolumeTrend();
    if (volumeTrend.length > 0) {
      const volumeCtx = document.getElementById('volume-chart');
      if (volumeCtx) {
        this.charts.volume = new Chart(volumeCtx, {
          type: 'line',
          data: {
            labels: volumeTrend.map(v => new Date(v.date).toLocaleDateString()),
            datasets: [{
              label: 'Total Volume (lbs)',
              data: volumeTrend.map(v => v.volume),
              borderColor: 'rgba(110, 231, 255, 0.8)',
              backgroundColor: 'rgba(110, 231, 255, 0.1)',
              tension: 0.4,
              fill: true
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: true },
              tooltip: { mode: 'index', intersect: false }
            },
            scales: {
              y: {
                beginAtZero: true,
                ticks: { color: 'rgba(255, 255, 255, 0.68)' },
                grid: { color: 'rgba(255, 255, 255, 0.1)' }
              },
              x: {
                ticks: { color: 'rgba(255, 255, 255, 0.68)' },
                grid: { color: 'rgba(255, 255, 255, 0.1)' }
              }
            }
          }
        });
      }
    }

    // Exercise weight progression chart
    if (this.selectedExercise) {
      const progression = this.getWeightProgression(this.selectedExercise);
      if (progression.length > 0) {
        const progCtx = document.getElementById('exercise-progression-chart');
        if (progCtx) {
          this.charts.progression = new Chart(progCtx, {
            type: 'line',
            data: {
              labels: progression.map(p => new Date(p.date).toLocaleDateString()),
              datasets: [{
                label: 'Weight (lbs)',
                data: progression.map(p => p.weight),
                borderColor: 'rgba(167, 139, 250, 0.8)',
                backgroundColor: 'rgba(167, 139, 250, 0.1)',
                tension: 0.4,
                yAxisID: 'y'
              }, {
                label: 'Volume (lbs)',
                data: progression.map(p => p.volume),
                borderColor: 'rgba(110, 231, 255, 0.8)',
                backgroundColor: 'rgba(110, 231, 255, 0.1)',
                tension: 0.4,
                yAxisID: 'y1'
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              interaction: { mode: 'index', intersect: false },
              plugins: {
                legend: { display: true },
                tooltip: { mode: 'index', intersect: false }
              },
              scales: {
                y: {
                  type: 'linear',
                  display: true,
                  position: 'left',
                  beginAtZero: true,
                  ticks: { color: 'rgba(255, 255, 255, 0.68)' },
                  grid: { color: 'rgba(255, 255, 255, 0.1)' }
                },
                y1: {
                  type: 'linear',
                  display: true,
                  position: 'right',
                  beginAtZero: true,
                  ticks: { color: 'rgba(255, 255, 255, 0.68)' },
                  grid: { drawOnChartArea: false }
                },
                x: {
                  ticks: { color: 'rgba(255, 255, 255, 0.68)' },
                  grid: { color: 'rgba(255, 255, 255, 0.1)' }
                }
              }
            }
          });
        }
      }
    }

    // PR chart
    const prs = this.getPersonalRecords().slice(0, 10);
    if (prs.length > 0) {
      const prCtx = document.getElementById('pr-chart');
      if (prCtx) {
        this.charts.pr = new Chart(prCtx, {
          type: 'bar',
          data: {
            labels: prs.map(pr => pr.exercise),
            datasets: [{
              label: 'Personal Record (lbs)',
              data: prs.map(pr => pr.prWeight),
              backgroundColor: 'rgba(110, 231, 255, 0.5)',
              borderColor: 'rgba(110, 231, 255, 0.8)',
              borderWidth: 1
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: true }
            },
            scales: {
              y: {
                beginAtZero: true,
                ticks: { color: 'rgba(255, 255, 255, 0.68)' },
                grid: { color: 'rgba(255, 255, 255, 0.1)' }
              },
              x: {
                ticks: { color: 'rgba(255, 255, 255, 0.68)', maxRotation: 45, minRotation: 45 },
                grid: { color: 'rgba(255, 255, 255, 0.1)' }
              }
            }
          }
        });
      }
    }
  }

  viewExerciseDetails(exerciseName) {
    this.selectedExercise = exerciseName;
    this.viewMode = 'analytics';
    this.render();
  }

  getLastWorkoutComparison(workout) {
    const exerciseWorkouts = this.workouts
      .filter(w => w.exercise === workout.exercise && w.id !== workout.id)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    
    if (exerciseWorkouts.length === 0) return null;
    
    const last = exerciseWorkouts[0];
    return {
      weightChange: workout.weight - last.weight,
      volumeChange: (workout.sets * workout.reps * workout.weight) - (last.sets * last.reps * last.weight),
      lastDate: last.date
    };
  }

  exportData() {
    const data = JSON.stringify(this.workouts, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gym-log-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  showMessage(message, type = 'info') {
    const messageEl = document.getElementById('gym-log-message');
    if (messageEl) {
      messageEl.textContent = message;
      messageEl.className = `message message-${type}`;
      messageEl.style.display = 'block';
      setTimeout(() => {
        messageEl.style.display = 'none';
      }, 3000);
    }
  }

  render() {
    const container = document.getElementById('gym-log-content');
    if (!container) return;

    const filtered = this.getFilteredWorkouts();
    const prs = this.getPersonalRecords();

    if (this.viewMode === 'analytics') {
      container.innerHTML = `
        <div class="gym-log-header">
          <h2>Exercise Analytics</h2>
          <div class="gym-log-actions">
            <button class="btn ${this.viewMode === 'analytics' ? 'active' : ''}" data-view="analytics">Analytics</button>
            <button class="btn ${this.viewMode === 'list' ? 'active' : ''}" data-view="list">List View</button>
            <button class="btn" id="export-workouts">Export Data</button>
          </div>
        </div>

        <div id="gym-log-message" class="message" style="display:none;"></div>

        ${this.selectedExercise ? `
          <div class="exercise-details-header">
            <h3>${this.selectedExercise}</h3>
            <button class="btn" onclick="gymLog.selectedExercise = null; gymLog.render();">← Back to All Exercises</button>
          </div>
          ${this.renderExerciseDetails(this.selectedExercise)}
        ` : `
          <div class="analytics-dashboard">
            <div class="stats-grid">
              <div class="stat-card">
                <div class="stat-label">Total Workouts</div>
                <div class="stat-value">${this.workouts.length}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Unique Exercises</div>
                <div class="stat-value">${this.getAllExercises().length}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Total Volume</div>
                <div class="stat-value">${this.workouts.reduce((sum, w) => sum + (w.sets * w.reps * w.weight), 0).toLocaleString()} lbs</div>
              </div>
            </div>

            <div class="chart-container">
              <h3>Volume Trend</h3>
              <canvas id="volume-chart"></canvas>
            </div>

            <div class="chart-container">
              <h3>Personal Records (Top 10)</h3>
              <canvas id="pr-chart"></canvas>
            </div>

            <div class="pr-list">
              <h3>All Personal Records</h3>
              <div class="pr-grid">
                ${prs.map(pr => `
                  <div class="pr-card" onclick="gymLog.viewExerciseDetails('${pr.exercise}')">
                    <div class="pr-exercise">${pr.exercise}</div>
                    <div class="pr-value">${pr.prWeight} lbs</div>
                    <div class="pr-volume">Volume: ${pr.prVolume.toLocaleString()} lbs</div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        `}
      `;
    } else {
      container.innerHTML = `
        <div class="gym-log-header">
          <h2>Gym Log</h2>
          <div class="gym-log-actions">
            <button class="btn ${this.viewMode === 'list' ? 'active' : ''}" data-view="list">List View</button>
            <button class="btn ${this.viewMode === 'analytics' ? 'active' : ''}" data-view="analytics">Analytics</button>
            <button class="btn" id="export-workouts">Export Data</button>
          </div>
        </div>

        <div id="gym-log-message" class="message" style="display:none;"></div>

        <form id="gym-log-form" class="gym-log-form">
          <div class="form-row">
            <div class="form-group">
              <label for="date">Date</label>
              <input type="date" id="date" name="date" value="${new Date().toISOString().split('T')[0]}" required>
            </div>
            <div class="form-group">
              <label for="exercise">Exercise</label>
              <input type="text" id="exercise" name="exercise" placeholder="e.g., Bench Press" required list="exercise-list">
              <datalist id="exercise-list">
                ${this.getAllExercises().map(ex => `<option value="${ex}">`).join('')}
              </datalist>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="sets">Sets</label>
              <input type="number" id="sets" name="sets" min="1" value="3" required>
            </div>
            <div class="form-group">
              <label for="reps">Reps</label>
              <input type="number" id="reps" name="reps" min="1" required>
            </div>
            <div class="form-group">
              <label for="weight">Weight (lbs)</label>
              <input type="number" id="weight" name="weight" min="0" step="0.5" required>
            </div>
          </div>
          <div class="form-group">
            <label for="notes">Notes (optional)</label>
            <textarea id="notes" name="notes" rows="2" placeholder="How did it feel? Form cues, etc."></textarea>
          </div>
          <button type="submit" class="btn primary">Log Workout</button>
        </form>

        <div class="gym-log-filters">
          <button class="btn ${this.currentFilter === 'all' ? 'active' : ''}" data-filter="all">All</button>
          <button class="btn ${this.currentFilter === 'today' ? 'active' : ''}" data-filter="today">Today</button>
          <button class="btn ${this.currentFilter === 'week' ? 'active' : ''}" data-filter="week">This Week</button>
          <button class="btn ${this.currentFilter === 'month' ? 'active' : ''}" data-filter="month">This Month</button>
        </div>

        <div class="gym-log-list">
          ${filtered.length === 0 
            ? '<p class="empty-state">No workouts logged yet. Start logging your workouts above!</p>'
            : filtered.map(workout => {
                const comparison = this.getLastWorkoutComparison(workout);
                const volume = workout.sets * workout.reps * workout.weight;
                return `
                  <div class="workout-card">
                    <div class="workout-header">
                      <div>
                        <h3>${workout.exercise}</h3>
                        <span class="workout-date">${new Date(workout.date).toLocaleDateString()}</span>
                      </div>
                      <div class="workout-actions">
                        <button class="btn-icon" onclick="gymLog.viewExerciseDetails('${workout.exercise}')" title="View Details">📊</button>
                        <button class="btn-icon" onclick="gymLog.editWorkout('${workout.id}')" title="Edit">✏️</button>
                        <button class="btn-icon" onclick="gymLog.deleteWorkout('${workout.id}')" title="Delete">×</button>
                      </div>
                    </div>
                    <div class="workout-details">
                      <span>${workout.sets} sets × ${workout.reps} reps</span>
                      <span class="workout-weight">${workout.weight} lbs</span>
                      <span class="workout-volume">Volume: ${volume.toLocaleString()} lbs</span>
                    </div>
                    ${comparison ? `
                      <div class="workout-progress">
                        ${comparison.weightChange > 0 ? `<span class="progress-up">↑ +${comparison.weightChange} lbs</span>` : ''}
                        ${comparison.weightChange < 0 ? `<span class="progress-down">↓ ${comparison.weightChange} lbs</span>` : ''}
                        ${comparison.weightChange === 0 ? `<span class="progress-same">→ Same weight</span>` : ''}
                      </div>
                    ` : ''}
                    ${workout.notes ? `<div class="workout-notes">${workout.notes}</div>` : ''}
                  </div>
                `;
              }).join('')
          }
        </div>
      `;
    }

    this.setupEventListeners();
    
    // Render charts after a small delay to ensure DOM is ready
    setTimeout(() => {
      if (this.viewMode === 'analytics') {
        this.renderCharts();
      }
    }, 100);
  }

  renderExerciseDetails(exerciseName) {
    const stats = this.getExerciseStats(exerciseName);
    if (!stats) return '<p>No data for this exercise.</p>';

    const progression = this.getWeightProgression(exerciseName);
    
    return `
      <div class="exercise-details">
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">Total Workouts</div>
            <div class="stat-value">${stats.totalWorkouts}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">PR Weight</div>
            <div class="stat-value">${stats.prWeight} lbs</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">PR Volume</div>
            <div class="stat-value">${stats.prVolume.toLocaleString()} lbs</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Avg Weight</div>
            <div class="stat-value">${stats.avgWeight.toFixed(1)} lbs</div>
          </div>
        </div>

        <div class="chart-container">
          <h3>Weight & Volume Progression</h3>
          <canvas id="exercise-progression-chart"></canvas>
        </div>

        <div class="exercise-workouts">
          <h3>All Workouts</h3>
          <div class="workout-list-compact">
            ${stats.workouts.reverse().map(w => `
              <div class="workout-item-compact">
                <span>${new Date(w.date).toLocaleDateString()}</span>
                <span>${w.sets}×${w.reps} @ ${w.weight} lbs</span>
                <span>Vol: ${(w.sets * w.reps * w.weight).toLocaleString()} lbs</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }
}

// Export gym log instance
const gymLog = new GymLog();
