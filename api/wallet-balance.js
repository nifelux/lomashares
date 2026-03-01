export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_KEY) {
      return res.status(500).json({ error: "Missing Supabase environment variables" });
    }

    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const safeEmail = String(email).trim().toLowerCase();

    // 1️⃣ Get user ID from profiles table
    const profileRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?select=id,email&email=eq.${encodeURIComponent(safeEmail)}`,
      {
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const profileData = await profileRes.json();

    if (!profileRes.ok) {
      return res.status(500).json({ error: "Profile query failed", details: profileData });
    }

    const profile = profileData?.[0];
    if (!profile?.id) {
      return res.status(404).json({ error: "User not found" });
    }

    // 2️⃣ Get wallet balance
    const walletRes = await fetch(
      `${SUPABASE_URL}/rest/v1/wallets?select=balance&user_id=eq.${profile.id}`,
      {
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const walletData = await walletRes.json();

    if (!walletRes.ok) {
      return res.status(500).json({ error: "Wallet query failed", details: walletData });
    }

    const balance = Number(walletData?.[0]?.balance || 0);

    return res.status(200).json({ balance });

  } catch (err) {
    return res.status(500).json({
      error: "Server error",
      message: err?.message || String(err),
    });
  }
        }
