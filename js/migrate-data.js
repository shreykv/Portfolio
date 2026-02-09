// =============================================================================
// Data Migration Utility - localStorage to Supabase
// =============================================================================
// This utility helps migrate existing localStorage data to Supabase.
// Run this once after configuring Supabase and logging in.
// =============================================================================

class DataMigration {
  constructor() {
    this.migrationLog = [];
    this.errors = [];
  }

  getSupabase() {
    return window.getSupabaseClient ? window.getSupabaseClient() : null;
  }

  getUserId() {
    return window.auth?.getUserId();
  }

  log(message, type = 'info') {
    const entry = { message, type, timestamp: new Date().toISOString() };
    this.migrationLog.push(entry);
    console.log(`[Migration ${type.toUpperCase()}] ${message}`);
  }

  // ==========================================================================
  // Check for existing localStorage data
  // ==========================================================================

  hasLocalStorageData() {
    const keys = ['gym-log', 'tournaments', 'counters', 'habits', 'tasks', 'focus-timer', 'gym-log-templates'];
    return keys.some(key => localStorage.getItem(key) !== null);
  }

  getLocalStorageStats() {
    const stats = {};
    
    // Gym log
    const gymLog = JSON.parse(localStorage.getItem('gym-log') || '[]');
    stats.workouts = Array.isArray(gymLog) ? gymLog.length : 0;
    
    // Templates
    const templates = JSON.parse(localStorage.getItem('gym-log-templates') || '[]');
    stats.templates = Array.isArray(templates) ? templates.length : 0;
    
    // Tournaments
    const tournaments = JSON.parse(localStorage.getItem('tournaments') || '[]');
    stats.tournaments = Array.isArray(tournaments) ? tournaments.length : 0;
    
    // Counters
    const countersData = JSON.parse(localStorage.getItem('counters') || '{"counters":[],"history":[]}');
    stats.counters = countersData.counters?.length || 0;
    stats.counterHistory = countersData.history?.length || 0;
    
    // Habits
    const habitsData = JSON.parse(localStorage.getItem('habits') || '{"habits":[],"entries":[]}');
    stats.habits = habitsData.habits?.length || 0;
    stats.habitEntries = habitsData.entries?.length || 0;
    
    // Tasks
    const tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
    stats.tasks = Array.isArray(tasks) ? tasks.length : 0;
    
    // Focus timer
    const focusData = JSON.parse(localStorage.getItem('focus-timer') || '{"tasks":[],"sessions":[]}');
    stats.focusTasks = focusData.tasks?.length || 0;
    stats.focusSessions = focusData.sessions?.length || 0;
    
    return stats;
  }

  // ==========================================================================
  // Migration Methods
  // ==========================================================================

  async migrateWorkouts() {
    const supabase = this.getSupabase();
    const userId = this.getUserId();
    
    if (!supabase || !userId) {
      this.log('Supabase not configured or user not logged in', 'error');
      return false;
    }

    const workouts = JSON.parse(localStorage.getItem('gym-log') || '[]');
    if (workouts.length === 0) {
      this.log('No workouts to migrate', 'info');
      return true;
    }

    this.log(`Migrating ${workouts.length} workouts...`);

    for (const workout of workouts) {
      try {
        const { error } = await supabase
          .from('workouts')
          .insert({
            user_id: userId,
            date: workout.date,
            exercise: workout.exercise,
            exercise_normalized: workout.exerciseNormalized || workout.exercise?.toLowerCase().trim(),
            category: workout.category || 'Other',
            sets: workout.sets,
            reps: workout.reps,
            weight: workout.weight,
            notes: workout.notes || null,
            created_at: workout.createdAt || new Date().toISOString()
          });

        if (error) {
          this.log(`Error migrating workout: ${error.message}`, 'error');
          this.errors.push({ type: 'workout', data: workout, error });
        }
      } catch (err) {
        this.log(`Exception migrating workout: ${err.message}`, 'error');
        this.errors.push({ type: 'workout', data: workout, error: err });
      }
    }

    this.log(`Workouts migration complete. Errors: ${this.errors.filter(e => e.type === 'workout').length}`, 'success');
    return true;
  }

  async migrateTemplates() {
    const supabase = this.getSupabase();
    const userId = this.getUserId();
    
    if (!supabase || !userId) return false;

    const templates = JSON.parse(localStorage.getItem('gym-log-templates') || '[]');
    if (templates.length === 0) {
      this.log('No templates to migrate', 'info');
      return true;
    }

    this.log(`Migrating ${templates.length} workout templates...`);

    for (const template of templates) {
      try {
        const { error } = await supabase
          .from('workout_templates')
          .insert({
            user_id: userId,
            name: template.name,
            description: template.description || null,
            exercises: template.exercises || [],
            created_at: template.createdAt || new Date().toISOString()
          });

        if (error) {
          this.log(`Error migrating template: ${error.message}`, 'error');
          this.errors.push({ type: 'template', data: template, error });
        }
      } catch (err) {
        this.log(`Exception migrating template: ${err.message}`, 'error');
        this.errors.push({ type: 'template', data: template, error: err });
      }
    }

    this.log(`Templates migration complete.`, 'success');
    return true;
  }

  async migrateTournaments() {
    const supabase = this.getSupabase();
    const userId = this.getUserId();
    
    if (!supabase || !userId) return false;

    const tournaments = JSON.parse(localStorage.getItem('tournaments') || '[]');
    if (tournaments.length === 0) {
      this.log('No tournaments to migrate', 'info');
      return true;
    }

    this.log(`Migrating ${tournaments.length} tournaments...`);

    for (const tournament of tournaments) {
      try {
        const { error } = await supabase
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
            bracket: tournament.bracket,
            created_at: tournament.createdAt || new Date().toISOString()
          });

        if (error) {
          this.log(`Error migrating tournament: ${error.message}`, 'error');
          this.errors.push({ type: 'tournament', data: tournament, error });
        }
      } catch (err) {
        this.log(`Exception migrating tournament: ${err.message}`, 'error');
        this.errors.push({ type: 'tournament', data: tournament, error: err });
      }
    }

    this.log(`Tournaments migration complete.`, 'success');
    return true;
  }

  async migrateCounters() {
    const supabase = this.getSupabase();
    const userId = this.getUserId();
    
    if (!supabase || !userId) return false;

    const data = JSON.parse(localStorage.getItem('counters') || '{"counters":[],"history":[]}');
    const counters = data.counters || [];
    const history = data.history || [];
    
    if (counters.length === 0) {
      this.log('No counters to migrate', 'info');
      return true;
    }

    this.log(`Migrating ${counters.length} counters and ${history.length} history entries...`);

    // Create a map of old IDs to new UUIDs
    const idMap = {};

    for (const counter of counters) {
      try {
        const { data: newCounter, error } = await supabase
          .from('counters')
          .insert({
            user_id: userId,
            name: counter.name,
            value: counter.value || 0,
            color: counter.color || '#6EE7FF',
            goal: counter.goal || 0,
            created_at: counter.createdAt || new Date().toISOString()
          })
          .select()
          .single();

        if (error) {
          this.log(`Error migrating counter: ${error.message}`, 'error');
          this.errors.push({ type: 'counter', data: counter, error });
        } else {
          idMap[counter.id] = newCounter.id;
        }
      } catch (err) {
        this.log(`Exception migrating counter: ${err.message}`, 'error');
        this.errors.push({ type: 'counter', data: counter, error: err });
      }
    }

    // Migrate history (limited to last 100 entries)
    const recentHistory = history.slice(0, 100);
    for (const entry of recentHistory) {
      const newCounterId = idMap[entry.counterId];
      if (!newCounterId) continue;

      try {
        const { error } = await supabase
          .from('counter_history')
          .insert({
            user_id: userId,
            counter_id: newCounterId,
            counter_name: entry.counterName,
            action: entry.action,
            value: entry.value,
            timestamp: entry.timestamp || new Date().toISOString()
          });

        if (error) {
          this.log(`Error migrating counter history: ${error.message}`, 'error');
        }
      } catch (err) {
        this.log(`Exception migrating counter history: ${err.message}`, 'error');
      }
    }

    this.log(`Counters migration complete.`, 'success');
    return true;
  }

  async migrateHabits() {
    const supabase = this.getSupabase();
    const userId = this.getUserId();
    
    if (!supabase || !userId) return false;

    const data = JSON.parse(localStorage.getItem('habits') || '{"habits":[],"entries":[]}');
    const habits = data.habits || [];
    const entries = data.entries || [];
    
    if (habits.length === 0) {
      this.log('No habits to migrate', 'info');
      return true;
    }

    this.log(`Migrating ${habits.length} habits and ${entries.length} entries...`);

    // Create a map of old IDs to new UUIDs
    const idMap = {};

    for (const habit of habits) {
      try {
        const { data: newHabit, error } = await supabase
          .from('habits')
          .insert({
            user_id: userId,
            name: habit.name,
            category: habit.category || 'General',
            color: habit.color || '#6EE7FF',
            created_at: habit.createdAt || new Date().toISOString()
          })
          .select()
          .single();

        if (error) {
          this.log(`Error migrating habit: ${error.message}`, 'error');
          this.errors.push({ type: 'habit', data: habit, error });
        } else {
          idMap[habit.id] = newHabit.id;
        }
      } catch (err) {
        this.log(`Exception migrating habit: ${err.message}`, 'error');
        this.errors.push({ type: 'habit', data: habit, error: err });
      }
    }

    // Migrate entries
    for (const entry of entries) {
      const newHabitId = idMap[entry.habitId];
      if (!newHabitId) continue;

      try {
        const { error } = await supabase
          .from('habit_entries')
          .insert({
            user_id: userId,
            habit_id: newHabitId,
            date: entry.date,
            completed_at: entry.completedAt || new Date().toISOString()
          });

        if (error && !error.message.includes('duplicate')) {
          this.log(`Error migrating habit entry: ${error.message}`, 'error');
        }
      } catch (err) {
        this.log(`Exception migrating habit entry: ${err.message}`, 'error');
      }
    }

    this.log(`Habits migration complete.`, 'success');
    return true;
  }

  async migrateTasks() {
    const supabase = this.getSupabase();
    const userId = this.getUserId();
    
    if (!supabase || !userId) return false;

    const tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
    if (tasks.length === 0) {
      this.log('No tasks to migrate', 'info');
      return true;
    }

    this.log(`Migrating ${tasks.length} tasks...`);

    for (const task of tasks) {
      try {
        const { error } = await supabase
          .from('tasks')
          .insert({
            user_id: userId,
            title: task.title,
            description: task.description || null,
            priority: task.priority || 'medium',
            due_date: task.dueDate || null,
            category: task.category || 'General',
            completed: task.completed || false,
            completed_at: task.completedAt || null,
            created_at: task.createdAt || new Date().toISOString()
          });

        if (error) {
          this.log(`Error migrating task: ${error.message}`, 'error');
          this.errors.push({ type: 'task', data: task, error });
        }
      } catch (err) {
        this.log(`Exception migrating task: ${err.message}`, 'error');
        this.errors.push({ type: 'task', data: task, error: err });
      }
    }

    this.log(`Tasks migration complete.`, 'success');
    return true;
  }

  async migrateFocusTimer() {
    const supabase = this.getSupabase();
    const userId = this.getUserId();
    
    if (!supabase || !userId) return false;

    const data = JSON.parse(localStorage.getItem('focus-timer') || '{"tasks":[],"sessions":[]}');
    const tasks = data.tasks || [];
    const sessions = data.sessions || [];
    
    if (tasks.length === 0 && sessions.length === 0) {
      this.log('No focus timer data to migrate', 'info');
      return true;
    }

    this.log(`Migrating ${tasks.length} focus tasks and ${sessions.length} sessions...`);

    // Create a map of old IDs to new UUIDs
    const idMap = {};

    for (const task of tasks) {
      try {
        const { data: newTask, error } = await supabase
          .from('focus_tasks')
          .insert({
            user_id: userId,
            title: task.title,
            description: task.description || null,
            priority: task.priority || 'medium',
            due_date: task.dueDate || null,
            category: task.category || 'General',
            completed: task.completed || false,
            completed_at: task.completedAt || null,
            created_at: task.createdAt || new Date().toISOString()
          })
          .select()
          .single();

        if (error) {
          this.log(`Error migrating focus task: ${error.message}`, 'error');
          this.errors.push({ type: 'focusTask', data: task, error });
        } else {
          idMap[task.id] = newTask.id;
        }
      } catch (err) {
        this.log(`Exception migrating focus task: ${err.message}`, 'error');
        this.errors.push({ type: 'focusTask', data: task, error: err });
      }
    }

    // Migrate sessions
    for (const session of sessions) {
      try {
        const { error } = await supabase
          .from('focus_sessions')
          .insert({
            user_id: userId,
            task_id: session.taskId ? (idMap[session.taskId] || null) : null,
            duration: session.duration,
            start_time: session.startTime,
            end_time: session.endTime,
            date: session.date
          });

        if (error) {
          this.log(`Error migrating focus session: ${error.message}`, 'error');
        }
      } catch (err) {
        this.log(`Exception migrating focus session: ${err.message}`, 'error');
      }
    }

    this.log(`Focus timer migration complete.`, 'success');
    return true;
  }

  // ==========================================================================
  // Run Full Migration
  // ==========================================================================

  async migrateAll() {
    this.migrationLog = [];
    this.errors = [];
    
    const supabase = this.getSupabase();
    const userId = this.getUserId();
    
    if (!supabase) {
      this.log('Supabase not configured. Please configure supabase-config.js first.', 'error');
      return { success: false, errors: this.errors, log: this.migrationLog };
    }

    if (!userId) {
      this.log('Not logged in. Please sign in first.', 'error');
      return { success: false, errors: this.errors, log: this.migrationLog };
    }

    this.log('Starting data migration from localStorage to Supabase...', 'info');
    this.log(`User ID: ${userId}`, 'info');

    const stats = this.getLocalStorageStats();
    this.log(`Found: ${stats.workouts} workouts, ${stats.templates} templates, ${stats.tournaments} tournaments, ${stats.counters} counters, ${stats.habits} habits, ${stats.tasks} tasks, ${stats.focusTasks} focus tasks`, 'info');

    // Run all migrations
    await this.migrateWorkouts();
    await this.migrateTemplates();
    await this.migrateTournaments();
    await this.migrateCounters();
    await this.migrateHabits();
    await this.migrateTasks();
    await this.migrateFocusTimer();

    const totalErrors = this.errors.length;
    if (totalErrors === 0) {
      this.log('✅ Migration completed successfully! All data has been migrated to Supabase.', 'success');
    } else {
      this.log(`⚠️ Migration completed with ${totalErrors} error(s). Check the errors array for details.`, 'warning');
    }

    return {
      success: totalErrors === 0,
      errors: this.errors,
      log: this.migrationLog
    };
  }

  // ==========================================================================
  // Clear localStorage (after successful migration)
  // ==========================================================================

  clearLocalStorage() {
    if (!confirm('This will delete ALL localStorage data. Make sure migration was successful! Continue?')) {
      return false;
    }

    const keys = ['gym-log', 'gym-log-templates', 'tournaments', 'counters', 'habits', 'tasks', 'focus-timer'];
    keys.forEach(key => localStorage.removeItem(key));
    
    this.log('localStorage data cleared.', 'success');
    return true;
  }

  // ==========================================================================
  // Export localStorage data (backup)
  // ==========================================================================

  exportLocalStorageBackup() {
    const backup = {
      exportedAt: new Date().toISOString(),
      'gym-log': JSON.parse(localStorage.getItem('gym-log') || '[]'),
      'gym-log-templates': JSON.parse(localStorage.getItem('gym-log-templates') || '[]'),
      'tournaments': JSON.parse(localStorage.getItem('tournaments') || '[]'),
      'counters': JSON.parse(localStorage.getItem('counters') || '{"counters":[],"history":[]}'),
      'habits': JSON.parse(localStorage.getItem('habits') || '{"habits":[],"entries":[]}'),
      'tasks': JSON.parse(localStorage.getItem('tasks') || '[]'),
      'focus-timer': JSON.parse(localStorage.getItem('focus-timer') || '{"tasks":[],"sessions":[]}')
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `localStorage-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    this.log('Backup exported successfully.', 'success');
    return backup;
  }
}

// Export migration utility
window.dataMigration = new DataMigration();

// Helper functions for console usage
window.migrateToSupabase = async () => {
  console.log('='.repeat(60));
  console.log('Data Migration: localStorage → Supabase');
  console.log('='.repeat(60));
  
  // First, export backup
  console.log('Step 1: Creating backup of localStorage data...');
  window.dataMigration.exportLocalStorageBackup();
  
  // Run migration
  console.log('\nStep 2: Starting migration...');
  const result = await window.dataMigration.migrateAll();
  
  console.log('\n' + '='.repeat(60));
  console.log('Migration Result:', result.success ? 'SUCCESS' : 'COMPLETED WITH ERRORS');
  console.log('Errors:', result.errors.length);
  console.log('='.repeat(60));
  
  return result;
};

window.checkLocalStorageData = () => {
  const stats = window.dataMigration.getLocalStorageStats();
  console.table(stats);
  return stats;
};
