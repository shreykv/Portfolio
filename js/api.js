// API client for backend integration with localStorage fallback
class API {
  constructor() {
    // Backend API base URL - configure this when backend is ready
    this.baseURL = ''; // e.g., 'https://api.example.com' or '/api'
    this.useBackend = false; // Set to true when backend is configured
  }

  // Generic request method
  async request(endpoint, options = {}) {
    const url = this.useBackend && this.baseURL 
      ? `${this.baseURL}${endpoint}` 
      : null;

    // Try backend first if configured
    if (url) {
      try {
        const response = await fetch(url, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            ...options.headers
          }
        });

        if (response.ok) {
          return await response.json();
        }
      } catch (error) {
        console.warn('Backend request failed, falling back to localStorage:', error);
        // Fall through to localStorage
      }
    }

    // Fallback to localStorage
    return this.localStorageRequest(endpoint, options);
  }

  // localStorage-based request handling
  localStorageRequest(endpoint, options) {
    const method = options.method || 'GET';
    const key = endpoint.replace(/^\/api\//, '').replace(/\//g, '_');

    if (method === 'GET') {
      const data = localStorage.getItem(key);
      if (!data) {
        // Return appropriate default based on endpoint
        if (key === 'counters') {
          return Promise.resolve({ counters: [], history: [] });
        }
        return Promise.resolve([]);
      }
      return Promise.resolve(JSON.parse(data));
    } else if (method === 'POST') {
      // Special handling for counters (stores object, not array)
      if (key === 'counters') {
        localStorage.setItem(key, JSON.stringify(options.body));
        return Promise.resolve(options.body);
      }
      // Regular array-based storage for other endpoints
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      const newItem = {
        id: Date.now().toString(),
        ...options.body,
        createdAt: new Date().toISOString()
      };
      existing.push(newItem);
      localStorage.setItem(key, JSON.stringify(existing));
      return Promise.resolve(newItem);
    } else if (method === 'PUT') {
      // Special handling for counters
      if (key === 'counters') {
        localStorage.setItem(key, JSON.stringify(options.body));
        return Promise.resolve(options.body);
      }
      // Regular array-based update
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      const updated = existing.map(item => 
        item.id === options.body.id 
          ? { ...item, ...options.body, updatedAt: new Date().toISOString() }
          : item
      );
      localStorage.setItem(key, JSON.stringify(updated));
      return Promise.resolve(options.body);
    } else if (method === 'DELETE') {
      // Special handling for counters
      if (key === 'counters') {
        // For counters, we don't delete the whole storage, just update
        const existing = JSON.parse(localStorage.getItem(key) || '{"counters":[],"history":[]}');
        existing.counters = existing.counters.filter(c => c.id !== options.body.id);
        localStorage.setItem(key, JSON.stringify(existing));
        return Promise.resolve({ success: true });
      }
      // Regular array-based delete
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      const filtered = existing.filter(item => item.id !== options.body.id);
      localStorage.setItem(key, JSON.stringify(filtered));
      return Promise.resolve({ success: true });
    }

    return Promise.resolve(null);
  }

  // Gym Log API methods
  async getWorkouts() {
    return this.request('/api/gym-log', { method: 'GET' });
  }

  async createWorkout(workout) {
    return this.request('/api/gym-log', {
      method: 'POST',
      body: workout
    });
  }

  async updateWorkout(workout) {
    return this.request('/api/gym-log', {
      method: 'PUT',
      body: workout
    });
  }

  async deleteWorkout(id) {
    return this.request('/api/gym-log', {
      method: 'DELETE',
      body: { id }
    });
  }

  // Tournament API methods
  async getTournaments() {
    return this.request('/api/tournaments', { method: 'GET' });
  }

  async createTournament(tournament) {
    return this.request('/api/tournaments', {
      method: 'POST',
      body: tournament
    });
  }

  async updateTournament(tournament) {
    return this.request('/api/tournaments', {
      method: 'PUT',
      body: tournament
    });
  }

  async deleteTournament(id) {
    return this.request('/api/tournaments', {
      method: 'DELETE',
      body: { id }
    });
  }

  // Counter API methods
  async getCounters() {
    const data = await this.request('/api/counters', { method: 'GET' });
    // Handle both array (old format) and object (new format) responses
    if (Array.isArray(data)) {
      return { counters: [], history: [] };
    }
    return data || { counters: [], history: [] };
  }

  async saveCounters(data) {
    // For counters, we store the entire data object
    return this.request('/api/counters', {
      method: 'POST',
      body: data
    });
  }

  async updateCounter(counter) {
    return this.request('/api/counters', {
      method: 'PUT',
      body: counter
    });
  }

  async deleteCounter(id) {
    return this.request('/api/counters', {
      method: 'DELETE',
      body: { id }
    });
  }
}

// Export API instance
const api = new API();
