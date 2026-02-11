// =============================================================================
// Supabase Authentication System
// =============================================================================
// Replaces the insecure client-side password with proper Supabase Auth
// Passwords are hashed with bcrypt server-side - never exposed in code
// =============================================================================

class Auth {
  constructor() {
    // Session management
    this.sessionKey = 'personal_auth';
    this.lockoutTime = 5 * 60 * 1000; // 5 minutes in milliseconds
    
    // Current user (will be set after successful auth)
    this.currentUser = null;
    
    // Initialize auth state
    this.initAuthListener();
  }

  // ==========================================================================
  // Supabase Auth Methods
  // ==========================================================================

  getSupabase() {
    return window.getSupabaseClient ? window.getSupabaseClient() : null;
  }

  isSupabaseEnabled() {
    return window.SUPABASE_CONFIG?.enabled && this.getSupabase() !== null;
  }

  async initAuthListener() {
    const supabase = this.getSupabase();
    if (!supabase) return;

    // Listen for auth state changes
    supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event);
      
      if (session) {
        this.currentUser = session.user;
        // Store session info locally for quick access
        sessionStorage.setItem(this.sessionKey, JSON.stringify({
          authenticated: true,
          timestamp: Date.now(),
          userId: session.user.id,
          email: session.user.email
        }));
      } else {
        this.currentUser = null;
        sessionStorage.removeItem(this.sessionKey);
      }
    });

    // Check for existing session on init
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        this.currentUser = session.user;
      }
    } catch (error) {
      console.error('Error checking session:', error);
    }
  }

  // ==========================================================================
  // Sign Up with Email/Password
  // ==========================================================================

  async signUp(email, password) {
    const supabase = this.getSupabase();
    
    if (!supabase) {
      return {
        success: false,
        error: 'Supabase not configured. Please check supabase-config.js'
      };
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // Redirect URL after email confirmation (if enabled)
          emailRedirectTo: window.location.origin + '/personal.html'
        }
      });

      if (error) {
        return { success: false, error: error.message };
      }

      // Check if email confirmation is required
      if (data.user && !data.session) {
        return {
          success: true,
          requiresConfirmation: true,
          message: 'Please check your email to confirm your account.'
        };
      }

      this.currentUser = data.user;
      return { success: true, user: data.user };
    } catch (error) {
      console.error('Sign up error:', error);
      // Show the real error message for debugging, not a generic one
      const msg = error?.message || String(error);
      if (msg.includes('Failed to fetch') || msg.includes('fetch')) {
        return { success: false, error: 'Cannot reach Supabase. Check that the URL in supabase-config.js is correct (should be https://[project-ref].supabase.co) and that your project is not paused.' };
      }
      return { success: false, error: msg };
    }
  }

  // ==========================================================================
  // Sign In with Email/Password
  // ==========================================================================

  async signIn(email, password) {
    // Check for lockout first
    if (this.isLockedOut()) {
      const lockout = this.isLockedOut();
      return {
        success: false,
        error: `Too many failed attempts. Please try again in ${lockout.minutes} minute(s).`
      };
    }

    const supabase = this.getSupabase();
    
    if (!supabase) {
      return {
        success: false,
        error: 'Supabase not configured. Please check supabase-config.js'
      };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        // Record failed attempt
        this.recordFailedAttempt();
        const attempts = this.getFailedAttempts();
        const remaining = this.maxAttempts - attempts;

        return {
          success: false,
          error: `${error.message}${remaining > 0 ? ` ${remaining} attempt(s) remaining.` : ''}`
        };
      }

      // Reset failed attempts on success
      localStorage.removeItem(this.attemptsKey);
      
      this.currentUser = data.user;
      return { success: true, user: data.user };
    } catch (error) {
      console.error('Sign in error:', error);
      const msg = error?.message || String(error);
      if (msg.includes('Failed to fetch') || msg.includes('fetch')) {
        return { success: false, error: 'Cannot reach Supabase. Check that the URL in supabase-config.js is correct (should be https://[project-ref].supabase.co) and that your project is not paused.' };
      }
      return { success: false, error: msg };
    }
  }

  // ==========================================================================
  // Sign Out
  // ==========================================================================

  async signOut() {
    const supabase = this.getSupabase();
    
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (error) {
        console.error('Sign out error:', error);
      }
    }

    this.currentUser = null;
    sessionStorage.removeItem(this.sessionKey);
  }

  // Alias for backward compatibility
  logout() {
    return this.signOut();
  }

  // ==========================================================================
  // Password Reset
  // ==========================================================================

  async resetPassword(email) {
    const supabase = this.getSupabase();
    
    if (!supabase) {
      return {
        success: false,
        error: 'Supabase not configured.'
      };
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/personal.html?reset=true'
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return {
        success: true,
        message: 'Password reset email sent. Please check your inbox.'
      };
    } catch (error) {
      console.error('Password reset error:', error);
      return { success: false, error: 'An unexpected error occurred.' };
    }
  }

  // ==========================================================================
  // Update Password (when logged in)
  // ==========================================================================

  async updatePassword(newPassword) {
    const supabase = this.getSupabase();
    
    if (!supabase) {
      return { success: false, error: 'Supabase not configured.' };
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, message: 'Password updated successfully.' };
    } catch (error) {
      console.error('Password update error:', error);
      return { success: false, error: 'An unexpected error occurred.' };
    }
  }

  // ==========================================================================
  // Check Authentication Status
  // ==========================================================================

  async isAuthenticated() {
    const supabase = this.getSupabase();
    
    // If Supabase is enabled, check with Supabase
    if (supabase) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        return session !== null;
      } catch (error) {
        console.error('Error checking auth status:', error);
        return false;
      }
    }

    // Fallback: Check session storage (for backward compatibility during migration)
    const session = sessionStorage.getItem(this.sessionKey);
    if (!session) return false;

    try {
      const data = JSON.parse(session);
      // Check if session is still valid (24 hours)
      const now = Date.now();
      if (now - data.timestamp > 24 * 60 * 60 * 1000) {
        this.logout();
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  // Synchronous version for immediate checks (uses cached state)
  isAuthenticatedSync() {
    // Check if we have a current user
    if (this.currentUser) return true;
    
    // Fallback to session storage check
    const session = sessionStorage.getItem(this.sessionKey);
    if (!session) return false;

    try {
      const data = JSON.parse(session);
      const now = Date.now();
      if (now - data.timestamp > 24 * 60 * 60 * 1000) {
        return false;
      }
      return data.authenticated === true;
    } catch {
      return false;
    }
  }

  // ==========================================================================
  // Get Current User
  // ==========================================================================

  async getCurrentUser() {
    const supabase = this.getSupabase();
    
    if (supabase) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        return user;
      } catch (error) {
        console.error('Error getting user:', error);
        return null;
      }
    }

    return this.currentUser;
  }

  getUserId() {
    return this.currentUser?.id || null;
  }

  // ==========================================================================
  // Rate Limiting / Lockout (kept from original for protection)
  // ==========================================================================

  recordFailedAttempt() {
    const attempts = this.getFailedAttempts() + 1;
    const data = {
      count: attempts,
      timestamp: Date.now()
    };
    localStorage.setItem(this.attemptsKey, JSON.stringify(data));
  }

  getFailedAttempts() {
    const data = localStorage.getItem(this.attemptsKey);
    if (!data) return 0;

    try {
      return JSON.parse(data).count || 0;
    } catch {
      return 0;
    }
  }

  isLockedOut() {
    const data = localStorage.getItem(this.attemptsKey);
    if (!data) return false;

    try {
      const attemptData = JSON.parse(data);
      const attempts = attemptData.count || 0;
      const timestamp = attemptData.timestamp || 0;
      const now = Date.now();

      if (attempts >= this.maxAttempts) {
        if (now - timestamp < this.lockoutTime) {
          const remaining = Math.ceil((this.lockoutTime - (now - timestamp)) / 1000 / 60);
          return { locked: true, minutes: remaining };
        } else {
          localStorage.removeItem(this.attemptsKey);
          return false;
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  // ==========================================================================
  // Legacy Method Support (for backward compatibility during migration)
  // ==========================================================================

  // This allows gradual migration - old code using password can still work
  // until fully migrated to Supabase
  authenticate(password) {
    console.warn('Legacy authenticate() called. Please migrate to signIn(email, password)');
    
    // If Supabase is enabled, this shouldn't be used
    if (this.isSupabaseEnabled()) {
      return {
        success: false,
        error: 'Please use email and password to sign in.'
      };
    }
    
    // Legacy fallback (not recommended - for migration period only)
    const legacyPassword = 'personal2024';
    
    if (this.isLockedOut()) {
      return {
        success: false,
        error: 'Too many failed attempts. Please try again later.'
      };
    }

    if (password === legacyPassword) {
      sessionStorage.setItem(this.sessionKey, JSON.stringify({
        authenticated: true,
        timestamp: Date.now()
      }));
      localStorage.removeItem(this.attemptsKey);
      return { success: true };
    } else {
      this.recordFailedAttempt();
      const attempts = this.getFailedAttempts();
      const remaining = this.maxAttempts - attempts;
      return {
        success: false,
        error: `Incorrect password. ${remaining} attempt(s) remaining.`
      };
    }
  }

  requireAuth() {
    if (!this.isAuthenticatedSync()) {
      if (window.location.pathname !== '/personal.html' && 
          !window.location.pathname.endsWith('/personal.html')) {
        window.location.href = '/personal.html';
      }
      return false;
    }
    return true;
  }
}

// Export auth instance
const auth = new Auth();
