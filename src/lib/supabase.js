
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://dhpmlprdcqlyeignuwmy.supabase.co'
const supabaseKey = 'sb_publishable_sehqOoG6qVySIX5IhmjNMw_0REfKiCs'

export const supabase = createClient(
  supabaseUrl,
  supabaseKey
)