import { createClient } from '@supabase/supabase-js'
const url = import.meta.env.VITE_SUPABASE_URL || 'https://lnvrkhireruuplrinnaw.supabase.co'
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxudnJraGlyZXJ1dXBscmlubmF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIxMTgxNzQsImV4cCI6MjEwNzY5NDE3NH0.F8CbeL0sWy1kw9ZoPettiwrJ568sgoU9VNhsIP7XKiU'
export const supabase = createClient(url, key)
