import { createClient } from '@supabase/supabase-js'

// The publishable key is meant to be public: what each visitor can do is decided by the
// row-level-security policies in supabase/schema.sql, not by hiding this key.
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://fuuwkrxjqqdfphyawgzu.supabase.co'
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_JlLz8O5oufRERkTEgqMnSw_rG156gsU'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
