// adminWithdrawals.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = "YOUR_SUPABASE_URL";       // replace with your Supabase URL
const SUPABASE_SERVICE_KEY = "YOUR_SUPABASE_SERVICE_KEY"; // replace with service_role key
const PAYSTACK_SECRET_KEY = "process.env.PAYSTACK_SECRET_KEY"; // fetched automatically on server
export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ------------------------------
// 1️⃣ Fetch pending withdrawals
// ------------------------------
export async function fetchPendingWithdrawals() {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('type', 'withdrawal')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) console.error(error);
  return data || [];
}

// ------------------------------
// 2️⃣ Render withdrawals table
// ------------------------------
export async function renderPendingWithdrawals() {
  const container = document.getElementById('pendingWithdrawals');
  if (!container) return;

  const withdrawals = await fetchPendingWithdrawals();

  if (withdrawals.length === 0) {
    container.innerHTML = '<p>No pending withdrawals.</p>';
    return;
  }

  container.innerHTML = withdrawals.map(wd => `
    <div class="withdraw-card" id="wd-${wd.id}">
      <p>User ID: ${wd.user_id}</p>
      <p>Amount: ₦${wd.amount.toLocaleString()}</p>
      <p>Ref: ${wd.ref}</p>
      <button onclick="approveWithdrawal('${wd.id}')">Approve & Send</button>
    </div>
  `).join('');
}

// ------------------------------
// 3️⃣ Approve & send Paystack transfer
// ------------------------------
export async function approveWithdrawal(txId) {
  // Fetch withdrawal transaction
  const { data: tx } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', txId)
    .single();

  if (!tx) return alert("Transaction not found");

  // Fetch user's wallet and account info (assuming you have account info stored)
  const { data: wallet } = await supabase
    .from('wallets')
    .select('*')
    .eq('user_id', tx.user_id)
    .single();

  // Example: You need to have user bank info stored in 'users' table
  const { data: user } = await supabase
    .from('users')
    .select('bank_account, bank_code')
    .eq('id', tx.user_id)
    .single();

  if (!user || !user.bank_account || !user.bank_code) {
    return alert("User bank info missing");
  }

  // Paystack transfer API
  const transferBody = {
    source: "balance",
    reason: "LomaShares Withdrawal",
    amount: tx.amount * 100, // in Kobo
    recipient: await createPaystackRecipient(user.bank_account, user.bank_code),
    reference: tx.ref
  };

  const response = await fetch('/api/paystackTransfer', { // server-side API route
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(transferBody)
  });

  const result = await response.json();

  if (result.status === true || result.status === 'success') {
    // Update transaction status
    await supabase.from('transactions')
      .update({ status: 'approved' })
      .eq('id', txId);

    alert(`Withdrawal ₦${tx.amount.toLocaleString()} approved and sent successfully!`);
    renderPendingWithdrawals();
  } else {
    alert("Paystack transfer failed: " + JSON.stringify(result));
  }
}

// ------------------------------
// 4️⃣ Create Paystack recipient (server-side recommended)
// ------------------------------
async function createPaystackRecipient(accountNumber, bankCode) {
  const response = await fetch('/api/paystackRecipient', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'nuban',
      name: 'Recipient Name', // ideally from user's profile
      account_number: accountNumber,
      bank_code: bankCode,
      currency: 'NGN'
    })
  });

  const data = await response.json();
  if (!data || !data.data || !data.data.recipient_code) {
    throw new Error("Failed to create Paystack recipient");
  }
  return data.data.recipient_code;
}

// ------------------------------
// 5️⃣ Initialize page
// ------------------------------
document.addEventListener('DOMContentLoaded', renderPendingWithdrawals);
