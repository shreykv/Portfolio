// Task/To-Do List Mini Site
class TodoList {
  constructor() {
    this.tasks = [];
    this.filter = 'all'; // 'all', 'active', 'completed'
    this.sortBy = 'date'; // 'date', 'priority', 'name'
    this.init();
  }

  async init() {
    await this.loadTasks();
    this.render();
    this.setupEventListeners();
  }

  async loadTasks() {
    try {
      this.tasks = await api.getTasks();
      this.sortTasks();
    } catch (error) {
      console.error('Error loading tasks:', error);
      this.tasks = [];
    }
  }

  async saveTasks() {
    // Tasks are saved individually, but we'll keep them in sync
  }

  setupEventListeners() {
    const form = document.getElementById('task-form');
    if (form) {
      form.addEventListener('submit', (e) => this.handleAddTask(e));
    }

    const filterButtons = document.querySelectorAll('[data-filter]');
    filterButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.filter = e.target.getAttribute('data-filter');
        this.render();
      });
    });

    const sortSelect = document.getElementById('task-sort');
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

    const task = {
      title: formData.get('title').trim(),
      description: formData.get('description') || '',
      priority: formData.get('priority') || 'medium',
      dueDate: formData.get('dueDate') || null,
      category: formData.get('category') || 'General',
      completed: false,
      createdAt: new Date().toISOString()
    };

    try {
      await api.createTask(task);
      await this.loadTasks();
      form.reset();
      this.render();
      this.showMessage('Task added!', 'success');
    } catch (error) {
      console.error('Error adding task:', error);
      this.showMessage('Error adding task.', 'error');
    }
  }

  async toggleTask(id) {
    const task = this.tasks.find(t => t.id === id);
    if (!task) return;

    task.completed = !task.completed;
    task.completedAt = task.completed ? new Date().toISOString() : null;

    try {
      await api.updateTask(task);
      await this.loadTasks();
      this.render();
    } catch (error) {
      console.error('Error updating task:', error);
    }
  }

  async deleteTask(id) {
    if (!confirm('Delete this task?')) return;

    try {
      await api.deleteTask(id);
      await this.loadTasks();
      this.render();
      this.showMessage('Task deleted.', 'success');
    } catch (error) {
      console.error('Error deleting task:', error);
      this.showMessage('Error deleting task.', 'error');
    }
  }

  async editTask(id) {
    const task = this.tasks.find(t => t.id === id);
    if (!task) return;

    const newTitle = prompt('Edit task title:', task.title);
    if (newTitle === null) return;

    task.title = newTitle.trim();

    try {
      await api.updateTask(task);
      await this.loadTasks();
      this.render();
    } catch (error) {
      console.error('Error updating task:', error);
    }
  }

  getFilteredTasks() {
    switch (this.filter) {
      case 'active':
        return this.tasks.filter(t => !t.completed);
      case 'completed':
        return this.tasks.filter(t => t.completed);
      default:
        return this.tasks;
    }
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

  showMessage(message, type = 'info') {
    const messageEl = document.getElementById('todo-message');
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
    const container = document.getElementById('todo-list-content');
    if (!container) return;

    const filtered = this.getFilteredTasks();
    const stats = this.getTasksStats();

    container.innerHTML = `
      <div class="todo-header">
        <h2>Task Manager</h2>
        <div class="todo-actions">
          <button class="btn" onclick="todoList.exportTasks()">Export</button>
        </div>
      </div>

      <div id="todo-message" class="message" style="display:none;"></div>

      <div class="todo-stats">
        <div class="todo-stat-card">
          <div class="todo-stat-value">${stats.total}</div>
          <div class="todo-stat-label">Total</div>
        </div>
        <div class="todo-stat-card">
          <div class="todo-stat-value">${stats.active}</div>
          <div class="todo-stat-label">Active</div>
        </div>
        <div class="todo-stat-card">
          <div class="todo-stat-value">${stats.completed}</div>
          <div class="todo-stat-label">Completed</div>
        </div>
        <div class="todo-stat-card ${stats.overdue > 0 ? 'overdue' : ''}">
          <div class="todo-stat-value">${stats.overdue}</div>
          <div class="todo-stat-label">Overdue</div>
        </div>
      </div>

      <form id="task-form" class="task-form">
        <div class="form-row">
          <div class="form-group">
            <label for="task-title">Task Title</label>
            <input type="text" id="task-title" name="title" placeholder="e.g., Finish project report" required>
          </div>
          <div class="form-group">
            <label for="task-category">Category</label>
            <input type="text" id="task-category" name="category" placeholder="e.g., Work" list="task-category-list">
            <datalist id="task-category-list">
              ${this.getCategories().map(cat => `<option value="${cat}">`).join('')}
            </datalist>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="task-priority">Priority</label>
            <select id="task-priority" name="priority">
              <option value="low">Low</option>
              <option value="medium" selected>Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <div class="form-group">
            <label for="task-dueDate">Due Date</label>
            <input type="date" id="task-dueDate" name="dueDate">
          </div>
        </div>
        <div class="form-group">
          <label for="task-description">Description (optional)</label>
          <textarea id="task-description" name="description" rows="2" placeholder="Additional details..."></textarea>
        </div>
        <button type="submit" class="btn primary">Add Task</button>
      </form>

      <div class="todo-controls">
        <div class="todo-filters">
          <button class="btn ${this.filter === 'all' ? 'active' : ''}" data-filter="all">All</button>
          <button class="btn ${this.filter === 'active' ? 'active' : ''}" data-filter="active">Active</button>
          <button class="btn ${this.filter === 'completed' ? 'active' : ''}" data-filter="completed">Completed</button>
        </div>
        <div class="todo-sort">
          <label for="task-sort">Sort by:</label>
          <select id="task-sort" class="sort-select">
            <option value="date" ${this.sortBy === 'date' ? 'selected' : ''}>Due Date</option>
            <option value="priority" ${this.sortBy === 'priority' ? 'selected' : ''}>Priority</option>
            <option value="name" ${this.sortBy === 'name' ? 'selected' : ''}>Name</option>
          </select>
        </div>
      </div>

      <div class="todo-list">
        ${filtered.length === 0
          ? '<p class="empty-state">No tasks yet. Add one above!</p>'
          : filtered.map(task => {
              const overdue = this.isOverdue(task.dueDate);
              const priorityColors = {
                high: 'rgba(239, 68, 68, 0.3)',
                medium: 'rgba(245, 158, 11, 0.3)',
                low: 'rgba(34, 197, 94, 0.3)'
              };
              const priorityBorders = {
                high: 'rgba(239, 68, 68, 0.8)',
                medium: 'rgba(245, 158, 11, 0.8)',
                low: 'rgba(34, 197, 94, 0.8)'
              };
              return `
                <div class="task-card ${task.completed ? 'completed' : ''} ${overdue ? 'overdue' : ''}" 
                     style="border-left: 4px solid ${priorityBorders[task.priority] || priorityBorders.medium}">
                  <div class="task-main">
                    <div class="task-checkbox" onclick="todoList.toggleTask('${task.id}')">
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
                      </div>
                    </div>
                  </div>
                  <div class="task-actions">
                    <button class="btn-icon" onclick="todoList.editTask('${task.id}')" title="Edit">✏️</button>
                    <button class="btn-icon" onclick="todoList.deleteTask('${task.id}')" title="Delete">×</button>
                  </div>
                </div>
              `;
            }).join('')
        }
      </div>
    `;

    this.setupEventListeners();
  }

  exportTasks() {
    const data = JSON.stringify(this.tasks, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tasks-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

// Export todo list instance
const todoList = new TodoList();
