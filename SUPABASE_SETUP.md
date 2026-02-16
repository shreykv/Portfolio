# Supabase Setup Guide

This guide walks you through setting up Supabase for multi-device data sync on your portfolio's personal mini-sites.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Create a Supabase Project](#create-a-supabase-project)
3. [Set Up the Database](#set-up-the-database)
4. [Configure Authentication](#configure-authentication)
5. [Configure Your App](#configure-your-app)
6. [Migrate Existing Data](#migrate-existing-data)
7. [Add Your Domain to Allowed Origins](#add-your-domain-to-allowed-origins)
8. [Testing](#testing)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- A Supabase account (free tier is sufficient)
- Your portfolio deployed to GitHub Pages (or similar)
- Existing localStorage data (optional - can be migrated)

---

## Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click **New Project**
3. Fill in the details:
   - **Name**: `portfolio-personal` (or any name you prefer)
   - **Database Password**: Generate a strong password and save it
   - **Region**: Choose the closest region to you
4. Click **Create new project** and wait for it to provision (~2 minutes)

---

## Set Up the Database

### Step 1: Run the Schema SQL

1. In your Supabase Dashboard, go to **SQL Editor** (left sidebar)
2. Click **New query**
3. Open `supabase/schema.sql` from your repository
4. Copy the entire contents and paste into the SQL Editor
5. Click **Run** (or press Ctrl+Enter)
6. You should see "Success. No rows returned" for each statement

### Step 2: Verify Tables Were Created

1. Go to **Table Editor** (left sidebar)
2. You should see these tables:
   - `workouts`
   - `workout_templates`
   - `tournaments`
   - `counters`
   - `counter_history`
   - `habits`
   - `habit_entries`
   - `tasks`
   - `focus_tasks`
   - `focus_sessions`
   - `active_timers`

### Step 3: Verify Realtime is Enabled for Active Timers

The `active_timers` table uses Supabase Realtime for cross-device timer sync. The schema SQL includes `ALTER PUBLICATION supabase_realtime ADD TABLE active_timers;` which enables this automatically. To verify:

1. Go to **Database** → **Replication** in the Supabase Dashboard
2. Under "Realtime", confirm that `active_timers` is listed
3. If it's not listed, run this SQL manually:
   ```sql
   ALTER PUBLICATION supabase_realtime ADD TABLE active_timers;
   ```

### Step 4: Verify RLS is Enabled

1. Click on any table (e.g., `workouts`)
2. Go to **RLS** tab (at the top)
3. You should see:
   - RLS Status: **Enabled** ✓
   - 4 policies listed (SELECT, INSERT, UPDATE, DELETE)

---

## Configure Authentication

### Step 1: Enable Email Auth

1. Go to **Authentication** → **Providers**
2. Ensure **Email** is enabled (it should be by default)
3. Configure settings:
   - **Enable email confirmations**: Optional (recommended OFF for personal use)
   - **Enable email change**: Yes
   - **Enable password recovery**: Yes

### Step 2: Configure Email Templates (Optional)

1. Go to **Authentication** → **Email Templates**
2. Customize the confirmation and reset password email templates if desired

### Step 3: Set Site URL

1. Go to **Authentication** → **URL Configuration**
2. Set **Site URL** to your GitHub Pages URL:
   ```
   https://shreykv.github.io/personl
   ```

---

## Configure Your App

### Step 1: Get Your API Credentials

1. Go to **Settings** → **API**
2. Find these values:
   - **Project URL**: `https://xxxxxxxxx.supabase.co`
   - **anon (public) key**: `eyJhbGciOiJIUzI1NiIs...` (long string)

⚠️ **NEVER use the `service_role` key in frontend code!**

### Step 2: Update supabase-config.js

Open `js/supabase-config.js` and update:

```javascript
const SUPABASE_CONFIG = {
  // Your Supabase project URL
  url: 'https://xxxxxxxxx.supabase.co',  // ← Replace with your Project URL
  
  // Your Supabase anon key
  anonKey: 'eyJhbGciOiJIUzI1NiIs...',  // ← Replace with your anon key
  
  // Enable Supabase integration
  enabled: true  // ← Change to true
};
```

### Step 3: Commit and Deploy

```bash
git add js/supabase-config.js
git commit -m "Configure Supabase integration"
git push
```

---

## Migrate Existing Data

If you have existing data in localStorage that you want to keep:

### Option 1: Automatic Migration (Recommended)

1. Open your site in a browser
2. Sign in with your new Supabase account (or create one)
3. You'll be prompted: "Found existing local data. Would you like to migrate it to the cloud?"
4. Click **OK** to migrate
5. A backup JSON file will be downloaded first
6. Migration will proceed automatically

### Option 2: Manual Migration (Console)

1. Open browser DevTools (F12)
2. Go to Console tab
3. Run:
   ```javascript
   // First, export a backup
   window.dataMigration.exportLocalStorageBackup();
   
   // Then run migration
   await window.migrateToSupabase();
   ```

### Option 3: Check Migration Status

```javascript
// Check what data exists locally
window.checkLocalStorageData();

// View migration log
window.dataMigration.migrationLog;

// View any errors
window.dataMigration.errors;
```

### After Successful Migration

Once migration is complete and verified, you can clear localStorage:

```javascript
// Only do this after confirming migration was successful!
window.dataMigration.clearLocalStorage();
```

---

## Add Your Domain to Allowed Origins

1. Go to **Authentication** → **URL Configuration**
2. Under **Redirect URLs**, add:
   ```
   https://yourusername.github.io/*
   https://yourusername.github.io/personal.html
   ```
3. If testing locally, also add:
   ```
   http://localhost:8000/*
   http://127.0.0.1:8000/*
   ```

---

## Testing

### Test Sign Up

1. Open your site
2. Click "Sign Up" tab
3. Enter a valid email and password (min 6 characters)
4. Click "Create Account"
5. If email confirmation is enabled, check your email

### Test Sign In

1. Enter your email and password
2. Click "Sign In"
3. You should see the dashboard

### Test Data Sync

1. Add some data (e.g., log a workout)
2. Open the site on another device or browser
3. Sign in with the same account
4. Your data should appear!

### Verify in Supabase Dashboard

1. Go to **Table Editor** → `workouts`
2. You should see your logged workouts
3. Each row has a `user_id` matching your auth user ID

---

## Troubleshooting

### "Supabase not configured" message

- Check that `supabase-config.js` has `enabled: true`
- Verify your URL and anon key are correct
- Make sure the Supabase JS library is loading (check Network tab)

### "Invalid API key" error

- Double-check you copied the `anon` key, not `service_role`
- Ensure there are no extra spaces in the key

### "Permission denied" or "RLS" errors

- Verify RLS policies were created (check Table Editor → RLS tab)
- Make sure you're signed in (check `auth.isAuthenticated()`)
- Try running the schema SQL again

### Data not syncing

- Check browser console for errors
- Verify you're signed in on both devices
- Check Network tab for failed API requests

### Focus timer not syncing across devices

- The active timer uses Supabase Realtime. Verify Realtime is enabled for `active_timers` (see Step 3 above)
- Check browser console for WebSocket errors
- Ensure both devices are signed in to the same account
- Timer state syncs on start, pause, resume, and stop -- the countdown display runs locally on each device

### Can't sign in after sign up

- If email confirmation is enabled, check spam folder
- You can disable confirmation in Authentication → Providers → Email

### Migration failed

- Check `window.dataMigration.errors` for details
- Your backup JSON file was downloaded - you can restore from it
- Try migrating one category at a time:
  ```javascript
  await window.dataMigration.migrateWorkouts();
  await window.dataMigration.migrateCounters();
  // etc.
  ```

---

## Security Notes

### What's Protected by RLS

- All tables have Row Level Security enabled
- Users can ONLY access their own data
- The `user_id` column in every table enforces this

### Safe to Expose

- ✅ Supabase project URL
- ✅ Supabase `anon` key
- ✅ Table names

### Never Expose

- ❌ `service_role` key
- ❌ Database password
- ❌ User passwords (handled by Supabase)

### How Passwords are Secured

- Passwords are hashed with **bcrypt** by Supabase
- You never see or store raw passwords
- Password hashes are stored in Supabase's `auth.users` table (not accessible)

---

## Costs & Limits (Free Tier)

| Resource | Free Tier Limit |
|----------|-----------------|
| Database | 500 MB |
| Auth users | 50,000 MAU |
| Storage | 1 GB |
| API requests | Unlimited* |
| Realtime connections | 200 concurrent |
| Realtime messages | 2 million/month |
| Projects | 2 |

*Fair use policy applies

For personal use, the free tier is more than sufficient! The focus timer sync uses Realtime but generates only ~4 messages per timer session, well within limits.

---

## File Structure

After setup, your relevant files are:

```
js/
├── supabase-config.js    # ← Your Supabase credentials (edit this)
├── auth.js               # ← Handles authentication
├── api.js                # ← API calls (Supabase or localStorage)
├── migrate-data.js       # ← Data migration utility
└── [other mini-site files]

supabase/
└── schema.sql            # ← Database schema (run once in SQL Editor)
```

---

## Need Help?

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Discord](https://discord.supabase.com)
- Check browser console for detailed error messages
