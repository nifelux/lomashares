import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

  try {
    const { reference } = req.body || {};
    if (!reference) return res.status(400).json({ error: "Missing reference" });

    // 1) Verify payment with Paystack
    const r = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
    });

    const v = await r.json();

    if (!v.status) return res.status(400).json({ error: "Paystack verification failed", raw: v });

    const trx = v.data;
    if (trx.status !== "success") return res.status(400).json({ error: "Payment not successful" });

    const userEmail = (trx.customer?.email || "").toLowerCase();
    const amount = Number(trx.amount) / 100; // kobo -> naira

    if (!userEmail || !amount) return res.status(400).json({ error: "Invalid Paystack response" });

    // 2) Prevent double-credit using transactions.reference
    const { data: existing } = await supabase
      .from("transactions")
      .select("id")
      .eq("reference", reference)
      .maybeSingle();

    if (existing) {
      return res.status(200).json({ message: "Already credited" });
    }

    // 3) Find user in users table
    const { data: userRow, error: uErr } = await supabase
      .from("users")
      .select("id,email")
      .ilike("email", userEmail)
      .single();

    if (uErr || !userRow) return res.status(404).json({ error: "User not found" });

    // 4) Fetch wallet
    const { data: walletRow, error: wErr } = await supabase
      .from("wallets")
      .select("id,balance")
      .eq("user_id", userRow.id)
      .single();

    if (wErr || !walletRow) return res.status(404).json({ error: "Wallet not found" });

    const newBalance = Number(walletRow.balance || 0) + Number(amount);

    // 5) Update wallet balance
    const { error: upErr } = await supabase
      .from("wallets")
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq("user_id", userRow.id);

    if (upErr) return res.status(500).json({ error: "Failed to update wallet balance" });

    // 6) Log transaction
    const { error: tErr } = await supabase.from("transactions").insert([{
      user_id: userRow.id,
      user_email: userRow.email,
      type: "Deposit",
      amount: Number(amount),
      status: "success",
      reference,
      description: "Deposit via Paystack",
      meta: {
        channel: trx.channel,
        gateway_response: trx.gateway_response,
        paid_at: trx.paid_at
      },
      created_at: new Date().toISOString()
    }]);

    if (tErr) return res.status(500).json({ error: "Failed to log transaction" });

    return res.status(200).json({ message: "Deposit credited", newBalance });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
      }
