const SUPABASE_URL = "https://lpnnqxalmihxgszoifpa.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxwbm5xeGFsbWloeGdzem9pZnBhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3MzM1ODEsImV4cCI6MjA4NzMwOTU4MX0.1hLW5gizjcPTKyfzx_XD9dxqegtXVQroNCclX1AaqZw";

const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);
