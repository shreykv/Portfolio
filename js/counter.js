// Interactive Counter Mini Site
class Counter {
  constructor() {
    this.counters = [];
    this.history = [];
    this.viewMode = 'counters'; // 'counters' or 'analytics'
    this.charts = {};
    this.init();
  }

  async init() {
    await this.loadCounters();
    this.render();
    this.setupEventListeners();
  }

  async loadCounters() {
    try {
      const data = await api.getCounters();
      this.counters = data.counters || [];
      this.history = data.history || [];
    } catch (error) {
      console.error('Error loading counters:', error);
      this.counters = [];
      this.history = [];
    }
  }

  setupEventListeners() {
    // Add counter form
    const form = document.getElementById('counter-form');
    if (form) {
      form.addEventListener('submit', (e) => this.handleAddCounter(e));
    }

    // Save button
    const saveBtn = document.getElementById('save-counters');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => this.saveCounters());
    }

    // Clear all button
    const clearBtn = document.getElementById('clear-counters');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clearAll());
    }
  }

  async handleAddCounter(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);

    const name = formData.get('name').trim();
    if (!name) return;

    const counter = {
      id: Date.now().toString(),
      name: name,
      value: parseInt(formData.get('initial') || '0'),
      color: formData.get('color') || '#6EE7FF',
      goal: parseInt(formData.get('goal') || '0'),
      createdAt: new Date().toISOString()
    };

    this.counters.push(counter);
    form.reset();
    await this.saveCounters();
    this.render();
  }

  increment(id, amount = 1) {
    const counter = this.counters.find(c => c.id === id);
    if (counter) {
      counter.value += amount;
      this.recordHistory(id, 'increment', counter.value);
      this.saveCounters();
      this.render();
    }
  }

  decrement(id) {
    const counter = this.counters.find(c => c.id === id);
    if (counter) {
      counter.value = Math.max(0, counter.value - 1);
      this.recordHistory(id, 'decrement', counter.value);
      this.saveCounters();
      this.render();
    }
  }

  reset(id) {
    const counter = this.counters.find(c => c.id === id);
    if (counter) {
      counter.value = 0;
      this.recordHistory(id, 'reset', 0);
      this.saveCounters();
      this.render();
    }
  }

  deleteCounter(id) {
    if (!confirm('Delete this counter?')) return;
    this.counters = this.counters.filter(c => c.id !== id);
    this.saveCounters();
    this.render();
  }

  setValue(id, value) {
    const counter = this.counters.find(c => c.id === id);
    if (counter) {
      const oldValue = counter.value;
      counter.value = Math.max(0, parseInt(value) || 0);
      if (oldValue !== counter.value) {
        this.recordHistory(id, 'set', counter.value);
        this.saveCounters();
        this.render();
      }
    }
  }

  setGoal(id, goal) {
    const counter = this.counters.find(c => c.id === id);
    if (counter) {
      counter.goal = Math.max(0, parseInt(goal) || 0);
      this.saveCounters();
      this.render();
    }
  }

  recordHistory(counterId, action, value) {
    const counter = this.counters.find(c => c.id === counterId);
    if (counter) {
      this.history.unshift({
        counterId,
        counterName: counter.name,
        action,
        value,
        timestamp: new Date().toISOString()
      });
      // Keep last 100 history entries
      if (this.history.length > 100) {
        this.history = this.history.slice(0, 100);
      }
    }
  }

  async saveCounters() {
    try {
      await api.saveCounters({
        counters: this.counters,
        history: this.history
      });
    } catch (error) {
      console.error('Error saving counters:', error);
    }
  }

  async clearAll() {
    if (!confirm('Clear all counters? This cannot be undone.')) return;
    this.counters = [];
    this.history = [];
    await this.saveCounters();
    this.render();
  }

  exportData() {
    const data = {
      counters: this.counters,
      history: this.history,
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `counters-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  getCounterHistory(counterId) {
    return this.history
      .filter(h => h.counterId === counterId)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  getCounterValueOverTime(counterId) {
    const history = this.getCounterHistory(counterId);
    if (history.length === 0) return [];

    const values = [];
    let currentValue = 0;
    
    history.forEach(entry => {
      if (entry.action === 'increment') currentValue = entry.value;
      else if (entry.action === 'decrement') currentValue = entry.value;
      else if (entry.action === 'set' || entry.action === 'reset') currentValue = entry.value;
      
      values.push({
        timestamp: entry.timestamp,
        value: currentValue
      });
    });

    return values;
  }

  getDailyTrends() {
    const dailyData = {};
    
    this.history.forEach(entry => {
      const date = new Date(entry.timestamp).toLocaleDateString();
      if (!dailyData[date]) {
        dailyData[date] = {};
      }
      if (!dailyData[date][entry.counterId]) {
        dailyData[date][entry.counterId] = 0;
      }
      if (entry.action === 'increment') {
        dailyData[date][entry.counterId]++;
      }
    });

    return Object.entries(dailyData)
      .sort((a, b) => new Date(a[0]) - new Date(b[0]))
      .slice(-30); // Last 30 days
  }

  renderCharts() {
    // Destroy existing charts
    Object.values(this.charts).forEach(chart => {
      if (chart) chart.destroy();
    });
    this.charts = {};

    // Counter values over time
    if (this.counters.length > 0) {
      const valueCtx = document.getElementById('counter-values-chart');
      if (valueCtx) {
        const datasets = this.counters.slice(0, 5).map((counter, idx) => {
          const history = this.getCounterValueOverTime(counter.id);
          if (history.length === 0) return null;
          
          return {
            label: counter.name,
            data: history.map(h => h.value),
            borderColor: counter.color,
            backgroundColor: counter.color + '40',
            tension: 0.4,
            fill: false
          };
        }).filter(Boolean);

        if (datasets.length > 0) {
          const allTimestamps = this.counters
            .flatMap(c => this.getCounterValueOverTime(c.id))
            .map(h => h.timestamp)
            .sort((a, b) => new Date(a) - new Date(b));
          
          const uniqueTimestamps = [...new Set(allTimestamps)];

          this.charts.values = new Chart(valueCtx, {
            type: 'line',
            data: {
              labels: uniqueTimestamps.map(t => new Date(t).toLocaleDateString()),
              datasets: datasets
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

      // Daily activity chart
      const dailyCtx = document.getElementById('daily-activity-chart');
      if (dailyCtx && this.history.length > 0) {
        const dailyTrends = this.getDailyTrends();
        const counterNames = this.counters.reduce((acc, c) => {
          acc[c.id] = c.name;
          return acc;
        }, {});

        const datasets = Object.keys(counterNames).slice(0, 5).map((counterId, idx) => {
          const counter = this.counters.find(c => c.id === counterId);
          if (!counter) return null;
          
          return {
            label: counter.name,
            data: dailyTrends.map(([date]) => {
              const dayData = dailyTrends.find(([d]) => d === date)?.[1];
              return dayData?.[counterId] || 0;
            }),
            backgroundColor: counter.color + '80',
            borderColor: counter.color,
            borderWidth: 1
          };
        }).filter(Boolean);

        if (datasets.length > 0) {
          this.charts.daily = new Chart(dailyCtx, {
            type: 'bar',
            data: {
              labels: dailyTrends.map(([date]) => new Date(date).toLocaleDateString()),
              datasets: datasets
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
                  stacked: true,
                  ticks: { color: 'rgba(255, 255, 255, 0.68)' },
                  grid: { color: 'rgba(255, 255, 255, 0.1)' }
                },
                x: {
                  stacked: true,
                  ticks: { color: 'rgba(255, 255, 255, 0.68)' },
                  grid: { color: 'rgba(255, 255, 255, 0.1)' }
                }
              }
            }
          });
        }
      }
    }
  }

  getProgressPercentage(counter) {
    if (!counter.goal || counter.goal === 0) return 0;
    return Math.min(100, Math.round((counter.value / counter.goal) * 100));
  }

  render() {
    const container = document.getElementById('counter-content');
    if (!container) return;

    if (this.viewMode === 'analytics') {
      container.innerHTML = `
        <div class="counter-header">
          <h2>Counter Analytics</h2>
          <div class="counter-actions">
            <button class="btn ${this.viewMode === 'analytics' ? 'active' : ''}" onclick="counter.viewMode = 'analytics'; counter.render();">Analytics</button>
            <button class="btn ${this.viewMode === 'counters' ? 'active' : ''}" onclick="counter.viewMode = 'counters'; counter.render();">Counters</button>
            <button class="btn" onclick="counter.exportData()">Export</button>
          </div>
        </div>

        <div class="analytics-dashboard">
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-label">Total Counters</div>
              <div class="stat-value">${this.counters.length}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Total Actions</div>
              <div class="stat-value">${this.history.length}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Total Value</div>
              <div class="stat-value">${this.counters.reduce((sum, c) => sum + c.value, 0)}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Goals Completed</div>
              <div class="stat-value">${this.counters.filter(c => c.goal > 0 && c.value >= c.goal).length}</div>
            </div>
          </div>

          <div class="chart-container">
            <h3>Counter Values Over Time</h3>
            <canvas id="counter-values-chart"></canvas>
          </div>

          <div class="chart-container">
            <h3>Daily Activity (Last 30 Days)</h3>
            <canvas id="daily-activity-chart"></canvas>
          </div>
        </div>
      `;

      setTimeout(() => this.renderCharts(), 100);
    } else {
      container.innerHTML = `
        <div class="counter-header">
          <h2>Interactive Counter</h2>
          <div class="counter-actions">
            <button class="btn ${this.viewMode === 'counters' ? 'active' : ''}" onclick="counter.viewMode = 'counters'; counter.render();">Counters</button>
            <button class="btn ${this.viewMode === 'analytics' ? 'active' : ''}" onclick="counter.viewMode = 'analytics'; counter.render();">Analytics</button>
            <button class="btn" onclick="counter.exportData()">Export</button>
            <button class="btn" id="clear-counters">Clear All</button>
          </div>
        </div>

        <form id="counter-form" class="counter-form">
          <div class="form-row">
            <div class="form-group">
              <label for="name">Counter Name</label>
              <input type="text" id="name" name="name" placeholder="e.g., Push-ups" required>
            </div>
            <div class="form-group">
              <label for="initial">Initial Value</label>
              <input type="number" id="initial" name="initial" min="0" value="0">
            </div>
            <div class="form-group">
              <label for="goal">Goal (optional)</label>
              <input type="number" id="goal" name="goal" min="0" placeholder="0">
            </div>
            <div class="form-group">
              <label for="color">Color</label>
              <input type="color" id="color" name="color" value="#6EE7FF">
            </div>
          </div>
          <button type="submit" class="btn primary">Add Counter</button>
        </form>

        <div class="counters-grid">
          ${this.counters.length === 0
            ? '<p class="empty-state">No counters yet. Create one above!</p>'
            : this.counters.map(counter => {
                const progress = this.getProgressPercentage(counter);
                const hasGoal = counter.goal > 0;
                return `
                  <div class="counter-card" style="border-left: 4px solid ${counter.color}">
                    <div class="counter-header-small">
                      <h3>${counter.name}</h3>
                      <button class="btn-icon" onclick="counter.deleteCounter('${counter.id}')" title="Delete">×</button>
                    </div>
                    ${hasGoal ? `
                      <div class="counter-goal-info">
                        <div class="goal-text">Goal: ${counter.goal}</div>
                        <div class="goal-progress">
                          <div class="goal-progress-bar">
                            <div class="goal-progress-fill" style="width: ${progress}%; background: ${counter.color}"></div>
                          </div>
                          <div class="goal-percentage">${progress}%</div>
                        </div>
                      </div>
                    ` : ''}
                    <div class="counter-value">
                      <input type="number" 
                             value="${counter.value}" 
                             onchange="counter.setValue('${counter.id}', this.value)"
                             class="counter-input">
                    </div>
                    ${hasGoal && counter.value >= counter.goal ? `
                      <div class="goal-achieved">🎉 Goal Achieved!</div>
                    ` : ''}
                    <div class="counter-controls">
                      <button class="btn counter-btn" onclick="counter.decrement('${counter.id}')">−</button>
                      <button class="btn counter-btn" onclick="counter.increment('${counter.id}', 5)">+5</button>
                      <button class="btn counter-btn" onclick="counter.increment('${counter.id}')">+</button>
                    </div>
                    ${hasGoal ? `
                      <div class="counter-goal-edit">
                        <input type="number" 
                               value="${counter.goal}" 
                               placeholder="Set goal"
                               onchange="counter.setGoal('${counter.id}', this.value)"
                               class="goal-input">
                        <button class="btn counter-btn-small" onclick="counter.setGoal('${counter.id}', prompt('Enter new goal:', ${counter.goal || 0}))">Edit Goal</button>
                      </div>
                    ` : `
                      <button class="btn counter-btn-small" onclick="counter.setGoal('${counter.id}', prompt('Enter goal:', 0))">Set Goal</button>
                    `}
                  </div>
                `;
              }).join('')
          }
        </div>

        ${this.history.length > 0 ? `
          <div class="counter-history">
            <h3>Recent History</h3>
            <div class="history-list">
              ${this.history.slice(0, 20).map(entry => `
                <div class="history-item">
                  <span class="history-action">${entry.counterName}</span>
                  <span class="history-detail">${entry.action} → ${entry.value}</span>
                  <span class="history-time">${new Date(entry.timestamp).toLocaleTimeString()}</span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      `;
    }

    this.setupEventListeners();
  }
}

// Export counter instance
const counter = new Counter();
