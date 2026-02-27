// /api/wallet.js

export default async function handler(req, res) {
  // Check env variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({
      error: "Supabase environment variables not set"
    });
  }

  // Dynamically import supabase client
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(supabaseUrl, supabaseKey);

  // -------------------
  // GET: test endpoint
  // -------------------
  if (req.method === "GET") {
    return res.status(200).json({
      message: "Wallet API working",
      hasUrl: !!supabaseUrl,
      hasServiceRole: !!supabaseKey
    });
  }

  // -------------------
  // POST: deposit or withdraw
  // -------------------
  if (req.method === "POST") {
    const { email, type, amount } = req.body;

    if (!email || !type || !amount) {
      return res.status(400).json({ error: "Missing email, type, or amount" });
    }

    try {
      // Fetch user first
      const { data: users, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

      if (fetchError || !users) {
        throw new Error("User not found");
      }

      let newBalance = parseFloat(users.balance);

      if (type === "deposit") {
        newBalance += parseFloat(amount);
      } else if (type === "withdraw") {
        if (newBalance < amount) {
          return res.status(400).json({ error: "Insufficient balance" });
        }
        newBalance -= parseFloat(amount);
      } else {
        return res.status(400).json({ error: "Invalid type" });
      }

      // Update balance
      const { data, error } = await supabase
        .from('users')
        .update({ balance: newBalance })
        .eq('email', email)
        .select();

      if (error) throw error;

      return res.status(200).json({
        message: `${type} successful`,
        balance: newBalance,
        data
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // -------------------
  // Method not allowed
  // -------------------
  return res.status(405).json({ error: "Method not allowed" });
        }
