// Focus Timer Mini Site - Task Management with Productivity Timer
class FocusTimer {
  constructor() {
    this.tasks = [];
    this.sessions = [];
    this.currentTimer = null;
    this.timerInterval = null;
    this.realtimeChannel = null;
    this._ignoringRealtime = false;
    this.viewMode = 'tasks'; // 'tasks', 'timer', 'analytics'
    this.filter = 'all'; // 'all', 'active', 'completed'
    this.sortBy = 'date'; // 'date', 'priority', 'name', 'time'
    this.chart = null;
    this.init();
  }

  async init() {
    await this.loadData();
    await this.loadActiveTimer();
    this.subscribeToRealtime();
    this.render();
    this.setupEventListeners();
    
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }

  async loadData() {
    try {
      const data = await api.getFocusTimer();
      this.tasks = data.tasks || [];
      this.sessions = data.sessions || [];
      this.sortTasks();
    } catch (error) {
      console.error('Error loading focus timer data:', error);
      this.tasks = [];
      this.sessions = [];
    }
  }

  async loadActiveTimer() {
    try {
      const timer = await api.getActiveTimer();
      if (!timer) return;

      if (timer.status === 'running') {
        const elapsed = Math.floor((Date.now() - new Date(timer.startTime).getTime()) / 1000);
        const remaining = timer.remaining - elapsed;

        if (remaining <= 0) {
          // Timer expired while we were away -- complete it
          await this.completeExpiredTimer(timer);
          return;
        }

        this.currentTimer = {
          duration: timer.duration,
          remaining: remaining,
          taskId: timer.taskId,
          isRunning: true,
          startTime: new Date(timer.startTime).getTime()
        };
        this.startLocalInterval();
      } else if (timer.status === 'paused') {
        this.currentTimer = {
          duration: timer.duration,
          remaining: timer.remaining,
          taskId: timer.taskId,
          isRunning: false,
          startTime: new Date(timer.startTime).getTime()
        };
      }
    } catch (error) {
      console.error('Error loading active timer:', error);
    }
  }

  async completeExpiredTimer(timer) {
    const session = {
      taskId: timer.taskId,
      duration: timer.duration,
      startTime: timer.startTime,
      endTime: new Date(new Date(timer.startTime).getTime() + timer.duration * 1000).toISOString(),
      date: new Date(timer.startTime).toISOString().split('T')[0]
    };

    try {
      if (api.isSupabaseEnabled()) {
        await api.saveFocusSession(session);
      } else {
        this.sessions.push({ id: Date.now().toString(), ...session });
        await this.saveData();
      }
      await api.deleteActiveTimer();
    } catch (error) {
      console.error('Error completing expired timer:', error);
    }

    this.showMessage('A previous timer completed while you were away!', 'success');
  }

  subscribeToRealtime() {
    if (!api.isSupabaseEnabled()) return;
    const userId = api.getUserId();
    if (!userId) return;

    this.realtimeChannel = api.subscribeToActiveTimer(userId, (payload) => {
      if (this._ignoringRealtime) return;
      this.onRealtimeEvent(payload);
    });
  }

  onRealtimeEvent(payload) {
    const { eventType, new: newRow, old: oldRow } = payload;

    if (eventType === 'INSERT' || eventType === 'UPDATE') {
      const timer = api.toCamelCase(newRow);

      if (timer.status === 'running') {
        const elapsed = Math.floor((Date.now() - new Date(timer.startTime).getTime()) / 1000);
        const remaining = timer.remaining - elapsed;

        if (remaining <= 0) {
          this.clearLocalTimer();
          this.render();
          return;
        }

        this.clearLocalInterval();
        this.currentTimer = {
          duration: timer.duration,
          remaining: remaining,
          taskId: timer.taskId,
          isRunning: true,
          startTime: new Date(timer.startTime).getTime()
        };
        this.startLocalInterval();
      } else if (timer.status === 'paused') {
        this.clearLocalInterval();
        this.currentTimer = {
          duration: timer.duration,
          remaining: timer.remaining,
          taskId: timer.taskId,
          isRunning: false,
          startTime: new Date(timer.startTime).getTime()
        };
      }

      this.render();
    } else if (eventType === 'DELETE') {
      const hadTimer = this.currentTimer !== null;
      this.clearLocalTimer();
      this.render();
      if (hadTimer) {
        this.showMessage('Timer stopped from another device.', 'info');
      }
    }
  }

  async saveData() {
    try {
      await api.saveFocusTimer({
        tasks: this.tasks,
        sessions: this.sessions
      });
    } catch (error) {
      console.error('Error saving focus timer data:', error);
    }
  }

  setupEventListeners() {
    const form = document.getElementById('focus-task-form');
    if (form) {
      form.addEventListener('submit', (e) => this.handleAddTask(e));
    }

    const filterButtons = document.querySelectorAll('[data-focus-filter]');
    filterButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.filter = e.target.getAttribute('data-focus-filter');
        this.render();
      });
    });

    const sortSelect = document.getElementById('focus-task-sort');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        this.sortBy = e.target.value;
        this.sortTasks();
        this.render();
      });
    }
  }

  sortTasks() {
    switch (this.sortBy) {
      case 'priority':
        this.tasks.sort((a, b) => {
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          return (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
        });
        break;
      case 'name':
        this.tasks.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'time':
        this.tasks.sort((a, b) => {
          const timeA = this.getTaskTimeStats(a.id).total;
          const timeB = this.getTaskTimeStats(b.id).total;
          return timeB - timeA;
        });
        break;
      case 'date':
      default:
        this.tasks.sort((a, b) => {
          const dateA = new Date(a.dueDate || a.createdAt || 0);
          const dateB = new Date(b.dueDate || b.createdAt || 0);
          return dateA - dateB;
        });
        break;
    }
  }

  async handleAddTask(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);

    const taskData = {
      title: formData.get('title').trim(),
      description: formData.get('description') || '',
      priority: formData.get('priority') || 'medium',
      dueDate: formData.get('dueDate') || null,
      category: formData.get('category') || 'General',
      completed: false
    };

    try {
      if (api.isSupabaseEnabled()) {
        const created = await api.createFocusTask(taskData);
        this.tasks.push(created);
      } else {
        const task = {
          id: Date.now().toString(),
          ...taskData,
          createdAt: new Date().toISOString()
        };
        this.tasks.push(task);
        await this.saveData();
      }
    } catch (error) {
      console.error('Error adding task:', error);
      this.showMessage('Failed to add task.', 'error');
      return;
    }

    form.reset();
    this.render();
    this.showMessage('Task added!', 'success');
  }

  async toggleTask(id) {
    const task = this.tasks.find(t => t.id === id);
    if (!task) return;

    task.completed = !task.completed;
    task.completedAt = task.completed ? new Date().toISOString() : null;

    try {
      if (api.isSupabaseEnabled()) {
        await api.updateFocusTask(task);
      } else {
        await this.saveData();
      }
    } catch (error) {
      console.error('Error toggling task:', error);
    }
    this.render();
  }

  async deleteTask(id) {
    if (!confirm('Delete this task?')) return;

    try {
      if (api.isSupabaseEnabled()) {
        await api.deleteFocusTask(id);
      }
      this.tasks = this.tasks.filter(t => t.id !== id);
      this.sessions = this.sessions.filter(s => s.taskId !== id);
      if (!api.isSupabaseEnabled()) {
        await this.saveData();
      }
    } catch (error) {
      console.error('Error deleting task:', error);
      this.showMessage('Failed to delete task.', 'error');
      return;
    }
    this.render();
    this.showMessage('Task deleted.', 'success');
  }

  async editTask(id) {
    const task = this.tasks.find(t => t.id === id);
    if (!task) return;

    const newTitle = prompt('Edit task title:', task.title);
    if (newTitle === null) return;

    task.title = newTitle.trim();
    try {
      if (api.isSupabaseEnabled()) {
        await api.updateFocusTask(task);
      } else {
        await this.saveData();
      }
    } catch (error) {
      console.error('Error editing task:', error);
    }
    this.render();
  }

  getFilteredTasks() {
    let filtered = this.tasks;
    
    switch (this.filter) {
      case 'active':
        filtered = filtered.filter(t => !t.completed);
        break;
      case 'completed':
        filtered = filtered.filter(t => t.completed);
        break;
    }

    return filtered;
  }

  getTasksStats() {
    const total = this.tasks.length;
    const completed = this.tasks.filter(t => t.completed).length;
    const active = total - completed;
    const overdue = this.tasks.filter(t => {
      if (t.completed || !t.dueDate) return false;
      return new Date(t.dueDate) < new Date();
    }).length;

    return { total, completed, active, overdue };
  }

  getCategories() {
    return [...new Set(this.tasks.map(t => t.category))];
  }

  isOverdue(dueDate) {
    if (!dueDate || new Date(dueDate) >= new Date()) return false;
    return true;
  }

  // Timer helpers for local interval management
  startLocalInterval() {
    this.clearLocalInterval();
    this.timerInterval = setInterval(() => {
      if (this.currentTimer && this.currentTimer.isRunning) {
        this.currentTimer.remaining--;
        this.updateTimerDisplay();

        if (this.currentTimer.remaining <= 0) {
          this.stopTimer(true);
        }
      }
    }, 1000);
  }

  clearLocalInterval() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  clearLocalTimer() {
    this.clearLocalInterval();
    this.currentTimer = null;
  }

  // Timer functionality
  async startTimer(duration, taskId = null) {
    if (this.currentTimer && this.currentTimer.isRunning) {
      return;
    }

    if (this.currentTimer && !this.currentTimer.isRunning) {
      this.resumeTimer();
      return;
    }

    const now = Date.now();
    const durationSecs = duration * 60;

    this.currentTimer = {
      duration: durationSecs,
      remaining: durationSecs,
      taskId: taskId,
      isRunning: true,
      startTime: now
    };

    this.startLocalInterval();
    this.render();

    this._ignoringRealtime = true;
    try {
      await api.upsertActiveTimer({
        taskId: taskId,
        duration: durationSecs,
        remaining: durationSecs,
        startTime: new Date(now).toISOString(),
        status: 'running'
      });
    } catch (error) {
      console.error('Error syncing timer start:', error);
    }
    this._ignoringRealtime = false;
  }

  async pauseTimer() {
    if (!this.currentTimer || !this.currentTimer.isRunning) return;

    this.currentTimer.isRunning = false;
    this.clearLocalInterval();
    this.render();

    this._ignoringRealtime = true;
    try {
      await api.upsertActiveTimer({
        taskId: this.currentTimer.taskId,
        duration: this.currentTimer.duration,
        remaining: this.currentTimer.remaining,
        startTime: new Date(this.currentTimer.startTime).toISOString(),
        status: 'paused'
      });
    } catch (error) {
      console.error('Error syncing timer pause:', error);
    }
    this._ignoringRealtime = false;
  }

  async resumeTimer() {
    if (!this.currentTimer || this.currentTimer.isRunning) return;

    const now = Date.now();
    this.currentTimer.isRunning = true;
    this.currentTimer.startTime = now;

    this.startLocalInterval();
    this.render();

    this._ignoringRealtime = true;
    try {
      await api.upsertActiveTimer({
        taskId: this.currentTimer.taskId,
        duration: this.currentTimer.duration,
        remaining: this.currentTimer.remaining,
        startTime: new Date(now).toISOString(),
        status: 'running'
      });
    } catch (error) {
      console.error('Error syncing timer resume:', error);
    }
    this._ignoringRealtime = false;
  }

  async stopTimer(completed = false) {
    this.clearLocalInterval();

    if (this.currentTimer && completed) {
      const session = {
        taskId: this.currentTimer.taskId,
        duration: this.currentTimer.duration - this.currentTimer.remaining,
        startTime: new Date(this.currentTimer.startTime).toISOString(),
        endTime: new Date().toISOString(),
        date: new Date().toISOString().split('T')[0]
      };

      try {
        if (api.isSupabaseEnabled()) {
          const saved = await api.saveFocusSession(session);
          this.sessions.unshift(saved);
        } else {
          this.sessions.push({ id: Date.now().toString(), ...session });
          await this.saveData();
        }
      } catch (error) {
        console.error('Error saving session:', error);
      }

      this.showMessage('Timer completed!', 'success');

      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Timer Completed!', {
          body: 'Your focus session has ended.',
          icon: '/favicon.ico'
        });
      }
    }

    this.currentTimer = null;

    this._ignoringRealtime = true;
    try {
      await api.deleteActiveTimer();
    } catch (error) {
      console.error('Error syncing timer stop:', error);
    }
    this._ignoringRealtime = false;

    this.render();
  }

  updateTimerDisplay() {
    const display = document.getElementById('timer-display');
    if (display && this.currentTimer) {
      const minutes = Math.floor(this.currentTimer.remaining / 60);
      const seconds = this.currentTimer.remaining % 60;
      display.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
  }

  formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    } else if (mins > 0) {
      return `${mins}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }

  // Time tracking
  getTimeTracked(period = 'week') {
    const now = new Date();
    let startDate;

    if (period === 'week') {
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 7);
    } else if (period === 'day') {
      startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
    }

    return this.sessions
      .filter(s => new Date(s.startTime) >= startDate)
      .reduce((total, s) => total + s.duration, 0);
  }

  getTaskTimeStats(taskId) {
    const taskSessions = this.sessions.filter(s => s.taskId === taskId);
    const total = taskSessions.reduce((sum, s) => sum + s.duration, 0);
    const count = taskSessions.length;
    
    return { total, count, sessions: taskSessions };
  }

  getWeeklyTimeData() {
    const data = [];
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const daySessions = this.sessions.filter(s => {
        const sessionDate = new Date(s.startTime).toISOString().split('T')[0];
        return sessionDate === dateStr;
      });
      
      const totalSeconds = daySessions.reduce((sum, s) => sum + s.duration, 0);
      const totalMinutes = Math.floor(totalSeconds / 60);
      
      data.push({
        date: dateStr,
        label: date.toLocaleDateString('en-US', { weekday: 'short' }),
        minutes: totalMinutes
      });
    }
    
    return data;
  }

  // Visualization
  renderWeeklyChart() {
    if (this.chart) {
      this.chart.destroy();
    }

    const ctx = document.getElementById('weekly-time-chart');
    if (!ctx) return;

    const weeklyData = this.getWeeklyTimeData();

    this.chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: weeklyData.map(d => d.label),
        datasets: [{
          label: 'Minutes Tracked',
          data: weeklyData.map(d => d.minutes),
          backgroundColor: 'rgba(110, 231, 255, 0.3)',
          borderColor: 'rgba(110, 231, 255, 0.8)',
          borderWidth: 2,
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const minutes = context.parsed.y;
                const hours = Math.floor(minutes / 60);
                const mins = minutes % 60;
                if (hours > 0) {
                  return `${hours}h ${mins}m`;
                }
                return `${mins}m`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              color: 'rgba(255, 255, 255, 0.68)',
              callback: (value) => {
                if (value >= 60) {
                  return `${Math.floor(value / 60)}h`;
                }
                return `${value}m`;
              }
            },
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            }
          },
          x: {
            ticks: {
              color: 'rgba(255, 255, 255, 0.68)'
            },
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            }
          }
        }
      }
    });
  }

  showMessage(message, type = 'info') {
    const messageEl = document.getElementById('focus-message');
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
    const container = document.getElementById('focus-timer-content');
    if (!container) return;

    const filtered = this.getFilteredTasks();
    const stats = this.getTasksStats();
    const weeklyTime = this.getTimeTracked('week');
    const dailyTime = this.getTimeTracked('day');

    if (this.viewMode === 'timer') {
      container.innerHTML = `
        <div class="focus-timer-header">
          <h2>Focus Timer</h2>
          <div class="focus-timer-actions">
            <button class="btn ${this.viewMode === 'timer' ? 'active' : ''}" onclick="focusTimer.viewMode = 'timer'; focusTimer.render();">Timer</button>
            <button class="btn ${this.viewMode === 'tasks' ? 'active' : ''}" onclick="focusTimer.viewMode = 'tasks'; focusTimer.render();">Tasks</button>
            <button class="btn ${this.viewMode === 'analytics' ? 'active' : ''}" onclick="focusTimer.viewMode = 'analytics'; focusTimer.render();">Analytics</button>
          </div>
        </div>

        <div id="focus-message" class="message" style="display:none;"></div>

        <div class="timer-container">
          ${this.currentTimer ? `
            <div class="timer-display-wrapper">
              <div class="timer-display" id="timer-display">
                ${String(Math.floor(this.currentTimer.remaining / 60)).padStart(2, '0')}:${String(this.currentTimer.remaining % 60).padStart(2, '0')}
              </div>
              ${this.currentTimer.taskId ? `
                <div class="timer-task-info">
                  Task: ${this.tasks.find(t => t.id === this.currentTimer.taskId)?.title || 'Unknown'}
                </div>
              ` : '<div class="timer-task-info">Standalone Timer</div>'}
            </div>
            <div class="timer-controls">
              ${this.currentTimer.isRunning ? `
                <button class="btn primary" onclick="focusTimer.pauseTimer()">Pause</button>
                <button class="btn" onclick="focusTimer.stopTimer(false)">Stop</button>
              ` : `
                <button class="btn primary" onclick="focusTimer.resumeTimer()">Resume</button>
                <button class="btn" onclick="focusTimer.stopTimer(false)">Stop</button>
              `}
            </div>
          ` : `
            <div class="timer-setup">
              <form id="timer-form" class="timer-form">
                <div class="form-group">
                  <label for="timer-duration">Duration (minutes)</label>
                  <input type="number" id="timer-duration" name="duration" min="1" max="480" value="25" required>
                </div>
                <div class="form-group">
                  <label for="timer-task">Link to Task (optional)</label>
                  <select id="timer-task" name="taskId">
                    <option value="">Standalone Timer</option>
                    ${this.tasks.filter(t => !t.completed).map(t => `
                      <option value="${t.id}">${t.title}</option>
                    `).join('')}
                  </select>
                </div>
                <button type="submit" class="btn primary">Start Timer</button>
              </form>
            </div>
          `}
        </div>

        ${this.sessions.length > 0 ? `
          <div class="session-history">
            <h3>Recent Sessions</h3>
            <div class="session-list">
              ${this.sessions.slice(0, 10).map(session => {
                const task = session.taskId ? this.tasks.find(t => t.id === session.taskId) : null;
                return `
                  <div class="session-item">
                    <div class="session-info">
                      <div class="session-duration">${this.formatTime(session.duration)}</div>
                      <div class="session-details">
                        ${task ? `<div class="session-task">${task.title}</div>` : '<div class="session-task">Standalone</div>'}
                        <div class="session-time">${new Date(session.startTime).toLocaleString()}</div>
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        ` : ''}
      `;

      // Setup timer form
      const timerForm = document.getElementById('timer-form');
      if (timerForm) {
        timerForm.addEventListener('submit', (e) => {
          e.preventDefault();
          const formData = new FormData(e.target);
          const duration = parseInt(formData.get('duration'));
          const taskId = formData.get('taskId') || null;
          this.startTimer(duration, taskId);
        });
      }

      // Update timer display if running
      if (this.currentTimer && this.currentTimer.isRunning) {
        this.updateTimerDisplay();
      }
    } else if (this.viewMode === 'analytics') {
      container.innerHTML = `
        <div class="focus-timer-header">
          <h2>Analytics</h2>
          <div class="focus-timer-actions">
            <button class="btn ${this.viewMode === 'timer' ? 'active' : ''}" onclick="focusTimer.viewMode = 'timer'; focusTimer.render();">Timer</button>
            <button class="btn ${this.viewMode === 'tasks' ? 'active' : ''}" onclick="focusTimer.viewMode = 'tasks'; focusTimer.render();">Tasks</button>
            <button class="btn ${this.viewMode === 'analytics' ? 'active' : ''}" onclick="focusTimer.viewMode = 'analytics'; focusTimer.render();">Analytics</button>
          </div>
        </div>

        <div class="analytics-dashboard">
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-label">Total Sessions</div>
              <div class="stat-value">${this.sessions.length}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Time This Week</div>
              <div class="stat-value">${this.formatTime(weeklyTime)}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Time Today</div>
              <div class="stat-value">${this.formatTime(dailyTime)}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Total Tasks</div>
              <div class="stat-value">${stats.total}</div>
            </div>
          </div>

          <div class="chart-container">
            <h3>Weekly Time Tracking</h3>
            <canvas id="weekly-time-chart"></canvas>
          </div>
        </div>
      `;

      setTimeout(() => this.renderWeeklyChart(), 100);
    } else {
      // Tasks view
      container.innerHTML = `
        <div class="focus-timer-header">
          <h2>Focus Timer</h2>
          <div class="focus-timer-actions">
            <button class="btn ${this.viewMode === 'timer' ? 'active' : ''}" onclick="focusTimer.viewMode = 'timer'; focusTimer.render();">Timer</button>
            <button class="btn ${this.viewMode === 'tasks' ? 'active' : ''}" onclick="focusTimer.viewMode = 'tasks'; focusTimer.render();">Tasks</button>
            <button class="btn ${this.viewMode === 'analytics' ? 'active' : ''}" onclick="focusTimer.viewMode = 'analytics'; focusTimer.render();">Analytics</button>
          </div>
        </div>

        <div id="focus-message" class="message" style="display:none;"></div>

        <div class="focus-stats">
          <div class="stat-card">
            <div class="stat-label">Total</div>
            <div class="stat-value">${stats.total}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Active</div>
            <div class="stat-value">${stats.active}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Completed</div>
            <div class="stat-value">${stats.completed}</div>
          </div>
          <div class="stat-card ${stats.overdue > 0 ? 'overdue' : ''}">
            <div class="stat-label">Overdue</div>
            <div class="stat-value">${stats.overdue}</div>
          </div>
        </div>

        <form id="focus-task-form" class="task-form">
          <div class="form-row">
            <div class="form-group">
              <label for="focus-task-title">Task Title</label>
              <input type="text" id="focus-task-title" name="title" placeholder="e.g., Finish project report" required>
            </div>
            <div class="form-group">
              <label for="focus-task-category">Category</label>
              <input type="text" id="focus-task-category" name="category" placeholder="e.g., Work" list="focus-category-list">
              <datalist id="focus-category-list">
                ${this.getCategories().map(cat => `<option value="${cat}">`).join('')}
              </datalist>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="focus-task-priority">Priority</label>
              <select id="focus-task-priority" name="priority">
                <option value="low">Low</option>
                <option value="medium" selected>Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div class="form-group">
              <label for="focus-task-dueDate">Due Date</label>
              <input type="date" id="focus-task-dueDate" name="dueDate">
            </div>
          </div>
          <div class="form-group">
            <label for="focus-task-description">Description (optional)</label>
            <textarea id="focus-task-description" name="description" rows="2" placeholder="Additional details..."></textarea>
          </div>
          <button type="submit" class="btn primary">Add Task</button>
        </form>

        <div class="todo-controls">
          <div class="todo-filters">
            <button class="btn ${this.filter === 'all' ? 'active' : ''}" data-focus-filter="all">All</button>
            <button class="btn ${this.filter === 'active' ? 'active' : ''}" data-focus-filter="active">Active</button>
            <button class="btn ${this.filter === 'completed' ? 'active' : ''}" data-focus-filter="completed">Completed</button>
          </div>
          <div class="todo-sort">
            <label for="focus-task-sort">Sort by:</label>
            <select id="focus-task-sort" class="sort-select">
              <option value="date" ${this.sortBy === 'date' ? 'selected' : ''}>Due Date</option>
              <option value="priority" ${this.sortBy === 'priority' ? 'selected' : ''}>Priority</option>
              <option value="name" ${this.sortBy === 'name' ? 'selected' : ''}>Name</option>
              <option value="time" ${this.sortBy === 'time' ? 'selected' : ''}>Time Tracked</option>
            </select>
          </div>
        </div>

        <div class="todo-list">
          ${filtered.length === 0
            ? '<p class="empty-state">No tasks yet. Add one above!</p>'
            : filtered.map(task => {
                const overdue = this.isOverdue(task.dueDate);
                const timeStats = this.getTaskTimeStats(task.id);
                const priorityBorders = {
                  high: 'rgba(239, 68, 68, 0.8)',
                  medium: 'rgba(245, 158, 11, 0.8)',
                  low: 'rgba(34, 197, 94, 0.8)'
                };
                return `
                  <div class="task-card ${task.completed ? 'completed' : ''} ${overdue ? 'overdue' : ''}" 
                       style="border-left: 4px solid ${priorityBorders[task.priority] || priorityBorders.medium}">
                    <div class="task-main">
                      <div class="task-checkbox" onclick="focusTimer.toggleTask('${task.id}')">
                        <div class="checkbox ${task.completed ? 'checked' : ''}">
                          ${task.completed ? '✓' : ''}
                        </div>
                      </div>
                      <div class="task-content">
                        <div class="task-title ${task.completed ? 'strikethrough' : ''}">${task.title}</div>
                        ${task.description ? `<div class="task-description">${task.description}</div>` : ''}
                        <div class="task-meta">
                          <span class="task-category">${task.category}</span>
                          <span class="task-priority priority-${task.priority}">${task.priority}</span>
                          ${task.dueDate ? `<span class="task-due ${overdue ? 'overdue' : ''}">Due: ${new Date(task.dueDate).toLocaleDateString()}</span>` : ''}
                          ${timeStats.total > 0 ? `<span class="task-time">⏱️ ${this.formatTime(timeStats.total)}</span>` : ''}
                        </div>
                      </div>
                    </div>
                    <div class="task-actions">
                      ${!task.completed ? `
                        <button class="btn-icon" onclick="focusTimer.startTimer(25, '${task.id}'); focusTimer.viewMode = 'timer'; focusTimer.render();" title="Start 25min Timer">⏱️</button>
                      ` : ''}
                      <button class="btn-icon" onclick="focusTimer.editTask('${task.id}')" title="Edit">✏️</button>
                      <button class="btn-icon" onclick="focusTimer.deleteTask('${task.id}')" title="Delete">×</button>
                    </div>
                  </div>
                `;
              }).join('')
          }
        </div>
      `;
    }

    this.setupEventListeners();
  }
}

// Export focus timer instance
const focusTimer = new FocusTimer();
