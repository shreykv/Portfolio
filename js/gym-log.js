// Gym Log Mini Site
class GymLog {
  constructor() {
    this.workouts = [];
    this.currentFilter = 'all';
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

    // Export button
    const exportBtn = document.getElementById('export-workouts');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportData());
    }
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
      weight: parseFloat(formData.get('weight'))
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

    container.innerHTML = `
      <div class="gym-log-header">
        <h2>Gym Log</h2>
        <div class="gym-log-actions">
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
            <input type="text" id="exercise" name="exercise" placeholder="e.g., Bench Press" required>
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
          : filtered.map(workout => `
            <div class="workout-card">
              <div class="workout-header">
                <div>
                  <h3>${workout.exercise}</h3>
                  <span class="workout-date">${new Date(workout.date).toLocaleDateString()}</span>
                </div>
                <button class="btn-icon" onclick="gymLog.deleteWorkout('${workout.id}')" title="Delete">×</button>
              </div>
              <div class="workout-details">
                <span>${workout.sets} sets × ${workout.reps} reps</span>
                <span class="workout-weight">${workout.weight} lbs</span>
              </div>
            </div>
          `).join('')
        }
      </div>
    `;

    this.setupEventListeners();
  }
}

// Export gym log instance
const gymLog = new GymLog();
