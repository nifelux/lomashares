import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

  try {
    const { reference, amount, userEmail } = req.body || {};
    if (!reference || !amount || !userEmail) {
      return res.status(400).json({ error: "Missing reference, amount or userEmail" });
    }

    // 1) Verify Paystack transaction
    const r = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` }
    });

    const v = await r.json();
    if (!v.status) return res.status(400).json({ error: "Paystack verification failed" });

    const trx = v.data;

    // Must be successful + amount must match
    const paidAmount = Number(trx.amount) / 100; // convert from kobo
    if (trx.status !== "success") return res.status(400).json({ error: "Payment not successful" });
    if (paidAmount !== Number(amount)) return res.status(400).json({ error: "Amount mismatch" });
    if ((trx.customer?.email || "").toLowerCase() !== String(userEmail).toLowerCase()) {
      return res.status(400).json({ error: "Email mismatch" });
    }

    // 2) Prevent double-credit (idempotency)
    const { data: existing } = await supabase
      .from("transactions")
      .select("id")
      .eq("reference", reference)
      .maybeSingle();

    if (existing) {
      return res.status(200).json({ message: "Already credited", newBalance: null });
    }

    // 3) Fetch user
    const { data: userRow, error: uErr } = await supabase
      .from("users")
      .select("id,email,balance")
      .eq("email", userEmail)
      .single();

    if (uErr || !userRow) return res.status(404).json({ error: "User not found" });

    const newBalance = Number(userRow.balance || 0) + Number(amount);

    // 4) Update balance
    const { error: bErr } = await supabase
      .from("users")
      .update({ balance: newBalance })
      .eq("id", userRow.id);

    if (bErr) return res.status(500).json({ error: "Failed to update balance" });

    // 5) Log transaction
    const { error: tErr } = await supabase.from("transactions").insert([{
      user_id: userRow.id,
      user_email: userEmail,
      type: "Deposit",
      amount: Number(amount),
      reference,
      status: "success",
      created_at: new Date().toISOString()
    }]);

    if (tErr) return res.status(500).json({ error: "Failed to log transaction" });

    return res.status(200).json({ message: "Deposit credited", newBalance });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
        }
