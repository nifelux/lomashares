// ------------------------------
// Lomashares Frontend JS (Production Ready)
// ------------------------------

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// ------------------------------
// Supabase Setup (STATIC HTML SAFE)
// ------------------------------
const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co'
const SUPABASE_ANON_KEY = 'YOUR_PUBLIC_ANON_KEY'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)


// ------------------------------
// Investment Products
// ------------------------------
const investmentProducts = [
  { id: 1, price: 1000, dailyIncome: 500, validDays: 3 },
  { id: 2, price: 3000, dailyIncome: 800, validDays: 5 },
  { id: 3, price: 7000, dailyIncome: 1500, validDays: 7 },
  { id: 4, price: 12000, dailyIncome: 2000, validDays: 9 },
  { id: 5, price: 25000, dailyIncome: 5000, validDays: 7 },
]


// ------------------------------
// AUTH FUNCTIONS (Supabase v2)
// ------------------------------
async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    alert(error.message)
    return
  }

  window.location.href = 'dashboard.html'
}


async function register(email, password) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  })

  if (error) {
    alert(error.message)
    return
  }

  alert('Registration successful! Please login.')
  window.location.href = 'index.html'
}


async function logout() {
  await supabase.auth.signOut()
  window.location.href = 'index.html'
}


// ------------------------------
// Wallet Functions
// ------------------------------
async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}


async function getWallet(userId) {
  const { data } = await supabase
    .from('wallets')
    .select('*')
    .eq('user_id', userId)
    .single()

  return data || { balance: 0 }
}


async function updateWallet(userId) {
  const wallet = await getWallet(userId)
  const el = document.getElementById('wallet-balance')
  if (el) el.innerText = `Balance: ₦${wallet.balance}`
}


// ------------------------------
// Dashboard Products
// ------------------------------
function loadDashboardInvestments() {
  const container = document.getElementById('investment-cards')
  if (!container) return

  container.innerHTML = ''

  investmentProducts.forEach((prod) => {
    const card = document.createElement('div')

    card.innerHTML = `
      <h3>Product ${prod.id}</h3>
      <p>Price: ₦${prod.price}</p>
      <p>Daily Income: ₦${prod.dailyIncome}</p>
      <p>Validity: ${prod.validDays} days</p>
      <input type="text" id="referral-code-${prod.id}" placeholder="Referral code (optional)" />
      <button onclick="invest(${prod.id}, ${prod.price})">Invest</button>
      <hr/>
    `

    container.appendChild(card)
  })
}


// ------------------------------
// Invest
// ------------------------------
async function invest(productId, amount) {
  const user = await getCurrentUser()
  if (!user) return alert('Please login first.')

  const referralCode =
    document.getElementById(`referral-code-${productId}`)?.value || null

  const res = await fetch('/api/investment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: user.id,
      investment_type: productId,
      amount,
      referral_code: referralCode,
    }),
  })

  const data = await res.json()

  if (data.error) {
    alert(data.error)
    return
  }

  alert('Investment successful!')
  updateWallet(user.id)
}


// ------------------------------
// Load User Investments
// ------------------------------
async function loadUserInvestments() {
  const user = await getCurrentUser()
  if (!user) return

  const { data } = await supabase
    .from('investments')
    .select('*')
    .eq('user_id', user.id)
    .order('start_date', { ascending: false })

  const container = document.getElementById('user-investments')
  if (!container) return

  container.innerHTML = ''

  data.forEach((inv) => {
    const product = investmentProducts.find(
      (p) => p.id === inv.investment_type
    )

    const card = document.createElement('div')

    card.innerHTML = `
      <h4>Product ${inv.investment_type}</h4>
      <p>Amount: ₦${inv.amount}</p>
      <p>Daily Income: ₦${product?.dailyIncome || 0}</p>
      <p>Start: ${new Date(inv.start_date).toLocaleDateString()}</p>
      <p>End: ${new Date(inv.end_date).toLocaleDateString()}</p>
      <p>Status: ${inv.status}</p>
      <p>Profit Earned: ₦${inv.profit_earned || 0}</p>
      <hr/>
    `

    container.appendChild(card)
  })
}


// ------------------------------
// Totals
// ------------------------------
async function loadTotals() {
  const user = await getCurrentUser()
  if (!user) return

  const { data: deposits } = await supabase
    .from('deposits')
    .select('amount')
    .eq('user_id', user.id)

  const { data: withdrawals } = await supabase
    .from('withdrawals')
    .select('amount')
    .eq('user_id', user.id)

  const totalDeposit = deposits?.reduce((s, d) => s + d.amount, 0) || 0
  const totalWithdrawal =
    withdrawals?.reduce((s, w) => s + w.amount, 0) || 0

  const depositEl = document.getElementById('total-deposit')
  const withdrawEl = document.getElementById('total-withdraw')

  if (depositEl)
    depositEl.innerText = `Total Deposited: ₦${totalDeposit}`
  if (withdrawEl)
    withdrawEl.innerText = `Total Withdrawn: ₦${totalWithdrawal}`
}


// ------------------------------
// Route Protection
// ------------------------------
;(async () => {
  const user = await getCurrentUser()

  const publicPages = ['/', '/index.html', '/register.html']

  if (!user && !publicPages.includes(window.location.pathname)) {
    window.location.href = 'index.html'
  }

  if (user) {
    updateWallet(user.id)
  }
})()


// ------------------------------
// Expose Globally
// ------------------------------
window.login = login
window.register = register
window.logout = logout
window.loadDashboardInvestments = loadDashboardInvestments
window.invest = invest
window.loadUserInvestments = loadUserInvestments
window.updateWallet = updateWallet
window.loadTotals = loadTotals
