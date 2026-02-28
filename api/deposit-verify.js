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

    // Verify on Paystack
    const r = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
    });
    const v = await r.json();

    if (!v.status) return res.status(400).json({ error: "Verification failed", raw: v });
    if (v.data.status !== "success") return res.status(400).json({ error: "Payment not successful" });

    const email = (v.data.customer?.email || "").toLowerCase();
    const amount = Number(v.data.amount) / 100; // convert from kobo

    // Prevent double-credit (important!)
    const { data: existing } = await supabase
      .from("transactions")
      .select("id")
      .eq("reference", reference)
      .maybeSingle();

    if (existing) {
      return res.status(200).json({ message: "Already credited" });
    }

    // Get user
    const { data: userRow, error: uErr } = await supabase
      .from("users")
      .select("id, email, balance")
      .ilike("email", email)
      .single();

    if (uErr || !userRow) return res.status(404).json({ error: "User not found in database" });

    const newBalance = Number(userRow.balance || 0) + amount;

    // Update balance
    const { error: bErr } = await supabase
      .from("users")
      .update({ balance: newBalance })
      .eq("id", userRow.id);

    if (bErr) return res.status(500).json({ error: "Failed to update wallet" });

    // Log transaction
    await supabase.from("transactions").insert([{
      user_id: userRow.id,
      user_email: userRow.email,
      type: "Deposit",
      amount,
      reference,
      status: "success",
      created_at: new Date().toISOString(),
    }]);

    return res.status(200).json({ message: "Deposit credited", newBalance });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
}
