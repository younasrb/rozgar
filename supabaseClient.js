// lib/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

// Get these from: Supabase Dashboard > Project Settings > API
const SUPABASE_URL = 'https://lotrzvlbcikameeplzan.supabase.co';       // e.g. https://xxxx.supabase.co
const SUPABASE_ANON_KEY = 'sb_publishable_1rqqfIStGbFEkrM4K5JJCQ_uIHJWlTr';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
