// Productivity Timer Mini Site
class ProductivityTimer {
  constructor() {
    this.sessions = [];
    this.settings = {
      pomodoroWork: 25 * 60, // 25 minutes in seconds
      pomodoroBreak: 5 * 60, // 5 minutes in seconds
      pomodoroLongBreak: 15 * 60, // 15 minutes in seconds
      pomodoroSessionsUntilLongBreak: 4,
      soundEnabled: true,
      notificationsEnabled: true,
      presets: [
        { name: 'Quick Focus', duration: 10 * 60 },
        { name: 'Pomodoro', duration: 25 * 60 },
        { name: 'Deep Work', duration: 45 * 60 },
        { name: 'Extended Focus', duration: 90 * 60 }
      ]
    };
    this.categories = ['Work', 'Study', 'Exercise', 'Creative', 'Reading', 'Other'];
    this.goals = {
      dailyMinutes: 0,
      weeklyMinutes: 0
    };
    this.currentTimer = null;
    this.timerInterval = null;
    this.currentMode = 'pomodoro'; // 'pomodoro', 'countdown', 'stopwatch', 'focus'
    this.customDuration = 25 * 60; // Default 25 minutes
    this.isRunning = false;
    this.isPaused = false;
    this.currentSession = null;
    this.pomodoroSessionCount = 0;
    this.viewMode = 'timer'; // 'timer' or 'analytics'
    this.charts = {};
    this.distractions = 0;
    this.startTime = null;
    this.elapsedTime = 0;
    this.init();
  }

  async init() {
    await this.loadSessions();
    await this.loadSettings();
    await this.loadGoals();
    this.render();
    this.setupEventListeners();
  }

  async loadSessions() {
    try {
      this.sessions = await api.getSessions();
      this.sessions.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
    } catch (error) {
      console.error('Error loading sessions:', error);
      this.sessions = [];
    }
  }

  async loadSettings() {
    try {
      const saved = await api.getTimerSettings();
      if (saved) {
        this.settings = { ...this.settings, ...saved };
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  async loadGoals() {
    try {
      const saved = await api.getTimerGoals();
      if (saved) {
        this.goals = { ...this.goals, ...saved };
      }
    } catch (error) {
      console.error('Error loading goals:', error);
    }
  }

  async saveSessions() {
    try {
      // Sessions are saved individually via createSession/updateSession
    } catch (error) {
      console.error('Error saving sessions:', error);
    }
  }

  async saveSettings() {
    try {
      await api.saveTimerSettings(this.settings);
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  }

  async saveGoals() {
    try {
      await api.saveTimerGoals(this.goals);
    } catch (error) {
      console.error('Error saving goals:', error);
    }
  }

  setupEventListeners() {
    // Timer controls
    const startBtn = document.getElementById('timer-start');
    if (startBtn) {
      startBtn.addEventListener('click', () => this.startTimer());
    }

    const pauseBtn = document.getElementById('timer-pause');
    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => this.pauseTimer());
    }

    const resetBtn = document.getElementById('timer-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.resetTimer());
    }

    // Mode selector
    const modeSelect = document.getElementById('timer-mode');
    if (modeSelect) {
      modeSelect.addEventListener('change', (e) => {
        this.currentMode = e.target.value;
        this.resetTimer();
        this.render();
      });
    }

    // Custom duration input
    const durationInput = document.getElementById('custom-duration');
    if (durationInput) {
      durationInput.addEventListener('change', (e) => {
        const minutes = parseInt(e.target.value) || 25;
        this.customDuration = minutes * 60;
      });
    }

    // Preset buttons
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('preset-btn')) {
        const duration = parseInt(e.target.dataset.duration);
        this.customDuration = duration;
        this.currentMode = 'countdown';
        this.resetTimer();
        this.render();
      }
    });

    // Distraction button
    const distractionBtn = document.getElementById('timer-distraction');
    if (distractionBtn) {
      distractionBtn.addEventListener('click', () => this.logDistraction());
    }

    // Session form
    const sessionForm = document.getElementById('session-form');
    if (sessionForm) {
      sessionForm.addEventListener('submit', (e) => this.handleAddSession(e));
    }

    // Settings form
    const settingsForm = document.getElementById('timer-settings-form');
    if (settingsForm) {
      settingsForm.addEventListener('submit', (e) => this.handleSaveSettings(e));
    }

    // Goals form
    const goalsForm = document.getElementById('timer-goals-form');
    if (goalsForm) {
      goalsForm.addEventListener('submit', (e) => this.handleSaveGoals(e));
    }
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  getRemainingTime() {
    if (this.currentMode === 'stopwatch') {
      return this.elapsedTime;
    }
    if (this.currentTimer === null) return 0;
    return Math.max(0, this.currentTimer - this.elapsedTime);
  }

  startTimer() {
    if (this.isRunning) return;

    if (!this.isPaused) {
      // Starting new timer
      if (this.currentMode === 'pomodoro') {
        this.currentTimer = this.settings.pomodoroWork;
      } else if (this.currentMode === 'countdown' || this.currentMode === 'focus') {
        this.currentTimer = this.customDuration;
      } else if (this.currentMode === 'stopwatch') {
        this.currentTimer = null;
        this.elapsedTime = 0;
      }
      this.startTime = new Date();
      this.elapsedTime = 0;
      this.distractions = 0;
      
      // Create session
      this.currentSession = {
        id: Date.now().toString(),
        type: this.currentMode,
        duration: this.currentTimer || 0,
        category: document.getElementById('session-category')?.value || 'Work',
        taskId: null,
        notes: '',
        completed: false,
        startTime: this.startTime.toISOString(),
        endTime: null,
        distractions: 0,
        createdAt: this.startTime.toISOString()
      };
    } else {
      // Resuming paused timer
      this.startTime = new Date(Date.now() - this.elapsedTime * 1000);
    }

    this.isRunning = true;
    this.isPaused = false;

    this.timerInterval = setInterval(() => {
      if (this.currentMode === 'stopwatch') {
        this.elapsedTime++;
      } else {
        this.elapsedTime++;
        const remaining = this.getRemainingTime();
        if (remaining <= 0) {
          this.completeTimer();
        }
      }
      this.updateDisplay();
    }, 1000);

    this.updateDisplay();
    this.render();
  }

  pauseTimer() {
    if (!this.isRunning) return;
    this.isRunning = false;
    this.isPaused = true;
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.updateDisplay();
    this.render();
  }

  resetTimer() {
    this.isRunning = false;
    this.isPaused = false;
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.currentTimer = null;
    this.elapsedTime = 0;
    this.startTime = null;
    this.currentSession = null;
    this.distractions = 0;
    this.updateDisplay();
    this.render();
  }

  async completeTimer() {
    this.isRunning = false;
    this.isPaused = false;
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    if (this.currentSession) {
      const endTime = new Date();
      this.currentSession.endTime = endTime.toISOString();
      this.currentSession.completed = true;
      this.currentSession.duration = this.elapsedTime;
      this.currentSession.distractions = this.distractions;
      
      // Get notes if available
      const notesInput = document.getElementById('session-notes');
      if (notesInput) {
        this.currentSession.notes = notesInput.value;
      }

      try {
        await api.createSession(this.currentSession);
        await this.loadSessions();
        
        // Play sound if enabled
        if (this.settings.soundEnabled) {
          this.playNotificationSound();
        }

        // Show notification if enabled
        if (this.settings.notificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
          new Notification('Timer Complete!', {
            body: `Your ${this.currentMode} session is complete.`,
            icon: '/logo.png'
          });
        }

        // Handle Pomodoro break
        if (this.currentMode === 'pomodoro') {
          this.pomodoroSessionCount++;
          if (this.pomodoroSessionCount % this.settings.pomodoroSessionsUntilLongBreak === 0) {
            this.showMessage('Great work! Time for a long break.', 'success');
            // Auto-start break timer
            setTimeout(() => {
              this.currentMode = 'countdown';
              this.customDuration = this.settings.pomodoroLongBreak;
              this.resetTimer();
              this.render();
            }, 2000);
          } else {
            this.showMessage('Session complete! Time for a short break.', 'success');
            setTimeout(() => {
              this.currentMode = 'countdown';
              this.customDuration = this.settings.pomodoroBreak;
              this.resetTimer();
              this.render();
            }, 2000);
          }
        }
      } catch (error) {
        console.error('Error saving session:', error);
      }
    }

    this.currentSession = null;
    this.elapsedTime = 0;
    this.startTime = null;
    this.distractions = 0;
    this.updateDisplay();
    this.render();
  }

  logDistraction() {
    if (this.isRunning && this.currentSession) {
      this.distractions++;
      this.currentSession.distractions = this.distractions;
      this.showMessage(`Distraction logged (${this.distractions})`, 'info');
    }
  }

  playNotificationSound() {
    // Create a simple beep sound using Web Audio API
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  }

  updateDisplay() {
    const remaining = this.getRemainingTime();
    const display = this.formatTime(remaining);
    
    // Update timer display
    const timerDisplay = document.getElementById('timer-display');
    if (timerDisplay) {
      timerDisplay.textContent = display;
    }

    // Update progress ring
    this.updateProgressRing(remaining);

    // Update browser tab title
    if (this.isRunning && this.currentMode !== 'stopwatch') {
      document.title = `${display} - Productivity Timer`;
    } else if (this.isRunning && this.currentMode === 'stopwatch') {
      document.title = `${display} - Stopwatch`;
    } else {
      document.title = 'Productivity Timer';
    }
  }

  updateProgressRing(remaining) {
    const progressCircle = document.getElementById('timer-progress-circle');
    if (!progressCircle) return;

    let progress = 0;
    if (this.currentMode === 'stopwatch') {
      // For stopwatch, show elapsed time as progress (no max)
      progress = (this.elapsedTime % 3600) / 3600; // Show hour cycle
    } else if (this.currentTimer && this.currentTimer > 0) {
      progress = Math.max(0, Math.min(1, remaining / this.currentTimer));
    }

    const circumference = 2 * Math.PI * 90; // radius = 90
    const offset = circumference * (1 - progress);
    
    progressCircle.style.strokeDashoffset = offset;
  }

  async handleAddSession(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);

    const startTimeStr = formData.get('startTime');
    const startTime = startTimeStr ? new Date(startTimeStr).toISOString() : new Date().toISOString();
    const durationMinutes = parseInt(formData.get('duration')) || 0;
    const duration = durationMinutes * 60; // Convert minutes to seconds
    const startDate = new Date(startTime);
    const endTime = new Date(startDate.getTime() + duration * 1000).toISOString();

    const session = {
      id: Date.now().toString(),
      type: formData.get('type') || 'countdown',
      duration: duration,
      category: formData.get('category') || 'Work',
      taskId: null,
      notes: formData.get('notes') || '',
      completed: true,
      startTime: startTime,
      endTime: endTime,
      distractions: parseInt(formData.get('distractions')) || 0,
      createdAt: new Date().toISOString()
    };

    try {
      await api.createSession(session);
      await this.loadSessions();
      form.reset();
      this.showMessage('Session added!', 'success');
      this.render();
    } catch (error) {
      console.error('Error adding session:', error);
      this.showMessage('Error adding session.', 'error');
    }
  }

  async handleSaveSettings(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);

    this.settings.pomodoroWork = parseInt(formData.get('pomodoroWork')) * 60;
    this.settings.pomodoroBreak = parseInt(formData.get('pomodoroBreak')) * 60;
    this.settings.pomodoroLongBreak = parseInt(formData.get('pomodoroLongBreak')) * 60;
    this.settings.pomodoroSessionsUntilLongBreak = parseInt(formData.get('pomodoroSessionsUntilLongBreak'));
    this.settings.soundEnabled = formData.get('soundEnabled') === 'on';
    this.settings.notificationsEnabled = formData.get('notificationsEnabled') === 'on';

    await this.saveSettings();
    this.showMessage('Settings saved!', 'success');
    this.render();
  }

  async handleSaveGoals(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);

    this.goals.dailyMinutes = parseInt(formData.get('dailyMinutes')) || 0;
    this.goals.weeklyMinutes = parseInt(formData.get('weeklyMinutes')) || 0;

    await this.saveGoals();
    this.showMessage('Goals saved!', 'success');
    this.render();
  }

  async deleteSession(id) {
    if (!confirm('Delete this session?')) return;

    try {
      await api.deleteSession(id);
      await this.loadSessions();
      this.render();
      this.showMessage('Session deleted.', 'success');
    } catch (error) {
      console.error('Error deleting session:', error);
      this.showMessage('Error deleting session.', 'error');
    }
  }

  async editSession(id) {
    const session = this.sessions.find(s => s.id === id);
    if (!session) return;

    // For now, just delete and let user add new one
    // Could be enhanced with an edit modal
    if (confirm('Edit session? (Will delete current and allow re-entry)')) {
      await this.deleteSession(id);
      // Pre-fill form
      const form = document.getElementById('session-form');
      if (form) {
        form.elements.type.value = session.type;
        form.elements.duration.value = Math.floor(session.duration / 60);
        form.elements.category.value = session.category;
        form.elements.notes.value = session.notes || '';
        form.elements.distractions.value = session.distractions || 0;
        form.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }

  getWeeklyStats() {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weekSessions = this.sessions.filter(s => 
      new Date(s.startTime) >= weekAgo && s.completed
    );

    const dailyData = {};
    for (let i = 0; i < 7; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      dailyData[dateStr] = { time: 0, sessions: 0 };
    }

    weekSessions.forEach(session => {
      const dateStr = session.startTime.split('T')[0];
      if (dailyData[dateStr]) {
        dailyData[dateStr].time += session.duration;
        dailyData[dateStr].sessions++;
      }
    });

    return Object.entries(dailyData)
      .sort((a, b) => new Date(a[0]) - new Date(b[0]))
      .map(([date, data]) => ({
        date,
        time: data.time,
        sessions: data.sessions
      }));
  }

  getCategoryStats() {
    const categoryData = {};
    const completedSessions = this.sessions.filter(s => s.completed);
    
    completedSessions.forEach(session => {
      const category = session.category || 'Other';
      if (!categoryData[category]) {
        categoryData[category] = { time: 0, sessions: 0 };
      }
      categoryData[category].time += session.duration;
      categoryData[category].sessions++;
    });

    return Object.entries(categoryData).map(([category, data]) => ({
      category,
      time: data.time,
      sessions: data.sessions
    }));
  }

  getTotalStats() {
    const completedSessions = this.sessions.filter(s => s.completed);
    const totalTime = completedSessions.reduce((sum, s) => sum + s.duration, 0);
    const avgDuration = completedSessions.length > 0 
      ? totalTime / completedSessions.length 
      : 0;
    const longestSession = completedSessions.length > 0
      ? Math.max(...completedSessions.map(s => s.duration))
      : 0;
    const completionRate = this.sessions.length > 0
      ? (completedSessions.length / this.sessions.length) * 100
      : 0;

    // Today's stats
    const today = new Date().toISOString().split('T')[0];
    const todaySessions = completedSessions.filter(s => s.startTime.startsWith(today));
    const todayTime = todaySessions.reduce((sum, s) => sum + s.duration, 0);

    // This week's stats
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const weekSessions = completedSessions.filter(s => new Date(s.startTime) >= weekAgo);
    const weekTime = weekSessions.reduce((sum, s) => sum + s.duration, 0);

    // This month's stats
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const monthSessions = completedSessions.filter(s => new Date(s.startTime) >= monthAgo);
    const monthTime = monthSessions.reduce((sum, s) => sum + s.duration, 0);

    return {
      totalSessions: completedSessions.length,
      totalTime,
      avgDuration,
      longestSession,
      completionRate,
      todayTime,
      weekTime,
      monthTime,
      todaySessions: todaySessions.length,
      weekSessions: weekSessions.length,
      monthSessions: monthSessions.length
    };
  }

  getFocusStreak() {
    const completedSessions = this.sessions.filter(s => s.completed);
    if (completedSessions.length === 0) return 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let streak = 0;
    let currentDate = new Date(today);

    // Check if today has a session
    const todayStr = today.toISOString().split('T')[0];
    const hasToday = completedSessions.some(s => s.startTime.startsWith(todayStr));
    
    if (hasToday) {
      streak++;
      currentDate.setDate(currentDate.getDate() - 1);
    } else {
      currentDate.setDate(currentDate.getDate() - 1);
    }

    // Count consecutive days
    while (true) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const hasSession = completedSessions.some(s => s.startTime.startsWith(dateStr));
      if (hasSession) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        break;
      }
    }

    return streak;
  }

  getGoalProgress() {
    const stats = this.getTotalStats();
    const dailyProgress = this.goals.dailyMinutes > 0
      ? Math.min(100, (stats.todayTime / 60 / this.goals.dailyMinutes) * 100)
      : 0;
    const weeklyProgress = this.goals.weeklyMinutes > 0
      ? Math.min(100, (stats.weekTime / 60 / this.goals.weeklyMinutes) * 100)
      : 0;

    return {
      dailyProgress,
      weeklyProgress,
      dailyRemaining: Math.max(0, this.goals.dailyMinutes - (stats.todayTime / 60)),
      weeklyRemaining: Math.max(0, this.goals.weeklyMinutes - (stats.weekTime / 60))
    };
  }

  renderCharts() {
    // Destroy existing charts
    Object.values(this.charts).forEach(chart => {
      if (chart) chart.destroy();
    });
    this.charts = {};

    // Weekly time spent chart
    const weeklyStats = this.getWeeklyStats();
    if (weeklyStats.length > 0) {
      const timeCtx = document.getElementById('weekly-time-chart');
      if (timeCtx) {
        this.charts.weeklyTime = new Chart(timeCtx, {
          type: 'line',
          data: {
            labels: weeklyStats.map(s => new Date(s.date).toLocaleDateString('en-US', { weekday: 'short' })),
            datasets: [{
              label: 'Time Spent (minutes)',
              data: weeklyStats.map(s => Math.round(s.time / 60)),
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

      // Weekly sessions chart
      const sessionsCtx = document.getElementById('weekly-sessions-chart');
      if (sessionsCtx) {
        this.charts.weeklySessions = new Chart(sessionsCtx, {
          type: 'bar',
          data: {
            labels: weeklyStats.map(s => new Date(s.date).toLocaleDateString('en-US', { weekday: 'short' })),
            datasets: [{
              label: 'Sessions Completed',
              data: weeklyStats.map(s => s.sessions),
              backgroundColor: 'rgba(167, 139, 250, 0.5)',
              borderColor: 'rgba(167, 139, 250, 0.8)',
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
                ticks: { color: 'rgba(255, 255, 255, 0.68)' },
                grid: { color: 'rgba(255, 255, 255, 0.1)' }
              }
            }
          }
        });
      }
    }

    // Category breakdown chart
    const categoryStats = this.getCategoryStats();
    if (categoryStats.length > 0) {
      const categoryCtx = document.getElementById('category-chart');
      if (categoryCtx) {
        const colors = [
          'rgba(110, 231, 255, 0.8)',
          'rgba(167, 139, 250, 0.8)',
          'rgba(34, 197, 94, 0.8)',
          'rgba(245, 158, 11, 0.8)',
          'rgba(239, 68, 68, 0.8)',
          'rgba(59, 130, 246, 0.8)'
        ];

        this.charts.category = new Chart(categoryCtx, {
          type: 'doughnut',
          data: {
            labels: categoryStats.map(s => s.category),
            datasets: [{
              data: categoryStats.map(s => Math.round(s.time / 60)),
              backgroundColor: colors.slice(0, categoryStats.length),
              borderColor: 'rgba(255, 255, 255, 0.1)',
              borderWidth: 2
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: true, position: 'right' },
              tooltip: {
                callbacks: {
                  label: (context) => {
                    const label = context.label || '';
                    const value = context.parsed || 0;
                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                    const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                    return `${label}: ${value} min (${percentage}%)`;
                  }
                }
              }
            }
          }
        });
      }
    }
  }

  exportData() {
    const data = {
      sessions: this.sessions,
      settings: this.settings,
      goals: this.goals,
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `productivity-timer-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  showMessage(message, type = 'info') {
    const messageEl = document.getElementById('timer-message');
    if (messageEl) {
      messageEl.textContent = message;
      messageEl.className = `message message-${type}`;
      messageEl.style.display = 'block';
      setTimeout(() => {
        messageEl.style.display = 'none';
      }, 3000);
    }
  }

  requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }

  render() {
    const container = document.getElementById('productivity-timer-content');
    if (!container) return;

    const stats = this.getTotalStats();
    const goalProgress = this.getGoalProgress();
    const streak = this.getFocusStreak();
    const remaining = this.getRemainingTime();
    const display = this.formatTime(remaining);
    const progress = this.currentTimer ? (remaining / this.currentTimer) : 0;

    if (this.viewMode === 'analytics') {
      container.innerHTML = `
        <div class="timer-header">
          <h2>Productivity Analytics</h2>
          <div class="timer-actions">
            <button class="btn ${this.viewMode === 'analytics' ? 'active' : ''}" onclick="productivityTimer.viewMode = 'analytics'; productivityTimer.render();">Analytics</button>
            <button class="btn ${this.viewMode === 'timer' ? 'active' : ''}" onclick="productivityTimer.viewMode = 'timer'; productivityTimer.render();">Timer</button>
            <button class="btn" onclick="productivityTimer.exportData()">Export</button>
          </div>
        </div>

        <div id="timer-message" class="message" style="display:none;"></div>

        <div class="analytics-dashboard">
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-label">Total Sessions</div>
              <div class="stat-value">${stats.totalSessions}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Total Time</div>
              <div class="stat-value">${Math.round(stats.totalTime / 60)} min</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Today</div>
              <div class="stat-value">${Math.round(stats.todayTime / 60)} min</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">This Week</div>
              <div class="stat-value">${Math.round(stats.weekTime / 60)} min</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Avg Session</div>
              <div class="stat-value">${Math.round(stats.avgDuration / 60)} min</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Longest Session</div>
              <div class="stat-value">${Math.round(stats.longestSession / 60)} min</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Focus Streak</div>
              <div class="stat-value">🔥 ${streak} days</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Completion Rate</div>
              <div class="stat-value">${Math.round(stats.completionRate)}%</div>
            </div>
          </div>

          ${this.goals.dailyMinutes > 0 || this.goals.weeklyMinutes > 0 ? `
            <div class="goals-section">
              <h3>Goal Progress</h3>
              <div class="goals-grid">
                ${this.goals.dailyMinutes > 0 ? `
                  <div class="goal-card">
                    <div class="goal-header">
                      <span>Daily Goal</span>
                      <span>${Math.round(stats.todayTime / 60)} / ${this.goals.dailyMinutes} min</span>
                    </div>
                    <div class="goal-progress-bar">
                      <div class="goal-progress-fill" style="width: ${goalProgress.dailyProgress}%"></div>
                    </div>
                    <div class="goal-remaining">${Math.round(goalProgress.dailyRemaining)} min remaining</div>
                  </div>
                ` : ''}
                ${this.goals.weeklyMinutes > 0 ? `
                  <div class="goal-card">
                    <div class="goal-header">
                      <span>Weekly Goal</span>
                      <span>${Math.round(stats.weekTime / 60)} / ${this.goals.weeklyMinutes} min</span>
                    </div>
                    <div class="goal-progress-bar">
                      <div class="goal-progress-fill" style="width: ${goalProgress.weeklyProgress}%"></div>
                    </div>
                    <div class="goal-remaining">${Math.round(goalProgress.weeklyRemaining)} min remaining</div>
                  </div>
                ` : ''}
              </div>
            </div>
          ` : ''}

          <div class="chart-container">
            <h3>Weekly Time Spent</h3>
            <canvas id="weekly-time-chart"></canvas>
          </div>

          <div class="chart-container">
            <h3>Weekly Sessions Completed</h3>
            <canvas id="weekly-sessions-chart"></canvas>
          </div>

          <div class="chart-container">
            <h3>Category Breakdown</h3>
            <canvas id="category-chart"></canvas>
          </div>

          <div class="session-history-section">
            <h3>Recent Sessions</h3>
            <div class="session-list">
              ${this.sessions.slice(0, 20).map(session => `
                <div class="session-card">
                  <div class="session-header">
                    <div>
                      <span class="session-type">${session.type}</span>
                      <span class="session-category">${session.category}</span>
                    </div>
                    <div class="session-actions">
                      <button class="btn-icon" onclick="productivityTimer.editSession('${session.id}')" title="Edit">✏️</button>
                      <button class="btn-icon" onclick="productivityTimer.deleteSession('${session.id}')" title="Delete">×</button>
                    </div>
                  </div>
                  <div class="session-details">
                    <span>${Math.round(session.duration / 60)} min</span>
                    <span>${new Date(session.startTime).toLocaleDateString()}</span>
                    ${session.distractions > 0 ? `<span class="distraction-badge">⚠️ ${session.distractions} distractions</span>` : ''}
                  </div>
                  ${session.notes ? `<div class="session-notes">${session.notes}</div>` : ''}
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;

      setTimeout(() => this.renderCharts(), 100);
    } else {
      container.innerHTML = `
        <div class="timer-header">
          <h2>Productivity Timer</h2>
          <div class="timer-actions">
            <button class="btn ${this.viewMode === 'timer' ? 'active' : ''}" onclick="productivityTimer.viewMode = 'timer'; productivityTimer.render();">Timer</button>
            <button class="btn ${this.viewMode === 'analytics' ? 'active' : ''}" onclick="productivityTimer.viewMode = 'analytics'; productivityTimer.render();">Analytics</button>
            <button class="btn" onclick="productivityTimer.exportData()">Export</button>
          </div>
        </div>

        <div id="timer-message" class="message" style="display:none;"></div>

        <div class="timer-main">
          <div class="timer-controls-section">
            <div class="mode-selector">
              <label for="timer-mode">Mode:</label>
              <select id="timer-mode" class="mode-select">
                <option value="pomodoro" ${this.currentMode === 'pomodoro' ? 'selected' : ''}>Pomodoro</option>
                <option value="countdown" ${this.currentMode === 'countdown' ? 'selected' : ''}>Countdown</option>
                <option value="stopwatch" ${this.currentMode === 'stopwatch' ? 'selected' : ''}>Stopwatch</option>
                <option value="focus" ${this.currentMode === 'focus' ? 'selected' : ''}>Focus</option>
              </select>
            </div>

            ${this.currentMode === 'countdown' || this.currentMode === 'focus' ? `
              <div class="duration-input">
                <label for="custom-duration">Duration (minutes):</label>
                <input type="number" id="custom-duration" value="${Math.floor(this.customDuration / 60)}" min="1" max="300">
              </div>
            ` : ''}

            <div class="preset-buttons">
              ${this.settings.presets.map(preset => `
                <button class="btn preset-btn" data-duration="${preset.duration}">${preset.name} (${Math.floor(preset.duration / 60)} min)</button>
              `).join('')}
            </div>
          </div>

          <div class="timer-display-section">
            <div class="timer-circle">
              <svg id="timer-progress-ring" width="300" height="300" viewBox="0 0 200 200">
                <circle cx="100" cy="100" r="90" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="8"/>
                <circle id="timer-progress-circle" cx="100" cy="100" r="90" fill="none" stroke="rgba(110,231,255,0.8)" stroke-width="8" 
                        stroke-dasharray="${2 * Math.PI * 90}" stroke-dashoffset="${2 * Math.PI * 90}" 
                        stroke-linecap="round" transform="rotate(-90 100 100)"/>
              </svg>
              <div class="timer-display-inner">
                <div id="timer-display" class="timer-display">${display}</div>
                <div class="timer-status">${this.isRunning ? (this.isPaused ? 'Paused' : 'Running') : 'Ready'}</div>
              </div>
            </div>

            <div class="timer-buttons">
              ${!this.isRunning ? `
                <button id="timer-start" class="btn primary">Start</button>
              ` : `
                <button id="timer-pause" class="btn">${this.isPaused ? 'Resume' : 'Pause'}</button>
              `}
              <button id="timer-reset" class="btn">Reset</button>
              ${this.isRunning ? `
                <button id="timer-distraction" class="btn">⚠️ Log Distraction</button>
              ` : ''}
            </div>
          </div>

          <div class="session-info-section">
            <div class="form-row">
              <div class="form-group">
                <label for="session-category">Category:</label>
                <select id="session-category">
                  ${this.categories.map(cat => `<option value="${cat}">${cat}</option>`).join('')}
                </select>
              </div>
            </div>
            <div class="form-group">
              <label for="session-notes">Notes (optional):</label>
              <textarea id="session-notes" rows="2" placeholder="What are you working on?"></textarea>
            </div>
          </div>

          <div class="quick-stats">
            <div class="quick-stat">
              <div class="quick-stat-label">Today</div>
              <div class="quick-stat-value">${Math.round(stats.todayTime / 60)} min</div>
            </div>
            <div class="quick-stat">
              <div class="quick-stat-label">Streak</div>
              <div class="quick-stat-value">🔥 ${streak}</div>
            </div>
            <div class="quick-stat">
              <div class="quick-stat-label">This Week</div>
              <div class="quick-stat-value">${Math.round(stats.weekTime / 60)} min</div>
            </div>
          </div>
        </div>

        <div class="manual-session-section">
          <h3>Add Manual Session</h3>
          <form id="session-form" class="session-form">
            <div class="form-row">
              <div class="form-group">
                <label for="manual-type">Type:</label>
                <select id="manual-type" name="type">
                  <option value="pomodoro">Pomodoro</option>
                  <option value="countdown">Countdown</option>
                  <option value="stopwatch">Stopwatch</option>
                  <option value="focus">Focus</option>
                </select>
              </div>
              <div class="form-group">
                <label for="manual-duration">Duration (minutes):</label>
                <input type="number" id="manual-duration" name="duration" min="1" required>
              </div>
              <div class="form-group">
                <label for="manual-category">Category:</label>
                <select id="manual-category" name="category">
                  ${this.categories.map(cat => `<option value="${cat}">${cat}</option>`).join('')}
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="manual-startTime">Start Time:</label>
                <input type="datetime-local" id="manual-startTime" name="startTime">
              </div>
              <div class="form-group">
                <label for="manual-distractions">Distractions:</label>
                <input type="number" id="manual-distractions" name="distractions" min="0" value="0">
              </div>
            </div>
            <div class="form-group">
              <label for="manual-notes">Notes:</label>
              <textarea id="manual-notes" name="notes" rows="2"></textarea>
            </div>
            <button type="submit" class="btn primary">Add Session</button>
          </form>
        </div>
      `;
    }

    this.setupEventListeners();
    this.updateDisplay();
    
    // Request notification permission on first render
    if (this.settings.notificationsEnabled) {
      this.requestNotificationPermission();
    }
  }
}

// Export productivity timer instance
const productivityTimer = new ProductivityTimer();
