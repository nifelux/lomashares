import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = window.__SUPABASE_URL__;
const SUPABASE_ANON_KEY = window.__SUPABASE_ANON_KEY__;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// -------- Register ----------
window.handleRegister = async function () {
  const email = document.getElementById("email")?.value.trim();
  const password = document.getElementById("password")?.value.trim();
  const confirm = document.getElementById("confirm-password")?.value.trim();
  const referral = document.getElementById("referral-code")?.value.trim() || null;

  if (!email || !password || !confirm) return alert("All fields required");
  if (password !== confirm) return alert("Passwords do not match");

  // Sign up (Supabase Auth)
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return alert(error.message);

  // Save referral used (optional) into profiles.referred_by
  if (referral && data?.user?.id) {
    await fetch("/api/referral", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: data.user.id, referral_code: referral })
    });
  }

  alert("Registration successful. Please login.");
  window.location.href = "index.html";
};

// -------- Login ----------
window.handleLogin = async function () {
  const email = document.getElementById("email")?.value.trim();
  const password = document.getElementById("password")?.value.trim();
  if (!email || !password) return alert("Enter email and password");

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return alert(error.message);

  window.location.href = "dashboard.html";
};

// -------- Logout ----------
window.handleLogout = async function () {
  await supabase.auth.signOut();
  window.location.href = "index.html";
};

// -------- Route Guard ----------
window.authGuard = async function (isPublicPage = false) {
  const { data } = await supabase.auth.getSession();
  const session = data?.session;

  if (!session && !isPublicPage) {
    window.location.href = "index.html";
  }

  if (session && isPublicPage) {
    window.location.href = "dashboard.html";
  }
};
