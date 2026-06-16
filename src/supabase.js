import { createClient } from '@supabase/supabase-js'

const url  = import.meta.env.VITE_SUPABASE_URL
const key  = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.warn(
    '[Abroad Veda] Supabase env vars missing. ' +
    'Copy .env.example → .env.local and fill in your project URL and anon key.'
  )
}

export const supabase = createClient(url || 'https://placeholder.supabase.co', key || 'placeholder')
