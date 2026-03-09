// Habit Tracker Mini Site
class HabitTracker {
  constructor() {
    this.habits = [];
    this.entries = []; // Daily habit completions
    this.viewMode = 'calendar'; // 'calendar' or 'list' or 'stats'
    this.currentDate = new Date().toISOString().split('T')[0];
    this.init();
  }

  async init() {
    await this.loadHabits();
    this.render();
    this.setupEventListeners();
  }

  async loadHabits() {
    try {
      const data = await api.getHabits();
      this.habits = data.habits || [];
      this.entries = data.entries || [];
    } catch (error) {
      console.error('Error loading habits:', error);
      this.habits = [];
      this.entries = [];
    }
  }

  async saveHabits() {
    try {
      await api.saveHabits({
        habits: this.habits,
        entries: this.entries
      });
    } catch (error) {
      console.error('Error saving habits:', error);
    }
  }

  setupEventListeners() {
    const form = document.getElementById('habit-form');
    if (form) {
      form.addEventListener('submit', (e) => this.handleAddHabit(e));
    }

    const dateInput = document.getElementById('habit-date-selector');
    if (dateInput) {
      dateInput.addEventListener('change', (e) => {
        this.currentDate = e.target.value;
        this.render();
      });
    }
  }

  async handleAddHabit(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);

    const habitData = {
      name: formData.get('name').trim(),
      category: formData.get('category') || 'General',
      color: formData.get('color') || '#6EE7FF'
    };

    try {
      if (api.isSupabaseEnabled()) {
        const created = await api.createHabit(habitData);
        this.habits.push(created);
      } else {
        const habit = {
          id: Date.now().toString(),
          ...habitData,
          createdAt: new Date().toISOString()
        };
        this.habits.push(habit);
        await this.saveHabits();
      }
    } catch (error) {
      console.error('Error adding habit:', error);
      return;
    }

    form.reset();
    this.render();
  }

  async toggleHabit(habitId, date) {
    const existingIndex = this.entries.findIndex(e => e.habitId === habitId && e.date === date);

    if (existingIndex >= 0) {
      this.entries.splice(existingIndex, 1);
    } else {
      this.entries.push({
        id: `${date}-${habitId}`,
        habitId,
        date,
        completedAt: new Date().toISOString()
      });
    }

    this.render();

    try {
      if (api.isSupabaseEnabled()) {
        await api.toggleHabitEntry(habitId, date);
      } else {
        await this.saveHabits();
      }
    } catch (error) {
      console.error('Error toggling habit entry:', error);
    }
  }

  isHabitCompleted(habitId, date) {
    return this.entries.some(e => e.habitId === habitId && e.date === date);
  }

  getHabitStreak(habitId) {
    const habitEntries = this.entries
      .filter(e => e.habitId === habitId)
      .map(e => e.date)
      .sort((a, b) => new Date(b) - new Date(a));

    if (habitEntries.length === 0) return 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let streak = 0;
    let currentDate = new Date(today);

    // Check if today is completed
    const todayStr = today.toISOString().split('T')[0];
    if (habitEntries.includes(todayStr)) {
      streak++;
      currentDate.setDate(currentDate.getDate() - 1);
    } else {
      // If today not completed, check yesterday
      currentDate.setDate(currentDate.getDate() - 1);
    }

    // Count consecutive days
    while (true) {
      const dateStr = currentDate.toISOString().split('T')[0];
      if (habitEntries.includes(dateStr)) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        break;
      }
    }

    return streak;
  }

  getCompletionRate(habitId, days = 30) {
    const habitEntries = this.entries.filter(e => e.habitId === habitId);
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - days);

    let totalDays = 0;
    let completedDays = 0;

    for (let i = 0; i < days; i++) {
      const checkDate = new Date(startDate);
      checkDate.setDate(checkDate.getDate() + i);
      const dateStr = checkDate.toISOString().split('T')[0];
      totalDays++;
      if (habitEntries.some(e => e.date === dateStr)) {
        completedDays++;
      }
    }

    return totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 0;
  }

  getCalendarDates() {
    const dates = [];
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 28); // Show last 4 weeks

    for (let i = 0; i < 35; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      dates.push(date.toISOString().split('T')[0]);
    }

    return dates;
  }

  getCategories() {
    return [...new Set(this.habits.map(h => h.category))];
  }

  async deleteHabit(id) {
    if (!confirm('Delete this habit?')) return;
    this.habits = this.habits.filter(h => h.id !== id);
    this.entries = this.entries.filter(e => e.habitId !== id);
    try {
      if (api.isSupabaseEnabled()) {
        await api.deleteHabit(id);
      } else {
        await this.saveHabits();
      }
    } catch (error) {
      console.error('Error deleting habit:', error);
    }
    this.render();
  }

  renderCalendar() {
    const dates = this.getCalendarDates();
    const categories = this.getCategories();
    
    let html = `
      <div class="habit-calendar">
        <div class="calendar-header">
          <div class="calendar-day-label"></div>
          ${dates.slice(0, 7).map((_, idx) => {
            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            return `<div class="calendar-day-label">${days[idx]}</div>`;
          }).join('')}
        </div>
    `;

    // Group habits by category
    categories.forEach(category => {
      const categoryHabits = this.habits.filter(h => h.category === category);
      if (categoryHabits.length === 0) return;

      html += `<div class="habit-category-group">
        <div class="category-header">${category}</div>
      `;

      categoryHabits.forEach(habit => {
        html += `<div class="habit-row">
          <div class="habit-name" style="border-left: 3px solid ${habit.color}">
            <span>${habit.name}</span>
            <div class="habit-meta">
              <span class="streak-badge">🔥 ${this.getHabitStreak(habit.id)}</span>
              <span class="completion-rate">${this.getCompletionRate(habit.id)}%</span>
            </div>
            <button class="btn-icon" onclick="habitTracker.deleteHabit('${habit.id}')" title="Delete">×</button>
          </div>
          <div class="calendar-days">
        `;

        dates.forEach(date => {
          const isCompleted = this.isHabitCompleted(habit.id, date);
          const dateObj = new Date(date);
          const isToday = date === new Date().toISOString().split('T')[0];
          const isFuture = dateObj > new Date();
          
          html += `
            <div class="calendar-day ${isCompleted ? 'completed' : ''} ${isToday ? 'today' : ''} ${isFuture ? 'future' : ''}" 
                 onclick="${!isFuture ? `habitTracker.toggleHabit('${habit.id}', '${date}')` : ''}"
                 style="${isCompleted ? `background: ${habit.color}; border-color: ${habit.color};` : ''}"
                 title="${new Date(date).toLocaleDateString()}">
              ${isCompleted ? '✓' : ''}
            </div>
          `;
        });

        html += `</div></div>`;
      });

      html += `</div>`;
    });

    html += `</div>`;
    return html;
  }

  render() {
    const container = document.getElementById('habit-tracker-content');
    if (!container) return;

    const selectedDateEntries = this.entries.filter(e => e.date === this.currentDate);
    const completedToday = selectedDateEntries.length;
    const totalHabits = this.habits.length;
    const completionRate = totalHabits > 0 ? Math.round((completedToday / totalHabits) * 100) : 0;

    container.innerHTML = `
      <div class="habit-tracker-header">
        <h2>Habit Tracker</h2>
        <div class="habit-tracker-actions">
          <button class="btn ${this.viewMode === 'calendar' ? 'active' : ''}" onclick="habitTracker.viewMode = 'calendar'; habitTracker.render();">Calendar</button>
          <button class="btn ${this.viewMode === 'list' ? 'active' : ''}" onclick="habitTracker.viewMode = 'list'; habitTracker.render();">Today</button>
          <button class="btn ${this.viewMode === 'stats' ? 'active' : ''}" onclick="habitTracker.viewMode = 'stats'; habitTracker.render();">Stats</button>
        </div>
      </div>

      <form id="habit-form" class="habit-form">
        <div class="form-row">
          <div class="form-group">
            <label for="habit-name">Habit Name</label>
            <input type="text" id="habit-name" name="name" placeholder="e.g., Morning Run" required>
          </div>
          <div class="form-group">
            <label for="habit-category">Category</label>
            <input type="text" id="habit-category" name="category" placeholder="e.g., Fitness" list="category-list">
            <datalist id="category-list">
              ${this.getCategories().map(cat => `<option value="${cat}">`).join('')}
            </datalist>
          </div>
          <div class="form-group">
            <label for="habit-color">Color</label>
            <input type="color" id="habit-color" name="color" value="#6EE7FF">
          </div>
        </div>
        <button type="submit" class="btn primary">Add Habit</button>
      </form>

      ${this.viewMode === 'calendar' ? `
        ${this.renderCalendar()}
      ` : this.viewMode === 'list' ? `
        <div class="habit-today-view">
          <div class="today-header">
            <input type="date" id="habit-date-selector" value="${this.currentDate}" class="date-selector">
            <div class="today-stats">
              <div class="today-stat">
                <div class="today-stat-value">${completedToday} / ${totalHabits}</div>
                <div class="today-stat-label">Completed</div>
              </div>
              <div class="today-stat">
                <div class="today-stat-value">${completionRate}%</div>
                <div class="today-stat-label">Completion Rate</div>
              </div>
            </div>
          </div>
          <div class="habit-list-today">
            ${this.habits.length === 0 
              ? '<p class="empty-state">No habits yet. Add one above!</p>'
              : this.habits.map(habit => {
                  const isCompleted = this.isHabitCompleted(habit.id, this.currentDate);
                  const streak = this.getHabitStreak(habit.id);
                  return `
                    <div class="habit-item-today ${isCompleted ? 'completed' : ''}" onclick="habitTracker.toggleHabit('${habit.id}', '${this.currentDate}')">
                      <div class="habit-item-left">
                        <div class="habit-checkbox ${isCompleted ? 'checked' : ''}" style="border-color: ${habit.color}">
                          ${isCompleted ? '✓' : ''}
                        </div>
                        <div>
                          <div class="habit-item-name">${habit.name}</div>
                          <div class="habit-item-meta">${habit.category} • 🔥 ${streak} day streak</div>
                        </div>
                      </div>
                      <div class="habit-item-right">
                        <div class="habit-completion-rate">${this.getCompletionRate(habit.id)}%</div>
                      </div>
                    </div>
                  `;
                }).join('')
            }
          </div>
        </div>
      ` : `
        <div class="habit-stats-view">
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-label">Total Habits</div>
              <div class="stat-value">${this.habits.length}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Total Entries</div>
              <div class="stat-value">${this.entries.length}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Avg Completion</div>
              <div class="stat-value">${this.habits.length > 0 ? Math.round(this.habits.reduce((sum, h) => sum + this.getCompletionRate(h.id), 0) / this.habits.length) : 0}%</div>
            </div>
          </div>
          <div class="habit-stats-list">
            <h3>Habit Statistics</h3>
            ${this.habits.map(habit => {
              const streak = this.getHabitStreak(habit.id);
              const completionRate = this.getCompletionRate(habit.id);
              const totalEntries = this.entries.filter(e => e.habitId === habit.id).length;
              return `
                <div class="habit-stat-card" style="border-left: 4px solid ${habit.color}">
                  <div class="habit-stat-name">${habit.name}</div>
                  <div class="habit-stat-details">
                    <div class="habit-stat-item">
                      <span class="stat-label">Streak</span>
                      <span class="stat-value">🔥 ${streak} days</span>
                    </div>
                    <div class="habit-stat-item">
                      <span class="stat-label">Completion Rate</span>
                      <span class="stat-value">${completionRate}%</span>
                    </div>
                    <div class="habit-stat-item">
                      <span class="stat-label">Total Days</span>
                      <span class="stat-value">${totalEntries}</span>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `}
    `;

    this.setupEventListeners();
  }
}

// Export habit tracker instance
const habitTracker = new HabitTracker();
