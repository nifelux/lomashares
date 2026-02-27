export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { amount, userEmail } = req.body;

    if (!amount || !userEmail) {
      return res.status(400).json({ error: "Missing amount or userEmail" });
    }

    // --- Supabase REST API info ---
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const USERS_TABLE = "users"; // replace with your table name if different

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: "Supabase env vars missing" });
    }

    // --- Step 1: Get user from Supabase ---
    const userResp = await fetch(`${SUPABASE_URL}/rest/v1/${USERS_TABLE}?email=eq.${encodeURIComponent(userEmail)}`, {
      method: "GET",
      headers: {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation"
      }
    });

    const users = await userResp.json();

    if (!users || users.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = users[0];

    // --- Step 2: Update balance ---
    const newBalance = parseFloat(user.balance || 0) + parseFloat(amount);

    const updateResp = await fetch(`${SUPABASE_URL}/rest/v1/${USERS_TABLE}?id=eq.${user.id}`, {
      method: "PATCH",
      headers: {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation"
      },
      body: JSON.stringify({ balance: newBalance })
    });

    const updatedUser = await updateResp.json();

    return res.status(200).json({
      message: "Deposit successful",
      newBalance,
      updatedUser
    });

  } catch (err) {
    console.error("Wallet API error:", err);
    return res.status(500).json({ error: "Error connecting to wallet API" });
  }
      }
