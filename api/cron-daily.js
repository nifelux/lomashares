export default async function handler(req, res) {
  try {
    // Optional security: allow only Vercel Cron calls
    // If you set CRON_SECRET in Vercel env, enable this:
    const CRON_SECRET = process.env.CRON_SECRET;
    if (CRON_SECRET) {
      const got = req.headers["x-cron-secret"];
      if (got !== CRON_SECRET) return res.status(401).json({ error: "Unauthorized" });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_KEY) {
      return res.status(500).json({ error: "Missing Supabase env vars" });
    }

    const rpcUrl = `${SUPABASE_URL}/rest/v1/rpc/run_daily_payouts`;

    const r = await fetch(rpcUrl, {
      method: "POST",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}), // uses default now()
    });

    const data = await r.json();
    if (!r.ok) return res.status(500).json({ error: "RPC failed", raw: data });

    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message || "Server error" });
  }
                                   }
