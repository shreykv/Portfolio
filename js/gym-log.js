// Gym Log Mini Site
class GymLog {
  constructor() {
    this.workouts = [];
    this.currentFilter = 'all';
    this.viewMode = 'list'; // 'list' or 'analytics'
    this.selectedExercise = null;
    this.selectedCategory = null;
    this.charts = {};
    this.editingWorkoutId = null;
    
    // Predefined list of common exercises
    this.commonExercises = [
      'Bench Press',
      'Squat',
      'Deadlift',
      'Overhead Press',
      'Barbell Row',
      'Pull-ups',
      'Dumbbell Press',
      'Incline Bench Press',
      'Leg Press',
      'Romanian Deadlift',
      'Barbell Curl',
      'Tricep Extension',
      'Shoulder Press',
      'Lateral Raises',
      'Chest Fly',
      'Lat Pulldown',
      'Cable Row',
      'Leg Curl',
      'Leg Extension',
      'Calf Raise',
      'Bicep Curl',
      'Hammer Curl',
      'Tricep Pushdown',
      'Face Pull',
      'Shrugs'
    ];
    
    // Exercise categories
    this.categories = [
      'Chest',
      'Back',
      'Legs',
      'Shoulders',
      'Arms',
      'Core',
      'Cardio',
      'Other'
    ];
    
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
      // Normalize exercise names for existing workouts that don't have it
      this.workouts.forEach(w => {
        if (!w.exerciseNormalized) {
          w.exerciseNormalized = this.normalizeExerciseName(w.exercise);
        }
        // Ensure category exists (default to 'Other' for old workouts)
        if (!w.category) {
          w.category = 'Other';
        }
      });
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

    // Exercise select dropdown
    const exerciseSelect = document.getElementById('exercise');
    if (exerciseSelect) {
      exerciseSelect.addEventListener('change', (e) => this.handleExerciseSelect(e));
    }
    
    // Custom exercise input
    const customExerciseInput = document.getElementById('exercise-custom');
    if (customExerciseInput) {
      customExerciseInput.addEventListener('input', (e) => this.handleExerciseInput(e));
    }
    
    // Category selector in analytics
    const categorySelect = document.getElementById('category-selector');
    if (categorySelect) {
      categorySelect.addEventListener('change', (e) => {
        this.selectedCategory = e.target.value === 'all' ? null : e.target.value;
        this.render();
      });
    }
  }

  // Normalize exercise name for consistent comparison
  normalizeExerciseName(name) {
    if (!name) return '';
    return name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/^\s+|\s+$/g, ''); // Trim again after normalization
  }

  // Get normalized exercise name for display (preserve original capitalization from common exercises)
  getDisplayExerciseName(normalizedName) {
    // Try to find matching common exercise with proper capitalization
    const match = this.commonExercises.find(ex => 
      this.normalizeExerciseName(ex) === normalizedName
    );
    return match || normalizedName.charAt(0).toUpperCase() + normalizedName.slice(1);
  }

  handleExerciseInput(e) {
    const input = e.target.value.toLowerCase();
    if (!input) return;

    const exercises = [...new Set(this.workouts.map(w => w.exercise))];
    const matches = exercises.filter(ex => ex.toLowerCase().includes(input));
    
    // Simple autocomplete - could be enhanced with dropdown
  }

  handleExerciseSelect(e) {
    const select = e.target;
    const customInput = document.getElementById('exercise-custom');
    if (select.value === 'custom') {
      if (customInput) {
        customInput.style.display = 'block';
        customInput.required = true;
        customInput.focus();
      }
    } else {
      if (customInput) {
        customInput.style.display = 'none';
        customInput.required = false;
        customInput.value = '';
      }
    }
  }

  async handleSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);

    // Get exercise name - either from select or custom input
    let exerciseName = formData.get('exercise');
    const customExercise = formData.get('exercise-custom');
    if (exerciseName === 'custom' && customExercise) {
      exerciseName = customExercise;
    }
    
    // Normalize exercise name before saving
    const normalizedExercise = this.normalizeExerciseName(exerciseName);
    const displayExercise = this.getDisplayExerciseName(normalizedExercise);

    const workout = {
      date: formData.get('date') || new Date().toISOString().split('T')[0],
      exercise: displayExercise, // Store with proper capitalization
      exerciseNormalized: normalizedExercise, // Store normalized for comparison
      category: formData.get('category') || 'Other',
      sets: parseInt(formData.get('sets')),
      reps: parseInt(formData.get('reps')),
      weight: parseFloat(formData.get('weight')),
      notes: formData.get('notes') || ''
    };

    try {
      if (this.editingWorkoutId) {
        // Update existing workout
        workout.id = this.editingWorkoutId;
        await api.updateWorkout(workout);
        this.editingWorkoutId = null;
        this.showMessage('Workout updated!', 'success');
      } else {
        // Create new workout
        await api.createWorkout(workout);
        this.showMessage('Workout logged successfully!', 'success');
      }
      
      form.reset();
      // Reset custom exercise input
      const customInput = document.getElementById('exercise-custom');
      if (customInput) {
        customInput.style.display = 'none';
        customInput.required = false;
      }
      // Reset submit button text and editing state
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.textContent = 'Log Workout';
      }
      this.editingWorkoutId = null;
      await this.loadWorkouts();
      this.render();
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

    this.editingWorkoutId = id;
    const form = document.getElementById('gym-log-form');
    if (form) {
      form.elements.date.value = workout.date;
      
      // Set exercise - check if it's in common exercises or use custom
      const normalizedExercise = workout.exerciseNormalized || this.normalizeExerciseName(workout.exercise);
      const isCommonExercise = this.commonExercises.some(ex => 
        this.normalizeExerciseName(ex) === normalizedExercise
      );
      
      if (isCommonExercise) {
        const matchingExercise = this.commonExercises.find(ex => 
          this.normalizeExerciseName(ex) === normalizedExercise
        );
        form.elements.exercise.value = matchingExercise;
        const customInput = document.getElementById('exercise-custom');
        if (customInput) {
          customInput.style.display = 'none';
          customInput.required = false;
        }
      } else {
        form.elements.exercise.value = 'custom';
        const customInput = document.getElementById('exercise-custom');
        if (customInput) {
          customInput.value = workout.exercise;
          customInput.style.display = 'block';
          customInput.required = true;
        }
      }
      
      form.elements.sets.value = workout.sets;
      form.elements.reps.value = workout.reps;
      form.elements.weight.value = workout.weight;
      form.elements.notes.value = workout.notes || '';
      form.elements.category.value = workout.category || 'Other';
      
      // Update submit button text
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.textContent = 'Update Workout';
      }
      
      // Scroll to form
      form.scrollIntoView({ behavior: 'smooth' });
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
    const normalizedName = this.normalizeExerciseName(exerciseName);
    const exerciseWorkouts = this.workouts.filter(w => {
      const workoutNormalized = w.exerciseNormalized || this.normalizeExerciseName(w.exercise);
      return workoutNormalized === normalizedName;
    });
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
    // Get unique exercises using normalized names, but return display names
    const exerciseMap = new Map();
    this.workouts.forEach(w => {
      const normalized = w.exerciseNormalized || this.normalizeExerciseName(w.exercise);
      if (!exerciseMap.has(normalized)) {
        exerciseMap.set(normalized, w.exercise);
      }
    });
    return Array.from(exerciseMap.values()).sort();
  }

  getPersonalRecords() {
    const exercises = this.getAllExercises();
    const workoutsToUse = this.selectedCategory
      ? this.workouts.filter(w => (w.category || 'Other') === this.selectedCategory)
      : this.workouts;
    
    const exerciseMap = new Map();
    exercises.forEach(ex => {
      const stats = this.getExerciseStats(ex);
      if (stats) {
        // Filter stats by category if selected
        const relevantWorkouts = stats.workouts.filter(w => {
          if (!this.selectedCategory) return true;
          return (w.category || 'Other') === this.selectedCategory;
        });
        
        if (relevantWorkouts.length > 0) {
          const weights = relevantWorkouts.map(w => w.weight);
          const volumes = relevantWorkouts.map(w => w.sets * w.reps * w.weight);
          exerciseMap.set(ex, {
            exercise: ex,
            prWeight: Math.max(...weights),
            prVolume: Math.max(...volumes),
            lastWorkout: relevantWorkouts[relevantWorkouts.length - 1].date
          });
        }
      }
    });
    
    return Array.from(exerciseMap.values()).sort((a, b) => b.prWeight - a.prWeight);
  }

  getVolumeTrend() {
    const workoutsByDate = {};
    const workoutsToUse = this.selectedCategory 
      ? this.workouts.filter(w => (w.category || 'Other') === this.selectedCategory)
      : this.workouts;
    
    workoutsToUse.forEach(w => {
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

  getCategoryTrends(category) {
    const categoryWorkouts = this.workouts.filter(w => (w.category || 'Other') === category);
    if (categoryWorkouts.length === 0) return null;

    // Group by exercise (normalized)
    const exerciseMap = new Map();
    categoryWorkouts.forEach(w => {
      const normalized = w.exerciseNormalized || this.normalizeExerciseName(w.exercise);
      if (!exerciseMap.has(normalized)) {
        exerciseMap.set(normalized, []);
      }
      exerciseMap.get(normalized).push(w);
    });

    // Get progression for each exercise
    const trends = [];
    exerciseMap.forEach((workouts, normalizedName) => {
      const sorted = workouts.sort((a, b) => new Date(a.date) - new Date(b.date));
      const displayName = sorted[0].exercise;
      trends.push({
        exercise: displayName,
        normalizedName: normalizedName,
        progression: sorted.map(w => ({
          date: w.date,
          weight: w.weight,
          volume: w.sets * w.reps * w.weight
        }))
      });
    });

    return trends;
  }

  getCategoryExercises(category) {
    const categoryWorkouts = this.workouts.filter(w => (w.category || 'Other') === category);
    const exerciseMap = new Map();
    categoryWorkouts.forEach(w => {
      const normalized = w.exerciseNormalized || this.normalizeExerciseName(w.exercise);
      if (!exerciseMap.has(normalized)) {
        exerciseMap.set(normalized, w.exercise);
      }
    });
    return Array.from(exerciseMap.values()).sort();
  }

  getWeightProgression(exerciseName) {
    const normalizedName = this.normalizeExerciseName(exerciseName);
    const exerciseWorkouts = this.workouts
      .filter(w => {
        const workoutNormalized = w.exerciseNormalized || this.normalizeExerciseName(w.exercise);
        return workoutNormalized === normalizedName;
      })
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

    // Category trends chart
    if (this.selectedCategory && !this.selectedExercise) {
      const categoryTrends = this.getCategoryTrends(this.selectedCategory);
      if (categoryTrends && categoryTrends.length > 0) {
        const categoryCtx = document.getElementById('category-trends-chart');
        if (categoryCtx) {
          // Get all unique dates from all progressions
          const allDates = new Set();
          categoryTrends.forEach(trend => {
            trend.progression.forEach(p => allDates.add(p.date));
          });
          const sortedDates = Array.from(allDates).sort((a, b) => new Date(a) - new Date(b));
          const dateMap = new Map();
          sortedDates.forEach((date, index) => dateMap.set(date, index));

          // Create datasets for each exercise in the category
          const colors = [
            'rgba(110, 231, 255, 0.8)',
            'rgba(167, 139, 250, 0.8)',
            'rgba(34, 197, 94, 0.8)',
            'rgba(245, 158, 11, 0.8)',
            'rgba(239, 68, 68, 0.8)',
            'rgba(59, 130, 246, 0.8)',
            'rgba(168, 85, 247, 0.8)',
            'rgba(236, 72, 153, 0.8)'
          ];
          
          const datasets = categoryTrends.slice(0, 8).map((trend, index) => {
            // Create array aligned with all dates, using null for missing data points
            const data = sortedDates.map(date => {
              const point = trend.progression.find(p => p.date === date);
              return point ? point.weight : null;
            });
            
            return {
              label: trend.exercise,
              data: data,
              borderColor: colors[index % colors.length],
              backgroundColor: colors[index % colors.length].replace('0.8', '0.1'),
              tension: 0.4,
              fill: false,
              spanGaps: true
            };
          });

          this.charts.categoryTrends = new Chart(categoryCtx, {
            type: 'line',
            data: {
              labels: sortedDates.map(d => new Date(d).toLocaleDateString()),
              datasets: datasets
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
    const workoutNormalized = workout.exerciseNormalized || this.normalizeExerciseName(workout.exercise);
    const exerciseWorkouts = this.workouts
      .filter(w => {
        const wNormalized = w.exerciseNormalized || this.normalizeExerciseName(w.exercise);
        return wNormalized === workoutNormalized && w.id !== workout.id;
      })
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

        <div class="category-selector-container" style="margin-bottom: 20px;">
          <label for="category-selector" style="margin-right: 10px; color: var(--muted);">Filter by Category:</label>
          <select id="category-selector" class="btn" style="padding: 8px 12px;">
            <option value="all" ${!this.selectedCategory ? 'selected' : ''}>All Categories</option>
            ${this.categories.map(cat => `<option value="${cat}" ${this.selectedCategory === cat ? 'selected' : ''}>${cat}</option>`).join('')}
          </select>
        </div>

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
                <div class="stat-value">${this.selectedCategory ? this.workouts.filter(w => (w.category || 'Other') === this.selectedCategory).length : this.workouts.length}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Unique Exercises</div>
                <div class="stat-value">${this.selectedCategory ? this.getCategoryExercises(this.selectedCategory).length : this.getAllExercises().length}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Total Volume</div>
                <div class="stat-value">${(this.selectedCategory ? this.workouts.filter(w => (w.category || 'Other') === this.selectedCategory) : this.workouts).reduce((sum, w) => sum + (w.sets * w.reps * w.weight), 0).toLocaleString()} lbs</div>
              </div>
            </div>

            <div class="chart-container">
              <h3>${this.selectedCategory ? `${this.selectedCategory} ` : ''}Volume Trend</h3>
              <canvas id="volume-chart"></canvas>
            </div>

            ${this.selectedCategory ? `
              <div class="chart-container">
                <h3>${this.selectedCategory} Exercise Trends</h3>
                <canvas id="category-trends-chart"></canvas>
              </div>
            ` : ''}

            <div class="chart-container">
              <h3>Personal Records (Top 10)${this.selectedCategory ? ` - ${this.selectedCategory}` : ''}</h3>
              <canvas id="pr-chart"></canvas>
            </div>

            <div class="pr-list">
              <h3>All Personal Records${this.selectedCategory ? ` - ${this.selectedCategory}` : ''}</h3>
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
              <label for="category">Category</label>
              <select id="category" name="category" required>
                ${this.categories.map(cat => `<option value="${cat}" ${!this.editingWorkoutId && cat === 'Other' ? 'selected' : ''}>${cat}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="exercise">Exercise</label>
              <select id="exercise" name="exercise" required>
                <option value="">Select exercise...</option>
                ${this.commonExercises.map(ex => `<option value="${ex}">${ex}</option>`).join('')}
                <option value="custom">Custom...</option>
              </select>
              <input type="text" id="exercise-custom" name="exercise-custom" placeholder="Enter custom exercise name" style="display: none; margin-top: 8px;">
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
          <button type="submit" class="btn primary">${this.editingWorkoutId ? 'Update Workout' : 'Log Workout'}</button>
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
                      ${workout.category ? `<span class="workout-category" style="color: var(--muted); font-size: 0.9em;">${workout.category}</span>` : ''}
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
