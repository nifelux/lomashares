import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { code, user_id } = req.body;

  try {
    // 1. Validate gift code
    const { data: gift } = await supabase
      .from('gifts')
      .select('*')
      .eq('code', code)
      .eq('used', false)
      .single();

    if (!gift) return res.status(400).json({ error: 'Invalid or used gift code' });

    const bonus = gift.amount;

    // 2. Update user's wallet
    const { data: wallet } = await supabase
      .from('wallets')
      .select('balance')
      .eq('user_id', user_id)
      .single();

    await supabase
      .from('wallets')
      .update({ balance: wallet.balance + bonus })
      .eq('user_id', user_id);

    // 3. Mark gift code as used
    await supabase
      .from('gifts')
      .update({ used: true })
      .eq('id', gift.id);

    res.status(200).json({ message: 'Gift applied', bonus });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
  }
