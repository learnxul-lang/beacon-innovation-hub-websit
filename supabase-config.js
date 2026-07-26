(() => {
  'use strict';

  const projectUrl =
    'https://pfrayjhaphzuynncfjnp.supabase.co';

  const publishableKey =
    'sb_publishable_eV46i3C8LrEzmYG9Seu-Zg_xM1GwIje';

  if (!window.supabase) {
    console.error('Supabase JavaScript library was not loaded.');
    return;
  }

  window.supabaseClient = window.supabase.createClient(
    projectUrl,
    publishableKey
  );

  console.log('Supabase connection configured successfully.');
})();
