window.STORE = (() => {
  'use strict';

  const config = window.BIH_SUPABASE_CONFIG;

  if (!window.supabase) {
    throw new Error(
      'The Supabase JavaScript library did not load.'
    );
  }

  if (!config?.url || !config?.key) {
    throw new Error(
      'Supabase configuration is missing. Check supabase-config.js.'
    );
  }

  const client = window.supabase.createClient(
    config.url,
    config.key,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  );

  // Keep all your existing STORE functions here.

  return {
    client,
    getAll,
    byType,
    getById,
    upsert,
    remove,
    login,
    logout,
    isAuthed,
    changePassword
  };
})();
