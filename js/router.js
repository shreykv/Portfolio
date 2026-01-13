// Client-side router for SPA navigation
class Router {
  constructor() {
    this.routes = new Map();
    this.currentRoute = null;
    this.notFoundHandler = null;
    this.init();
  }

  init() {
    // Handle browser back/forward buttons and hash changes
    window.addEventListener('popstate', () => {
      this.handleRoute();
    });
    window.addEventListener('hashchange', () => {
      this.handleRoute();
    });

    // Handle initial load
    this.handleRoute();

    // Intercept link clicks
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[data-route]');
      if (link) {
        e.preventDefault();
        const route = link.getAttribute('data-route');
        this.navigate(route);
      }
    });
  }

  // Register a route with its handler
  register(path, handler) {
    this.routes.set(path, handler);
  }

  // Set 404 handler
  setNotFound(handler) {
    this.notFoundHandler = handler;
  }

  // Navigate to a route
  navigate(path, replace = false) {
    // Use hash-based routing for GitHub Pages compatibility
    let hashPath = path;
    if (!hashPath.startsWith('#')) {
      hashPath = hashPath.startsWith('/') ? '#' + hashPath : '#/' + hashPath;
    }
    
    if (replace) {
      window.location.replace(window.location.pathname + hashPath);
    } else {
      window.location.hash = hashPath;
    }
    // handleRoute will be called by hashchange event
  }

  // Get current path
  getCurrentPath() {
    // Use hash-based routing
    const hash = window.location.hash;
    if (hash) {
      return hash.slice(1); // Remove #
    }
    // Fallback to pathname for initial load
    const pathname = window.location.pathname;
    // If we're on personal.html, default to /personal
    if (pathname.includes('personal')) {
      return '/personal';
    }
    return pathname;
  }

  // Handle the current route
  handleRoute() {
    const path = this.getCurrentPath();
    let matched = false;

    // Try exact match first
    if (this.routes.has(path)) {
      const handler = this.routes.get(path);
      handler();
      this.currentRoute = path;
      matched = true;
    } else {
      // Try pattern matching
      for (const [routePath, handler] of this.routes.entries()) {
        if (this.matchRoute(routePath, path)) {
          handler();
          this.currentRoute = path;
          matched = true;
          break;
        }
      }
    }

    // Handle 404
    if (!matched && this.notFoundHandler) {
      this.notFoundHandler();
    }
  }

  // Match route pattern (supports :param syntax)
  matchRoute(pattern, path) {
    const patternParts = pattern.split('/');
    const pathParts = path.split('/');

    if (patternParts.length !== pathParts.length) {
      return false;
    }

    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(':')) {
        continue; // Parameter match
      }
      if (patternParts[i] !== pathParts[i]) {
        return false;
      }
    }

    return true;
  }

  // Get route parameters
  getParams(pattern) {
    const params = {};
    const patternParts = pattern.split('/');
    const pathParts = this.getCurrentPath().split('/');

    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(':')) {
        const paramName = patternParts[i].slice(1);
        params[paramName] = pathParts[i];
      }
    }

    return params;
  }
}

// Export router instance
const router = new Router();
