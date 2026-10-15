// Copy to config.js at deployment time (config.js is NOT committed).
// The anon/publishable key is public by design; every rule is enforced by RLS + RPCs.
window.KMI_NEXT_CONFIG = {
  supabaseUrl: 'https://<project-ref>.supabase.co',
  anonKey: '<publishable anon key>',
  // features: { homePrefs: true },   // ONLY after migration 0088 is applied on this project; leave out otherwise (no request is made, order stays on the device)
};
