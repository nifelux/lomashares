// lomashares.js
// ------------------------------
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)
// 1️⃣ Supabase Setup
// ------------------------------
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = "https://lpnnqxalmihxgszoifpa.supabase.co";       // replace with your Supabase URL
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxwbm5xeGFsbWloeGdzem9pZnBhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3MzM1ODEsImV4cCI6MjA4NzMwOTU4MX0.1hLW5gizjcPTKyfzx_XD9dxqegtXVQroNCclX1AaqZw"; // replace with anon/public key
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ------------------------------
// 2️⃣ Utility: Get current logged-in user
// ------------------------------
export async function getCurrentUser() {
  const { data } = await supabase.auth.getUser();
  return data.user || null;
}

// ------------------------------
// 3️⃣ Wallet: Fetch wallet
// ------------------------------
export async function getWallet() {
  const user = await getCurrentUser();
  if (!user) return null;
  const { data: wallet } = await supabase
    .from("wallets")
    .select("*")
    .eq("user_id", user.id)
    .single();
  return wallet;
}

// ------------------------------
// 4️⃣ Wallet: Deposit
// ------------------------------
export async function deposit(amount) {
  if (amount < 100) {
    alert("Minimum deposit is ₦100");
    return;
  }

  const user = await getCurrentUser();
  if (!user) return alert("Not logged in");

  // Paystack transaction reference
  const ref = "LS-" + Date.now();

  // Open Paystack popup
  const handler = PaystackPop.setup({
    key: "pk_live_cd8547f6b4270551729c247d8d31635691c39a08", // your public key
    email: user.email,
    amount: amount * 100,
    currency: "NGN",
    ref: ref,
    callback: async function(response) {
      // Record transaction in Supabase
      await supabase.from("transactions").insert([{
        user_id: user.id,
        type: "deposit",
        amount,
        ref,
        status: "approved"
      }]);

      // Update wallet balance
      const wallet = await getWallet();
      await supabase.from("wallets")
        .update({ balance: wallet.balance + amount })
        .eq("id", wallet.id);

      alert("Deposit successful! Your wallet has been updated.");
      renderWallet();
      renderTransactions();
    }
  });

  handler.openIframe();
}

// ------------------------------
// 5️⃣ Wallet: Withdraw
// ------------------------------
export async function withdraw(amount) {
  if (amount < 1000) return alert("Minimum withdrawal is ₦1,000");

  const user = await getCurrentUser();
  if (!user) return alert("Not logged in");

  const wallet = await getWallet();
  if (wallet.balance < amount) return alert("Insufficient balance");

  // Record withdrawal request
  const { data, error } = await supabase.from("transactions").insert([{
    user_id: user.id,
    type: "withdrawal",
    amount,
    ref: "WD-" + Date.now(),
    status: "pending"
  }]).select().single();

  if (error) return alert(error.message);

  alert("Withdrawal request submitted. Admin will approve and Paystack transfer will happen automatically.");
  renderWallet();
  renderTransactions();
}

// ------------------------------
// 6️⃣ Investments: Add investment
// ------------------------------
export async function addInvestment(type, amount, roi, durationDays) {
  const user = await getCurrentUser();
  if (!user) return alert("Not logged in");

  const wallet = await getWallet();
  if (wallet.balance < amount) return alert("Insufficient balance");

  // Deduct amount from wallet
  await supabase.from("wallets")
    .update({ balance: wallet.balance - amount })
    .eq("id", wallet.id);

  // Create investment
  const maturityDate = new Date();
  maturityDate.setDate(maturityDate.getDate() + durationDays);

  await supabase.from("investments").insert([{
    user_id: user.id,
    type,
    amount,
    roi,
    status: "active",
    created_at: new Date(),
    maturity_date: maturityDate.toISOString()
  }]);

  // Record transaction
  await supabase.from("transactions").insert([{
    user_id: user.id,
    type: "investment",
    amount,
    ref: "INV-" + Date.now(),
    status: "approved"
  }]);

  alert("Investment created successfully!");
  renderWallet();
  renderInvestments();
  renderTransactions();
}

// ------------------------------
// 7️⃣ Automatically settle matured investments
// ------------------------------
export async function settleMaturedInvestments() {
  const user = await getCurrentUser();
  if (!user) return;

  const { data: investments } = await supabase.from("investments")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "active");

  const now = new Date();

  for (let inv of investments) {
    if (new Date(inv.maturity_date) <= now) {
      // Add ROI + principal back to wallet
      const wallet = await getWallet();
      const totalReturn = inv.amount + inv.roi;
      await supabase.from("wallets")
        .update({ balance: wallet.balance + totalReturn })
        .eq("id", wallet.id);

      // Mark investment as matured
      await supabase.from("investments")
        .update({ status: "matured" })
        .eq("id", inv.id);

      // Record transaction
      await supabase.from("transactions").insert([{
        user_id: user.id,
        type: "investment_matured",
        amount: totalReturn,
        ref: "MAT-" + Date.now(),
        status: "approved"
      }]);
    }
  }
}

// ------------------------------
// 8️⃣ Render wallet balance
// ------------------------------
export async function renderWallet() {
  const walletEl = document.getElementById("walletApproved");
  const wallet = await getWallet();
  if (walletEl && wallet) {
    walletEl.innerText = "₦" + wallet.balance.toLocaleString();
  }
}

// ------------------------------
// 9️⃣ Render investments
// ------------------------------
export async function renderInvestments() {
  const container = document.getElementById("investmentsContainer");
  if (!container) return;

  const user = await getCurrentUser();
  const { data: investments } = await supabase.from("investments")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  container.innerHTML = investments.map(inv => `
    <div class="investment-card">
      <h4>${inv.type} (${inv.status})</h4>
      <p>Amount: ₦${inv.amount.toLocaleString()}</p>
      <p>ROI: ₦${inv.roi.toLocaleString()}</p>
      <p>Maturity: ${new Date(inv.maturity_date).toLocaleDateString()}</p>
    </div>
  `).join("");
}

// ------------------------------
// 10️⃣ Render transactions
// ------------------------------
export async function renderTransactions() {
  const container = document.getElementById("transactionsContainer");
  if (!container) return;

  const user = await getCurrentUser();
  const { data: txs } = await supabase.from("transactions")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  container.innerHTML = txs.map(tx => `
    <div class="tx-card">
      <p><strong>${tx.type}</strong> ₦${tx.amount.toLocaleString()}</p>
      <p>Ref: ${tx.ref}</p>
      <p>Status: ${tx.status}</p>
      <p>Date: ${new Date(tx.created_at).toLocaleDateString()}</p>
    </div>
  `).join("");
}

// ------------------------------
// 11️⃣ Initialize on page load
// ------------------------------
document.addEventListener("DOMContentLoaded", async () => {
  await renderWallet();
  await renderInvestments();
  await renderTransactions();
  await settleMaturedInvestments();
});
// =======================
// Gift Code Redemption (one-time use)
// =======================
export async function redeemGiftCode(userId, code) {
  // Fetch gift code record
  const { data: gift, error } = await supabase
    .from('gift_codes')
    .select('*')
    .eq('code', code)
    .single();

  if (error || !gift) return alert("Invalid gift code");
  if (gift.redeemed) return alert("This gift code has already been used");

  // Credit wallet with gift amount
  await supabase
    .from('wallets')
    .update({
      approved: supabase.raw(`approved + ${gift.amount}`)
    })
    .eq('user_id', userId);

  // Mark gift code as redeemed
  await supabase
    .from('gift_codes')
    .update({ redeemed: true, used_by: userId })
    .eq('code', code);

  alert(`Gift code applied! ₦${gift.amount.toLocaleString()} added to your wallet`);
}

// =======================
// Handle Referral on Registration (records the referral)
// =======================
export async function handleReferralOnSignup(newUserId, referralCode) {
  if (!referralCode) return;

  // Lookup referrer by code
  const { data: referrer, error } = await supabase
    .from('users')
    .select('id')
    .eq('referral_code', referralCode)
    .single();

  if (error || !referrer) return;

  // Insert referral record
  await supabase
    .from('referrals')
    .insert({
      referrer_id: referrer.id,
      referred_id: newUserId,
      reward_given: false
    });

  console.log(`Referral recorded: referrer ${referrer.id}, new user ${newUserId}`);
}

// =======================
// Handle Referral Bonus on Investment (10% of referred user's investment)
// =======================
export async function handleReferralOnInvestment(userId, investmentAmount) {
  // Check if user was referred
  const { data: referral, error } = await supabase
    .from('referrals')
    .select('*')
    .eq('referred_id', userId)
    .single();

  if (error || !referral || referral.reward_given) return;

  const bonus = investmentAmount * 0.10; // 10% referral bonus

  // Credit the referrer's wallet
  await supabase
    .from('wallets')
    .update({
      approved: supabase.raw(`approved + ${bonus}`)
    })
    .eq('user_id', referral.referrer_id);

  // Mark referral as rewarded
  await supabase
    .from('referrals')
    .update({ reward_given: true })
    .eq('id', referral.id);

  console.log(`Referral bonus ₦${bonus.toLocaleString()} credited to user ${referral.referrer_id}`);
}

// =======================
// Create Investment & Trigger Referral Bonus
// =======================
export async function makeInvestment(userId, amount) {
  // Insert investment record
  const { data: investment, error } = await supabase
    .from('investments')
    .insert({
      user_id: userId,
      amount,
      status: 'active',
      start_date: new Date().toISOString()
    })
    .select('*')
    .single();

  if (error) return alert("Error creating investment: " + error.message);

  // Deduct investment amount from wallet
  await supabase
    .from('wallets')
    .update({
      approved: supabase.raw(`approved - ${amount}`)
    })
    .eq('user_id', userId);

  // Handle referral bonus
  await handleReferralOnInvestment(userId, amount);

  alert(`Investment of ₦${amount.toLocaleString()} made successfully! Referral bonus credited if applicable.`);
}
