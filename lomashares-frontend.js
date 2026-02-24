// ==============================
// 1️⃣ Initialize Supabase frontend client
// ==============================
const supabase = supabase.createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// ==============================
// 2️⃣ LOGIN
// ==============================
async function login(email, password) {
  const { user, error } = await supabase.auth.signIn({ email, password });
  if (error) {
    console.error(error.message);
    alert(error.message);
    return;
  }
  // Redirect to dashboard
  window.location.href = 'index.html';
}

// ==============================
// 3️⃣ REGISTER
// ==============================
async function register(email, password) {
  const { user, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    console.error(error.message);
    alert(error.message);
    return;
  }

  // Automatically create wallet record via backend
  await fetch("/api/investment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: user.id, amount: 0 })
  });

  alert("Registration successful! Please log in.");
  window.location.href = 'login.html';
}

// ==============================
// 4️⃣ CREATE INVESTMENT
// ==============================
async function createInvestment(user_id, amount, referral_code = null) {
  const res = await fetch("/api/investment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id, amount, referral_code })
  });
  const data = await res.json();
  console.log(data);
  return data;
}

// ==============================
// 5️⃣ APPLY REFERRAL CODE
// ==============================
async function applyReferral(user_id, code, investment_amount) {
  const res = await fetch("/api/referral", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id, code, investment_amount })
  });
  const data = await res.json();
  console.log(data);
  return data;
}

// ==============================
// 6️⃣ APPLY GIFT CODE
// ==============================
async function applyGift(user_id, code) {
  const res = await fetch("/api/gift", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id, code })
  });
  const data = await res.json();
  console.log(data);
  return data;
}

// ==============================
// 7️⃣ WITHDRAW (ADMIN APPROVE)
// ==============================
async function withdraw(user_id, amount) {
  const res = await fetch("/api/withdraw", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id, amount })
  });
  const data = await res.json();
  console.log(data);
  return data;
}

// ==============================
// 8️⃣ FETCH WALLET
// ==============================
async function getWallet(user_id) {
  const { data, error } = await supabase
    .from('wallets')
    .select('*')
    .eq('user_id', user_id)
    .single();
  if (error) console.error(error.message);
  return data;
}

// ==============================
// 9️⃣ EXAMPLE USAGE
// ==============================

// LOGIN FORM
// document.getElementById('login-btn').addEventListener('click', () => {
//   login(emailInput.value, passwordInput.value);
// });

// REGISTER FORM
// document.getElementById('register-btn').addEventListener('click', () => {
//   register(emailInput.value, passwordInput.value);
// });

// CREATE INVESTMENT
// createInvestment(userId, 5000, "REF123");

// APPLY REFERRAL
// applyReferral(userId, "REF123", 5000);

// APPLY GIFT
// applyGift(userId, "GIFT123");

// ADMIN WITHDRAW
// withdraw(userId, 5000);

// FETCH WALLET
// getWallet(userId).then(wallet => console.log("Balance:", wallet.balance));
