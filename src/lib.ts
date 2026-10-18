import { createClient } from '@supabase/supabase-js';

// Vite only exposes VITE_* variables to browser code. Use a public anon/publishable
// key here; never put a Supabase secret/service-role key in frontend environment variables.
const url = (import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '');
const key = (
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  ''
).trim();

let validUrl = false;
try {
  const parsed = new URL(url);
  validUrl = parsed.protocol === 'https:' || parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
} catch {
  validUrl = false;
}

const publicKey = !!key && !key.startsWith('sb_secret_') && !key.includes('service_role');
export const supabase = validUrl && publicKey ? createClient(url, key) : null;

export const formatNPR = (amount:number) => new Intl.NumberFormat('en-NP',{style:'currency',currency:'NPR',maximumFractionDigits:0}).format(amount);
