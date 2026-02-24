// ------------------------------
// Lomashares Frontend JS (Full Version)
// ------------------------------
import { createClient } from '@supabase/supabase-js';

// ------------------------------
// Supabase Setup
// ------------------------------
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ------------------------------
// Investment Products
// ------------------------------
const investmentProducts = [
  { id: 1, price: 1000, dailyIncome: 500, validDays: 3 },
  { id: 2, price: 3000, dailyIncome: 800, validDays: 5 },
  { id: 3, price: 7000, dailyIncome: 1500, validDays: 7 },
  { id: 4, price: 12000, dailyIncome: 2000, validDays: 9 },
  { id: 5, price: 25000, dailyIncome: 5000, validDays: 7 },
];

// ------------------------------
// Wallet Functions
// ------------------------------
async function getWallet(userId) {
  const { data, error } = await supabase.from('wallets').select('*').eq('user_id', userId).single();
  return data || { balance: 0 };
}

async function updateWallet(userId) {
  const wallet = await getWallet(userId);
  const el = document.getElementById('wallet-balance');
  if (el) el.innerText = `Balance: ₦${wallet.balance}`;
}

// ------------------------------
// Login & Register
// ------------------------------
async function login(email, password) {
  const { user, error } = await supabase.auth.signIn({ email, password });
  if (error) return alert(error.message);
  window.location.href = 'dashboard.html';
}

async function register(email, password) {
  const { user, error } = await supabase.auth.signUp({ email, password });
  if (error) return alert(error.message);

  // Automatically create wallet record
  await fetch('/api/investment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: user.id, autoWallet: true })
  });

  alert('Registration successful! Please login.');
  window.location.href = 'login.html';
}

// ------------------------------
// Dashboard: Show Investment Products
// ------------------------------
function loadDashboardInvestments() {
  const container = document.getElementById('investment-cards');
  if (!container) return;

  container.innerHTML = '';
  investmentProducts.forEach(prod => {
    const card = document.createElement('div');
    card.innerHTML = `
      <h3>Product ${prod.id}</h3>
      <p>Price: ₦${prod.price}</p>
      <p>Daily Income: ₦${prod.dailyIncome}</p>
      <p>Validity: ${prod.validDays} days</p>
      <input type="text" id="referral-code-${prod.id}" placeholder="Referral code (optional)" />
      <button onclick="invest(${prod.id}, ${prod.price})">Invest</button>
    `;
    container.appendChild(card);
  });
}

// ------------------------------
// Invest Function
// ------------------------------
async function invest(productId, amount) {
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

  if (document.getElementById('user-investments')) loadUserInvestments();
}

// ------------------------------
// Load User Investments
// ------------------------------
async function loadUserInvestments() {
  const user = supabase.auth.user();
  if (!user) return;

  const { data } = await supabase.from('investments').select('*').eq('user_id', user.id).order('start_date', { ascending: false });
  const container = document.getElementById('user-investments');
  if (!container) return;

  container.innerHTML = '';
  data.forEach(inv => {
    const product = investmentProducts.find(p => p.id === inv.investment_type);
    const card = document.createElement('div');
    card.innerHTML = `
      <h4>Product ${inv.investment_type}</h4>
      <p>Amount: ₦${inv.amount}</p>
      <p>Daily Income: ₦${product.dailyIncome}</p>
      <p>Start: ${new Date(inv.start_date).toLocaleDateString()}</p>
      <p>End: ${new Date(inv.end_date).toLocaleDateString()}</p>
      <p>Status: ${inv.status}</p>
      <p>Profit Earned: ₦${inv.profit_earned || 0}</p>
    `;
    container.appendChild(card);
  });
}

// ------------------------------
// Apply Gift Code
// ------------------------------
async function applyGift(userId, giftCode) {
  const res = await fetch('/api/gift', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, gift_code: giftCode })
  });

  const data = await res.json();
  if (data.error) return alert(data.error);

  alert(`Gift applied! ₦${data.amount} credited.`);
  updateWallet(userId);
}

// ------------------------------
// Generate Gift Code
// ------------------------------
async function generateGiftCode(userId, amount) {
  const res = await fetch('/api/gift', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, generate_amount: amount })
  });

  const data = await res.json();
  if (data.error) return alert(data.error);

  alert(`Gift code generated: ${data.gift_code} for ₦${amount}`);
}

// ------------------------------
// Withdraw
// ------------------------------
async function requestWithdraw(userId, amount) {
  const res = await fetch('/api/withdraw', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, amount })
  });

  const data = await res.json();
  if (data.error) return alert(data.error);

  alert('Withdrawal requested successfully!');
  updateWallet(userId);
}

// ------------------------------
// Load Total Deposits & Withdrawals
// ------------------------------
async function loadTotals() {
  const user = supabase.auth.user();
  if (!user) return;

  const { data: deposits } = await supabase.from('deposits').select('amount').eq('user_id', user.id);
  const { data: withdrawals } = await supabase.from('withdrawals').select('amount').eq('user_id', user.id);

  const totalDeposit = deposits.reduce((sum, d) => sum + d.amount, 0);
  const totalWithdrawal = withdrawals.reduce((sum, w) => sum + w.amount, 0);

  const depositEl = document.getElementById('total-deposit');
  const withdrawEl = document.getElementById('total-withdraw');
  if (depositEl) depositEl.innerText = `Total Deposited: ₦${totalDeposit}`;
  if (withdrawEl) withdrawEl.innerText = `Total Withdrawn: ₦${totalWithdrawal}`;
}

// ------------------------------
// Admin Withdrawal Approval
// ------------------------------
async function loadPendingWithdrawals() {
  const { data, error } = await supabase.from('withdrawals').select('*').eq('status', 'pending').order('created_at', { ascending: true });
  const container = document.getElementById('pending-withdrawals');
  if (!container) return;

  container.innerHTML = '';
  data.forEach(withdraw => {
    const card = document.createElement('div');
    card.innerHTML = `
      <p>User ID: ${withdraw.user_id}</p>
      <p>Amount: ₦${withdraw.amount}</p>
      <p>Status: ${withdraw.status}</p>
      <button onclick="approveWithdrawal('${withdraw.id}', ${withdraw.amount}, '${withdraw.user_id}')">Approve</button>
    `;
    container.appendChild(card);
  });
}

async function approveWithdrawal(withdrawalId, amount, userId) {
  const res = await fetch('/api/admin-withdrawal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ withdrawal_id: withdrawalId, amount, user_id: userId })
  });

  const data = await res.json();
  if (data.error) return alert(data.error);

  alert('Withdrawal approved and sent!');
  loadPendingWithdrawals();
}

// ------------------------------
// Redirect to Login if not logged in
// ------------------------------
const user = supabase.auth.user();
if (!user && !['/index.html', '/register.html'].includes(window.location.pathname)) {
  window.location.href = 'login.html';
}

// ------------------------------
// Expose functions globally
// ------------------------------
window.login = login;
window.register = register;
window.loadDashboardInvestments = loadDashboardInvestments;
window.invest = invest;
window.loadUserInvestments = loadUserInvestments;
window.applyGift = applyGift;
window.generateGiftCode = generateGiftCode;
window.requestWithdraw = requestWithdraw;
window.updateWallet = updateWallet;
window.loadTotals = loadTotals;
window.loadPendingWithdrawals = loadPendingWithdrawals;
window.approveWithdrawal = approveWithdrawal;
