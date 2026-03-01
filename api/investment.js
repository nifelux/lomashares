export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_KEY) {
      return res.status(500).json({
        error: "Missing env vars",
        needs: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]
      });
    }

    const headers = {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json"
    };

    // ============================
    // Banner Plans (exact numbers)
    // ============================
    const PLANS = [
      { id: 1, invest: 3000, daily: 200, total30: 6000 },
      { id: 2, invest: 5000, daily: 333, total30: 10000 },
      { id: 3, invest: 10000, daily: 667, total30: 20000 },
      { id: 4, invest: 30000, daily: 2000, total30: 60000 },
      { id: 5, invest: 100000, daily: 8333, total30: 200000 },
      { id: 6, invest: 200000, daily: 16333, total30: 400000 },
      { id: 7, invest: 300000, daily: 20000, total30: 600000 },
      { id: 8, invest: 400000, daily: 26667, total30: 1000000 },
      { id: 9, invest: 500000, daily: 33333, total30: 1750000 },
      { id: 10, invest: 1000000, daily: 66667, total30: 2000000 }
    ];

    // ============================
    // Request body
    // ============================
    const body = req.body || {};
    const email = String(body.email || "").trim().toLowerCase();
    const plan_id = Number(body.plan_id);
    const referral_code_raw = String(body.referral_code || "").trim();
    const referral_code = referral_code_raw ? referral_code_raw.toUpperCase() : null;

    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "Valid email required" });
    }
    if (!plan_id || plan_id < 1 || plan_id > 10) {
      return res.status(400).json({ error: "Invalid plan_id (1 - 10)" });
    }

    const plan = PLANS.find(p => p.id === plan_id);
    if (!plan) return res.status(400).json({ error: "Plan not found" });

    // ============================
    // 1) Find user profile by email
    // Requires public.profiles with (id, email, referral_code)
    // ============================
    const profUrl =
      `${SUPABASE_URL}/rest/v1/profiles?select=id,email,referral_code` +
      `&email=eq.${encodeURIComponent(email)}&limit=1`;

    const profRes = await fetch(profUrl, { headers });
    const profJson = await profRes.json();

    if (!profRes.ok) {
      return res.status(500).json({ error: "Profile query failed", details: profJson });
    }

    const profile = Array.isArray(profJson) ? profJson[0] : null;
    if (!profile?.id) {
      return res.status(404).json({ error: "User not found (profiles)", email });
    }

    const user_id = profile.id;

    // ============================
    // 2) Fetch wallet
    // Requires public.wallets(user_id, balance)
    // ============================
    const walletUrl =
      `${SUPABASE_URL}/rest/v1/wallets?select=user_id,balance` +
      `&user_id=eq.${user_id}&limit=1`;

    const walletRes = await fetch(walletUrl, { headers });
    const walletJson = await walletRes.json();

    if (!walletRes.ok) {
      return res.status(500).json({ error: "Wallet query failed", details: walletJson });
    }

    const wallet = Array.isArray(walletJson) ? walletJson[0] : null;
    if (!wallet) {
      return res.status(400).json({ error: "Wallet not found for user" });
    }

    const balance = Number(wallet.balance || 0);
    if (balance < plan.invest) {
      return res.status(400).json({
        error: "Insufficient balance",
        balance,
        required: plan.invest
      });
    }

    // ============================
    // 3) Enforce max 2 per plan lifetime
    // Requires investments.plan_id
    // ============================
    const countUrl =
      `${SUPABASE_URL}/rest/v1/investments?select=id` +
      `&user_id=eq.${user_id}&plan_id=eq.${plan_id}`;

    const countRes = await fetch(countUrl, { headers });
    const countJson = await countRes.json();

    if (!countRes.ok) {
      return res.status(500).json({ error: "Investment count failed", details: countJson });
    }

    const investedTimes = Array.isArray(countJson) ? countJson.length : 0;
    if (investedTimes >= 2) {
      return res.status(400).json({
        error: "Limit reached: max 2 investments per plan lifetime"
      });
    }

    // ============================
    // 4) Deduct wallet balance
    // ============================
    const new_balance = balance - plan.invest;

    const updWalletRes = await fetch(`${SUPABASE_URL}/rest/v1/wallets?user_id=eq.${user_id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        balance: new_balance,
        updated_at: new Date().toISOString()
      })
    });

    if (!updWalletRes.ok) {
      const raw = await updWalletRes.json().catch(() => ({}));
      return res.status(500).json({ error: "Failed to update wallet", details: raw });
    }

    // ============================
    // 5) Insert investment
    // Requires: investments(plan_id, daily_income, total_days, days_paid, last_paid_at)
    // ============================
    const start = new Date();
    const maturity = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);

    const invBody = {
      user_id,
      plan_id,
      amount: plan.invest,
      daily_income: plan.daily,
      total_days: 30,
      days_paid: 0,
      status: "active",
      start_date: start.toISOString(),
      last_paid_at: start.toISOString(),
      maturity_date: maturity.toISOString()
    };

    const invRes = await fetch(`${SUPABASE_URL}/rest/v1/investments`, {
      method: "POST",
      headers: { ...headers, Prefer: "return=representation" },
      body: JSON.stringify(invBody)
    });

    const invJson = await invRes.json();
    if (!invRes.ok) {
      return res.status(500).json({ error: "Investment insert failed", details: invJson });
    }

    const investmentRow = Array.isArray(invJson) ? invJson[0] : invJson;

    // ============================
    // 6) Log transaction (investment debit)
    // ============================
    await fetch(`${SUPABASE_URL}/rest/v1/transactions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        user_id,
        type: "investment",
        amount: plan.invest,
        status: "success",
        reference: `INV:${investmentRow.id}`
      })
    }).catch(() => {});

    // ============================
    // 7) Referral bonus (optional)
    // Sponsor earns 10% of invested amount
    // referral_code should match sponsor profiles.referral_code
    // ============================
    let sponsorPaid = false;
    let sponsorBonus = 0;

    if (referral_code) {
      const sponsorUrl =
        `${SUPABASE_URL}/rest/v1/profiles?select=id,referral_code` +
        `&referral_code=eq.${encodeURIComponent(referral_code)}&limit=1`;

      const sponsorRes = await fetch(sponsorUrl, { headers });
      const sponsorJson = await sponsorRes.json();

      const sponsor = Array.isArray(sponsorJson) ? sponsorJson[0] : null;

      // Sponsor must exist and not be same user
      if (sponsorRes.ok && sponsor?.id && sponsor.id !== user_id) {
        sponsorBonus = plan.invest * 0.10;

        // fetch sponsor wallet
        const sWalletRes = await fetch(
          `${SUPABASE_URL}/rest/v1/wallets?select=user_id,balance&user_id=eq.${sponsor.id}&limit=1`,
          { headers }
        );
        const sWalletJson = await sWalletRes.json();
        const sWallet = Array.isArray(sWalletJson) ? sWalletJson[0] : null;

        if (sWallet) {
          // credit sponsor
          await fetch(`${SUPABASE_URL}/rest/v1/wallets?user_id=eq.${sponsor.id}`, {
            method: "PATCH",
            headers,
            body: JSON.stringify({
              balance: Number(sWallet.balance || 0) + sponsorBonus,
              updated_at: new Date().toISOString()
            })
          });

          // log referral transaction
          await fetch(`${SUPABASE_URL}/rest/v1/transactions`, {
            method: "POST",
            headers,
            body: JSON.stringify({
              user_id: sponsor.id,
              type: "referral_bonus",
              amount: sponsorBonus,
              status: "success",
              reference: `REFBONUS:${investmentRow.id}`
            })
          }).catch(() => {});

          sponsorPaid = true;
        }
      }
    }

    // ============================
    // Response
    // ============================
    return res.status(200).json({
      ok: true,
      message: "Investment created",
      plan: { id: plan_id, invest: plan.invest, daily: plan.daily, total30: plan.total30 },
      investment: investmentRow,
      wallet: { before: balance, after: new_balance },
      referral: {
        used_code: referral_code,
        sponsor_paid: sponsorPaid,
        bonus_amount: sponsorBonus
      }
    });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Server error" });
  }
       }
