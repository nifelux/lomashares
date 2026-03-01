export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: "Missing email" });

    const safeEmail = String(email).trim().toLowerCase();

    // Get profile -> auth user id
    const pRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?select=id,email&email=eq.${encodeURIComponent(safeEmail)}`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
    );
    const проф = await pRes.json();
    if (!pRes.ok) return res.status(500).json({ error: "Profiles query failed", details: проф });

    const profile = проф?.[0];
    if (!profile?.id) return res.status(404).json({ error: "User not found" });

    // Get wallet balance
    const wRes = await fetch(
      `${SUPABASE_URL}/rest/v1/wallets?select=balance&user_id=eq.${profile.id}`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
    );
    const w = await wRes.json();
    if (!wRes.ok) return res.status(500).json({ error: "Wallet query failed", details: w });

    return res.status(200).json({ balance: Number(w?.[0]?.balance || 0) });
  } catch (e) {
    return res.status(500).json({ error: "Server error", message: String(e?.message || e) });
  }
      }
