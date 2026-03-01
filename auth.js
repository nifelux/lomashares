import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = window.__SUPABASE_URL__;
const SUPABASE_ANON_KEY = window.__SUPABASE_ANON_KEY__;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Single guard to prevent redirect loops
export async function guard({ isPublicPage }) {
  const page = (location.pathname.split("/").pop() || "").toLowerCase();
  const { data: { session } } = await supabase.auth.getSession();

  if (isPublicPage) {
    if (session && page !== "dashboard.html") location.replace("dashboard.html");
    return;
  }

  if (!session && page !== "index.html") location.replace("index.html");
}

export async function doLogin(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  location.replace("dashboard.html");
}

export async function doRegister(email, password) {
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  location.replace("index.html");
}

export async function doLogout() {
  await supabase.auth.signOut();
  location.replace("index.html");
}

export async function getSessionUser() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user || null;
}
