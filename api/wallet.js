import axios from "axios";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { reference, user_id } = req.body;

    if (!reference || !user_id) {
      return res.status(400).json({ message: "Missing reference or user." });
    }

    // Verify with Paystack
    const verifyRes = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
        }
      }
    );

    const payment = verifyRes.data.data;

    if (payment.status !== "success") {
      return res.status(400).json({ message: "Payment not successful." });
    }

    const amountPaid = payment.amount / 100;

    // Prevent duplicate
    const { data: existing } = await supabase
      .from("transactions")
      .select("*")
      .eq("reference", reference)
      .maybeSingle();

    if (existing) {
      return res.status(400).json({ message: "Already processed." });
    }

    // Insert transaction
    await supabase.from("transactions").insert({
      user_id,
      type: "deposit",
      amount: amountPaid,
      reference,
      status: "completed"
    });

    // Get wallet
    const { data: wallet } = await supabase
      .from("wallets")
      .select("balance")
      .eq("user_id", user_id)
      .maybeSingle();

    let newBalance = amountPaid;

    if (wallet) {
      newBalance = wallet.balance + amountPaid;

      await supabase
        .from("wallets")
        .update({ balance: newBalance })
        .eq("user_id", user_id);
    } else {
      await supabase.from("wallets").insert({
        user_id,
        balance: amountPaid
      });
    }

    return res.status(200).json({
      message: "Deposit successful",
      balance: newBalance
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error." });
  }
      }
