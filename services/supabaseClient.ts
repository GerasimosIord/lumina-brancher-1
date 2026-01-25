import { createClient } from '@supabase/supabase-js'
// @ts-ignore
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
// @ts-ignore
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
// Create a single supabase client for interacting with your database
export const supabase = createClient(supabaseUrl, supabaseKey)