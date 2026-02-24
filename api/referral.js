import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { code, user_id, investment_amount } = req.body;

  try {
    // 1. Validate referral code
    const { data: referral } = await supabase
      .from('referrals')
      .select('*')
      .eq('code', code)
      .single();

    if (!referral) return res.status(400).json({ error: 'Invalid referral code' });

    // 2. Calculate 10% bonus
    const bonus = investment_amount * 0.1;

    // 3. Update referred user's wallet
    await supabase
      .from('wallets')
      .update({ balance: referral.referred_user_balance + bonus })
      .eq('user_id', referral.referred_user_id);

    // 4. Mark referral as used
    await supabase
      .from('referrals')
      .update({ used: true })
      .eq('id', referral.id);

    res.status(200).json({ message: 'Referral bonus applied', bonus });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
    }
