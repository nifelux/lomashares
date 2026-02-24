// lomashares.js
// ------------------------------
// 1️⃣ Supabase Setup
// ------------------------------
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = "YOUR_SUPABASE_URL";       // replace with your Supabase URL
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY"; // replace with anon/public key
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
