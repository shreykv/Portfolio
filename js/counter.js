// Interactive Counter Mini Site
class Counter {
  constructor() {
    this.counters = [];
    this.history = [];
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
      createdAt: new Date().toISOString()
    };

    this.counters.push(counter);
    form.reset();
    await this.saveCounters();
    this.render();
  }

  increment(id) {
    const counter = this.counters.find(c => c.id === id);
    if (counter) {
      counter.value++;
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

  render() {
    const container = document.getElementById('counter-content');
    if (!container) return;

    container.innerHTML = `
      <div class="counter-header">
        <h2>Interactive Counter</h2>
        <div class="counter-actions">
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
            <label for="color">Color</label>
            <input type="color" id="color" name="color" value="#6EE7FF">
          </div>
        </div>
        <button type="submit" class="btn primary">Add Counter</button>
      </form>

      <div class="counters-grid">
        ${this.counters.length === 0
          ? '<p class="empty-state">No counters yet. Create one above!</p>'
          : this.counters.map(counter => `
            <div class="counter-card" style="border-left: 4px solid ${counter.color}">
              <div class="counter-header-small">
                <h3>${counter.name}</h3>
                <button class="btn-icon" onclick="counter.deleteCounter('${counter.id}')" title="Delete">×</button>
              </div>
              <div class="counter-value">
                <input type="number" 
                       value="${counter.value}" 
                       onchange="counter.setValue('${counter.id}', this.value)"
                       class="counter-input">
              </div>
              <div class="counter-controls">
                <button class="btn counter-btn" onclick="counter.decrement('${counter.id}')">−</button>
                <button class="btn counter-btn" onclick="counter.reset('${counter.id}')">Reset</button>
                <button class="btn counter-btn" onclick="counter.increment('${counter.id}')">+</button>
              </div>
            </div>
          `).join('')
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

    this.setupEventListeners();
  }
}

// Export counter instance
const counter = new Counter();
