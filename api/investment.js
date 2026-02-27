// investment.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY // Service Role key
);

// 10 Investment products
const products = [
  { id: 1, price: 3000 },
  { id: 2, price: 5000 },
  { id: 3, price: 7000 },
  { id: 4, price: 10000 },
  { id: 5, price: 15000 },
  { id: 6, price: 20000 },
  { id: 7, price: 30000 },
  { id: 8, price: 40000 },
  { id: 9, price: 50000 },
  { id: 10, price: 100000 },
];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { user_id, plan_id, referral_code } = req.body;

  try {
    const product = products.find(p => p.id === plan_id);
    if (!product) return res.status(400).json({ error: 'Invalid investment plan' });

    // Check lifetime purchases
    const { data: purchases } = await supabase
      .from('investments')
      .select('*')
      .eq('user_id', user_id)
      .eq('plan_id', plan_id);

    if (purchases.length >= 2) return res.status(400).json({ error: 'You can only buy this product twice' });

    // Fetch user wallet & referred_by
    const { data: userWallet } = await supabase
      .from('users')
      .select('wallet, referred_by')
      .eq('id', user_id)
      .single();

    if (!userWallet || userWallet.wallet < product.price)
      return res.status(400).json({ error: 'Insufficient wallet balance' });

    // Deduct wallet
    await supabase
      .from('users')
      .update({ wallet: userWallet.wallet - product.price })
      .eq('id', user_id);

    // Referral bonus
    if (userWallet.referred_by) {
      const referralBonus = product.price * 0.10; // 10%
      await supabase
        .from('users')
        .update({ wallet: supabase.raw('wallet + ?', [referralBonus]) })
        .eq('id', userWallet.referred_by);
    }

    // Calculate daily ROI
    const totalReturn = product.price * 2; // 200%
    const dailyIncome = totalReturn / 30;

    // Insert investment
    await supabase.from('investments').insert({
      user_id,
      plan_id,
      amount: product.price,
      total_return: totalReturn,
      daily_earning: dailyIncome,
      duration: 30,
      status: 'active',
      next_payment: new Date(Date.now() + 24 * 60 * 60 * 1000), // next day
    });

    return res.status(200).json({ message: 'Investment created successfully', product });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
                                  }
