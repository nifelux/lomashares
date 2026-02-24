import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { user_id, amount, referral_code } = req.body;

  try {
    // 1. Create investment record
    const { data: investment } = await supabase
      .from('investments')
      .insert([{ user_id, amount, status: 'active', created_at: new Date() }])
      .select()
      .single();

    // 2. Update user's wallet
    const { data: wallet } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', user_id)
      .single();

    await supabase
      .from('wallets')
      .update({ balance: wallet.balance + amount })
      .eq('user_id', user_id);

    // 3. Apply referral bonus if referral code exists
    if (referral_code) {
      await fetch(`${process.env.VERCEL_URL}/api/referral`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: referral_code, user_id, investment_amount: amount })
      });
    }

    res.status(200).json({ message: 'Investment successful', investment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
                }
