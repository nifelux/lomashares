// /api/wallet.js
import { createClient } from "@supabase/supabase-js";

// Supabase environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { amount, userEmail } = req.body;

  if (!amount || !userEmail) {
    return res.status(400).json({ error: "Amount and userEmail are required" });
  }

  try {
    // Get the user from Supabase
    const { data: user, error: fetchError } = await supabase
      .from("users")
      .select("*")
      .eq("email", userEmail)
      .single();

    if (fetchError) {
      return res.status(404).json({ error: "User not found" });
    }

    // Update user's balance
    const newBalance = parseFloat(user.balance || 0) + parseFloat(amount);

    const { error: updateError } = await supabase
      .from("users")
      .update({ balance: newBalance })
      .eq("email", userEmail);

    if (updateError) {
      return res.status(500).json({ error: updateError.message });
    }

    // Return the new balance
    return res.status(200).json({
      message: "Deposit successful",
      balance: newBalance,
    });
  } catch (err) {
    console.error("Wallet API error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
         }
