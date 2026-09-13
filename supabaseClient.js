// lib/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

// Prefer environment variables (set these in .env.local — see env.local.example) so real
// project keys never have to be committed to the repo. The hardcoded values below are only
// a fallback for the shared hackathon demo project, so `npm run dev` still works out of the
// box for teammates who haven't set up their own .env.local yet.
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lotrzvlbcikameeplzan.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_1rqqfIStGbFEkrM4K5JJCQ_uIHJWlTr';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
