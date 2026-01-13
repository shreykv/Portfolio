// Password authentication system
class Auth {
  constructor() {
    // Default password - should be changed in production
    // For GitHub Pages, consider using environment variables or a config file
    this.password = 'personal2024'; // Change this to your desired password
    this.sessionKey = 'personal_auth';
    this.attemptsKey = 'auth_attempts';
    this.maxAttempts = 5;
    this.lockoutTime = 5 * 60 * 1000; // 5 minutes in milliseconds
  }

  // Check if user is authenticated
  isAuthenticated() {
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

  // Authenticate with password
  authenticate(password) {
    // Check for lockout
    if (this.isLockedOut()) {
      return {
        success: false,
        error: 'Too many failed attempts. Please try again later.'
      };
    }

    if (password === this.password) {
      // Store session
      sessionStorage.setItem(this.sessionKey, JSON.stringify({
        authenticated: true,
        timestamp: Date.now()
      }));

      // Reset attempts
      localStorage.removeItem(this.attemptsKey);
      return { success: true };
    } else {
      // Record failed attempt
      this.recordFailedAttempt();
      const attempts = this.getFailedAttempts();
      const remaining = this.maxAttempts - attempts;

      return {
        success: false,
        error: `Incorrect password. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`
      };
    }
  }

  // Logout
  logout() {
    sessionStorage.removeItem(this.sessionKey);
  }

  // Record failed login attempt
  recordFailedAttempt() {
    const attempts = this.getFailedAttempts() + 1;
    const data = {
      count: attempts,
      timestamp: Date.now()
    };
    localStorage.setItem(this.attemptsKey, JSON.stringify(data));
  }

  // Get number of failed attempts
  getFailedAttempts() {
    const data = localStorage.getItem(this.attemptsKey);
    if (!data) return 0;

    try {
      return JSON.parse(data).count || 0;
    } catch {
      return 0;
    }
  }

  // Check if account is locked out
  isLockedOut() {
    const data = localStorage.getItem(this.attemptsKey);
    if (!data) return false;

    try {
      const attemptData = JSON.parse(data);
      const attempts = attemptData.count || 0;
      const timestamp = attemptData.timestamp || 0;
      const now = Date.now();

      if (attempts >= this.maxAttempts) {
        // Check if lockout period has passed
        if (now - timestamp < this.lockoutTime) {
          const remaining = Math.ceil((this.lockoutTime - (now - timestamp)) / 1000 / 60);
          return { locked: true, minutes: remaining };
        } else {
          // Lockout expired, reset attempts
          localStorage.removeItem(this.attemptsKey);
          return false;
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  // Require authentication (redirect if not authenticated)
  requireAuth() {
    if (!this.isAuthenticated()) {
      // Redirect to login
      if (window.location.pathname !== '/personal') {
        window.location.href = '/personal';
      }
      return false;
    }
    return true;
  }
}

// Export auth instance
const auth = new Auth();
