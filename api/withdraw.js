import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { user_id, amount } = req.body;

  try {
    // 1. Check wallet balance
    const { data: wallet } = await supabase
      .from('wallets')
      .select('balance')
      .eq('user_id', user_id)
      .single();

    if (!wallet || wallet.balance < amount)
      return res.status(400).json({ error: 'Insufficient balance' });

    // 2. Make Paystack transfer
    const response = await fetch('https://api.paystack.co/transfer', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        source: 'balance',
        reason: 'User withdrawal',
        amount: amount * 100, // kobo
        recipient: 'USER_PAYSTACK_RECIPIENT_CODE'
      })
    });

    const data = await response.json();
    if (!data.status) return res.status(400).json({ error: 'Paystack transfer failed', data });

    // 3. Deduct wallet balance
    await supabase
      .from('wallets')
      .update({ balance: wallet.balance - amount })
      .eq('user_id', user_id);

    res.status(200).json({ message: 'Withdrawal successful', data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
      }
