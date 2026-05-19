// =============================================================================
// API Client - Supabase Integration with localStorage Fallback
// =============================================================================
// This API client seamlessly switches between Supabase (cloud) and localStorage
// based on configuration. All data syncs across devices when using Supabase.
// =============================================================================

class API {
  constructor() {
    // Backend API base URL - configure this when backend is ready
    this.baseURL = ''; // e.g., 'https://api.example.com' or '/api'
    this.useBackend = false; // Set to true when backend is configured
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  getSupabase() {
    return window.getSupabaseClient ? window.getSupabaseClient() : null;
  }

  isSupabaseEnabled() {
    return window.SUPABASE_CONFIG?.enabled && this.getSupabase() !== null;
  }

  getUserId() {
    return window.auth?.getUserId() || null;
  }

  // Convert snake_case to camelCase
  toCamelCase(obj) {
    if (Array.isArray(obj)) {
      return obj.map(item => this.toCamelCase(item));
    }
    if (obj !== null && typeof obj === 'object') {
      return Object.keys(obj).reduce((acc, key) => {
        const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        acc[camelKey] = this.toCamelCase(obj[key]);
        return acc;
      }, {});
    }
    return obj;
  }

  // Convert camelCase to snake_case
  toSnakeCase(obj) {
    if (Array.isArray(obj)) {
      return obj.map(item => this.toSnakeCase(item));
    }
    if (obj !== null && typeof obj === 'object') {
      return Object.keys(obj).reduce((acc, key) => {
        const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        acc[snakeKey] = this.toSnakeCase(obj[key]);
        return acc;
      }, {});
    }
    return obj;
  }

  // ==========================================================================
  // Generic Request Method (supports custom backend)
  // ==========================================================================

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
      }
    }

    // Fallback to localStorage
    return this.localStorageRequest(endpoint, options);
  }

  // ==========================================================================
  // localStorage-based Request Handling (Fallback)
  // ==========================================================================

  localStorageRequest(endpoint, options) {
    const method = options.method || 'GET';
    const key = endpoint.replace(/^\/api\//, '').replace(/\//g, '_');

    if (method === 'GET') {
      const data = localStorage.getItem(key);
      if (!data) {
        if (key === 'counters') {
          return Promise.resolve({ counters: [], history: [] });
        }
        if (key === 'habits') {
          return Promise.resolve({ habits: [], entries: [] });
        }
        if (key === 'focus-timer') {
          return Promise.resolve({ tasks: [], sessions: [] });
        }
        return Promise.resolve([]);
      }
      return Promise.resolve(JSON.parse(data));
    } else if (method === 'POST') {
      if (key === 'counters' || key === 'habits' || key === 'focus-timer') {
        localStorage.setItem(key, JSON.stringify(options.body));
        return Promise.resolve(options.body);
      }
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
      if (key === 'counters' || key === 'habits' || key === 'focus-timer') {
        localStorage.setItem(key, JSON.stringify(options.body));
        return Promise.resolve(options.body);
      }
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      const updated = existing.map(item => 
        item.id === options.body.id 
          ? { ...item, ...options.body, updatedAt: new Date().toISOString() }
          : item
      );
      localStorage.setItem(key, JSON.stringify(updated));
      return Promise.resolve(options.body);
    } else if (method === 'DELETE') {
      if (key === 'counters') {
        const existing = JSON.parse(localStorage.getItem(key) || '{"counters":[],"history":[]}');
        existing.counters = existing.counters.filter(c => c.id !== options.body.id);
        localStorage.setItem(key, JSON.stringify(existing));
        return Promise.resolve({ success: true });
      }
      if (key === 'habits') {
        const existing = JSON.parse(localStorage.getItem(key) || '{"habits":[],"entries":[]}');
        existing.habits = existing.habits.filter(h => h.id !== options.body.id);
        existing.entries = existing.entries.filter(e => e.habitId !== options.body.id);
        localStorage.setItem(key, JSON.stringify(existing));
        return Promise.resolve({ success: true });
      }
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      const filtered = existing.filter(item => item.id !== options.body.id);
      localStorage.setItem(key, JSON.stringify(filtered));
      return Promise.resolve({ success: true });
    }

    return Promise.resolve(null);
  }

  // ==========================================================================
  // GYM LOG API METHODS
  // ==========================================================================

  async getWorkouts() {
    if (this.isSupabaseEnabled()) {
      const supabase = this.getSupabase();
      const { data, error } = await supabase
        .from('workouts')
        .select('*')
        .order('date', { ascending: false });
      
      if (error) {
        console.error('Error fetching workouts:', error);
        return [];
      }
      return this.toCamelCase(data);
    }
    return this.request('/api/gym-log', { method: 'GET' });
  }

  async createWorkout(workout) {
    if (this.isSupabaseEnabled()) {
      const supabase = this.getSupabase();
      const userId = this.getUserId();
      
      const { data, error } = await supabase
        .from('workouts')
        .insert({
          user_id: userId,
          date: workout.date,
          exercise: workout.exercise,
          exercise_normalized: workout.exerciseNormalized,
          categories: workout.categories || ['Other'],
          sets: workout.sets,
          reps: workout.reps,
          weight: workout.weight,
          notes: workout.notes || null
        })
        .select()
        .single();
      
      if (error) {
        console.error('Error creating workout:', error);
        throw error;
      }
      return this.toCamelCase(data);
    }
    return this.request('/api/gym-log', { method: 'POST', body: workout });
  }

  async updateWorkout(workout) {
    if (this.isSupabaseEnabled()) {
      const supabase = this.getSupabase();
      
      const { data, error } = await supabase
        .from('workouts')
        .update({
          date: workout.date,
          exercise: workout.exercise,
          exercise_normalized: workout.exerciseNormalized,
          categories: workout.categories || ['Other'],
          sets: workout.sets,
          reps: workout.reps,
          weight: workout.weight,
          notes: workout.notes || null
        })
        .eq('id', workout.id)
        .select()
        .single();
      
      if (error) {
        console.error('Error updating workout:', error);
        throw error;
      }
      return this.toCamelCase(data);
    }
    return this.request('/api/gym-log', { method: 'PUT', body: workout });
  }

  async deleteWorkout(id) {
    if (this.isSupabaseEnabled()) {
      const supabase = this.getSupabase();
      
      const { error } = await supabase
        .from('workouts')
        .delete()
        .eq('id', id);
      
      if (error) {
        console.error('Error deleting workout:', error);
        throw error;
      }
      return { success: true };
    }
    return this.request('/api/gym-log', { method: 'DELETE', body: { id } });
  }

  // ==========================================================================
  // WORKOUT TEMPLATES API METHODS
  // ==========================================================================

  async getWorkoutTemplates() {
    if (this.isSupabaseEnabled()) {
      const supabase = this.getSupabase();
      const { data, error } = await supabase
        .from('workout_templates')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching templates:', error);
        return [];
      }
      return this.toCamelCase(data);
    }
    // Fallback to localStorage
    const data = localStorage.getItem('gym-log-templates');
    return data ? JSON.parse(data) : [];
  }

  async saveWorkoutTemplates(templates) {
    if (this.isSupabaseEnabled()) {
      const supabase = this.getSupabase();
      const userId = this.getUserId();

      // Delete existing templates and re-insert
      await supabase
        .from('workout_templates')
        .delete()
        .eq('user_id', userId);

      if (templates.length > 0) {
        const rows = templates.map(t => ({
          user_id: userId,
          name: t.name,
          description: t.description || null,
          exercises: t.exercises || [],
          created_at: t.createdAt || new Date().toISOString()
        }));
        const { error } = await supabase
          .from('workout_templates')
          .insert(rows);
        if (error) {
          console.error('Error saving templates to Supabase:', error);
        }
      }
      return;
    }
    localStorage.setItem('gym-log-templates', JSON.stringify(templates));
  }

  // ==========================================================================
  // TOURNAMENT API METHODS
  // ==========================================================================

  async getTournaments() {
    if (this.isSupabaseEnabled()) {
      const supabase = this.getSupabase();
      const { data, error } = await supabase
        .from('tournaments')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching tournaments:', error);
        return [];
      }
      return this.toCamelCase(data);
    }
    return this.request('/api/tournaments', { method: 'GET' });
  }

  async createTournament(tournament) {
    if (this.isSupabaseEnabled()) {
      const supabase = this.getSupabase();
      const userId = this.getUserId();
      
      const { data, error } = await supabase
        .from('tournaments')
        .insert({
          user_id: userId,
          name: tournament.name,
          type: tournament.type,
          seeding_mode: tournament.seedingMode || 'random',
          game_mode: tournament.gameMode || 'singles',
          has_consolation: tournament.hasConsolation || false,
          participants: tournament.participants,
          final_participants: tournament.finalParticipants,
          teams: tournament.teams,
          power_rankings: tournament.powerRankings,
          bracket: tournament.bracket
        })
        .select()
        .single();
      
      if (error) {
        console.error('Error creating tournament:', error);
        throw error;
      }
      return this.toCamelCase(data);
    }
    return this.request('/api/tournaments', { method: 'POST', body: tournament });
  }

  async updateTournament(tournament) {
    if (this.isSupabaseEnabled()) {
      const supabase = this.getSupabase();
      
      const { data, error } = await supabase
        .from('tournaments')
        .update({
          name: tournament.name,
          type: tournament.type,
          seeding_mode: tournament.seedingMode,
          game_mode: tournament.gameMode,
          has_consolation: tournament.hasConsolation,
          participants: tournament.participants,
          final_participants: tournament.finalParticipants,
          teams: tournament.teams,
          power_rankings: tournament.powerRankings,
          bracket: tournament.bracket
        })
        .eq('id', tournament.id)
        .select()
        .single();
      
      if (error) {
        console.error('Error updating tournament:', error);
        throw error;
      }
      return this.toCamelCase(data);
    }
    return this.request('/api/tournaments', { method: 'PUT', body: tournament });
  }

  async deleteTournament(id) {
    if (this.isSupabaseEnabled()) {
      const supabase = this.getSupabase();
      
      const { error } = await supabase
        .from('tournaments')
        .delete()
        .eq('id', id);
      
      if (error) {
        console.error('Error deleting tournament:', error);
        throw error;
      }
      return { success: true };
    }
    return this.request('/api/tournaments', { method: 'DELETE', body: { id } });
  }

  // ==========================================================================
  // COUNTER API METHODS
  // ==========================================================================

  async getCounters() {
    if (this.isSupabaseEnabled()) {
      const supabase = this.getSupabase();
      
      // Fetch counters
      const { data: counters, error: counterError } = await supabase
        .from('counters')
        .select('*')
        .order('created_at', { ascending: true });
      
      if (counterError) {
        console.error('Error fetching counters:', counterError);
        return { counters: [], history: [] };
      }

      // Fetch history
      const { data: history, error: historyError } = await supabase
        .from('counter_history')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(100);
      
      if (historyError) {
        console.error('Error fetching counter history:', historyError);
      }

      return {
        counters: this.toCamelCase(counters) || [],
        history: this.toCamelCase(history) || []
      };
    }
    
    const data = await this.request('/api/counters', { method: 'GET' });
    if (Array.isArray(data)) {
      return { counters: [], history: [] };
    }
    return data || { counters: [], history: [] };
  }

  async saveCounters(data) {
    if (this.isSupabaseEnabled()) {
      const supabase = this.getSupabase();
      const userId = this.getUserId();

      for (const counter of data.counters) {
        if (counter.id && counter.id.length === 36) {
          await supabase
            .from('counters')
            .update({
              name: counter.name,
              value: counter.value,
              color: counter.color,
              goal: counter.goal || 0
            })
            .eq('id', counter.id);
        } else {
          const { data: inserted, error } = await supabase
            .from('counters')
            .insert({
              user_id: userId,
              name: counter.name,
              value: counter.value || 0,
              color: counter.color || '#6EE7FF',
              goal: counter.goal || 0
            })
            .select()
            .single();

          if (!error && inserted) {
            counter.id = inserted.id;
          }
        }
      }

      // Delete DB rows that no longer exist locally
      const localIds = data.counters.map(c => c.id).filter(id => id && id.length === 36);
      if (localIds.length > 0) {
        await supabase
          .from('counters')
          .delete()
          .eq('user_id', userId)
          .not('id', 'in', `(${localIds.join(',')})`);
      } else {
        await supabase
          .from('counters')
          .delete()
          .eq('user_id', userId);
      }

      return data;
    }
    return this.request('/api/counters', { method: 'POST', body: data });
  }

  async updateCounter(counter) {
    if (this.isSupabaseEnabled()) {
      const supabase = this.getSupabase();
      
      const { data, error } = await supabase
        .from('counters')
        .update({
          name: counter.name,
          value: counter.value,
          color: counter.color,
          goal: counter.goal || 0
        })
        .eq('id', counter.id)
        .select()
        .single();
      
      if (error) {
        console.error('Error updating counter:', error);
        throw error;
      }
      return this.toCamelCase(data);
    }
    return this.request('/api/counters', { method: 'PUT', body: counter });
  }

  async deleteCounter(id) {
    if (this.isSupabaseEnabled()) {
      const supabase = this.getSupabase();
      
      const { error } = await supabase
        .from('counters')
        .delete()
        .eq('id', id);
      
      if (error) {
        console.error('Error deleting counter:', error);
        throw error;
      }
      return { success: true };
    }
    return this.request('/api/counters', { method: 'DELETE', body: { id } });
  }

  async clearAllCounters() {
    if (this.isSupabaseEnabled()) {
      const supabase = this.getSupabase();
      const userId = this.getUserId();

      const { error } = await supabase
        .from('counters')
        .delete()
        .eq('user_id', userId);

      if (error) {
        console.error('Error clearing all counters:', error);
        throw error;
      }
      return { success: true };
    }
    return this.request('/api/counters', { method: 'POST', body: { counters: [], history: [] } });
  }

  async addCounterHistory(counterId, counterName, action, value) {
    if (this.isSupabaseEnabled()) {
      const supabase = this.getSupabase();
      const userId = this.getUserId();
      
      await supabase
        .from('counter_history')
        .insert({
          user_id: userId,
          counter_id: counterId,
          counter_name: counterName,
          action,
          value
        });
    }
  }

  // ==========================================================================
  // HABIT TRACKER API METHODS
  // ==========================================================================

  async getHabits() {
    if (this.isSupabaseEnabled()) {
      const supabase = this.getSupabase();
      
      const { data: habits, error: habitsError } = await supabase
        .from('habits')
        .select('*')
        .order('created_at', { ascending: true });
      
      if (habitsError) {
        console.error('Error fetching habits:', habitsError);
        return { habits: [], entries: [] };
      }

      const { data: entries, error: entriesError } = await supabase
        .from('habit_entries')
        .select('*')
        .order('date', { ascending: false });
      
      if (entriesError) {
        console.error('Error fetching habit entries:', entriesError);
      }

      return {
        habits: this.toCamelCase(habits) || [],
        entries: this.toCamelCase(entries) || []
      };
    }
    
    const data = await this.request('/api/habits', { method: 'GET' });
    if (Array.isArray(data)) {
      return { habits: [], entries: [] };
    }
    return data || { habits: [], entries: [] };
  }

  async saveHabits(data) {
    if (this.isSupabaseEnabled()) {
      // For Supabase, we handle habits and entries separately
      // This method is kept for backward compatibility
      console.log('Using saveHabits with Supabase - consider using individual methods');
    }
    return this.request('/api/habits', { method: 'POST', body: data });
  }

  async createHabit(habit) {
    if (this.isSupabaseEnabled()) {
      const supabase = this.getSupabase();
      const userId = this.getUserId();
      
      const { data, error } = await supabase
        .from('habits')
        .insert({
          user_id: userId,
          name: habit.name,
          category: habit.category || 'General',
          color: habit.color || '#6EE7FF'
        })
        .select()
        .single();
      
      if (error) {
        console.error('Error creating habit:', error);
        throw error;
      }
      return this.toCamelCase(data);
    }
  }

  async deleteHabit(id) {
    if (this.isSupabaseEnabled()) {
      const supabase = this.getSupabase();
      
      const { error } = await supabase
        .from('habits')
        .delete()
        .eq('id', id);
      
      if (error) {
        console.error('Error deleting habit:', error);
        throw error;
      }
      return { success: true };
    }
  }

  async toggleHabitEntry(habitId, date) {
    if (this.isSupabaseEnabled()) {
      const supabase = this.getSupabase();
      const userId = this.getUserId();
      
      // Check if entry exists
      const { data: existing } = await supabase
        .from('habit_entries')
        .select('id')
        .eq('habit_id', habitId)
        .eq('date', date)
        .single();
      
      if (existing) {
        // Delete entry
        await supabase
          .from('habit_entries')
          .delete()
          .eq('id', existing.id);
      } else {
        // Create entry
        await supabase
          .from('habit_entries')
          .insert({
            user_id: userId,
            habit_id: habitId,
            date
          });
      }
      return { success: true };
    }
  }

  // ==========================================================================
  // TASK / TODO LIST API METHODS
  // ==========================================================================

  async getTasks() {
    if (this.isSupabaseEnabled()) {
      const supabase = this.getSupabase();
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('due_date', { ascending: true, nullsFirst: false });
      
      if (error) {
        console.error('Error fetching tasks:', error);
        return [];
      }
      return this.toCamelCase(data);
    }
    return this.request('/api/tasks', { method: 'GET' });
  }

  async createTask(task) {
    if (this.isSupabaseEnabled()) {
      const supabase = this.getSupabase();
      const userId = this.getUserId();
      
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          user_id: userId,
          title: task.title,
          description: task.description || null,
          priority: task.priority || 'medium',
          due_date: task.dueDate || null,
          category: task.category || 'General',
          completed: task.completed || false
        })
        .select()
        .single();
      
      if (error) {
        console.error('Error creating task:', error);
        throw error;
      }
      return this.toCamelCase(data);
    }
    return this.request('/api/tasks', { method: 'POST', body: task });
  }

  async updateTask(task) {
    if (this.isSupabaseEnabled()) {
      const supabase = this.getSupabase();
      
      const { data, error } = await supabase
        .from('tasks')
        .update({
          title: task.title,
          description: task.description,
          priority: task.priority,
          due_date: task.dueDate,
          category: task.category,
          completed: task.completed,
          completed_at: task.completed ? new Date().toISOString() : null
        })
        .eq('id', task.id)
        .select()
        .single();
      
      if (error) {
        console.error('Error updating task:', error);
        throw error;
      }
      return this.toCamelCase(data);
    }
    return this.request('/api/tasks', { method: 'PUT', body: task });
  }

  async deleteTask(id) {
    if (this.isSupabaseEnabled()) {
      const supabase = this.getSupabase();
      
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', id);
      
      if (error) {
        console.error('Error deleting task:', error);
        throw error;
      }
      return { success: true };
    }
    return this.request('/api/tasks', { method: 'DELETE', body: { id } });
  }

  // ==========================================================================
  // FOCUS TIMER API METHODS
  // ==========================================================================

  async getFocusTimer() {
    if (this.isSupabaseEnabled()) {
      const supabase = this.getSupabase();
      
      const { data: tasks, error: tasksError } = await supabase
        .from('focus_tasks')
        .select('*')
        .order('due_date', { ascending: true, nullsFirst: false });
      
      if (tasksError) {
        console.error('Error fetching focus tasks:', tasksError);
        return { tasks: [], sessions: [] };
      }

      const { data: sessions, error: sessionsError } = await supabase
        .from('focus_sessions')
        .select('*')
        .order('start_time', { ascending: false })
        .limit(100);
      
      if (sessionsError) {
        console.error('Error fetching focus sessions:', sessionsError);
      }

      return {
        tasks: this.toCamelCase(tasks) || [],
        sessions: this.toCamelCase(sessions) || []
      };
    }
    
    const data = await this.request('/api/focus-timer', { method: 'GET' });
    if (Array.isArray(data)) {
      return { tasks: [], sessions: [] };
    }
    return data || { tasks: [], sessions: [] };
  }

  async saveFocusTimer(data) {
    if (this.isSupabaseEnabled()) {
      console.log('Using saveFocusTimer with Supabase - consider using individual methods');
    }
    return this.request('/api/focus-timer', { method: 'POST', body: data });
  }

  async createFocusTask(task) {
    if (this.isSupabaseEnabled()) {
      const supabase = this.getSupabase();
      const userId = this.getUserId();
      
      const { data, error } = await supabase
        .from('focus_tasks')
        .insert({
          user_id: userId,
          title: task.title,
          description: task.description || null,
          priority: task.priority || 'medium',
          due_date: task.dueDate || null,
          category: task.category || 'General',
          completed: false
        })
        .select()
        .single();
      
      if (error) {
        console.error('Error creating focus task:', error);
        throw error;
      }
      return this.toCamelCase(data);
    }
  }

  async saveFocusSession(session) {
    if (this.isSupabaseEnabled()) {
      const supabase = this.getSupabase();
      const userId = this.getUserId();
      
      const { data, error } = await supabase
        .from('focus_sessions')
        .insert({
          user_id: userId,
          task_id: session.taskId || null,
          duration: session.duration,
          start_time: session.startTime,
          end_time: session.endTime,
          date: session.date
        })
        .select()
        .single();
      
      if (error) {
        console.error('Error saving focus session:', error);
        throw error;
      }
      return this.toCamelCase(data);
    }
    
    // Fallback: append to existing data
    const current = await this.getFocusTimer();
    current.sessions.push(session);
    return this.saveFocusTimer(current);
  }

  async saveSession(session) {
    return this.saveFocusSession(session);
  }

  async updateFocusTask(task) {
    if (this.isSupabaseEnabled()) {
      const supabase = this.getSupabase();

      const { data, error } = await supabase
        .from('focus_tasks')
        .update({
          title: task.title,
          description: task.description || null,
          priority: task.priority || 'medium',
          due_date: task.dueDate || null,
          category: task.category || 'General',
          completed: task.completed,
          completed_at: task.completed ? (task.completedAt || new Date().toISOString()) : null
        })
        .eq('id', task.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating focus task:', error);
        throw error;
      }
      return this.toCamelCase(data);
    }
  }

  async deleteFocusTask(id) {
    if (this.isSupabaseEnabled()) {
      const supabase = this.getSupabase();

      const { error } = await supabase
        .from('focus_tasks')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting focus task:', error);
        throw error;
      }
      return { success: true };
    }
  }

  // ==========================================================================
  // ACTIVE TIMER API METHODS (cross-device sync)
  // ==========================================================================

  async getActiveTimer() {
    if (this.isSupabaseEnabled()) {
      const supabase = this.getSupabase();

      const { data, error } = await supabase
        .from('active_timers')
        .select('*')
        .maybeSingle();

      if (error) {
        console.error('Error fetching active timer:', error);
        return null;
      }
      return data ? this.toCamelCase(data) : null;
    }
    return null;
  }

  async upsertActiveTimer(timer) {
    if (this.isSupabaseEnabled()) {
      const supabase = this.getSupabase();
      const userId = this.getUserId();

      const { data, error } = await supabase
        .from('active_timers')
        .upsert({
          user_id: userId,
          task_id: timer.taskId || null,
          duration: timer.duration,
          remaining: timer.remaining,
          start_time: timer.startTime,
          status: timer.status
        }, { onConflict: 'user_id' })
        .select()
        .single();

      if (error) {
        console.error('Error upserting active timer:', error);
        throw error;
      }
      return this.toCamelCase(data);
    }
    return null;
  }

  async deleteActiveTimer() {
    if (this.isSupabaseEnabled()) {
      const supabase = this.getSupabase();
      const userId = this.getUserId();

      const { error } = await supabase
        .from('active_timers')
        .delete()
        .eq('user_id', userId);

      if (error) {
        console.error('Error deleting active timer:', error);
        throw error;
      }
      return { success: true };
    }
    return null;
  }

  subscribeToActiveTimer(userId, callback) {
    if (!this.isSupabaseEnabled()) return null;
    const supabase = this.getSupabase();

    const channel = supabase
      .channel('active-timer-sync')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'active_timers',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          callback(payload);
        }
      )
      .subscribe();

    return channel;
  }

  unsubscribeFromActiveTimer(channel) {
    if (channel && this.isSupabaseEnabled()) {
      const supabase = this.getSupabase();
      supabase.removeChannel(channel);
    }
  }

// ==========================================================================
  // SCREENER API METHODS
  // ==========================================================================
  // The screener tables are publicly readable (RLS USING(true)) and pushed
  // to by an external Python tool, not by site visitors. So no insert/update/
  // delete methods here — read-only from the JS side.
  // ==========================================================================

  async getLatestScreenerPicks() {
    // Always reads from the screener_latest_picks view, which auto-resolves
    // to the most recent snapshot's picks. No need to pass a snapshot ID.
    if (this.isSupabaseEnabled()) {
      const supabase = this.getSupabase();
      const { data, error } = await supabase
        .from('screener_latest_picks')
        .select('*')
        .order('strategy_key', { ascending: true })
        .order('rank', { ascending: true });

      if (error) {
        console.error('Error fetching screener picks:', error);
        return [];
      }
      return this.toCamelCase(data) || [];
    }
    // No localStorage fallback — without Supabase there's no screener data.
    return [];
  }

  async getScreenerSnapshots(limit = 20) {
    if (this.isSupabaseEnabled()) {
      const supabase = this.getSupabase();
      const { data, error } = await supabase
        .from('screener_snapshots')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching screener snapshots:', error);
        return [];
      }
      return this.toCamelCase(data) || [];
    }
    return [];
  }

  async getScreenerPriceHistory(ticker, daysBack = 90) {
    // Pulls daily closes for one ticker over the trailing window.
    // Used by the (future) performance chart.
    if (this.isSupabaseEnabled()) {
      const supabase = this.getSupabase();
      const cutoff = new Date(Date.now() - daysBack * 86400000)
        .toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from('screener_prices')
        .select('date, close, volume')
        .eq('ticker', ticker)
        .gte('date', cutoff)
        .order('date', { ascending: true });

      if (error) {
        console.error('Error fetching screener prices:', error);
        return [];
      }
      return data || [];
    }
    return [];
  }
}



// Export API instance
const api = new API();
