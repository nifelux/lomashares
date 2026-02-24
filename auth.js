// auth.js
// Make sure to include in <script type="module" src="auth.js"></script>

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// --------------------
// 1️⃣ Setup Supabase
// --------------------
const SUPABASE_URL = "https://lpnnqxalmihxgszoifpa.supabase.co"; // replace with your Supabase project URL
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxwbm5xeGFsbWloeGdzem9pZnBhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3MzM1ODEsImV4cCI6MjA4NzMwOTU4MX0.1hLW5gizjcPTKyfzx_XD9dxqegtXVQroNCclX1AaqZw"; // replace with anon/public key
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --------------------
// 2️⃣ Auto redirect if already logged in
// --------------------
async function redirectIfLoggedIn() {
  const { data: { user } } = await supabase.auth.getUser();
  if (user && window.location.pathname.includes('login.html')) {
    // Already logged in, send to dashboard
    window.location.href = 'index.html';
  } else if (!user && window.location.pathname.includes('index.html')) {
    // Not logged in, send to login page
    window.location.href = 'login.html';
  }
}
redirectIfLoggedIn();

// --------------------
// 3️⃣ REGISTER FUNCTION
// --------------------
export async function registerUser() {
  const emailInput = document.getElementById('reg-username');
  const passwordInput = document.getElementById('reg-password');

  if (!emailInput || !passwordInput) return;

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    alert("Please fill in all fields");
    return;
  }

  // Sign up with Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (authError) {
    alert(authError.message);
    return;
  }

  // Create user record in 'users' table
  const { data: userRecord, error: userError } = await supabase
    .from('users')
    .insert([{
      auth_id: authData.user.id,
      email: authData.user.email
    }])
    .select()
    .single();

  if (userError) {
    alert("Error creating user record: " + userError.message);
    return;
  }

  // Create wallet for the user
  const { data: walletData, error: walletError } = await supabase
    .from('wallets')
    .insert([{
      user_id: userRecord.id,
      balance: 0
    }])
    .select()
    .single();

  if (walletError) {
    alert("Error creating wallet: " + walletError.message);
    return;
  }

  alert("Registration successful! Please log in.");
  window.location.href = 'login.html';
}

// --------------------
// 4️⃣ LOGIN FUNCTION
// --------------------
export async function loginUser() {
  const emailInput = document.getElementById('login-email');
  const passwordInput = document.getElementById('login-password');

  if (!emailInput || !passwordInput) return;

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    alert("Please fill in all fields");
    return;
  }

  const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (loginError) {
    alert(loginError.message);
    return;
  }

  // Successful login
  window.location.href = 'index.html';
}

// --------------------
// 5️⃣ LOGOUT FUNCTION
// --------------------
export async function logoutUser() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    alert("Logout failed: " + error.message);
    return;
  }
  window.location.href = 'login.html';
}

// --------------------
// 6️⃣ Attach to buttons (if on page)
// --------------------
document.addEventListener('DOMContentLoaded', () => {
  const regBtn = document.getElementById('register-btn');
  const loginBtn = document.getElementById('login-btn');
  const logoutBtn = document.getElementById('logout-btn');

  if (regBtn) regBtn.addEventListener('click', registerUser);
  if (loginBtn) loginBtn.addEventListener('click', loginUser);
  if (logoutBtn) logoutBtn.addEventListener('click', logoutUser);
});
