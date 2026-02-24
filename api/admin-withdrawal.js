export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { withdrawal_id, amount, user_id } = req.body;
  const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

  try {
    // Call Paystack transfer API
    const response = await fetch('https://api.paystack.co/transfer', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        source: 'balance',
        reason: 'Withdrawal approved',
        amount: amount * 100, // Paystack expects kobo
        recipient: await getPaystackRecipientCode(user_id) // function to fetch recipient code from your db
      })
    });

    const result = await response.json();
    if (!result.status) throw new Error(result.message);

    // Update withdrawal status in Supabase
    await supabase
      .from('withdrawals')
      .update({ status: 'approved', approved_at: new Date() })
      .eq('id', withdrawal_id);

    res.status(200).json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
          }
