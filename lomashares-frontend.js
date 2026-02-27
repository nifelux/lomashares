/* =====================================================
   LOMASHARES FRONTEND COMPLETE SYSTEM
   Backend v2 Ready | 10 Investment Products
===================================================== */

/* ------------------------------
   Supabase Setup
------------------------------ */
const SUPABASE_URL = "YOUR_SUPABASE_URL";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";
const supabase = supabase.createClient
  ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : supabase;

/* ------------------------------
   Investment Products
------------------------------ */
const PRODUCTS = [
  { id: 1, price: 3000, daily: 200, totalReturn: 6000, days: 30 },
  { id: 2, price: 5000, daily: 333, totalReturn: 10000, days: 30 },
  { id: 3, price: 10000, daily: 666, totalReturn: 20000, days: 30 },
  { id: 4, price: 15000, daily: 1000, totalReturn: 30000, days: 30 },
  { id: 5, price: 25000, daily: 1666, totalReturn: 50000, days: 30 },
  { id: 6, price: 30000, daily: 2000, totalReturn: 60000, days: 30 },
  { id: 7, price: 40000, daily: 2666, totalReturn: 80000, days: 30 },
  { id: 8, price: 50000, daily: 3333, totalReturn: 100000, days: 30 },
  { id: 9, price: 75000, daily: 5000, totalReturn: 150000, days: 30 },
  { id: 10, price: 100000, daily: 6666, totalReturn: 200000, days: 30 },
];

/* ------------------------------
   Login & Register
------------------------------ */
window.login = async function(email, password) {
  const { data: user, error } = await supabase.auth.signIn({ email, password });
  if (error) return alert(error.message);
  window.location.href = 'dashboard.html';
};

window.register = async function(email, password, referralCode = null) {
  const { data: user, error } = await supabase.auth.signUp({ email, password });
  if (error) return alert(error.message);

  if (referralCode) {
    const res = await fetch('/api/referral', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ referral_code: referralCode, new_user: user.id })
    });
    const data = await res.json();
    if (data.error) return alert(data.error);
  }

  // Initialize wallet
  await fetch('/api/investment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: user.id, autoWallet: true })
  });

  alert('Registration successful! Login now.');
  window.location.href = 'index.html';
};

/* ------------------------------
   Wallet
------------------------------ */
window.getWallet = async function(userId) {
  const { data } = await supabase.from('wallets').select('*').eq('user_id', userId).single();
  return data || { balance: 0 };
};

window.updateWallet = async function(userId) {
  const wallet = await getWallet(userId);
  const el = document.getElementById('wallet-balance');
  if (el) el.innerText = `Balance: ₦${wallet.balance}`;
};

/* ------------------------------
   Load Dashboard Products
------------------------------ */
window.loadDashboardInvestments = async function(userInvestments = []) {
  const container = document.getElementById('investment-cards');
  if (!container) return;
  container.innerHTML = '';

  PRODUCTS.forEach(prod => {
    const investedCount = userInvestments.filter(inv => inv.investment_type === prod.id).length;
    const canInvest = investedCount < 2;

    const card = document.createElement('div');
    card.className = 'investment-card';
    card.innerHTML = `
      <h3>Product ${prod.id}</h3>
      <p>Price: ₦${prod.price}</p>
      <p>Daily: ₦${prod.daily}</p>
      <p>Total Return: ₦${prod.totalReturn} in ${prod.days} days</p>
      <input type="text" id="referral-code-${prod.id}" placeholder="Referral code (optional)">
      <button ${!canInvest ? 'disabled' : ''} onclick="invest(${prod.id}, ${prod.price})">
        ${canInvest ? 'Invest' : 'Max Reached'}
      </button>
    `;
    container.appendChild(card);
  });
};

/* ------------------------------
   Invest Function
------------------------------ */
window.invest = async function(productId, amount) {
  const user = supabase.auth.user();
  if (!user) return alert('Please login first.');

  const referralCode = document.getElementById(`referral-code-${productId}`)?.value || null;

  const res = await fetch('/api/investment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: user.id,
      investment_type: productId,
      amount,
      referral_code: referralCode
    })
  });

  const data = await res.json();
  if (data.error) return alert(data.error);

  alert('Investment successful!');
  updateWallet(user.id);
  loadUserInvestments();
};

/* ------------------------------
   Load User Investments
------------------------------ */
window.loadUserInvestments = async function() {
  const user = supabase.auth.user();
  if (!user) return;

  const { data: investments } = await supabase.from('investments').select('*').eq('user_id', user.id).order('start_date', { ascending: false });
  const container = document.getElementById('user-investments');
  if (!container) return;

  container.innerHTML = '';
  loadDashboardInvestments(investments);

  investments.forEach(inv => {
    const prod = PRODUCTS.find(p => p.id === inv.investment_type);
    const card = document.createElement('div');
    card.innerHTML = `
      <h4>Product ${inv.investment_type}</h4>
      <p>Amount: ₦${inv.amount}</p>
      <p>Daily: ₦${prod.daily}</p>
      <p>Start: ${new Date(inv.start_date).toLocaleDateString()}</p>
      <p>End: ${new Date(inv.end_date).toLocaleDateString()}</p>
      <p>Status: ${inv.status}</p>
      <p>Profit Earned: ₦${inv.profit_earned || 0}</p>
    `;
    container.appendChild(card);
  });
};

/* ------------------------------
   Gift Codes
------------------------------ */
window.applyGift = async function(userId, giftCode) {
  const res = await fetch('/api/gift', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, gift_code: giftCode })
  });
  const data = await res.json();
  if (data.error) return alert(data.error);

  alert(`Gift applied! ₦${data.amount} credited.`);
  updateWallet(userId);
};

/* ------------------------------
   Withdrawals
------------------------------ */
window.requestWithdraw = async function(userId, amount) {
  const res = await fetch('/api/withdraw', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, amount })
  });
  const data = await res.json();
  if (data.error) return alert(data.error);

  alert('Withdrawal requested successfully!');
  updateWallet(userId);
};

/* ------------------------------
   Admin Withdraw Approval
------------------------------ */
window.loadPendingWithdrawals = async function() {
  const { data } = await supabase.from('withdrawals').select('*').eq('status', 'pending').order('created_at', { ascending: true });
  const container = document.getElementById('pending-withdrawals');
  if (!container) return;

  container.innerHTML = '';
  data.forEach(w => {
    const card = document.createElement('div');
    card.innerHTML = `
      <p>User ID: ${w.user_id}</p>
      <p>Amount: ₦${w.amount}</p>
      <p>Status: ${w.status}</p>
      <button onclick="approveWithdrawal('${w.id}', ${w.amount}, '${w.user_id}')">Approve</button>
    `;
    container.appendChild(card);
  });
};

window.approveWithdrawal = async function(withdrawalId, amount, userId) {
  const res = await fetch('/api/admin-withdrawal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ withdrawal_id: withdrawalId, amount, user_id: userId })
  });

  const data = await res.json();
  if (data.error) return alert(data.error);

  alert('Withdrawal approved!');
  loadPendingWithdrawals();
};

/* ------------------------------
   Page Protection
------------------------------ */
window.addEventListener('load', async () => {
  const protectedPages = [
    "dashboard.html", "investment.html", "deposit.html", "withdraw.html",
    "profile.html", "refer.html", "team.html", "transactions.html"
  ];

  const page = window.location.pathname.split("/").pop();
  const user = supabase.auth.user();

  if (protectedPages.includes(page) && !user) {
    window.location.href = "index.html";
  } else if (page === "dashboard.html") {
    await updateWallet(user.id);
    await loadUserInvestments();
  }
});
