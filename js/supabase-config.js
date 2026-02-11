// =============================================================================
// Supabase Configuration
// =============================================================================
// IMPORTANT: Replace these values with your actual Supabase project credentials
// Get these from: Supabase Dashboard > Settings > API
// =============================================================================

const SUPABASE_CONFIG = {
  url: 'https://wxdlgovtibygpigrleux.supabase.co',
  
  // Supabase anon (public) key (safe to expose - protected by RLS)
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4ZGxnb3Z0aWJ5Z3BpZ3JsZXV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzNDMxNzAsImV4cCI6MjA4NTkxOTE3MH0.CjiUVWNGD2GJkX21BK1KBUKdPJ0FHVD82S8_38WwfVw',
  
  // Enable/disable Supabase integration (set to true when configured)
  enabled: true
};
  
// =============================================================================
// Supabase Client Initialization
// =============================================================================

let supabaseClient = null;

function initSupabase() {
  if (!SUPABASE_CONFIG.enabled) {
    console.log('Supabase is disabled. Using localStorage fallback.');
    return null;
  }
  
  if (SUPABASE_CONFIG.url === 'YOUR_SUPABASE_URL' || 
      SUPABASE_CONFIG.anonKey === 'YOUR_SUPABASE_ANON_KEY') {
    console.warn('Supabase not configured. Please update supabase-config.js with your credentials.');
    return null;
  }
  
  // Check if Supabase JS library is loaded
  if (typeof window.supabase === 'undefined') {
    console.error('Supabase JS library not loaded. Add the CDN script to your HTML.');
    return null;
  }
  
  try {
    supabaseClient = window.supabase.createClient(
      SUPABASE_CONFIG.url,
      SUPABASE_CONFIG.anonKey,
      {
        auth: {
          // Persist session in localStorage
          persistSession: true,
          // Auto-refresh token before expiry
          autoRefreshToken: true,
          // Detect session from URL (for OAuth redirects)
          detectSessionInUrl: true
        }
      }
    );
    console.log('Supabase client initialized successfully');
    return supabaseClient;
  } catch (error) {
    console.error('Failed to initialize Supabase client:', error);
    return null;
  }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  initSupabase();
});

// Export for use in other modules
window.SUPABASE_CONFIG = SUPABASE_CONFIG;
window.getSupabaseClient = () => supabaseClient;
window.initSupabase = initSupabase;
