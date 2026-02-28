import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { userEmail, amount } = req.body;

    if (!userEmail || !amount || amount <= 0) {
      return res.status(400).json({ error: "Invalid request data" });
    }

    // 1. Find the user
    const { data: users, error: fetchError } = await supabase
      .from("users")
      .select("*")
      .eq("email", userEmail)
      .single();

    if (fetchError || !users) {
      return res.status(404).json({ error: "User not found" });
    }

    // 2. Update balance
    const newBalance = (users.balance || 0) + amount;

    const { data: updatedUser, error: updateError } = await supabase
      .from("users")
      .update({ balance: newBalance })
      .eq("email", userEmail)
      .select()
      .single();

    if (updateError) {
      return res.status(500).json({ error: "Failed to update balance" });
    }

    // 3. Optionally: log the transaction
    await supabase.from("transactions").insert([
      {
        user_email: userEmail,
        type: "Deposit",
        amount: amount,
        date: new Date().toISOString(),
      },
    ]);

    return res.status(200).json({ newBalance });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
}
