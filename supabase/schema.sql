-- =============================================================================
-- Supabase Database Schema for Portfolio Personal Mini-Sites
-- =============================================================================
-- This schema creates all necessary tables with Row Level Security (RLS) enabled.
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- =============================================================================

-- =============================================================================
-- 1. GYM LOG TABLES
-- =============================================================================

-- Workouts table
CREATE TABLE IF NOT EXISTS workouts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  exercise TEXT NOT NULL,
  exercise_normalized TEXT NOT NULL,
  categories TEXT[] DEFAULT '{Other}',
  sets INTEGER NOT NULL,
  reps INTEGER NOT NULL,
  weight DECIMAL(10, 2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migration: If upgrading from single category to multi-category, run:
-- ALTER TABLE workouts ADD COLUMN categories TEXT[] DEFAULT '{Other}';
-- UPDATE workouts SET categories = ARRAY[category] WHERE category IS NOT NULL;
-- ALTER TABLE workouts DROP COLUMN category;

-- Workout templates table
CREATE TABLE IF NOT EXISTS workout_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  exercises JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 2. TOURNAMENT TABLES
-- =============================================================================

CREATE TABLE IF NOT EXISTS tournaments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'single-elimination', 'double-elimination', 'round-robin'
  seeding_mode TEXT DEFAULT 'random', -- 'random', 'ranked'
  game_mode TEXT DEFAULT 'singles', -- 'singles', 'doubles'
  has_consolation BOOLEAN DEFAULT FALSE,
  participants JSONB NOT NULL DEFAULT '[]', -- Array of participant names
  final_participants JSONB, -- For doubles: array of team names
  teams JSONB, -- Team compositions for doubles
  power_rankings JSONB, -- { offense: [], defense: [] }
  bracket JSONB NOT NULL, -- Complete bracket structure
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 3. COUNTER TABLES
-- =============================================================================

CREATE TABLE IF NOT EXISTS counters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  value INTEGER DEFAULT 0,
  color TEXT DEFAULT '#6EE7FF',
  goal INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS counter_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  counter_id UUID REFERENCES counters(id) ON DELETE CASCADE NOT NULL,
  counter_name TEXT NOT NULL,
  action TEXT NOT NULL, -- 'increment', 'decrement', 'reset', 'set'
  value INTEGER NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 4. HABIT TRACKER TABLES
-- =============================================================================

CREATE TABLE IF NOT EXISTS habits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'General',
  color TEXT DEFAULT '#6EE7FF',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS habit_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  habit_id UUID REFERENCES habits(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(habit_id, date) -- Prevent duplicate entries for same habit/date
);

-- =============================================================================
-- 5. TASK / TODO LIST TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'medium', -- 'low', 'medium', 'high'
  due_date DATE,
  category TEXT DEFAULT 'General',
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 6. FOCUS TIMER TABLES
-- =============================================================================

CREATE TABLE IF NOT EXISTS focus_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'medium',
  due_date DATE,
  category TEXT DEFAULT 'General',
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS focus_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  task_id UUID REFERENCES focus_tasks(id) ON DELETE SET NULL,
  duration INTEGER NOT NULL, -- Duration in seconds
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  date DATE NOT NULL
);

-- =============================================================================
-- 7. ACTIVE TIMER TABLE (for cross-device timer sync via Realtime)
-- =============================================================================

CREATE TABLE IF NOT EXISTS active_timers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  task_id UUID REFERENCES focus_tasks(id) ON DELETE SET NULL,
  duration INTEGER NOT NULL,        -- total duration in seconds
  remaining INTEGER NOT NULL,       -- remaining seconds (snapshot on pause/start)
  start_time TIMESTAMPTZ NOT NULL,  -- when the timer was last started/resumed
  status TEXT NOT NULL DEFAULT 'running',  -- 'running' or 'paused'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE counter_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE habit_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE focus_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE focus_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_timers ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- WORKOUTS POLICIES
-- =============================================================================
CREATE POLICY "Users can view own workouts" ON workouts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own workouts" ON workouts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own workouts" ON workouts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own workouts" ON workouts
  FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- WORKOUT TEMPLATES POLICIES
-- =============================================================================
CREATE POLICY "Users can view own workout templates" ON workout_templates
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own workout templates" ON workout_templates
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own workout templates" ON workout_templates
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own workout templates" ON workout_templates
  FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- TOURNAMENTS POLICIES
-- =============================================================================
CREATE POLICY "Users can view own tournaments" ON tournaments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tournaments" ON tournaments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tournaments" ON tournaments
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tournaments" ON tournaments
  FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- COUNTERS POLICIES
-- =============================================================================
CREATE POLICY "Users can view own counters" ON counters
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own counters" ON counters
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own counters" ON counters
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own counters" ON counters
  FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- COUNTER HISTORY POLICIES
-- =============================================================================
CREATE POLICY "Users can view own counter history" ON counter_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own counter history" ON counter_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own counter history" ON counter_history
  FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- HABITS POLICIES
-- =============================================================================
CREATE POLICY "Users can view own habits" ON habits
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own habits" ON habits
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own habits" ON habits
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own habits" ON habits
  FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- HABIT ENTRIES POLICIES
-- =============================================================================
CREATE POLICY "Users can view own habit entries" ON habit_entries
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own habit entries" ON habit_entries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own habit entries" ON habit_entries
  FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- TASKS POLICIES
-- =============================================================================
CREATE POLICY "Users can view own tasks" ON tasks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tasks" ON tasks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tasks" ON tasks
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tasks" ON tasks
  FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- FOCUS TASKS POLICIES
-- =============================================================================
CREATE POLICY "Users can view own focus tasks" ON focus_tasks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own focus tasks" ON focus_tasks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own focus tasks" ON focus_tasks
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own focus tasks" ON focus_tasks
  FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- FOCUS SESSIONS POLICIES
-- =============================================================================
CREATE POLICY "Users can view own focus sessions" ON focus_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own focus sessions" ON focus_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own focus sessions" ON focus_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- ACTIVE TIMERS POLICIES
-- =============================================================================
CREATE POLICY "Users can view own active timers" ON active_timers
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own active timers" ON active_timers
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own active timers" ON active_timers
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own active timers" ON active_timers
  FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- Workouts indexes
CREATE INDEX IF NOT EXISTS idx_workouts_user_id ON workouts(user_id);
CREATE INDEX IF NOT EXISTS idx_workouts_date ON workouts(date DESC);
CREATE INDEX IF NOT EXISTS idx_workouts_exercise ON workouts(exercise_normalized);

-- Templates indexes
CREATE INDEX IF NOT EXISTS idx_workout_templates_user_id ON workout_templates(user_id);

-- Tournaments indexes
CREATE INDEX IF NOT EXISTS idx_tournaments_user_id ON tournaments(user_id);

-- Counters indexes
CREATE INDEX IF NOT EXISTS idx_counters_user_id ON counters(user_id);
CREATE INDEX IF NOT EXISTS idx_counter_history_user_id ON counter_history(user_id);
CREATE INDEX IF NOT EXISTS idx_counter_history_counter_id ON counter_history(counter_id);

-- Habits indexes
CREATE INDEX IF NOT EXISTS idx_habits_user_id ON habits(user_id);
CREATE INDEX IF NOT EXISTS idx_habit_entries_user_id ON habit_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_habit_entries_habit_id ON habit_entries(habit_id);
CREATE INDEX IF NOT EXISTS idx_habit_entries_date ON habit_entries(date DESC);

-- Tasks indexes
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(completed);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);

-- Focus timer indexes
CREATE INDEX IF NOT EXISTS idx_focus_tasks_user_id ON focus_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_user_id ON focus_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_task_id ON focus_sessions(task_id);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_date ON focus_sessions(date DESC);

-- Active timers indexes
CREATE INDEX IF NOT EXISTS idx_active_timers_user_id ON active_timers(user_id);

-- =============================================================================
-- HELPER FUNCTIONS (Optional but useful)
-- =============================================================================

-- Function to automatically set updated_at timestamp
-- SET search_path = '' prevents the "mutable search_path" security warning
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_workouts_updated_at
  BEFORE UPDATE ON workouts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workout_templates_updated_at
  BEFORE UPDATE ON workout_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tournaments_updated_at
  BEFORE UPDATE ON tournaments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_counters_updated_at
  BEFORE UPDATE ON counters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_focus_tasks_updated_at
  BEFORE UPDATE ON focus_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_active_timers_updated_at
  BEFORE UPDATE ON active_timers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- REALTIME (Enable for cross-device timer sync)
-- =============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE active_timers;

-- =============================================================================
-- VERIFICATION QUERY (Run after creating tables to verify)
-- =============================================================================
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' 
-- ORDER BY table_name;

-- =============================================================================
-- NOTES:
-- 1. Run this SQL in your Supabase Dashboard > SQL Editor
-- 2. After running, go to Authentication > URL Configuration and add your 
--    GitHub Pages domain to the allowed origins
-- 3. Get your anon key from Settings > API
-- 4. NEVER expose your service_role key in frontend code
-- =============================================================================
