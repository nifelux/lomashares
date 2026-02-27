/* =====================================================
   LOMASHARES FRONTEND COMPLETE SYSTEM
   Version: Backend v2 Compatible (Supabase + API)
===================================================== */

/* =====================================================
   SUPABASE INIT
===================================================== */
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = "https://lpnnqxalmihxgszoifpa.supabase.co"; // replace with your URL
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxwbm5xeGFsbWloeGdzem9pZnBhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3MzM1ODEsImV4cCI6MjA4NzMwOTU4MX0.1hLW5gizjcPTKyfzx_XD9dxqegtXVQroNCclX1AaqZw";              // replace with your anon key
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* =====================================================
   AUTH USER HELPERS
===================================================== */
function setAuthUser(user) {
  localStorage.setItem("authUser", JSON.stringify(user));
}

function getAuthUser() {
  return JSON.parse(localStorage.getItem("authUser"));
}

function logout() {
  supabase.auth.signOut();
  localStorage.removeItem("authUser");
  window.location.href = "index.html";
}

/* =====================================================
   REFERRAL SYSTEM
===================================================== */
function generateReferralCode() {
  return "LOMA" + Math.floor(100000 + Math.random() * 900000);
}

async function isValidReferral(code) {
  if (!code) return true;
  const res = await fetch(`/api/referral.js?code=${code}`);
  const data = await res.json();
  return data.valid;
}

/* =====================================================
   AUTHENTICATION
===================================================== */
window.handleRegister = async function () {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const confirmPassword = document.getElementById("confirm-password").value.trim();
  const referral = document.getElementById("referral-code")?.value.trim();

  if (!email || !password || !confirmPassword) return alert("All fields required");
  if (password !== confirmPassword) return alert("Passwords do not match");
  if (!(await isValidReferral(referral))) return alert("Invalid referral code");

  // Supabase signup
  const { user, error } = await supabase.auth.signUp({ email, password });
  if (error) return alert(error.message);

  // Call backend to create user record
  const createRes = await fetch('/api/createUser.js', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, referral })
  });

  const createData = await createRes.json();
  if (createData.error) return alert(createData.error);

  setAuthUser(createData.user);
  alert("Registration successful");
  window.location.href = "index.html";
};

window.handleLogin = async function () {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const { user, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return alert(error.message);

  const res = await fetch(`/api/getUser.js?email=${email}`);
  const authUser = await res.json();
  setAuthUser(authUser);

  window.location.href = "dashboard.html";
};

/* =====================================================
   PAGE PROTECTION
===================================================== */
window.addEventListener("load", async function () {
  const protectedPages = [
    "dashboard.html",
    "investment.html",
    "deposit.html",
    "withdraw.html",
    "profile.html",
    "refer.html",
    "team.html",
    "transactions.html",
    "admin-withdrawals.html"
  ];

  const page = window.location.pathname.split("/").pop();
  const auth = getAuthUser();
  if (protectedPages.includes(page) && !auth) {
    window.location.href = "index.html";
  }
});

/* =====================================================
   INVESTMENT PRODUCTS (10 Products, 200% return in 30 days)
===================================================== */
const PRODUCTS = [
  { id: 1, price: 3000 },
  { id: 2, price: 5000 },
  { id: 3, price: 7000 },
  { id: 4, price: 10000 },
  { id: 5, price: 15000 },
  { id: 6, price: 20000 },
  { id: 7, price: 30000 },
  { id: 8, price: 40000 },
  { id: 9, price: 50000 },
  { id: 10, price: 100000 }
];

/* =====================================================
   INVEST FUNCTION (Calls backend)
===================================================== */
window.invest = async function (productId) {
  const auth = getAuthUser();
  if (!auth) return alert("Login required");

  const res = await fetch('/api/investment.js', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: auth.email, productId })
  });

  const data = await res.json();
  if (data.error) return alert(data.error);

  setAuthUser(data.user);
  alert("Investment successful");
};

/* =====================================================
   DAILY PROFIT SYSTEM
===================================================== */
window.processDailyIncome = async function () {
  const auth = getAuthUser();
  if (!auth) return;

  const res = await fetch('/api/dailyIncome.js', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: auth.email })
  });

  const data = await res.json();
  if (!data.user) return;

  setAuthUser(data.user);
};

/* =====================================================
   DEPOSIT
===================================================== */
window.deposit = async function (amount) {
  const auth = getAuthUser();
  if (!auth) return alert("Login required");

  const res = await fetch('/api/deposit.js', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: auth.email, amount: parseFloat(amount) })
  });

  const data = await res.json();
  if (data.error) return alert(data.error);

  setAuthUser(data.user);
  alert("Deposit successful");
};

/* =====================================================
   WITHDRAW
===================================================== */
window.withdraw = async function (amount) {
  const auth = getAuthUser();
  if (!auth) return alert("Login required");

  const res = await fetch('/api/withdraw.js', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: auth.email, amount: parseFloat(amount) })
  });

  const data = await res.json();
  if (data.error) return alert(data.error);

  setAuthUser(data.user);
  alert("Withdrawal request submitted");
};

/* =====================================================
   ADMIN WITHDRAW APPROVAL
===================================================== */
window.approveWithdrawal = async function (userEmail, index) {
  const res = await fetch('/api/approveWithdrawal.js', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userEmail, index })
  });

  const data = await res.json();
  if (data.error) return alert(data.error);
};

/* =====================================================
   DROPDOWN MENU (LOGIN/REGISTER/ABOUT)
===================================================== */
window.toggleMenu = function () {
  const menu = document.getElementById("dropdownMenu");
  menu.style.display = menu.style.display === "flex" ? "none" : "flex";
};

window.addEventListener("click", function (e) {
  const menu = document.getElementById("dropdownMenu");
  const icon = document.querySelector(".menu-icon");

  if (!icon.contains(e.target) && !menu.contains(e.target)) {
    menu.style.display = "none";
  }
});

/* =====================================================
   DASHBOARD AUTO UPDATE
===================================================== */
window.addEventListener("load", function () {
  window.processDailyIncome();
});
