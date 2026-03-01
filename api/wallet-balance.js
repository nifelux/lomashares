export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_KEY) {
      return res.status(500).json({ error: "Missing Supabase env keys" });
    }

    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: "Missing email" });

    const safeEmail = String(email).trim().toLowerCase();

    // 1) Find user id from users table
    const userRes = await fetch(
      `${SUPABASE_URL}/rest/v1/users?select=id,email&email=eq.${encodeURIComponent(safeEmail)}`,
      {
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const users = await userRes.json();
    if (!userRes.ok) {
      return res.status(500).json({ error: "Users query failed", details: users });
    }

    const user = users?.[0];
    if (!user?.id) return res.status(404).json({ error: "User not found" });

    // 2) Get wallet balance from wallets table
    const walletRes = await fetch(
      `${SUPABASE_URL}/rest/v1/wallets?select=balance&user_id=eq.${user.id}`,
      {
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const wallets = await walletRes.json();
    if (!walletRes.ok) {
      return res.status(500).json({ error: "Wallet query failed", details: wallets });
    }

    const wallet = wallets?.[0];
    const balance = Number(wallet?.balance || 0);

    return res.status(200).json({ balance });
  } catch (err) {
    return res.status(500).json({ error: "Server crash", message: String(err?.message || err) });
  }
  }
